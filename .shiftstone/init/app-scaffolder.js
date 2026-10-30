/**
 * ShiftStone Initializer v3.0 — Application Domain Scaffolding Engine (Unit U16)
 *
 * Scaffolds application domain infrastructure in `apps/web/`:
 *   1. Application Stylesheet Synchronization (LOCK-INIT3-15): injects living brand tokens into `globals.css`.
 *   2. Initial SQL Migration: generates valid PostgreSQL DDL with tables, indexes, and RLS policies.
 *   3. TypeScript Database Types: generates `app/types/database.types.ts`.
 *   4. Environment Variable Synchronization (LOCK-INIT3-16): updates `.env.example` & Devops docs.
 *   5. Package Dependency Ingestion: adds researched service SDKs to `package.json`.
 *
 * Traceability:
 *   - REQ-INIT3-16, LOCK-INIT3-12, LOCK-INIT3-15, LOCK-INIT3-16
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { syncApplicationStylesheet } from './brand-generator.js';

/**
 * Service registry mapping integration names to SDK packages and required environment variables.
 */
export const KNOWN_SERVICES = {
  dodopayments: {
    name: 'Dodo Payments',
    packages: {
      '@dodopayments/dodopayments': '^1.0.0',
      standardwebhooks: '^1.0.0',
    },
    envKeys: [
      'DODO_PAYMENTS_API_KEY',
      'DODO_PAYMENTS_WEBHOOK_SECRET',
    ],
  },
  'dodo-payments': {
    name: 'Dodo Payments',
    packages: {
      '@dodopayments/dodopayments': '^1.0.0',
      standardwebhooks: '^1.0.0',
    },
    envKeys: [
      'DODO_PAYMENTS_API_KEY',
      'DODO_PAYMENTS_WEBHOOK_SECRET',
    ],
  },
  qstash: {
    name: 'Upstash QStash',
    packages: {
      '@upstash/qstash': '^2.7.0',
    },
    envKeys: [
      'QSTASH_TOKEN',
      'QSTASH_CURRENT_SIGNING_KEY',
      'QSTASH_NEXT_SIGNING_KEY',
    ],
  },
  'upstash-qstash': {
    name: 'Upstash QStash',
    packages: {
      '@upstash/qstash': '^2.7.0',
    },
    envKeys: [
      'QSTASH_TOKEN',
      'QSTASH_CURRENT_SIGNING_KEY',
      'QSTASH_NEXT_SIGNING_KEY',
    ],
  },
  'cloudflare-r2': {
    name: 'Cloudflare R2 Storage',
    packages: {
      '@aws-sdk/client-s3': '^3.500.0',
    },
    envKeys: [
      'CLOUDFLARE_R2_ACCOUNT_ID',
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
      'CLOUDFLARE_R2_BUCKET_NAME',
    ],
  },
  resend: {
    name: 'Resend Email',
    packages: {
      resend: '^3.2.0',
    },
    envKeys: [
      'RESEND_API_KEY',
    ],
  },
};

/**
 * Standard baseline environment variables for Supabase full-stack apps.
 */
export const BASELINE_ENV_KEYS = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_APP_URL',
];

/**
 * Baseline environment variables specifically tailored for React Router 8 + Cloudflare Workers.
 * Conforms to workerd/Vite runtime (.dev.vars) and @supabase/ssr without Next.js NEXT_PUBLIC_* prefixes.
 */
export const RR8_BASELINE_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DATABASE_URL',
  'DIRECT_URL',
];

/**
 * Formats a 14-digit migration timestamp (YYYYMMDDHHMMSS).
 */
export function formatMigrationTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

/**
 * Scans research dossiers in `docs/research/` to extract declared packages and environment keys.
 */
