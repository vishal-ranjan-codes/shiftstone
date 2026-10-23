#!/usr/bin/env node
/**
 * v1.x → v2.0 migration (task 7.7, blueprint section 10.14).
 *
 *   node .shiftstone/migrate-v1-to-v2.js                     dry-run (default): detect + plan, writes nothing
 *   node .shiftstone/migrate-v1-to-v2.js --apply             perform the plan and write the migration report
 *   node .shiftstone/migrate-v1-to-v2.js --report            write the report even in dry-run mode
 *   node .shiftstone/migrate-v1-to-v2.js --root=<dir>         workspace to migrate (default: cwd)
 *   node .shiftstone/migrate-v1-to-v2.js --framework=<dir>    v2 framework source (default: this repo)
 *   node .shiftstone/migrate-v1-to-v2.js --archetype=<name>   override the suggested archetype
 *
 * Safety contract (phase 7 risk table — "migration script corrupts user work"):
 *   - DRY-RUN BY DEFAULT: without --apply nothing is written (except with an
 *     explicit --report).
 *   - NEVER touches user code (apps/**), docs/backlog/**, docs/bible/** or
 *     .git/**. Harness files merge with force:false — an existing file always
 *     wins over the framework copy.
 *   - RR8-coupled skills move into packs/rr8-supabase-cf/skills/ ONLY when the
 *     pack does not already ship that skill; custom skills and symlinked
 *     (junctioned) skills are never moved.
 *   - Every apply emits a migration report to docs/reports/ (OKF frontmatter).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listPackNames, loadPack } from './init/pack-loader.js';
import { matchPattern } from './init/validate-manifest.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_FRAMEWORK = path.resolve(HERE, '..');

/** Framework dirs merged into the workspace (missing files only — force:false). */
export const HARNESS_MERGE_PATHS = [
  '.shiftstone',
  'packs',
  'evals',
  'docs/loops',
  '_config',
  '.github/workflows',
];

/** v1-era folders whose contents moved into core/ — reported, never deleted. */
export const V1_RULE_FOLDERS = ['.agent/rules', '.claude/rules', '.commandcode/rules'];

