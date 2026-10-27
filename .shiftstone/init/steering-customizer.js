/**
 * Context-Aware Steering Customizer & Dynamic Drift Rules (REQ-INIT-09 / LOCK-INIT-08 / Phase 3 Unit U10)
 *
 * Dynamically synthesizes custom product.md, global.md, and bible-rules.md
 * based on elicited discovery data, active domain rules, and Bible taxonomy.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateTaxonomy } from './bible-topology.js';

export const STATIC_RULE_LINE_LIMIT = 120;

/**
 * Synthesizes product.md containing Product Thesis, Target Audience, Value Prop,
 * Stack Identity, and Goals vs Anti-Goals.
 *
 * @param {Record<string, any>} context Discovery and project context
 * @returns {string} Markdown content with YAML frontmatter
 */
export function generateProductRule(context = {}) {
  const projectName = context.projectName || context.name || 'ShiftStone Application';
  const valueProp = context.valueProp || context.valueProposition || 'High-velocity AI-native web application';
  const thesis = context.thesis || context.productThesis || `${projectName} solves core domain workflows with precision and edge-native performance.`;
  const targetAudience = context.targetAudience || context.personas || 'Developers, operational teams, and domain professionals.';
  const stack = context.stack || context.stackIdentity || 'React Router 8, Cloudflare Workers, Supabase PostgreSQL, Tailwind CSS v4';

  const goals = Array.isArray(context.goals) && context.goals.length > 0
    ? context.goals
    : [
        'Deliver sub-150ms P95 global page latency via Cloudflare edge isolates',
        'Enforce 100% Row-Level Security isolation across all tenant records',
        'Maintain zero-drift documentation with Red-First TDD verification',
      ];

  const antiGoals = Array.isArray(context.antiGoals) && context.antiGoals.length > 0
    ? context.antiGoals
    : [
        'Do NOT introduce heavy node-dependent runtime libraries that break Workers V8 isolates',
        'Do NOT bypass Row-Level Security using service role keys in user-facing endpoints',
        'Do NOT write application code in the workspace root or create monolithic documentation files',
      ];

  const appFolder = context.appPath || 'apps/web';

  const lines = [
    '---',
    'activation: always',
    '---',
    '',
    `# ${projectName} — Product & Workspace Identity`,
    '',
    `- **Product**: ${projectName} — ${valueProp}`,
    `- **Thesis**: ${thesis}`,
    `- **Target Audience**: ${targetAudience}`,
    `- **Stack Identity**: ${stack}`,
    '',
    '---',
    '',
    '## Core Goals vs Anti-Goals',
    '',
    '### Core Goals',
    ...goals.map((g) => `- ${g}`),
    '',
    '### Anti-Goals',
    ...antiGoals.map((ag) => `- ${ag}`),
    '',
    '---',
    '',
    '## Project Registry',
    '',
    '| Folder | Status | Rule |',
    '|---|---|---|',
    `| \`${appFolder}/\` | ACTIVE | Active application source code (React Router, Workers, Supabase) |`,
    '| `.shiftstone/` | ACTIVE | Framework engine: harness, context, governance, observability |',
    '| `docs/bible/` | ACTIVE — SSOT | Read before coding, update after coding |',
    '| `docs/plans/` | ACTIVE | Implementation plans and Stage Contracts |',
    '| `docs/backlog/` | ACTIVE | Actionable task backlogs and user stories |',
  ];

  return lines.join('\n') + '\n';
}

/**
 * Synthesizes global.md incorporating domain rules, isolation invariants,
 * and dispatch routing.
 *
 * @param {Record<string, any>} context Discovery context
 * @returns {string} Markdown content with YAML frontmatter
 */