export function extractResearchFindings(root = process.cwd()) {
  const researchDir = path.join(root, 'docs', 'research');
  const result = {
    services: [],
    packages: {},
    envKeys: new Set(),
  };

  if (!existsSync(researchDir)) {
    return {
      services: [],
      packages: {},
      envKeys: [],
    };
  }

  const entries = readdirSync(researchDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) {
      continue;
    }

    const topic = entry.name;
    const implFile = path.join(researchDir, topic, '05-IMPLEMENTATION.md');
    const briefFile = path.join(researchDir, topic, '00-BRIEF.md');

    let text = '';
    if (existsSync(implFile)) {
      text += readFileSync(implFile, 'utf8');
    }
    if (existsSync(briefFile)) {
      text += '\n' + readFileSync(briefFile, 'utf8');
    }

    if (!text) continue;

    result.services.push(topic);

    // Check against known services
    const matchedService = Object.keys(KNOWN_SERVICES).find(
      (k) => topic.toLowerCase().includes(k) || k.includes(topic.toLowerCase())
    );
    if (matchedService) {
      const def = KNOWN_SERVICES[matchedService];
      Object.assign(result.packages, def.packages);
      def.envKeys.forEach((k) => result.envKeys.add(k));
    }

    // Extract any uppercase environment keys: [A-Z0-9_]{3,}_(?:KEY|SECRET|TOKEN|URL|ID)
    const envRegex = /\b([A-Z0-9_]{3,}(?:_KEY|_SECRET|_TOKEN|_URL|_ID|_NAME))\b/g;
    let match;
    while ((match = envRegex.exec(text)) !== null) {
      const key = match[1];
      if (!key.startsWith('GIT_') && !key.startsWith('NODE_')) {
        result.envKeys.add(key);
      }
    }
  }

  return {
    services: result.services,
    packages: result.packages,
    envKeys: Array.from(result.envKeys),
  };
}

/**
 * Synthesizes valid PostgreSQL DDL with table schemas, constraints, indexes, and RLS policies.
 */
export function synthesizeInitialMigration(context = {}) {
  const entities = context.entities || context.domain_entities?.entities || [];
  const projectName = context.projectName || 'ShiftStone App';

  let sql = `-- =============================================================================
-- Migration: Initial Schema Definition for ${projectName}
-- Generated by ShiftStone Initializer v3.0 (Unit U16 / REQ-INIT3-16)
-- Conforms to Row Level Security (RLS) and Tenant Isolation Standards
-- =============================================================================

-- Enable required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Core Authentication & Multi-Tenant Entities
-- -----------------------------------------------------------------------------

-- Workspaces table (Root isolation boundary)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (Mirrors Supabase auth.users & aligns with React Router 8 starter)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  display_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workspace memberships
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- Attach updated_at triggers
DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

  // Append domain entities
  const customTableNames = [];
  if (Array.isArray(entities) && entities.length > 0) {
    for (const ent of entities) {
      const rawName = typeof ent === 'string' ? ent : ent.name || ent.tableName;
      if (!rawName) continue;
      const tableName = rawName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
      if (['workspaces', 'profiles', 'workspace_members'].includes(tableName)) continue;

      customTableNames.push(tableName);
      sql += `\n-- -----------------------------------------------------------------------------
-- Domain Entity: ${rawName}
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.${tableName} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${tableName}_workspace ON public.${tableName}(workspace_id);

DROP TRIGGER IF EXISTS trg_${tableName}_updated_at ON public.${tableName};
CREATE TRIGGER trg_${tableName}_updated_at
  BEFORE UPDATE ON public.${tableName}
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;
    }
  }

  // Row Level Security (RLS) section
  sql += `\n-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and manage their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Workspaces: Members can select workspaces they belong to
CREATE POLICY "workspaces_select_member"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Workspace Members: Members can view team members in same workspace
CREATE POLICY "workspace_members_select"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
    )
  );
`;

  // Custom entity RLS
  for (const tName of customTableNames) {
    sql += `\nALTER TABLE public.${tName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "${tName}_select_workspace_member"
  ON public.${tName} FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ${tName}.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "${tName}_insert_workspace_member"
  ON public.${tName} FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ${tName}.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "${tName}_update_workspace_member"
  ON public.${tName} FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ${tName}.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "${tName}_delete_workspace_admin"
  ON public.${tName} FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ${tName}.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );
`;
  }

  return {
    sql,
    tableNames: ['workspaces', 'profiles', 'workspace_members', ...customTableNames],
  };
}

