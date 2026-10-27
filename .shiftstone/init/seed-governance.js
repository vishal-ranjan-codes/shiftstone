/**
 * Governance seeder (blueprint section 5.4): everything init writes into
 * the workspace besides scaffolding and git — docs tree, bible pack
 * overlays, decision seeds, workspace files, skill junctions, generated
 * manifest/INDEX, opencode pack fragments.
 *
 * Runs after composition validation and before variable substitution, so
 * every file it creates still carries `{{PLACEHOLDERS}}` for the
 * substitution pass to fill.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { generateAll } from '../governance/index-generator.ts';
import { generateSkillsManifest } from '../scripts/generate-skills-manifest.js';
import { linkIdeFolders } from '../scripts/link-ide-folders.js';
import { curateSkills } from './skill-curator.js';

/** Marker in docs/bible/DECISIONS.md where pack seeds are rendered. */
export const DECISIONS_MARKER =
  '<!-- Pack-seeded ADRs are inserted here at init (.shiftstone/packs/<archetype>/decisions-seed.yaml). New ADRs append below the seeded block. -->';
export const LEGACY_DECISIONS_MARKER =
  '<!-- Pack-seeded ADRs are inserted here at init (packs/<archetype>/decisions-seed.yaml). New ADRs append below the seeded block. -->';

/**
 * Lab-maintenance scripts stripped from the user-facing root package.json
 * when init merges an archetype (LOCK-B1). They remain reachable inside
 * `.shiftstone/` for maintainers. `sync:engine` variants are matched by
 * prefix in `isLabOnlyScript`.
 */
export const LAB_ONLY_SCRIPTS = [
  'parity',
  'manifest',
  'validate:budgets',
  'validate:integrity',
  'validate:junctions',
  'validate:parity',
  'validate:manifest',
  'validate:contracts',
  'validate:plans',
  'validate:lenses',
  'validate:reports',
  'validate:anti-gaming',
  'validate:learning',
  'validate:decisions',
  'compile:decisions',
  'sync:bible:proposal',
  'validate:protected',
  'validate:release',
  'trials',
  'validate:telemetry',
  'validate:workspace',
];

export function isLabOnlyScript(key) {
  return LAB_ONLY_SCRIPTS.includes(key) || key === 'sync:engine' || key.startsWith('sync:engine:');
}

const DOCS_DIRS = [
  'docs/plans',
  'docs/reports',
  'docs/reports/status',
  'docs/reports/sync',
  'docs/research',
  'docs/research/_template',
  'docs/bugs',
  'docs/backlog',
];

function renderDecision(decision) {
  return (
    `## ${decision.id} — ${decision.title}\n\n` +
    `- **Date**: ${decision.date}\n` +
    `- **Status**: ${decision.status}\n` +
    `- **Context**: ${decision.context}\n` +
    `- **Decision**: ${decision.decision}\n` +
    `- **Consequences**: ${decision.consequences}`
  );
}

export function renderDecisionSeed(seed) {
  return (seed.decisions ?? []).map(renderDecision).join('\n\n---\n\n');
}

function ensureDir(root, rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) {
    mkdirSync(full, { recursive: true });
    return true;
  }
  return false;
}

/** Apply every active pack's bible overlays over docs/bible/ (task 4.4). */
function applyBibleOverlays(root, composition) {
  const applied = [];
  for (const archetype of composition.archetypes) {
    const overlayRel = archetype.manifest.composition?.bible_overlays;
    if (typeof overlayRel !== 'string') continue;
    const overlayDir = archetype.dir + path.sep + overlayRel.replace(/^\.\//, '');
    if (!existsSync(overlayDir)) continue;
    const copyTree = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const source = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
          copyTree(source);
          continue;
        }
        const rel = path.relative(overlayDir, source);
        const dest = path.join(root, 'docs', 'bible', rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        cpSync(source, dest);
        applied.push(`docs/bible/${rel.replace(/\\/g, '/')}`);
      }
    };
    copyTree(overlayDir);
  }
  return applied;
}

/**
 * Layer pack surface overlays over core/ — path-scoped rules and workflows
 * (blueprint §5.2; the pack copy wins file-for-file, so a default flagship
 * composition reproduces the pre-refactor content byte-for-byte after
 * variable substitution).
 *
 * @param {string} root
 * @param {{archetypes: Array<{dir: string, manifest: any}>}} composition
 * @returns {string[]} applied relative paths
 */