export function generateGlobalRule(context = {}) {
  const projectName = context.projectName || context.name || 'ShiftStone';
  const domainRules = Array.isArray(context.domainRules) && context.domainRules.length > 0
    ? context.domainRules
    : [
        'All domain mutations must execute inside atomic PostgreSQL transactions via RPC functions.',
        'Owner isolation: every resource entity must reference a valid tenant/user foreign key.',
      ];

  const isolationInvariants = Array.isArray(context.isolationInvariants) && context.isolationInvariants.length > 0
    ? context.isolationInvariants
    : [
        'Tenant data is isolated via Row-Level Security policies on every database table.',
        'Server secrets (SUPABASE_SECRET_KEY) are strictly forbidden from browser contexts.',
      ];

  const lines = [
    '---',
    'activation: always',
    '---',
    '',
    `# ${projectName} — Global Engineering Rules`,
    '',
    'Enforced on every single agent task. Read this file before acting on any request.',
    '',
    '---',
    '',
    '## Domain Rules & Invariants',
    '',
    '### Non-Negotiable Domain Invariants',
    ...domainRules.map((r) => `- ${r}`),
    '',
    '### Tenant Security & Isolation Invariants',
    ...isolationInvariants.map((i) => `- ${i}`),
    '',
    '---',
    '',
    '## Task → Rule File Dispatch',
    '',
    '| Task Type | Rule File to Read |',
    '|---|---|',
    '| Stack-specific code (React Router, Cloudflare, Supabase) | `.shiftstone/path-scoped-rules/stack-rules.md` |',
    '| Folder structure or file placement decisions | `.shiftstone/path-scoped-rules/structure.md` |',
    '| TypeScript quality, naming conventions, error handling | `.shiftstone/path-scoped-rules/code-quality.md` |',
    '| UI components, styling, design tokens | `.shiftstone/path-scoped-rules/ui-rules.md` |',
    '| Research, technology decisions, library selection | `.shiftstone/path-scoped-rules/research-rules.md` |',
    '| Bible updates, documentation, ADRs, changelog | `.shiftstone/path-scoped-rules/bible-rules.md` |',
    '| Workspace identity, project registry, hard rules | `.shiftstone/static-rules/product.md` |',
    '| Engagement mode / autonomy boundary | `docs/bible/MODE.md` |',
    '',
    '---',
    '',
    '## Mode Detection (Bible Update Checks)',
    '',
    '- **Research Mode**: files in `docs/research/` → verify `docs/research/README.md` is updated.',
    '- **Development Mode**: files in `apps/`, `.shiftstone/`, `packages/` → run `docs/bible/` check using `bible-rules.md`.',
    '- **Config/Workspace Mode**: files in `.agent/`, `.agents/`, `docs/plans/`, `docs/bugs/` → skip bible checks.',
  ];

  return lines.join('\n') + '\n';
}

/**
 * Dynamically generates bible-rules.md based on the active Bible taxonomy,
 * mapping source files in apps/<app>/ directly to corresponding modular Bible files.
 *
 * @param {object} [taxonomy] Active Bible taxonomy descriptor
 * @param {object} [options]
 * @returns {string} Markdown content with YAML frontmatter
 */
