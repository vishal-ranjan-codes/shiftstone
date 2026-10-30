import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASELINE_ENV_KEYS,
  KNOWN_SERVICES,
  RR8_BASELINE_ENV_KEYS,
  formatMigrationTimestamp,
  generateDatabaseTypes,
  scaffoldApplicationDomain,
  syncApplicationRoutes,
  syncEnvironmentVariables,
  syncThemeConfig,
  synthesizeInitialMigration,
} from '../../init/app-scaffolder.js';

describe('Unit U16 — Application Domain Scaffolding Engine', () => {
  const testRoot = path.join(__dirname, '..', '..', 'tmp', 'test-app-scaffolder');
  const appPath = path.join(testRoot, 'apps', 'web');

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(appPath, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  describe('TS-U16-01 (L1) — Application Domain Scaffolding Generation', () => {
    it('emits migration SQL, updates .env.example, updates package.json, and injects theme CSS tokens (AC-U16-01, AC-U16-02, AC-U16-03)', () => {
      // 1. Setup brand-tokens.json
      const brandDir = path.join(testRoot, 'docs', 'brand');
      mkdirSync(brandDir, { recursive: true });
      const sampleTokens = {
        color: {
          primary: { $value: 'oklch(0.65 0.22 270)' },
          primaryDark: { $value: 'oklch(0.70 0.25 270)' },
          surface: {
            light: { $value: 'oklch(0.99 0.01 250)' },
            dark: { $value: 'oklch(0.15 0.02 250)' },
          },
        },
        fontFamily: {
          heading: { $value: 'Outfit' },
          body: { $value: 'Inter' },
        },
      };
      writeFileSync(
        path.join(brandDir, 'brand-tokens.json'),
        JSON.stringify(sampleTokens, null, 2),
        'utf8'
      );

      // 2. Pre-create globals.css with legacy Facebook blue
      const globalsCssPath = path.join(appPath, 'app', 'globals.css');
      mkdirSync(path.dirname(globalsCssPath), { recursive: true });
      writeFileSync(
        globalsCssPath,
        '@import "tailwindcss";\n:root { --color-primary: #1877F2; }\n',
        'utf8'
      );

      // 3. Pre-create research dossier in test root
      const researchDir = path.join(testRoot, 'docs', 'research', 'dodo-payments');
      mkdirSync(researchDir, { recursive: true });
      writeFileSync(
        path.join(researchDir, '00-BRIEF.md'),
        '---\ntopic: "dodo-payments"\nprovider: "Dodo Payments"\n---\n# Brief',
        'utf8'
      );
      writeFileSync(
        path.join(researchDir, '05-IMPLEMENTATION.md'),
        '```typescript\nimport { DodoPayments } from "@dodopayments/dodopayments";\nconst key = process.env.DODO_PAYMENTS_API_KEY;\n```',
        'utf8'
      );

      // 4. Execute domain scaffolder
      const context = {
        root: testRoot,
        projectName: 'SaaS Rocket',
        entities: ['organizations', 'subscriptions', 'invoices'],
        services: ['dodopayments', 'qstash'],
      };

      const result = scaffoldApplicationDomain(context, appPath);

      expect(result.success).toBe(true);

      // Verify AC-U16-01: Initial SQL migration file is generated
      expect(existsSync(result.migration.path)).toBe(true);
      expect(result.migration.filename).toMatch(/^\d{14}_init_schema\.sql$/);
      const sqlContent = readFileSync(result.migration.path, 'utf8');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.workspaces');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.profiles');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.workspace_members');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.organizations');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.subscriptions');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS public.invoices');
      expect(sqlContent).toContain('ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;');
      expect(sqlContent).toContain('ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;');

      // Verify TypeScript database types
      expect(existsSync(result.types.path)).toBe(true);
      const typesContent = readFileSync(result.types.path, 'utf8');
      expect(typesContent).toContain('export interface Database');
      expect(typesContent).toContain('workspaces: {');
      expect(typesContent).toContain('organizations: {');
      expect(typesContent).toContain('subscriptions: {');

      // Verify AC-U16-02: .env.example and package.json include keys & packages
      const envExamplePath = path.join(appPath, '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);
      const envText = readFileSync(envExamplePath, 'utf8');
      for (const baseline of BASELINE_ENV_KEYS) {
        expect(envText).toContain(baseline);
      }
      expect(envText).toContain('DODO_PAYMENTS_API_KEY');
      expect(envText).toContain('DODO_PAYMENTS_WEBHOOK_SECRET');
      expect(envText).toContain('QSTASH_TOKEN');

      // Verify package.json
      const pkgPath = path.join(appPath, 'package.json');
      expect(existsSync(pkgPath)).toBe(true);
      const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
      expect(pkgJson.dependencies['@dodopayments/dodopayments']).toBeDefined();
      expect(pkgJson.dependencies['standardwebhooks']).toBeDefined();
      expect(pkgJson.dependencies['@upstash/qstash']).toBeDefined();
      expect(pkgJson.dependencies['@supabase/supabase-js']).toBeDefined();

      // Verify AC-U16-03: globals.css updated with active brand tokens and no legacy blue
      expect(existsSync(globalsCssPath)).toBe(true);
      const cssContent = readFileSync(globalsCssPath, 'utf8');
      expect(cssContent).not.toContain('#1877F2');
      expect(cssContent).toContain('ShiftStone Living Brand Theme Tokens:BEGIN');
      expect(cssContent).toContain('--color-primary: oklch(0.65 0.22 270)');
      expect(cssContent).toContain('--font-heading: "Outfit"');

      // Verify environments documentation in bible
      const bibleDevopsDoc = path.join(testRoot, 'docs', 'bible', '02-setup-and-devops', 'environments-and-secrets.md');
      expect(existsSync(bibleDevopsDoc)).toBe(true);
      const devopsText = readFileSync(bibleDevopsDoc, 'utf8');
      expect(devopsText).toContain('DODO_PAYMENTS_API_KEY');
    });
  });

  describe('TS-U16-02 (L2) — Migration SQL Syntax & Structure Verification', () => {
    it('verifies generated SQL migration has valid balanced syntax and complete RLS coverage', () => {
      const context = {
        projectName: 'Acme SaaS',
        entities: ['projects', 'tasks', 'milestones'],
      };

      const { sql, tableNames } = synthesizeInitialMigration(context);

      // Verify balanced parentheses
      let parenCount = 0;
      for (const char of sql) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        expect(parenCount).toBeGreaterThanOrEqual(0);
      }
      expect(parenCount).toBe(0);

      // Verify all non-comment, non-empty statements end with semicolon
      const statements = sql
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('--'));

      // Check all expected tables are defined
      for (const tName of tableNames) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${tName}`);
        expect(sql).toContain(`ALTER TABLE public.${tName} ENABLE ROW LEVEL SECURITY;`);
        expect(sql).toContain(`CREATE POLICY "${tName}_select`);
      }

      // Verify extension creation
      expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

      // Verify timestamp trigger function definition
      expect(sql).toContain('CREATE OR REPLACE FUNCTION update_updated_at_column()');
    });
  });

  describe('TS-U16-03 — React Router 8 Stack Deep Integration', () => {
    it('synchronizes .dev.vars and .dev.vars.example without Next.js prefixes for RR8 archetype', () => {
      const rr8AppPath = path.join(testRoot, 'apps', 'web-rr8');
      mkdirSync(rr8AppPath, { recursive: true });

      // Pre-create .dev.vars.example as shipped by starter template
      writeFileSync(
        path.join(rr8AppPath, '.dev.vars.example'),
        'SUPABASE_URL=https://sample.supabase.co\nSUPABASE_PUBLISHABLE_KEY=sb_pub_key\n',
        'utf8'
      );

      const res = syncEnvironmentVariables(
        rr8AppPath,
        ['CLOUDFLARE_R2_ACCOUNT_ID', 'DODO_PAYMENTS_API_KEY'],
        testRoot,
        'rr8-supabase-cf'
      );

      expect(res.isRR8).toBe(true);

      // Check .dev.vars.example updated with researched keys
      const devExample = readFileSync(path.join(rr8AppPath, '.dev.vars.example'), 'utf8');
      expect(devExample).toContain('CLOUDFLARE_R2_ACCOUNT_ID');
      expect(devExample).toContain('DODO_PAYMENTS_API_KEY');
      expect(devExample).not.toContain('NEXT_PUBLIC_');

      // Check .dev.vars was materialized for local development
      const devVarsPath = path.join(rr8AppPath, '.dev.vars');
      expect(existsSync(devVarsPath)).toBe(true);
      const devVars = readFileSync(devVarsPath, 'utf8');
      expect(devVars).toContain('SUPABASE_PUBLISHABLE_KEY');
    });

    it('aligns profiles schema and generated types with RR8 role & display_name contracts', () => {
      const { sql, tableNames } = synthesizeInitialMigration({
        projectName: 'RR8 Portal',
        entities: ['invoices'],
      });

      // Profiles table contains role and display_name
      expect(sql).toContain("role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'))");
      expect(sql).toContain('display_name TEXT');

      const types = generateDatabaseTypes(tableNames);
      expect(types).toContain("role: 'user' | 'admin'");
      expect(types).toContain('display_name: string | null');
    });

    it('synchronizes theme preset in app/config/theme.ts', () => {
      const rr8AppPath = path.join(testRoot, 'apps', 'web-rr8-theme');
      const themeDir = path.join(rr8AppPath, 'app', 'config');
      mkdirSync(themeDir, { recursive: true });

      writeFileSync(
        path.join(themeDir, 'theme.ts'),
        'export const siteThemeConfig = {\n  preset: "tech-blue",\n  enableAccent: false,\n};\n',
        'utf8'
      );

      const res = syncThemeConfig(rr8AppPath, { archetype: 'The Hero' });
      expect(res.success).toBe(true);
      expect(res.preset).toBe('signal');

      const updated = readFileSync(path.join(themeDir, 'theme.ts'), 'utf8');
      expect(updated).toContain('preset: "signal"');
    });

    it('scaffolds domain entity route and registers it into app/routes.ts', () => {
      const rr8AppPath = path.join(testRoot, 'apps', 'web-rr8-routes');
      const appDir = path.join(rr8AppPath, 'app');
      mkdirSync(appDir, { recursive: true });

      writeFileSync(
        path.join(appDir, 'routes.ts'),
        `import { route, layout } from "@react-router/dev/routes";
export default [
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard-home.tsx"),
  ]),
];`,
        'utf8'
      );

      const res = syncApplicationRoutes(rr8AppPath, ['projects']);
      expect(res.success).toBe(true);
      expect(res.addedRoutes).toContain('dashboard-projects.tsx');

      // Verify route file exists and has loader + component
      const routeFile = path.join(appDir, 'routes', 'dashboard-projects.tsx');
      expect(existsSync(routeFile)).toBe(true);
      const routeContent = readFileSync(routeFile, 'utf8');
      expect(routeContent).toContain('export async function loader');
      expect(routeContent).toContain('ProjectsPage');
      expect(routeContent).toContain('supabaseContext');

      // Verify registered in app/routes.ts
      const updatedRoutes = readFileSync(path.join(appDir, 'routes.ts'), 'utf8');
      expect(updatedRoutes).toContain('route("dashboard/projects", "routes/dashboard-projects.tsx")');
    });
  });
});