/**
 * Generates TypeScript type definitions mirroring database tables.
 */
export function generateDatabaseTypes(tableNames = ['workspaces', 'profiles', 'workspace_members']) {
  return `/**
 * Supabase Database Type Definitions
 * Generated by ShiftStone Initializer v3.0 (Unit U16 / REQ-INIT3-16)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
${tableNames
  .map((name) => {
    if (name === 'profiles') {
      return `      profiles: {
        Row: {
          id: string;
          email: string;
          role: 'user' | 'admin';
          display_name: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at: string;
          updated_at: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Insert: {
          id: string;
          email: string;
          role?: 'user' | 'admin';
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'user' | 'admin';
          display_name?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Relationships: [];
      };`;
    }
    return `      ${name}: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          [key: string]: Json | string | number | boolean | null | undefined;
        };
        Relationships: [];
      };`;
  })
  .join('\n')}
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
`;
}

/**
 * Updates application .env.example, .dev.vars.example (for Cloudflare Workers / RR8), and docs/bible/ environments documentation.
 */
export function syncEnvironmentVariables(appPath, envKeys = [], root = process.cwd(), archetype = null) {
  const isRR8 =
    archetype === 'rr8-supabase-cf' ||
    existsSync(path.join(appPath, 'wrangler.jsonc')) ||
    existsSync(path.join(appPath, '.dev.vars.example')) ||
    existsSync(path.join(appPath, 'react-router.config.ts'));

  const baseKeys = isRR8 ? RR8_BASELINE_ENV_KEYS : BASELINE_ENV_KEYS;
  const allKeys = Array.from(new Set([...baseKeys, ...envKeys]));

  const envExamplePath = path.join(appPath, '.env.example');
  let content = existsSync(envExamplePath) ? readFileSync(envExamplePath, 'utf8') : '';

  const lines = content.split('\n');
  const existingKeys = new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0].trim())
  );

  const missingKeys = allKeys.filter((k) => !existingKeys.has(k));

  if (missingKeys.length > 0) {
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += '\n# === ShiftStone Researched & Baseline Services ===\n';
    for (const key of missingKeys) {
      content += `${key}="your_${key.toLowerCase()}_here"\n`;
    }
    mkdirSync(path.dirname(envExamplePath), { recursive: true });
    writeFileSync(envExamplePath, content, 'utf8');
  }

  // If RR8 / Cloudflare Workers, synchronize .dev.vars.example and .dev.vars
  let devVarsCreated = false;
  if (isRR8) {
    const devVarsExamplePath = path.join(appPath, '.dev.vars.example');
    let devVarsContent = existsSync(devVarsExamplePath) ? readFileSync(devVarsExamplePath, 'utf8') : '';
    const devLines = devVarsContent.split('\n');
    const existingDevKeys = new Set(
      devLines
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.split('=')[0].trim())
    );
    const missingDevKeys = allKeys.filter((k) => !existingDevKeys.has(k));
    if (missingDevKeys.length > 0) {
      if (devVarsContent.length > 0 && !devVarsContent.endsWith('\n')) {
        devVarsContent += '\n';
      }
      devVarsContent += '\n# === ShiftStone Researched & Baseline Services ===\n';
      for (const key of missingDevKeys) {
        devVarsContent += `${key}="your_${key.toLowerCase()}_here"\n`;
      }
      writeFileSync(devVarsExamplePath, devVarsContent, 'utf8');
    }

    const devVarsPath = path.join(appPath, '.dev.vars');
    if (!existsSync(devVarsPath) && existsSync(devVarsExamplePath)) {
      writeFileSync(devVarsPath, devVarsContent, 'utf8');
      devVarsCreated = true;
    }
  }

  // Update docs/bible/02-setup-and-devops/environments-and-secrets.md if devops doc exists or can be created
  const bibleDevopsDir = path.join(root, 'docs', 'bible', '02-setup-and-devops');
  mkdirSync(bibleDevopsDir, { recursive: true });
  const bibleDocPath = path.join(bibleDevopsDir, 'environments-and-secrets.md');

  const docContent = `# Environments and Secrets Configuration

This chapter specifies the required environment variables and production secret provisionings for the application.

## Active Environment Variables Ledger

| Variable Key | Purpose | Required In |
|---|---|---|
${allKeys.map((k) => `| \`${k}\` | Configuration key for application runtime | Production, Staging, Local |`).join('\n')}