export function generateBibleRule(taxonomy, options = {}) {
  if (!taxonomy) {
    taxonomy = evaluateTaxonomy(options.context || {});
  }

  const appPath = options.appPath || 'apps/web';
  const isCli = taxonomy.productType === 'cli_devtool';

  // Build dynamic mapping rows based on active taxonomy chapters
  const mappingRows = [];

  // Architecture mapping
  mappingRows.push(
    `| Monorepo layout, runtime topology, edge memory | \`01-architecture/topology.md\` · \`operational-envelope.md\` |`,
  );

  // Setup & workflow
  mappingRows.push(
    `| Env vars, local secrets, pnpm build deps | \`02-setup-and-workflow/local-environment.md\` |`,
    `| Dev server, typegen, deployment scripts | \`02-setup-and-workflow/dev-workflow.md\` |`,
  );

  // Database
  if (taxonomy.chapters.some((c) => c.name === 'database')) {
    mappingRows.push(
      `| SQL schemas, DDL, table definitions (\`${appPath}/supabase/\`) | \`03-database/schema-reference.md\` |`,
      `| Row Level Security (RLS) policies | \`03-database/rls-policies.md\` |`,
      `| Database migration files, seeding | \`03-database/migrations.md\` |`,
    );
  }

  // Plugin architecture (for CLI)
  if (taxonomy.chapters.some((c) => c.name === 'plugin-architecture')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'plugin-architecture');
    mappingRows.push(
      `| Plugin hooks, extensibility points (\`${appPath}/plugins/\`) | \`${chap.slug}/plugin-lifecycle.md\` · \`hook-system.md\` |`,
    );
  }

  // Auth & RBAC
  if (taxonomy.chapters.some((c) => c.name === 'auth-and-rbac')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'auth-and-rbac');
    mappingRows.push(
      `| Auth providers, OTP, session handling (\`${appPath}/app/lib/auth/\`) | \`${chap.slug}/identity-providers.md\` |`,
      `| User roles, permission matrices, admin routes | \`${chap.slug}/permissions-matrix.md\` |`,
      `| Route guards, auth middleware (\`${appPath}/app/middleware/\`) | \`${chap.slug}/route-guards.md\` |`,
    );
  }

  // Core Systems
  if (taxonomy.chapters.some((c) => c.name === 'core-systems')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'core-systems');
    mappingRows.push(
      `| Domain invariants, transactional RPCs (\`${appPath}/app/domain/\`) | \`${chap.slug}/domain-invariants.md\` |`,
      `| Entity lifecycle state machines | \`${chap.slug}/state-machines.md\` |`,
      `| ActionResult types, error taxonomy | \`${chap.slug}/error-taxonomy.md\` |`,
    );
  }

  // Vector storage (AI/RAG)
  if (taxonomy.chapters.some((c) => c.name === 'vector-storage-and-embeddings')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'vector-storage-and-embeddings');
    mappingRows.push(
      `| Vector index schemas, embeddings, pgvector | \`${chap.slug}/vector-index-schemas.md\` · \`similarity-search.md\` |`,
    );
  }

  // Prompt chains (AI/RAG)
  if (taxonomy.chapters.some((c) => c.name === 'evals-and-prompt-chains')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'evals-and-prompt-chains');
    mappingRows.push(
      `| Prompt orchestration, model evals | \`${chap.slug}/eval-benchmarks.md\` · \`prompt-orchestration.md\` |`,
    );
  }

  // Integrations
  if (taxonomy.chapters.some((c) => c.name === 'integrations')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'integrations');
    mappingRows.push(
      `| Cloudflare R2 storage, Cron scheduled workers | \`${chap.slug}/third-party-services.md\` |`,
      `| Ingress webhooks, signature verification (\`${appPath}/app/routes/api.webhooks.ts\`) | \`${chap.slug}/webhooks.md\` |`,
    );
  }

  // Frontend
  if (taxonomy.chapters.some((c) => c.name === 'frontend')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'frontend');
    mappingRows.push(
      `| Tailwind v4 tokens, themes (\`${appPath}/app/globals.css\`) | \`${chap.slug}/design-tokens.md\` |`,
      `| Nested route tree, layouts (\`${appPath}/app/routes.ts\`) | \`${chap.slug}/route-hierarchy.md\` |`,
      `| shadcn/ui components (\`${appPath}/app/components/ui/\`) | \`${chap.slug}/component-standards.md\` |`,
    );
  }

  // CLI commands (for CLI)
  if (taxonomy.chapters.some((c) => c.name === 'cli-commands-and-flags')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'cli-commands-and-flags');
    mappingRows.push(
      `| CLI commands, flags, arguments (\`${appPath}/commands/\`) | \`${chap.slug}/command-reference.md\` · \`flags-and-arguments.md\` |`,
    );
  }

  // API Contracts
  if (taxonomy.chapters.some((c) => c.name === 'api-contracts')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'api-contracts');
    mappingRows.push(
      `| Route actions, form mutations, Zod schemas | \`${chap.slug}/route-actions.md\` |`,
      `| Route loaders, data fetching, resource routes | \`${chap.slug}/route-loaders.md\` |`,
    );
  }

  // Compliance (for Fintech)
  if (taxonomy.chapters.some((c) => c.name === 'compliance-and-ledger')) {
    const chap = taxonomy.chapters.find((c) => c.name === 'compliance-and-ledger');
    mappingRows.push(
      `| Ledger models, double-entry accounting | \`${chap.slug}/ledger-model.md\` |`,
    );
  }

  // Global mappings
  mappingRows.push(
    `| Architecture decision made | \`docs/decisions/\` → \`DECISIONS.md\` |`,
    `| Any shipped feature or bug fix | \`log.md\` row → compiled into \`CHANGELOG.md\` |`,
  );

  const lines = [
    '---',
    'activation: always',
    '---',
    '',
    '# ShiftStone — Bible Rules',
    '',
    '---',
    '',
    '## Mode Detection',
    '',
    'Before any `docs/bible/` update check, identify the current mode from the file path being written:',
    '',
    '| File Path Prefix | Mode | Action |',
    '|---|---|---|',
    `| \`${appPath}/\`, \`.shiftstone/\`, \`packages/\` | Development Mode | Run full \`docs/bible/\` check using mapping table below |`,
    '| `docs/research/` | Research Mode | Skip `docs/bible/` checks; verify `docs/research/README.md` index is updated |',
    '| `docs/bible/` | Direct Bible Edit | Skip — bible is already being updated |',
    '| `.agent/`, `.agents/`, `.claude/`, `.opencode/` | Config Mode | Skip — no `docs/bible/` update needed |',
    '| `docs/bugs/`, `docs/plans/`, `docs/reports/` | Docs Artifact | Skip — no `docs/bible/` update needed |',
    '',
    '---',
    '',
    '## Change → docs/bible/ Mapping Table',
    '',
    'Use this table in Development Mode to identify which `docs/bible/` file(s) to update:',
    '',
    '| Change Type | docs/bible/ File to Update |',
    '|---|---|',
    ...mappingRows,
    '',
    '---',
    '',
    '## ADR Format',
    '',
    'Every architecture decision gets an OKF file in `docs/decisions/DEC-XXX-<slug>.md` compiled into `docs/bible/DECISIONS.md`.',
    '',
    '---',
    '',
    '## Changelog Entry Format',
    '',
    'Every shipped change is recorded as an append-only `log.md` row and compiled into `docs/bible/CHANGELOG.md` via `node .shiftstone/scripts/compile-changelog.js`.',
    '',
    '---',
    '',
    '## Core Bible Rules',
    '',
    '- ALWAYS read `docs/bible/README.md` before starting any framework feature.',
    '- ALWAYS update the relevant modular `docs/bible/` file after any code change.',
    '- Research findings MUST be saved to `docs/research/` — never inline in `docs/bible/`.',
  ];

  return lines.join('\n') + '\n';
}