export function applySurfaceOverlays(root, composition) {
  const targets = {
    path_scoped_rules: ['.shiftstone', 'path-scoped-rules'],
    workflows: ['.shiftstone', 'workflows'],
  };
  const applied = [];
  for (const archetype of composition.archetypes) {
    for (const [key, target] of Object.entries(targets)) {
      const rel = archetype.manifest?.composition?.[key];
      if (typeof rel !== 'string') continue;
      const src = path.join(archetype.dir, rel.replace(/^\.\//, ''));
      if (!existsSync(src)) continue;
      const destRoot = path.join(root, ...target);
      const copyTree = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const source = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) continue;
          if (entry.isDirectory()) {
            copyTree(source);
            continue;
          }
          const relFile = path.relative(src, source);
          const dest = path.join(destRoot, relFile);
          mkdirSync(path.dirname(dest), { recursive: true });
          cpSync(source, dest);
          applied.push(`${target.slice(1).join('/')}/${relFile.replace(/\\/g, '/')}`);
        }
      };
      copyTree(src);
    }
  }
  return applied;
}

/**
 * When composition relocates the app folder (--app-path), rewrite the
 * composed path-rule references (frontmatter `paths:` globs and in-body
 * literals) from the pack's defaultAppPath to the effective one.
 * No-op for default compositions.
 */
function rewriteComposedAppPath(root, composition) {
  const primary = composition.archetypes?.[0];
  if (!primary) return 0;
  const from = primary.manifest?.spec?.defaultAppPath;
  const to = primary.effectiveAppPath;
  if (!from || !to || to === from) return 0;
  const dir = path.join(root, '.shiftstone', 'path-scoped-rules');
  if (!existsSync(dir)) return 0;
  let changed = 0;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.md')) continue;
    const file = path.join(dir, entry);
    const raw = readFileSync(file, 'utf8');
    const next = raw.split(from).join(to);
    if (next !== raw) {
      writeFileSync(file, next, 'utf8');
      changed += 1;
    }
  }
  return changed;
}