---

*Generated by ShiftStone Initializer v3.0 (Unit U16).*
`;
  writeFileSync(bibleDocPath, docContent, 'utf8');

  return {
    path: envExamplePath,
    allKeys,
    missingKeys,
    isRR8,
    devVarsCreated,
  };
}

/**
 * Synchronizes brand theme configuration in app/config/theme.ts for React Router 8.
 */
export function syncThemeConfig(appPath, brandContext = {}) {
  const themeConfigPath = path.join(appPath, 'app', 'config', 'theme.ts');
  if (!existsSync(themeConfigPath)) {
    return { skipped: true, reason: 'theme.ts not present' };
  }

  let content = readFileSync(themeConfigPath, 'utf8');
  let preset = brandContext.preset || brandContext.paletteId || brandContext.variation?.id || null;

  // Infer preset from brand colors or archetype if not explicitly set
  if (!preset && (brandContext.archetype || brandContext.primary)) {
    const arch = String(
      typeof brandContext.archetype === 'string'
        ? brandContext.archetype
        : brandContext.archetype?.primary || ''
    ).toLowerCase();
    if (arch.includes('ruler') || arch.includes('sage')) preset = 'tech-blue';
    else if (arch.includes('hero') || arch.includes('outlaw')) preset = 'signal';
    else if (arch.includes('explorer') || arch.includes('creator')) preset = 'tidal';
    else if (arch.includes('caregiver') || arch.includes('everyman')) preset = 'forest';
    else if (arch.includes('lover') || arch.includes('jester')) preset = 'terracotta';
    else if (arch.includes('magician')) preset = 'monochrome';
  }

  if (preset) {
    content = content.replace(
      /preset:\s*["'][^"']+["']/,
      `preset: "${preset}"`
    );
    writeFileSync(themeConfigPath, content, 'utf8');
    return { success: true, preset, path: themeConfigPath };
  }

  return { skipped: true, reason: 'no preset specified' };
}

/**
 * Scaffolds and registers domain entity routes in React Router 8 (app/routes.ts and app/routes/).
 */
export function syncApplicationRoutes(appPath, entities = []) {
  const routesFilePath = path.join(appPath, 'app', 'routes.ts');
  if (!existsSync(routesFilePath) || !Array.isArray(entities) || entities.length === 0) {
    return { skipped: true, reason: 'routes.ts not present or empty entities' };
  }

  let routesContent = readFileSync(routesFilePath, 'utf8');
  const routesDir = path.join(appPath, 'app', 'routes');
  const addedRoutes = [];

  for (const ent of entities) {
    const rawName = typeof ent === 'string' ? ent : ent.name || ent.tableName;
    if (!rawName) continue;
    const entitySlug = rawName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
    if (['workspaces', 'profiles', 'workspace-members'].includes(entitySlug)) continue;

    const entityNameUpper = entitySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');

    const routeFileName = `dashboard-${entitySlug}.tsx`;
    const routeFilePath = path.join(routesDir, routeFileName);

    // 1. Create route component if not exists
    if (!existsSync(routeFilePath)) {
      const componentContent = `import { useState } from "react";
