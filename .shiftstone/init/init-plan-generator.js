/**
 * ShiftStone Initializer v3.0 — Tier 2 Workspace Initialization Plan Suite Generator (Unit U17)
 *
 * Writes a formal, machine-executable Tier 2 Multi-Phase Plan Suite to `docs/plans/workspace-initialization/`
 * directly from Discovery Context and Trait Matrix before any synthesis begins:
 *   1. CONTEXT.md (Stage Contract Brief)
 *   2. index.md (Master Plan Index & Dependency DAG)
 *   3. README.md (Managed Status Table & Execution Ledger)
 *   4. plan-manifest.json (plan-manifest/v1 machine execution graph)
 *   5. phase-1-product-prd-and-vision.md
 *   6. phase-2-app-scaffolding-and-theming.md
 *   7. phase-3-technical-bible-and-adrs.md
 *   8. phase-4-actionable-task-backlog.md
 *   9. phase-5-ai-steering-and-harness.md
 *
 * Traceability:
 *   - REQ-INIT3-17, LOCK-INIT3-18
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(
  __dirname,
  '../../.agents/skills/ss-init/resources/init-plan-templates'
);

/**
 * Reads a template file from the resource directory, or falls back to an empty string.
 */
function readTemplate(filename) {
  const fullPath = path.join(TEMPLATES_DIR, filename);
  if (existsSync(fullPath)) {
    return readFileSync(fullPath, 'utf8');
  }
  return '';
}

/**
 * Normalizes an array or string into clean markdown bullet items.
 */
function toBulletList(items, defaultText = 'None specified.') {
  if (!items || (Array.isArray(items) && items.length === 0)) {
    return `- ${defaultText}`;
  }
  if (typeof items === 'string') {
    return items.startsWith('-') ? items : `- ${items}`;
  }
  return items
    .map((item) => {
      if (typeof item === 'string') return `- ${item}`;
      if (item && typeof item === 'object') {
        const title = item.name || item.title || item.role || item.id || 'Item';
        const desc = item.description || item.goal || item.summary || '';
        return desc ? `- **${title}:** ${desc}` : `- **${title}**`;
      }
      return `- ${String(item)}`;
    })
    .join('\n');
}

/**
 * Compiles Master Initialization Brief (CONTEXT.md).
 */