/**
 * Applies custom steering rules to a target workspace.
 *
 * @param {string} root Target workspace root
 * @param {object} context Discovery context
 * @param {object} [taxonomy] Evaluated Bible taxonomy
 * @param {object} [options]
 * @returns {object} Write result
 */
export function applySteeringCustomization(root, context, taxonomy, options = {}) {
  if (!taxonomy) {
    taxonomy = evaluateTaxonomy(context || {});
  }

  const staticRulesDir = path.join(root, '.shiftstone', 'static-rules');
  const pathRulesDir = path.join(root, '.shiftstone', 'path-scoped-rules');
  mkdirSync(staticRulesDir, { recursive: true });
  mkdirSync(pathRulesDir, { recursive: true });

  const productContent = generateProductRule(context);
  const globalContent = generateGlobalRule(context);
  const bibleRuleContent = generateBibleRule(taxonomy, { ...options, appPath: context?.appPath });

  const productPath = path.join(staticRulesDir, 'product.md');
  const globalPath = path.join(staticRulesDir, 'global.md');
  const bibleRulePath = path.join(pathRulesDir, 'bible-rules.md');

  writeFileSync(productPath, productContent, 'utf8');
  writeFileSync(globalPath, globalContent, 'utf8');
  writeFileSync(bibleRulePath, bibleRuleContent, 'utf8');

  return {
    success: true,
    paths: {
      product: productPath,
      global: globalPath,
      bibleRules: bibleRulePath,
    },
  };
}