import { Link } from "react-router";
import { Plus, Table as TableIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { supabaseContext } from "~/lib/supabase/context";
import { userContext } from "~/lib/context";
import type { Route } from "./+types/${entitySlug}";

export function meta() {
  return [{ title: "${entityNameUpper} — Dashboard" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const supabase = context.get(supabaseContext);
  const user = context.get(userContext);

  let items: any[] = [];
  if (supabase && user) {
    const { data } = await supabase
      .from("${entitySlug.replace(/-/g, '_')}")
      .select("*")
      .order("created_at", { ascending: false });
    items = data || [];
  }

  return { items, user };
}

export default function ${entityNameUpper}Page({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1">${entityNameUpper}</h1>
          <p className="text-sm text-muted-foreground">Manage and track your ${entitySlug} records.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span>New ${entityNameUpper.replace(/s$/, '')}</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TableIcon className="h-4 w-4" />
            <span>All ${entityNameUpper}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>No ${entitySlug} found yet. Create your first record above.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item: any) => (
                <li key={item.id} className="py-3 flex justify-between items-center">
                  <span className="font-medium text-foreground">{item.name || item.id}</span>
                  <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
`;
      mkdirSync(path.dirname(routeFilePath), { recursive: true });
      writeFileSync(routeFilePath, componentContent, 'utf8');
      addedRoutes.push(routeFileName);
    }

    // 2. Register route in app/routes.ts inside dashboard layout if not already present
    const routeRegistration = `route("dashboard/${entitySlug}", "routes/${routeFileName}")`;
    if (!routesContent.includes(routeRegistration) && !routesContent.includes(`dashboard/${entitySlug}`)) {
      const dashboardLayoutRegex = /(layout\("routes\/dashboard-layout\.tsx",\s*\[)([\s\S]*?)(\]\))/;
      if (dashboardLayoutRegex.test(routesContent)) {
        routesContent = routesContent.replace(
          dashboardLayoutRegex,
          `$1$2    ${routeRegistration},\n  $3`
        );
        writeFileSync(routesFilePath, routesContent, 'utf8');
      }
    }
  }

  return {
    success: true,
    addedRoutes,
  };
}

/**
 * Injects external service packages into apps/web/package.json dependencies.
 */
export function syncPackageDependencies(appPath, packages = {}) {
  const pkgPath = path.join(appPath, 'package.json');
  let pkg = {
    name: 'web-app',
    version: '0.1.0',
    private: true,
    dependencies: {},
  };

  if (existsSync(pkgPath)) {
    try {
      pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    } catch {
      // keep fallback
    }
  }

  pkg.dependencies = pkg.dependencies || {};

  // Default baseline packages
  if (!pkg.dependencies['@supabase/supabase-js']) {
    pkg.dependencies['@supabase/supabase-js'] = '^2.45.0';
  }

  for (const [name, version] of Object.entries(packages)) {
    pkg.dependencies[name] = version;
  }

  // Sort dependencies alphabetically
  const sortedDeps = {};
  for (const key of Object.keys(pkg.dependencies).sort()) {
    sortedDeps[key] = pkg.dependencies[key];
  }
  pkg.dependencies = sortedDeps;

  mkdirSync(path.dirname(pkgPath), { recursive: true });
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  return {
    path: pkgPath,
    dependencies: pkg.dependencies,
  };
}

/**
 * Main application domain scaffolding orchestrator.
 *
 * @param {Record<string, any>} context - Discovery and brand context.
 * @param {string} [appPath] - Relative or absolute path to the application directory.
 * @returns {Record<string, any>} Scaffold report.
 */
export function scaffoldApplicationDomain(context = {}, appPath = 'apps/web') {
  const root = context.root || process.cwd();
  const resolvedAppPath = path.isAbsolute(appPath) ? appPath : path.resolve(root, appPath);

  mkdirSync(resolvedAppPath, { recursive: true });

  // 1. Synchronize Application Stylesheet (globals.css) with active brand tokens (LOCK-INIT3-15)
  const stylesheetPath = path.join(resolvedAppPath, 'app', 'globals.css');
  let tokens = context.tokens;
  if (!tokens) {
    const brandTokensPath = path.join(root, 'docs', 'brand', 'brand-tokens.json');
    if (existsSync(brandTokensPath)) {
      try {
        tokens = JSON.parse(readFileSync(brandTokensPath, 'utf8'));
      } catch {
        tokens = {};
      }
    } else {
      tokens = {};
    }
  }

  // If globals.css contains legacy Facebook blue (#1877F2), purge it
  if (existsSync(stylesheetPath)) {
    let css = readFileSync(stylesheetPath, 'utf8');
    if (css.includes('#1877F2')) {
      css = css.replace(/#1877F2/g, 'var(--color-primary, oklch(0.62 0.22 260))');
      writeFileSync(stylesheetPath, css, 'utf8');
    }
  }

  const stylesheetResult = syncApplicationStylesheet(stylesheetPath, tokens);

  // 2. Initial SQL Migration
  const { sql, tableNames } = synthesizeInitialMigration(context);
  const migrationsDir = path.join(resolvedAppPath, 'supabase', 'migrations');
  mkdirSync(migrationsDir, { recursive: true });

  const timestamp = context.migrationTimestamp || formatMigrationTimestamp();
  const migrationFilename = `${timestamp}_init_schema.sql`;
  const migrationPath = path.join(migrationsDir, migrationFilename);
  writeFileSync(migrationPath, sql, 'utf8');

  // 3. TypeScript Database Types
  const typesDir = path.join(resolvedAppPath, 'app', 'types');
  mkdirSync(typesDir, { recursive: true });
  const typesPath = path.join(typesDir, 'database.types.ts');
  const typesContent = generateDatabaseTypes(tableNames);
  writeFileSync(typesPath, typesContent, 'utf8');

  // 4. Extract Research Dossier Findings & Ingest Packages/Env Keys
  const findings = extractResearchFindings(root);

  // Merge explicitly declared services in context
  const declaredServices = context.integrations?.services || context.services || [];
  for (const s of declaredServices) {
    const serviceName = typeof s === 'string' ? s : s.name;
    const matched = Object.keys(KNOWN_SERVICES).find(
      (k) => serviceName.toLowerCase().includes(k) || k.includes(serviceName.toLowerCase())
    );
    if (matched) {
      const def = KNOWN_SERVICES[matched];
      Object.assign(findings.packages, def.packages);
      def.envKeys.forEach((k) => {
        if (!findings.envKeys.includes(k)) findings.envKeys.push(k);
      });
    }
  }

  // Merge any context-provided packages or env keys
  if (context.packages) {
    Object.assign(findings.packages, context.packages);
  }
  if (Array.isArray(context.envKeys)) {
    for (const k of context.envKeys) {
      if (!findings.envKeys.includes(k)) findings.envKeys.push(k);
    }
  }

  // 5. Synchronize Environment Variables (.env.example, .dev.vars.example & Devops doc)
  const archetype = context.archetype || context.archetypes || null;
  const envResult = syncEnvironmentVariables(resolvedAppPath, findings.envKeys, root, archetype);

  // 6. Ingest Package Dependencies (package.json)
  const pkgResult = syncPackageDependencies(resolvedAppPath, findings.packages);

  // 7. Synchronize Theme Config (app/config/theme.ts)
  const themeResult = syncThemeConfig(resolvedAppPath, context);

  // 8. Scaffold and register domain entity routes (app/routes.ts and app/routes/)
  const entities = context.entities || context.domain_entities?.entities || [];
  const routesResult = syncApplicationRoutes(resolvedAppPath, entities);

  return {
    success: true,
    appPath: resolvedAppPath,
    stylesheet: stylesheetResult,
    theme: themeResult,
    routes: routesResult,
    migration: {
      path: migrationPath,
      filename: migrationFilename,
      tableNames,
      sql,
    },
    types: {
      path: typesPath,
      content: typesContent,
    },
    env: envResult,
    packages: pkgResult,
  };
}