export function compileInitializationBrief(context = {}, traitMatrix = {}, root = process.cwd()) {
  const c = context.context_data || context;
  const tm = traitMatrix || {};

  const projectName =
    c.projectName ||
    c.identity?.product_name ||
    tm.identity?.product_name ||
    'ShiftStone SaaS';

  const productThesis =
    c.productThesis ||
    c.identity?.thesis ||
    tm.identity?.thesis ||
    'Autonomous enterprise operations platform';

  const valueProposition =
    c.valueProp ||
    c.identity?.value_proposition ||
    tm.identity?.value_proposition ||
    'Empowers teams with autonomous code quality, bounded context, and verifiable governance.';

  const archetypes = c.archetype || tm.brand_preferences?.archetype || {
    primary: 'The Sage',
    secondary: 'The Ruler',
  };
  const primaryArchetype = typeof archetypes === 'string' ? archetypes : archetypes.primary || 'The Sage';
  const secondaryArchetype = typeof archetypes === 'object' ? archetypes.secondary || 'The Ruler' : 'The Ruler';

  const coreGoals = toBulletList(
    c.coreGoals || c.identity?.core_goals || tm.identity?.core_goals,
    'Deliver secure, multi-tenant workspace with production-grade reliability.'
  );

  const antiGoals = toBulletList(
    c.antiGoals || c.identity?.anti_goals || tm.identity?.anti_goals,
    'No unverified third-party libraries, no monolithic codebases, no unauthenticated routes.'
  );

  const personas = toBulletList(
    c.userPersonas || c.actors_roles?.personas || tm.actors_roles?.personas,
    'Operations Lead, Authenticated Workspace Member, System Administrator.'
  );

  const dataEntities = toBulletList(
    c.entities || c.domain_entities?.entities || tm.domain_entities?.entities,
    'Workspaces, Profiles, Memberships, Projects, Subscriptions.'
  );

  const businessInvariants = toBulletList(
    c.businessInvariants || c.domain_entities?.business_invariants || tm.domain_entities?.business_invariants,
    'Tenant data isolation is strictly enforced via Row Level Security (RLS) on every table.'
  );

  // Brand and tokens
  const tokens = c.tokens || {};
  const color = tokens.color || {};
  const font = tokens.fontFamily || {};

  const colorPrimary = color.primary?.$value || c.primary || 'oklch(0.62 0.22 260)';
  const colorPrimaryDark = color.primaryDark?.$value || c.primaryDark || 'oklch(0.68 0.24 260)';
  const colorSurfaceLight = color.surface?.light?.$value || c.surfaceLight || 'oklch(0.98 0.01 250)';
  const colorSurfaceDark = color.surface?.dark?.$value || c.surfaceDark || 'oklch(0.16 0.02 250)';
  const colorAccent = color.accent?.$value || c.accent || colorPrimary;

  const fontHeading = font.heading?.$value || 'Plus Jakarta Sans';
  const fontBody = font.body?.$value || 'Inter';
  const fontCode = font.mono?.$value || 'JetBrains Mono';

  // Researched services and env keys
  const services = c.integrations?.services || c.services || tm.integrations?.services || ['Supabase', 'Cloudflare Workers'];
  const researchedServices = toBulletList(
    services,
    'Supabase PostgreSQL Database, Cloudflare Workers Edge Handlers.'
  );

  const envKeys = c.envKeys || ['DATABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const envKeysLedger = envKeys
    .map((k) => `| \`${k}\` | Application runtime credential | Required in Production & Local |`)
    .join('\n');

  const appPath = c.appPath || 'apps/web';
  const rawPrdText =
    c.rawPrdText ||
    c.rawPrd ||
    c.prdText ||
    tm.rawPrd ||
    tm.rawPrdText ||
    'Extracted from user discovery interview.';
  const timestamp = new Date().toISOString();

  let template = readTemplate('context-template.md');
  if (!template) {
    template = `# Master Initialization Brief: {{PROJECT_NAME}}\n\n## Product Thesis\n{{PRODUCT_THESIS}}\n\n## Personas\n{{PERSONAS}}\n\n## Entities\n{{DATA_ENTITIES}}\n\n## Invariants\n{{BUSINESS_INVARIANTS}}\n\n## Raw PRD\n\`\`\`markdown\n{{RAW_PRD_TEXT}}\n\`\`\`\n`;
  }

  const replacements = {
    '{{PROJECT_NAME}}': projectName,
    '{{PRODUCT_THESIS}}': productThesis,
    '{{VALUE_PROPOSITION}}': valueProposition,
    '{{PRIMARY_ARCHETYPE}}': primaryArchetype,
    '{{SECONDARY_ARCHETYPE}}': secondaryArchetype,
    '{{CORE_GOALS}}': coreGoals,
    '{{ANTI_GOALS}}': antiGoals,
    '{{PERSONAS}}': personas,
    '{{DATA_ENTITIES}}': dataEntities,
    '{{BUSINESS_INVARIANTS}}': businessInvariants,
    '{{BRAND_ARCHETYPE}}': primaryArchetype,
    '{{COLOR_PRIMARY}}': colorPrimary,
    '{{COLOR_PRIMARY_DARK}}': colorPrimaryDark,
    '{{COLOR_SURFACE_LIGHT}}': colorSurfaceLight,
    '{{COLOR_SURFACE_DARK}}': colorSurfaceDark,
    '{{COLOR_ACCENT}}': colorAccent,
    '{{FONT_HEADING}}': fontHeading,
    '{{FONT_BODY}}': fontBody,
    '{{FONT_CODE}}': fontCode,
    '{{RESEARCHED_SERVICES}}': researchedServices,
    '{{ENV_KEYS_LEDGER}}': envKeysLedger,
    '{{APP_PATH}}': appPath,
    '{{RAW_PRD_TEXT}}': rawPrdText,
    '{{TIMESTAMP}}': timestamp,
    '{{ROOT}}': root.replace(/\\/g, '/'),
  };

  let output = template;
  for (const [key, val] of Object.entries(replacements)) {
    output = output.replaceAll(key, String(val));
  }

  return {
    content: output,
    variables: replacements,
  };
}

/**
 * Generates the declarative plan-manifest.json conforming to plan-manifest/v1.
 */
export function generatePlanManifest(context = {}) {
  const templateRaw = readTemplate('manifest-template.json');
  if (templateRaw) {
    try {
      const manifest = JSON.parse(templateRaw);
      manifest.suiteId = 'workspace-initialization';
      manifest.definitionRevision = 1;
      return manifest;
    } catch {
      // fallback
    }
  }

  return {
    schema: 'plan-manifest/v1',
    suiteId: 'workspace-initialization',
    definitionRevision: 1,
    phases: [
      {
        phaseId: 'P1',
        contract: 'docs/plans/workspace-initialization/phase-1-product-prd-and-vision.md',
        unitIds: ['U1', 'U2'],
        dependsOn: [],
        sourcePaths: ['docs/bible/PRD', 'docs/bible/00-product-and-vision'],
        checks: [
          {
            id: 'p1-prd-and-vision-check',
            acceptanceIds: ['AC-U1-01', 'AC-U2-01'],
            level: 1,
            kind: 'automated',
            required: true,
            regressionFor: [],
            sourcePaths: ['docs/bible/PRD', 'docs/bible/00-product-and-vision'],
            environmentKeys: ['node-version'],
            runner: {
              executable: 'node',
              args: ['.shiftstone/init/validate-bible-synthesis.js', 'docs/bible/PRD', 'docs/bible/00-product-and-vision'],
              cwd: '.',
            },
          },
        ],
        requiredReview: false,
        humanApprovalRequired: false,
        recovery: {
          retry: 'Review PRD and vision synthesis depth floors.',
          rollback: 'git checkout docs/bible/PRD docs/bible/00-product-and-vision',
        },
      },
      {
        phaseId: 'P2',
        contract: 'docs/plans/workspace-initialization/phase-2-app-scaffolding-and-theming.md',
        unitIds: ['U3', 'U4', 'U5', 'U6'],
        dependsOn: [
          {
            phaseId: 'P1',
            requires: 'complete',
            reason: 'PRD requirements and product vision must be locked before application domain scaffolding.',
          },
        ],
        sourcePaths: [
          'apps/web/app/globals.css',
          'apps/web/supabase/migrations',
          'apps/web/app/types/database.types.ts',
          'apps/web/.env.example',
          'apps/web/package.json',
        ],
        checks: [
          {
            id: 'p2-app-scaffolding-check',
            acceptanceIds: ['AC-U3-01', 'AC-U4-01', 'AC-U5-01', 'AC-U6-01'],
            level: 2,
            kind: 'automated',
            required: true,
            regressionFor: ['P1'],
            sourcePaths: [
              'apps/web/app/globals.css',
              'apps/web/supabase/migrations',
              'apps/web/app/types/database.types.ts',
              'apps/web/.env.example',
              'apps/web/package.json',
            ],
            environmentKeys: ['node-version'],
            runner: {
              executable: 'pnpm',
              args: ['vitest', 'run', 'tests/init/app-scaffolder.test.ts'],
              cwd: '.shiftstone',
            },
          },
        ],
        requiredReview: false,
        humanApprovalRequired: false,
        recovery: {
          retry: 'Review application stylesheet tokens, SQL migrations, and environment variable synchronization.',
          rollback: 'git checkout apps/web',
        },
      },
      {
        phaseId: 'P3',
        contract: 'docs/plans/workspace-initialization/phase-3-technical-bible-and-adrs.md',
        unitIds: ['U7', 'U8'],
        dependsOn: [
          {
            phaseId: 'P2',
            requires: 'complete',
            reason: 'Application domain models and migrations establish the technical architecture contract.',
          },
        ],
        sourcePaths: [
          'docs/bible/01-architecture',
          'docs/bible/02-database-and-models',
          'docs/bible/03-api-and-routes',
          'docs/decisions',
        ],
        checks: [
          {
            id: 'p3-technical-bible-check',
            acceptanceIds: ['AC-U7-01', 'AC-U8-01'],
            level: 2,
            kind: 'automated',
            required: true,
            regressionFor: ['P2'],
            sourcePaths: [
              'docs/bible/01-architecture',
              'docs/bible/02-database-and-models',
              'docs/bible/03-api-and-routes',
              'docs/decisions',
            ],
            environmentKeys: ['node-version'],
            runner: {
              executable: 'node',
              args: ['.shiftstone/init/validate-bible-synthesis.js', 'docs/bible'],
              cwd: '.',
            },
          },
        ],
        requiredReview: false,
        humanApprovalRequired: false,
        recovery: {
          retry: 'Review modular chapter subfolders and architectural decisions ledger.',
          rollback: 'git checkout docs/bible docs/decisions',
        },
      },
      {
        phaseId: 'P4',
        contract: 'docs/plans/workspace-initialization/phase-4-actionable-task-backlog.md',
        unitIds: ['U9', 'U10'],
        dependsOn: [
          {
            phaseId: 'P3',
            requires: 'complete',
            reason: 'Technical chapters and decisions provide concrete implementation requirements for task cards.',
          },
        ],
        sourcePaths: [
          'docs/backlog/README.md',
          'docs/backlog/MOC.md',
          'docs/backlog/Phase 1 - Foundation & Auth Setup',
        ],
        checks: [
          {
            id: 'p4-actionable-backlog-check',
            acceptanceIds: ['AC-U9-01', 'AC-U10-01'],
            level: 2,
            kind: 'automated',
            required: true,
            regressionFor: ['P3'],
            sourcePaths: ['docs/backlog/README.md', 'docs/backlog/MOC.md'],
            environmentKeys: ['node-version'],
            runner: {
              executable: 'pnpm',
              args: ['vitest', 'run', 'tests/skills/ss-backlog.test.ts'],
              cwd: '.shiftstone',
            },
          },
        ],
        requiredReview: false,
        humanApprovalRequired: false,
        recovery: {
          retry: 'Ensure task cards have user stories, PRD links, and phase capacity does not exceed 12 tasks.',
          rollback: 'git checkout docs/backlog',
        },
      },
      {
        phaseId: 'P5',
        contract: 'docs/plans/workspace-initialization/phase-5-ai-steering-and-harness.md',
        unitIds: ['U11', 'U12'],
        dependsOn: [
          {
            phaseId: 'P4',
            requires: 'complete',
            reason: 'Backlog milestones and architecture must be finalized before compiling steering orientation.',
          },
        ],
        sourcePaths: [
          'AGENTS.md',
          '.shiftstone/static-rules',
          '.shiftstone/path-scoped-rules',
        ],
        checks: [
          {
            id: 'p5-steering-and-harness-check',
            acceptanceIds: ['AC-U11-01', 'AC-U12-01'],
            level: 2,
            kind: 'automated',
            required: true,
            regressionFor: ['P4'],
            sourcePaths: ['AGENTS.md', '.shiftstone/static-rules'],
            environmentKeys: ['node-version'],
            runner: {
              executable: 'node',
              args: ['.shiftstone/scripts/validate-context-budgets.js'],
              cwd: '.',
            },
          },
        ],
        requiredReview: false,
        humanApprovalRequired: false,
        recovery: {
          retry: 'Verify AGENTS.md <= 60 lines and cumulative always-on rules <= 12,288 bytes.',
          rollback: 'git checkout AGENTS.md .shiftstone/static-rules',
        },
      },
    ],
  };
}

/**
 * Main Tier 2 Workspace Initialization Plan Suite Generator.
 *
 * @param {string} root - Target workspace root path.
 * @param {Record<string, any>} context - Session and discovery context.
 * @param {Record<string, any>} [traitMatrix] - Analyzed PRD trait matrix.
 * @returns {Record<string, any>} Generation report with emitted file list.
 */
export function generateInitializationPlan(root = process.cwd(), context = {}, traitMatrix = {}) {
  const planDir = path.join(root, 'docs', 'plans', 'workspace-initialization');
  mkdirSync(planDir, { recursive: true });

  const { content: briefContent, variables } = compileInitializationBrief(context, traitMatrix, root);
  const projectName = variables['{{PROJECT_NAME}}'];
  const timestamp = variables['{{TIMESTAMP}}'];

  // Helper for applying replacements
  const renderTemplate = (filename) => {
    let raw = readTemplate(filename);
    if (!raw) return '';
    for (const [key, val] of Object.entries(variables)) {
      raw = raw.replaceAll(key, String(val));
    }
    return raw;
  };

  const emittedFiles = [];

  // 1. CONTEXT.md
  const contextPath = path.join(planDir, 'CONTEXT.md');
  writeFileSync(contextPath, briefContent, 'utf8');
  emittedFiles.push(contextPath);

  // 2. index.md
  const indexPath = path.join(planDir, 'index.md');
  const indexContent = renderTemplate('index-template.md');
  writeFileSync(indexPath, indexContent, 'utf8');
  emittedFiles.push(indexPath);

  // 3. README.md
  const readmePath = path.join(planDir, 'README.md');
  const readmeContent = renderTemplate('readme-template.md');
  writeFileSync(readmePath, readmeContent, 'utf8');
  emittedFiles.push(readmePath);

  // 4. plan-manifest.json
  const manifestPath = path.join(planDir, 'plan-manifest.json');
  const manifest = generatePlanManifest(context);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  emittedFiles.push(manifestPath);

  // 5–9: The 5 discrete phase contracts
  const phaseFiles = [
    { filename: 'phase-1-product-prd-and-vision.md', template: 'phase-1-template.md' },
    { filename: 'phase-2-app-scaffolding-and-theming.md', template: 'phase-2-template.md' },
    { filename: 'phase-3-technical-bible-and-adrs.md', template: 'phase-3-template.md' },
    { filename: 'phase-4-actionable-task-backlog.md', template: 'phase-4-template.md' },
    { filename: 'phase-5-ai-steering-and-harness.md', template: 'phase-5-template.md' },
  ];

  for (const { filename, template } of phaseFiles) {
    const filePath = path.join(planDir, filename);
    const content = renderTemplate(template);
    writeFileSync(filePath, content, 'utf8');
    emittedFiles.push(filePath);
  }

  return {
    success: true,
    planDir,
    projectName,
    filesCount: emittedFiles.length,
    files: emittedFiles,
    manifest,
  };
}