/** Ordered token map: specific stacks first, rr8 last as the v1 default. */
const PACK_TOKENS = [
  ['sveltekit-supabase', [/@sveltejs\/kit/, /sveltekit/i, /\bsvelte\b/i]],
  ['nextjs-prisma-pg', [/"next"\s*:/, /nextjs/i, /@prisma\//]],
  ['fastapi-pg', [/fastapi/i, /uvicorn/i, /sqlalchemy/i]],
  ['expo-react-native', [/\bexpo\b/i, /react-native/i]],
  ['go-chi-postgres', [/go-chi\/chi/, /chi\/v5/, /\bpackage main\b/]],
  ['rr8-supabase-cf', [/react-router/i, /@react-router\//, /supabase/i, /wrangler/i, /cloudflare/i]],
];

const REGISTRY_HEADER = [
  '# Installed packs + active composition (blueprint Appendix C).',
  '# Rewritten by .shiftstone/init/seed-governance.js on every composition.',
  '# Consumed by .shiftstone/context/skill-paths.ts (skill discovery) and',
  '# .shiftstone/scripts/generate-skills-manifest.js (metadata.activePacks).',
  'apiVersion: workspace/v1',
  'kind: PackRegistry',
];

function existsIn(root, rel) {
  return existsSync(path.join(root, rel));
}

function readIfText(abs, limit = 200_000) {
  try {
    return readFileSync(abs, 'utf8').slice(0, limit);
  } catch {
    return '';
  }
}

/** Real (non-junction) skill directories in a skills root. */
function realSkillDirs(skillsRoot) {
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .map((entry) => entry.name)
    .sort();
}

/** Files contributing to archetype detection (bounded corpus). */
function detectionCorpus(root) {
  const parts = [];
  for (const rel of ['AGENTS.md', 'CLAUDE.md', 'package.json', 'pnpm-workspace.yaml']) {
    const text = readIfText(path.join(root, rel), 50_000);
    if (text) parts.push(text);
  }
  const bible = path.join(root, 'docs', 'bible');
  if (existsSync(bible)) {
    for (const entry of readdirSync(bible, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d\d-/.test(entry.name)) continue;
      const chapter = path.join(bible, entry.name);
      for (const file of readdirSync(chapter)) {
        if (file.endsWith('.md')) parts.push(readIfText(path.join(chapter, file), 20_000));
      }
    }
  }
  const apps = path.join(root, 'apps');
  if (existsSync(apps)) {
    for (const entry of readdirSync(apps, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const text = readIfText(path.join(apps, entry.name, 'package.json'), 20_000);
      if (text) parts.push(text);
    }
  }
  return parts.join('\n');
}

/**
 * Detect workspace state (blueprint section 10.14 step 1).
 * @returns {Record<string, any>} markers, counts and v1/migrated verdicts
 */
export function detectState(root) {
  const bible = existsIn(root, 'docs/bible');
  const chapters = bible
    ? readdirSync(path.join(root, 'docs', 'bible'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
        .map((entry) => entry.name)
        .sort()
    : [];
  const skillNames = realSkillDirs(path.join(root, '.agents', 'skills'));
  const apps = existsIn(root, 'apps')
    ? readdirSync(path.join(root, 'apps'), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];

  const state = {
    bible,
    bibleChapters: chapters,
    skillsRoot: existsIn(root, '.agents/skills'),
    skillNames,
    backlog: existsIn(root, 'docs/backlog'),
    decisions: existsIn(root, 'docs/bible/DECISIONS.md'),
    apps,
    v1RuleFolders: V1_RULE_FOLDERS.filter((rel) => existsIn(root, rel)),
    rootInitJs: existsIn(root, 'init.js'),
    packsRegistry: existsIn(root, 'packs/_registry.yaml'),
    harness: existsIn(root, '.shiftstone/harness') || existsIn(root, 'core/harness'),
    core: existsIn(root, '.shiftstone') || existsIn(root, 'core'),
  };
  state.alreadyMigrated = state.packsRegistry && state.harness;
  state.isV1 = !state.alreadyMigrated && (state.bible || state.skillsRoot);
  return state;
}

/** Pick the equivalent v2.0 archetype (blueprint section 10.14 step 2). */
export function suggestArchetype(root, { available }) {
  const corpus = detectionCorpus(root);
  let best = { pack: null, hits: 0, tokens: [] };
  for (const [pack, tokens] of PACK_TOKENS) {
    if (!available.includes(pack)) continue;
    const matched = tokens.filter((token) => token.test(corpus));
    if (matched.length > best.hits) {
      best = { pack, hits: matched.length, tokens: matched.map(String) };
    }
  }
  if (best.pack) return best;
  if (available.includes('rr8-supabase-cf')) {
    return { pack: 'rr8-supabase-cf', hits: 0, tokens: ['v1 default (flagship)'] };
  }
  return { pack: available[0] ?? null, hits: 0, tokens: ['first available pack'] };
}

/**
 * Build the migration plan (steps 2–6 of blueprint section 10.14).
 * Pure: reads only, writes nothing.
 *
 * @param {{root: string, framework: string, archetypeOverride?: string}} options
 */
export function buildPlan({ root, framework, archetypeOverride }) {
  const detected = detectState(root);
  const available = listPackNames(framework);
  const suggestion = archetypeOverride
    ? { pack: archetypeOverride, hits: 0, tokens: ['--archetype override'] }
    : suggestArchetype(root, { available });

  const errors = [];
  if (archetypeOverride && !available.includes(archetypeOverride)) {
    errors.push(`--archetype=${archetypeOverride} not found in ${path.join(framework, 'packs')} (available: ${available.join(', ') || 'none'})`);
  }

  // RR8-coupled vs custom skills (blueprint section 10.14 step 3).
  let rr8Include = [];
  try {
    rr8Include = loadPack(framework, 'rr8-supabase-cf').manifest.composition?.skills?.include ?? [];
  } catch {
    rr8Include = [];
  }
  const packSkillNames = existsIn(framework, 'packs/rr8-supabase-cf/skills')
    ? new Set(realSkillDirs(path.join(framework, 'packs/rr8-supabase-cf/skills')))
    : new Set();

  const moves = [];
  const preservedSkills = [];
  for (const name of detected.skillNames) {
    const coupled = rr8Include.some((pattern) => matchPattern(pattern, name));
    if (!coupled) {
      preservedSkills.push(name);
      continue;
    }
    const targetExists =
      existsIn(root, `packs/rr8-supabase-cf/skills/${name}`) || packSkillNames.has(name);
    moves.push({ skill: name, action: targetExists ? 'pack-owns' : 'move' });
  }

  const samePath = (rel) => path.resolve(framework, rel) === path.resolve(root, rel);
  const merge = HARNESS_MERGE_PATHS.filter((rel) => !samePath(rel)).map((rel) => ({
    path: rel,
    mode: existsIn(root, rel) ? 'merge missing files' : 'create',
  }));

  const followups = [];
  if (detected.v1RuleFolders.length > 0) {
    followups.push(
      `v1 rule folders are real directories: ${detected.v1RuleFolders.join(', ')} — remove them yourself, then run \`node .shiftstone/scripts/link-ide-folders.js\` to junction-link the IDE folders to core/ (migration never deletes your files).`,
    );
  }
  if (!detected.harness) {
    followups.push('Install harness deps in the migrated workspace: `npm install --prefix core` (or `pnpm -C .shiftstone install`).');
  }
  followups.push(
    `Re-run composition to link skills and apply overlays: \`node .shiftstone/init.js --archetype=${suggestion.pack}\` (or type \`/init\`) — the composer never overwrites existing user files.`,
  );
  followups.push('Regenerate the skills manifest: `node .shiftstone/scripts/generate-skills-manifest.js`.');
  if (detected.bible) {
    followups.push('Your docs/bible/ was preserved as-is — run `/sync-bible` to converge it with the v2 stack-agnostic template.');
  }

  return {
    detected,
    available,
    suggestion,
    merge,
    registry: detected.packsRegistry ? 'exists (left untouched)' : `create (activePacks: [${suggestion.pack}])`,
    moves,
    preservedSkills,
    followups,
    errors,
  };
}

/** Execute the plan (blueprint section 10.14 steps 3–6). Returns what happened. */
export function applyPlan(plan, { root, framework }) {
  const applied = { merged: [], registry: 'skipped', moved: [], leftInPlace: [] };
  const filter = (src) => {
    const base = path.basename(src);
    return base !== 'node_modules' && base !== '.git' && base !== 'dist' && base !== 'coverage' && base !== '.loops';
  };

  for (const step of plan.merge) {
    const src = path.join(framework, step.path);
    const dst = path.join(root, step.path);
    if (!existsSync(src)) continue;
    mkdirSync(path.dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true, force: false, filter });
    applied.merged.push(step.path);
  }

  if (!plan.detected.packsRegistry) {
    const registryPath = path.join(root, 'packs', '_registry.yaml');
    mkdirSync(path.dirname(registryPath), { recursive: true });
    writeFileSync(
      registryPath,
      `${REGISTRY_HEADER.join('\n')}\nactivePacks:\n  - ${plan.suggestion.pack}\n`,
      'utf8',
    );
    applied.registry = `created (activePacks: [${plan.suggestion.pack}])`;
  }

  for (const move of plan.moves) {
    if (move.action !== 'move') {
      applied.leftInPlace.push(move.skill);
      continue;
    }
    const src = path.join(root, '.agents', 'skills', move.skill);
    const dst = path.join(root, 'packs', 'rr8-supabase-cf', 'skills', move.skill);
    if (!existsSync(src) || existsSync(dst)) {
      applied.leftInPlace.push(move.skill);
      continue;
    }
    mkdirSync(path.dirname(dst), { recursive: true });
    renameSync(src, dst);
    applied.moved.push(move.skill);
  }

  return applied;
}

function reportTimestamp(date = new Date()) {
  const iso = date.toISOString(); // 2026-10-17T05:30:00.000Z
  const compact = `${iso.slice(0, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
  return { iso, compact };
}

export function renderReport({ mode, root, framework, plan, applied }) {
  const { iso } = reportTimestamp();
  const d = plan.detected;
  const outcome = applied
    ? [
        `1. Harness merged (existing files preserved): ${applied.merged.join(', ') || 'nothing — already present'}`,
        `2. Pack registry: ${applied.registry}`,
        `3. Skills relocated into packs/rr8-supabase-cf/skills/: ${applied.moved.join(', ') || 'none — pack already ships them'}`,
        `4. Skills left in .agents/skills/ (custom or duplicate): ${applied.leftInPlace.join(', ') || 'none'}`,
      ]
    : plan.merge.map((step, i) => `${i + 1}. ${step.path} — ${step.mode}`).concat([
        `${plan.merge.length + 1}. Pack registry — ${plan.registry}`,
        `${plan.merge.length + 2}. Skills — ${plan.moves
          .map((m) => `${m.skill} (${m.action === 'move' ? 'move' : 'pack ships it, left in place'})`)
          .join('; ') || 'none'}`,
      ]);

  return `---
type: report
timestamp: ${iso}
---

# v1.x → v2.0 Migration Report

- **Mode:** ${mode}
- **Workspace:** \`${root}\`
- **Framework source:** \`${framework}\`
- **Generated:** ${iso}

## Detected state (step 1)

| Marker | Value |
|---|---|
| docs/bible/ | ${d.bible ? `${d.bibleChapters.length} chapter(s): ${d.bibleChapters.join(', ')}` : 'absent'} |
| .agents/skills/ | ${d.skillNames.length} real skill dir(s)${d.skillsRoot ? '' : ' (folder absent)'} |
| docs/backlog/ | ${d.backlog ? 'present — preserved untouched' : 'absent'} |
| docs/bible/DECISIONS.md | ${d.decisions ? 'present — preserved untouched' : 'absent'} |
| apps/ | ${d.apps.length > 0 ? `${d.apps.join(', ')} — user code, preserved untouched` : 'absent'} |
| v1 rule folders | ${d.v1RuleFolders.length > 0 ? d.v1RuleFolders.join(', ') : 'none'} |
| .shiftstone/harness | ${d.harness ? 'present' : 'absent'} |
| packs/_registry.yaml | ${d.packsRegistry ? 'present' : 'absent'} |

## Suggested archetype (step 2)

**${plan.suggestion.pack}** — matched on: ${plan.suggestion.tokens.join(', ') || 'default'}.

## Actions ${applied ? 'applied' : 'planned (dry-run)'}

${outcome.join('\n')}

## Preserved by contract

\`apps/**\` (code), \`docs/backlog/**\`, \`docs/bible/**\` (incl. DECISIONS.md),
\`.git/**\`, and every custom skill in \`.agents/skills/\`
(${plan.preservedSkills.join(', ') || 'none found'}) — never written, never deleted.

## Follow-up (manual)

${plan.followups.map((item, i) => `${i + 1}. ${item}`).join('\n')}
`;
}

/**
 * Full migration entry point.
 * @param {{root: string, framework: string, apply?: boolean, report?: boolean, archetypeOverride?: string}} options
 * @returns {{code: number, lines: string[], plan: any, reportPath?: string}}
 */
export function run({ root, framework = DEFAULT_FRAMEWORK, apply = false, report = false, archetypeOverride }) {
  const lines = [];
  if (!existsSync(root)) {
    return { code: 1, lines: [`error: workspace root not found: ${root}`] };
  }
  if (!existsSync(path.join(framework, 'packs'))) {
    return { code: 1, lines: [`error: framework source has no packs/ directory: ${framework}`] };
  }

  const plan = buildPlan({ root, framework, archetypeOverride });
  if (plan.errors.length > 0) {
    return { code: 1, lines: plan.errors.map((error) => `error: ${error}`), plan };
  }

  const state = plan.detected;
  if (!state.isV1 && state.alreadyMigrated) {
    lines.push('already a v2.0 workspace (packs/_registry.yaml + .shiftstone/harness present) — nothing to migrate.');
    return { code: 0, lines, plan };
  }
  if (!state.isV1) {
    lines.push('not a v1.x workspace (no docs/bible/ and no .agents/skills/) — nothing to migrate.');
    return { code: 0, lines, plan };
  }

  const mode = apply ? 'APPLY' : 'DRY RUN';
  lines.push(`v1.x → v2.0 migration — ${mode}${apply ? '' : ' (nothing written)'}`);
  lines.push('');
  lines.push(
    `Detected: bible=${state.bible ? `${state.bibleChapters.length} chapters` : 'no'}, ` +
      `skills=${state.skillNames.length} (${plan.moves.length} rr8-coupled, ${plan.preservedSkills.length} custom), ` +
      `backlog=${state.backlog}, decisions=${state.decisions}, apps=${state.apps.join('+') || 'none'}`,
  );
  lines.push(`Suggested archetype: ${plan.suggestion.pack} (${plan.suggestion.tokens.join(', ')})`);
  lines.push('');
  lines.push('Plan:');
  plan.merge.forEach((step, index) => {
    lines.push(`  ${index + 1}. harness ${step.path} — ${step.mode}`);
  });
  lines.push(`  ${plan.merge.length + 1}. packs/_registry.yaml — ${plan.registry}`);
  const moveList = plan.moves.filter((m) => m.action === 'move').map((m) => m.skill);
  const owned = plan.moves.length - moveList.length;
  lines.push(
    `  ${plan.merge.length + 2}. skills — move ${moveList.length}: [${moveList.join(', ')}]; ` +
      `${owned} already shipped by the pack (left in place); ${plan.preservedSkills.length} custom preserved`,
  );
  lines.push('Follow-up (manual):');
  for (const item of plan.followups) lines.push(`  - ${item}`);

  let applied = null;
  let reportPath;
  if (apply) {
    applied = applyPlan(plan, { root, framework });
    lines.push('');
    lines.push(`applied: merged [${applied.merged.join(', ')}], registry ${applied.registry}, moved [${applied.moved.join(', ')}]`);
  }

  if (apply || report) {
    const { compact } = reportTimestamp();
    const dir = path.join(root, 'docs', 'reports');
    mkdirSync(dir, { recursive: true });
    let candidate = path.join(dir, `${compact}-v1-to-v2-migration.md`);
    let suffix = 2;
    while (existsSync(candidate)) {
      candidate = path.join(dir, `${compact}-v1-to-v2-migration-${suffix}.md`);
      suffix += 1;
    }
    writeFileSync(
      candidate,
      renderReport({ mode: apply ? 'applied' : 'dry-run', root, framework, plan, applied }),
      'utf8',
    );
    reportPath = candidate;
    lines.push(`report: ${path.relative(root, candidate).split(path.sep).join('/')}`);
  } else {
    lines.push('');
    lines.push('dry-run only — re-run with --apply to execute (the report is written on apply).');
  }

  return { code: 0, lines, plan, reportPath };
}

function parseArgs(argv) {
  const flags = { apply: false, report: false, root: process.cwd(), framework: DEFAULT_FRAMEWORK, archetypeOverride: undefined };
  for (const arg of argv) {
    if (arg === '--apply') flags.apply = true;
    else if (arg === '--report') flags.report = true;
    else if (arg.startsWith('--root=')) flags.root = path.resolve(arg.slice('--root='.length));
    else if (arg.startsWith('--framework=')) flags.framework = path.resolve(arg.slice('--framework='.length));
    else if (arg.startsWith('--archetype=')) flags.archetypeOverride = arg.slice('--archetype='.length);
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else flags.unknown = arg;
  }
  return flags;
}

const USAGE = `usage: node .shiftstone/migrate-v1-to-v2.js [--apply] [--report] [--root=<dir>] [--framework=<dir>] [--archetype=<name>]

  dry-run by default; --apply performs the migration and writes
  docs/reports/<timestamp>-v1-to-v2-migration.md`;

export function main(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  if (flags.help) {
    console.log(USAGE);
    return 0;
  }
  if (flags.unknown) {
    console.error(`error: unknown argument: ${flags.unknown}`);
    console.error(USAGE);
    return 1;
  }
  const result = run({
    root: flags.root,
    framework: flags.framework,
    apply: flags.apply,
    report: flags.report,
    archetypeOverride: flags.archetypeOverride,
  });
  for (const line of result.lines) console.log(line);
  return result.code;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main());