/** Render all active packs' decision seeds into DECISIONS.md (task 4.5). */
function applyDecisionSeeds(root, composition) {
  const renders = [];
  for (const archetype of composition.archetypes) {
    const seedRel = archetype.manifest.composition?.decisions_seed;
    if (typeof seedRel !== 'string') continue;
    const seedPath = path.join(archetype.dir, seedRel);
    if (!existsSync(seedPath)) continue;
    let seed;
    try {
      seed = parseYaml(readFileSync(seedPath, 'utf8'));
    } catch (error) {
      throw new Error(`pack "${archetype.name}": decisions seed unreadable — ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!seed || typeof seed !== 'object') continue;
    renders.push(renderDecisionSeed(seed));
  }
  if (renders.length === 0) {
    const decisionsPath = path.join(root, 'docs', 'bible', 'DECISIONS.md');
    if (existsSync(decisionsPath)) {
      const cleanTemplate = `---
type: decisions
timestamp: 2026-10-13T00:00:00.000Z
---
# Architecture Decision Records (ADRs)

All foundational engineering and architectural decisions for {{PROJECT_NAME}} are documented here in chronological order.

---

${DECISIONS_MARKER}
`;
      writeFileSync(decisionsPath, cleanTemplate, 'utf8');
    }
    return false;
  }

  const decisionsPath = path.join(root, 'docs', 'bible', 'DECISIONS.md');
  if (!existsSync(decisionsPath)) return false;
  const content = readFileSync(decisionsPath, 'utf8');
  const marker = content.includes(DECISIONS_MARKER)
    ? DECISIONS_MARKER
    : content.includes(LEGACY_DECISIONS_MARKER)
      ? LEGACY_DECISIONS_MARKER
      : null;
  if (!marker) return false; // already seeded
  const block = renders.join('\n\n---\n\n');
  writeFileSync(decisionsPath, content.replace(marker, () => block), 'utf8');
  return true;
}

/**
 * LOCK-B3 generic three-phase template for packs without a backlog seed:
 * stack-neutral wording only (never carries archetype vocabulary).
 */
const GENERIC_BACKLOG_PHASES = [
  {
    dir: 'Phase 1 - Foundation',
    file: '1.1-project-setup.md',
    title: 'Phase 1.1: Project Setup',
    focus: 'Repository configuration, tooling, environment wiring, and the architecture baseline.',
    tasks: [
      '- [ ] **[P1]** Initialize the application skeleton for the chosen stack',
      '- [ ] **[P1]** Configure environment variables and the local secrets file',
      '- [ ] **[P2]** Document the architecture baseline in docs/bible/',
    ],
  },
  {
    dir: 'Phase 2 - Feature',
    file: '2.1-core-features.md',
    title: 'Phase 2.1: Core Features',
    focus: 'Primary user-facing functionality of the product.',
    tasks: [
      '- [ ] **[P1]** Define and implement the first end-to-end user journey',
      '- [ ] **[P2]** Add input validation and typed error handling across boundaries',
    ],
  },
  {
    dir: 'Phase 3 - Ship',
    file: '3.1-launch-checklist.md',
    title: 'Phase 3.1: Launch Checklist',
    focus: 'Testing, deployment, observability, and launch readiness.',
    tasks: [
      '- [ ] **[P1]** Establish the automated test suite and CI quality gates',
      '- [ ] **[P1]** Deploy to production with a documented rollback procedure',
      '- [ ] **[P2]** Wire up logging, metrics, and alerting',
    ],
  },
];

function renderGenericTaskFile(phase, today) {
  const phaseNumber = phase.file.split('.')[0];
  return `---
title: "${phase.title}"
status: "planned"
type: "backlog"
tags: ["backlog", "phase-${phaseNumber}"]
phase: "${phase.file.replace('.md', '')}"
lastUpdated: "${today}"
component: "core"
---

# ${phase.title} Backlog

${phase.focus}

## Status: Planned 📋

## Tasks

${phase.tasks.join('\n')}

## Change Log

| Date | Task | Action | Assignee |
|---|---|---|---|
`;
}

function renderGenericMoc(today) {
  const listings = GENERIC_BACKLOG_PHASES.map((phase) => {
    const shortName = phase.dir.replace('Phase ', '');
    const fileStem = phase.file.replace('.md', '');
    return `### ${shortName.replace(' - ', ': ')}\n*${phase.focus}*\n- [[${phase.dir}/${fileStem}\\|${phase.title.replace(/^Phase /, '')}]] 📁 *Planned*`;
  }).join('\n\n');
  return `---
title: "Backlog Map of Content"
status: "active"
type: "overview"
tags: ["backlog", "moc", "roadmap"]
lastUpdated: "${today}"
component: "core"
---

# Backlog Map of Content (MOC)

This Map of Content serves as the single source of truth for the {{PROJECT_NAME}} roadmap and task hierarchy. Tasks are broken down into granular, small-scoped files to prevent AI context overload.

---

## Roadmap 📂

${listings}

---

## How to Work with this Backlog

- Format: \`- [ ] **[Priority]** Task Description\` (where Priority is \`[P1]\`, \`[P2]\`, or \`[P3]\`).
- \`[ ]\` → \`[/]\` when work starts; \`[/]\` → \`[x]\` **only** after \`/ss-verify <task-id>\` returns a Checker verdict ≥ 0.8.
- No active backlog file should exceed **12 unresolved tasks** — run \`/ss-backlog-sync\` to split.
`;
}

/** First active pack whose seed directory resolves (declared or conventional). */
function findBacklogSeed(composition) {
  for (const archetype of composition.archetypes) {
    const declared = archetype.manifest?.spec?.workspace?.backlogSeed;
    if (typeof declared === 'string') {
      const dir = path.join(archetype.dir, declared.replace(/^\.\//, ''));
      if (!existsSync(dir)) {
        throw new Error(`pack "${archetype.name}": declared workspace.backlogSeed "${declared}" does not exist`);
      }
      return { pack: archetype.name, dir };
    }
    const conventional = path.join(archetype.dir, 'backlog-seed');
    if (existsSync(conventional)) return { pack: archetype.name, dir: conventional };
  }
  return null;
}

/**
 * Archetype-aware backlog composition (LOCK-B3): purge phase directories
 * and the composed MOC belonging to a previously composed archetype, then
 * compose docs/backlog/ from the active pack's seed — or the generic
 * three-phase template when no active pack ships one. Governance indexes
 * are regenerated so `governance/index.js --check` stays green.
 */
async function composeBacklog(root, composition) {
  const backlogDir = path.join(root, 'docs', 'backlog');
  mkdirSync(backlogDir, { recursive: true });

  const seed = findBacklogSeed(composition);
  const keep = new Set(seed ? readdirSync(seed.dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
  const purged = [];
  for (const entry of readdirSync(backlogDir, { withFileTypes: true })) {
    const isComposed =
      (entry.isDirectory() && /^Phase \d+ - /.test(entry.name) && !keep.has(entry.name)) ||
      (entry.isFile() && entry.name === 'MOC.md');
    if (!isComposed) continue;
    rmSync(path.join(backlogDir, entry.name), { recursive: true, force: true });
    purged.push(entry.isDirectory() ? `${entry.name}/` : entry.name);
  }

  if (seed) {
    cpSync(seed.dir, backlogDir, { recursive: true });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    for (const phase of GENERIC_BACKLOG_PHASES) {
      const dir = path.join(backlogDir, phase.dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, phase.file), renderGenericTaskFile(phase, today), 'utf8');
    }
    writeFileSync(path.join(backlogDir, 'MOC.md'), renderGenericMoc(today), 'utf8');
  }
  await generateAll(backlogDir);
  return { purged, source: seed ? `pack:${seed.pack}` : 'generic-template' };
}

/** Monorepo workspace files from the primary archetype's spec (section 5.4). */
function writeWorkspaceFiles(root, composition, answers) {
  const primary = composition.archetypes[0];
  const spec = primary.manifest.spec;
  const written = [];

  if (spec.folderLayout !== 'monorepo') return written;

  if (spec.packaging === 'pnpm') {
    const workspaceYaml = path.join(root, 'pnpm-workspace.yaml');
    if (!existsSync(workspaceYaml)) {
      writeFileSync(workspaceYaml, "packages:\n  - 'apps/*'\n  - 'packages/*'\n", 'utf8');
      written.push('pnpm-workspace.yaml');
    }
  }

  // LOCK-B6: non-pnpm packaging modes receive the equivalent root TypeScript
  // solution config when absent, so IDE language servers resolve imports at
  // the repository root on a fresh checkout. The pnpm distribution ships its
  // own committed copy, and an existing user tsconfig is never touched.
  const tsconfigPath = path.join(root, 'tsconfig.json');
  if (spec.packaging !== 'pnpm' && !existsSync(tsconfigPath)) {
    const appPath = primary.effectiveAppPath ?? spec.defaultAppPath;
    const tsconfig = {
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: 'es2023',
        module: 'nodenext',
        moduleResolution: 'nodenext',
        resolveJsonModule: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      files: [],
      references: [{ path: `./${appPath}` }, { path: './.shiftstone' }],
    };
    writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`, 'utf8');
    written.push('tsconfig.json');
  }

  const workspace = spec.workspace;
  if (!workspace) return written;
  const rootPkgPath = path.join(root, 'package.json');
  const lower = answers.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

  if (!existsSync(rootPkgPath)) {
    const pkg = {
      name: `${lower}-workspace`,
      version: '0.1.0',
      private: true,
      scripts: {
        ...(workspace.rootScripts ?? {}),
        'test:engine': 'pnpm -C .shiftstone test',
        'typecheck:engine': 'pnpm -C .shiftstone typecheck',
        'lint:engine': 'pnpm -C .shiftstone lint',
      },
    };
    if (Array.isArray(workspace.onlyBuiltDependencies)) {
      pkg.pnpm = { onlyBuiltDependencies: workspace.onlyBuiltDependencies };
    }
    writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    written.push('package.json');
    return written;
  }

  // Merge mode (LOCK-B2): an existing root package.json is never skipped —
  // archetype rootScripts win per-key, the project is renamed from the
  // interview answer, lab-only scripts are stripped, and every unrelated
  // user field survives.
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `root package.json is not valid JSON — cannot merge archetype scripts: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  pkg.name = `${lower}-workspace`;
  const scripts = { ...(pkg.scripts ?? {}) };
  for (const key of Object.keys(scripts)) {
    if (isLabOnlyScript(key)) delete scripts[key];
  }
  Object.assign(scripts, workspace.rootScripts ?? {});
  pkg.scripts = scripts;
  if (Array.isArray(workspace.onlyBuiltDependencies)) {
    pkg.pnpm = { ...(pkg.pnpm ?? {}), onlyBuiltDependencies: workspace.onlyBuiltDependencies };
  }
  writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  written.push('package.json');
  return written;
}

/** Remove pack-skill junctions that no longer belong to an active pack. */
export function pruneStaleSkillLinks(root, desired) {
  const skillsRoot = path.join(root, '.agents', 'skills');
  if (!existsSync(skillsRoot)) return [];
  const removed = [];
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    if (desired.has(entry.name)) continue;
    rmSync(path.join(skillsRoot, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}

export function writeRegistry(root, composition) {
  const doc = {
    apiVersion: 'workspace/v1',
    kind: 'PackRegistry',
    activePacks: composition.archetypes.map((a) => a.name),
  };
  const namespaced = [
    ...new Set(composition.skills.filter((s) => s.as !== s.name).map((s) => s.name)),
  ].sort();
  if (namespaced.length > 0) doc.namespacedSkills = namespaced;
  if (Array.isArray(composition.excludedSkills) && composition.excludedSkills.length > 0) {
    doc.excludedSkills = [...new Set(composition.excludedSkills)].sort();
  }
  writeFileSync(
    path.join(root, '.shiftstone', 'packs', '_registry.yaml'),
    `${stringifyYaml(doc)}`,
    'utf8',
  );
}

/** Pack-aware opencode.json: app permission patterns + pack fragments (task 4.11). */
function applyOpencode(root, composition) {
  const opencodePath = path.join(root, 'opencode.json');
  if (!existsSync(opencodePath)) return false;
  const config = JSON.parse(readFileSync(opencodePath, 'utf8'));

  const permission = config.permission ?? {};
  const external = { ...(permission.external_directory ?? {}) };
  delete external['{{APP_PATH}}/**'];
  delete external['*'];
  for (const archetype of composition.archetypes) {
    external[`${archetype.effectiveAppPath}/**`] = 'allow';
  }
  external['*'] = 'deny';
  permission.external_directory = external;
  config.permission = permission;

  for (const archetype of composition.archetypes) {
    const fragment = archetype.manifest.composition?.opencode;
    if (fragment && typeof fragment === 'object') {
      for (const [key, value] of Object.entries(fragment)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && config[key]) {
          config[key] = { ...config[key], ...value };
        } else {
          config[key] = value;
        }
      }
    }
  }

  // Keep the instructions list consistent with the composed path-rule
  // surface: drop entries whose rule file does not exist (a pack rule was
  // not composed) and add pack-shipped rule files that are not listed.
  const rulesDir = path.join(root, '.shiftstone', 'path-scoped-rules');
  if (existsSync(rulesDir)) {
    const existing = readdirSync(rulesDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => `.shiftstone/path-scoped-rules/${f}`);
    const instructions = Array.isArray(config.instructions) ? config.instructions.map(String) : [];
    const scoped = instructions.filter((i) => i.startsWith('.shiftstone/path-scoped-rules/'));
    const rest = instructions.filter((i) => !i.startsWith('.shiftstone/path-scoped-rules/'));
    const kept = scoped.filter((i) => existing.includes(i));
    const added = existing.filter((f) => !scoped.includes(f));
    config.instructions = [...rest, ...kept, ...added];
  }

  writeFileSync(opencodePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return true;
}

/** Default Command Code settings (carried over from the pre-refactor init);
 * pack `composition.commandcode` fragments merge their permission entries on top. */
export function writeCommandCodeSettings(root, answers, composition) {
  const cmdDir = path.join(root, '.commandcode');
  const settingsPath = path.join(cmdDir, 'settings.json');
  if (existsSync(settingsPath)) return false;
  mkdirSync(cmdDir, { recursive: true });
  const packageManager = answers.packageManager ?? 'pnpm';
  const settings = {
    $schema: 'https://commandcode.ai/config.json',
    permissions: {
      deny: ['Read(.dev.vars)', 'Read(.env*)', 'Read(secrets/**)'],
      ask: ['Shell(git push:*)', 'Shell(git commit:*)'],
      allow: [
        `Shell(${packageManager} *)`,
        'Shell(git status:*)',
        'Shell(git diff:*)',
        'Shell(git log:*)',
        'Shell(rg:*)',
        'Shell(find:*)',
        'Shell(ls:*)',
      ],
    },
  };
  for (const archetype of composition?.archetypes ?? []) {
    const permissions = archetype.manifest?.composition?.commandcode?.permissions;
    if (!permissions || typeof permissions !== 'object') continue;
    for (const key of ['deny', 'ask', 'allow']) {
      if (Array.isArray(permissions[key])) settings.permissions[key].push(...permissions[key]);
    }
  }
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return true;
}

function writeSeedDocs(root, projectName) {
  const created = [];
  for (const dir of DOCS_DIRS) if (ensureDir(root, dir)) created.push(`${dir}/`);

  const bugLogPath = path.join(root, 'docs', 'bugs', 'open-bugs.md');
  if (!existsSync(bugLogPath)) {
    writeFileSync(
      bugLogPath,
      `# ${projectName} Open Bug Log\n\n*(Use /bug-report to append bugs here)*\n\n| Bug ID | Title | Status | Severity | Date Captured |\n|---|---|---|---|---|\n`,
      'utf8',
    );
    created.push('docs/bugs/open-bugs.md');
  }

  const researchReadmePath = path.join(root, 'docs', 'research', 'README.md');
  if (!existsSync(researchReadmePath)) {
    writeFileSync(
      researchReadmePath,
      `# ${projectName} Technical Research\n\nKeep all technology investigations here to preserve them across AI sessions.\n\n| Topic | Date | Decision Made |\n|---|---|---|\n`,
      'utf8',
    );
    created.push('docs/research/README.md');
  }
  return created;
}

/**
 * Project-specific specialist skill synthesis (carried over verbatim from
 * the pre-refactor init.js).
 */
export function scaffoldProjectSkill(root, skillName, projectName) {
  const sanitizedSkill = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const skillDir = path.join(root, '.agents', 'skills', sanitizedSkill);
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (existsSync(skillFile)) return false;

  mkdirSync(skillDir, { recursive: true });
  const titleCase = sanitizedSkill
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const skillContent = `---
name: ${sanitizedSkill}
description: Project-specific specialist guidelines and integration patterns for ${titleCase} in ${projectName}. Load when designing, implementing, or debugging ${titleCase} features.
type: skill
timestamp: ${new Date().toISOString()}
version: 1.0.0
pack: core
---

# ${titleCase} Skill (${projectName})

> Load this skill when designing, implementing, or debugging ${titleCase} features and third-party integrations for ${projectName}.

- Procedural knowledge: [instructions.md](./instructions.md)
`;
  writeFileSync(skillFile, skillContent, 'utf8');

  const instructionsContent = `
# ${titleCase} — Project Specialist Guidelines

Companion to [SKILL.md](./SKILL.md).

## 1. Architectural Role & Responsibilities
- Manage ${titleCase} integration points, environment variables, and client SDKs.
- Isolate external API calls inside dedicated server-side utility modules (e.g. \`app/lib/${sanitizedSkill}/\`).
- Enforce strict typing, error handling, and security token protection.

---

## 2. Environment Variables & Credentials
- Define required secrets inside \`{{LOCAL_SECRETS_FILE}}\` for local development.
- Secure production secrets with \`{{SECRET_PUT_CMD}}\`.
- Never expose service tokens or secret keys to client-side code.

---

## 3. Implementation Standards
- Validate all incoming payloads and external webhook signatures with **{{PAYLOAD_VALIDATOR}}**.
- Return typed responses conforming to \`{{TYPED_RESPONSE}}\`.
- Maintain graceful degradation when credentials are unset in local test environments.
`;
  writeFileSync(path.join(skillDir, 'instructions.md'), instructionsContent, 'utf8');

  // Register in AGENTS.md for universal AI discovery
  const agentsMdPath = path.join(root, 'AGENTS.md');
  if (existsSync(agentsMdPath)) {
    try {
      let agentsContent = readFileSync(agentsMdPath, 'utf8');
      const tablePlaceholder =
        '| *(Populated dynamically when third-party integrations such as Stripe, Resend, or pgvector are initialized)* | `.agents/skills/<integration-name>/SKILL.md` |';
      const newEntry = `| ${titleCase} integration guidelines | \`.agents/skills/${sanitizedSkill}/SKILL.md\` |`;
      if (agentsContent.includes(tablePlaceholder) && !agentsContent.includes(newEntry)) {
        agentsContent = agentsContent.replace(tablePlaceholder, `${newEntry}\n${tablePlaceholder}`);
        writeFileSync(agentsMdPath, agentsContent, 'utf8');
      }
    } catch (regError) {
      console.warn(`   ⚠️  Could not update AGENTS.md: ${regError.message}`);
    }
  }
  return true;
}

/**
 * Seed the workspace's governance surface.
 *
 * @param {{ root: string, composition: any, answers: Record<string, any>, quiet?: boolean }} params
 */
export async function seedGovernance({ root, composition, answers, context, quiet = false }) {
  const log = (message) => {
    if (!quiet) console.log(message);
  };
  const result = {
    docsDirs: [],
    overlays: [],
    surfaceOverlays: [],
    decisionsSeeded: false,
    backlog: { purged: [], source: 'generic-template' },
    workspaceFiles: [],
    prunedSkillLinks: [],
    opencodeUpdated: false,
    customSkills: [],
    curatedSkills: [],
    excludedSkills: [],
    tokenSavings: 0,
    savingsPercent: 0,
  };

  result.docsDirs = writeSeedDocs(root, answers.projectName);
  log(`   📂 docs tree: ${result.docsDirs.length} entries ensured`);

  result.backlog = await composeBacklog(root, composition);
  log(`   🗂️  docs/backlog composed from ${result.backlog.source}${result.backlog.purged.length ? ` (purged ${result.backlog.purged.length} previously composed entries)` : ''}`);

  // Dynamic skill curation based on interview context / answers (REQ-INIT-10, Unit U11)
  const curation = curateSkills({
    skills: composition.skills,
    context: context || answers,
    answers,
  });
  if (curation.excludedSkills.length > 0) {
    composition.skills = curation.curatedSkills;
    composition.excludedSkills = curation.excludedSkills;
    result.curatedSkills = curation.curatedSkills.map((s) => s.name || s.as);
    result.excludedSkills = curation.excludedSkills;
    result.tokenSavings = curation.tokenSavings;
    result.savingsPercent = curation.savingsPercent;
    log(`   ✂️  curated skills: pruned ${curation.excludedSkills.length} unneeded skills (${Math.round(curation.savingsPercent)}% token reduction)`);
  }

  // Registry first: skill discovery, junctions and manifest all read it.
  writeRegistry(root, composition);

  // Skill junctions: prune stale, materialize active (task 4.2 / 4.12).
  const desired = new Set(composition.skills.map((s) => s.as));
  result.prunedSkillLinks = pruneStaleSkillLinks(root, desired);
  for (const skill of composition.skills) {
    const linkAbs = path.join(root, '.agents', 'skills', skill.as);
    if (existsSync(linkAbs)) continue;
    mkdirSync(path.dirname(linkAbs), { recursive: true });
    const target = process.platform === 'win32' ? 'junction' : 'dir';
    symlinkSync(skill.dir, linkAbs, target);
    log(`   🔗 skill ${skill.as} -> .shiftstone/packs/${skill.pack}/skills/${skill.name}`);
  }
  linkIdeFolders({ root, quiet: true });

  result.overlays = applyBibleOverlays(root, composition);
  if (result.overlays.length > 0) log(`   📖 bible overlays applied: ${result.overlays.length} file(s)`);

  result.surfaceOverlays = applySurfaceOverlays(root, composition);
  if (result.surfaceOverlays.length > 0) log(`   🧩 pack surface overlays applied: ${result.surfaceOverlays.length} file(s)`);
  const rewrittenScopes = rewriteComposedAppPath(root, composition);
  if (rewrittenScopes > 0) log(`   🔀 path-rule app-path scopes rewritten: ${rewrittenScopes} file(s)`);

  result.decisionsSeeded = applyDecisionSeeds(root, composition);
  if (result.decisionsSeeded) log('   📜 decisions seed rendered into docs/bible/DECISIONS.md');

  result.workspaceFiles = writeWorkspaceFiles(root, composition, answers);
  for (const file of result.workspaceFiles) log(`   🏗️  created ${file}`);

  result.opencodeUpdated = applyOpencode(root, composition);
  if (result.opencodeUpdated) log('   ⚙️  opencode.json made pack-aware');

  writeCommandCodeSettings(root, answers, composition);

  if (answers.skills) {
    for (const skill of String(answers.skills).split(',').map((s) => s.trim()).filter(Boolean)) {
      if (scaffoldProjectSkill(root, skill, answers.projectName)) result.customSkills.push(skill);
    }
  }

  const primary = composition.archetypes[0];
  generateSkillsManifest({
    root,
    quiet: true,
    appPath: primary?.effectiveAppPath,
    defaultAppPath: primary?.manifest?.spec?.defaultAppPath,
    excludedSkills: composition.excludedSkills,
  });
  log('   🧠 skills manifest + AGENTS.md INDEX regenerated');

  return result;
}
