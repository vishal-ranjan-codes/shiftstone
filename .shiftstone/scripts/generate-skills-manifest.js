#!/usr/bin/env node
/**
 * Generates .shiftstone/context/skills-manifest.yaml from .agents/skills/* and
 * refreshes the generated Skill INDEX block in AGENTS.md (single source of
 * truth: each SKILL.md frontmatter).
 *
 *   node .shiftstone/scripts/generate-skills-manifest.js
 *
 * Budgets are read from .shiftstone/context/token-budget.json (canonical caps).
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { listActivePackSkills, listCoreSkills, readPackRegistry } from '../context/skill-paths.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUDGET_PATH = path.join(ROOT, '.shiftstone', 'context', 'token-budget.json');

const ROUTES_PATHS = ['apps/web/app/routes.ts', 'apps/web/app/routes/**'];
const SUPABASE_PATHS = ['supabase/**', 'apps/web/app/lib/supabase/**'];
const WORKERS_PATHS = ['workers/**', 'wrangler.jsonc'];
const UI_PATHS = ['apps/web/app/components/**', 'apps/web/app/routes/**/*.tsx', '**/*.css'];
const MIDDLEWARE_PATHS = ['apps/web/app/middleware/**', 'workers/**'];

/** tier / paths / depends_on per skill (blueprint §6.3). */
const CONFIG = {
  stack: { tier: 'always-load' },
  'find-skills': { tier: 'manual-load' },
  swarm: { tier: 'manual-load' },

  'react-router-routing': { paths: ROUTES_PATHS, depends_on: ['stack'] },
  'react-router-data-loading': { paths: ROUTES_PATHS, depends_on: ['stack', 'react-router-routing'] },
  'react-router-actions-forms': { paths: ROUTES_PATHS, depends_on: ['stack', 'react-router-routing'] },
  'react-router-error-boundaries': { paths: ROUTES_PATHS, depends_on: ['stack', 'react-router-routing'] },
  'react-router-middleware': { paths: ['apps/web/app/middleware/**'], depends_on: ['stack', 'react-router-routing'] },
  'react-router-typegen': { paths: ['apps/web/**'], depends_on: ['stack', 'react-router-routing'] },

  'supabase-auth': { paths: SUPABASE_PATHS, depends_on: ['stack', 'supabase-postgres'] },
  'supabase-postgres': { paths: SUPABASE_PATHS, depends_on: ['stack'] },
  'supabase-migrations': { paths: SUPABASE_PATHS, depends_on: ['supabase-postgres'] },
  'supabase-rls': { paths: SUPABASE_PATHS, depends_on: ['supabase-postgres', 'supabase-migrations'] },
  'supabase-api-keys': { paths: SUPABASE_PATHS, depends_on: ['stack'] },
  'supabase-realtime': { paths: SUPABASE_PATHS, depends_on: ['stack', 'supabase-auth'] },

  'cloudflare-workers': { paths: WORKERS_PATHS, depends_on: ['stack'] },
  'cloudflare-cron': { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  'cloudflare-kv': { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  'cloudflare-d1': { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  'cloudflare-queues': { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  'cloudflare-r2': { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  'ci-cd-cloudflare': { paths: ['.github/workflows/**', 'wrangler.jsonc'], depends_on: ['cloudflare-workers'] },
  jobs: { paths: WORKERS_PATHS, depends_on: ['cloudflare-workers'] },
  storage: { paths: ['apps/web/app/routes/api/storage/**', 'workers/**'], depends_on: ['cloudflare-r2'] },

  ui: { paths: UI_PATHS, depends_on: ['design-tokens', 'tailwind-v4', 'shadcn-ui'] },
  'tailwind-v4': { paths: UI_PATHS, depends_on: ['design-tokens'] },
  'design-tokens': { paths: UI_PATHS, depends_on: [] },
  'shadcn-ui': { paths: UI_PATHS, depends_on: ['tailwind-v4', 'design-tokens'] },
  'theme-management': { paths: UI_PATHS, depends_on: ['design-tokens'] },
  'web-design-guidelines': { paths: UI_PATHS, depends_on: ['ui'] },

  'zod-validation': { paths: ['apps/web/**'], depends_on: ['stack'] },
  'security-headers': { paths: MIDDLEWARE_PATHS, depends_on: ['stack'] },
  'rate-limiting': { paths: MIDDLEWARE_PATHS, depends_on: ['stack'] },
  'graceful-degradation': { paths: MIDDLEWARE_PATHS, depends_on: ['stack'] },
  'vitest-testing': { paths: ['**/*.test.ts', '**/*.test.tsx', 'vitest.config.ts'], depends_on: ['stack'] },
  'playwright-e2e': { paths: ['e2e/**', 'playwright.config.ts'], depends_on: ['vitest-testing'] },

  backlog: { paths: ['docs/backlog/**'], depends_on: [] },
  'research-methodology': { paths: ['docs/research/**'], depends_on: [] },
  'ss-docs': { paths: ['docs/bible/**', 'docs/backlog/**', 'docs/research/**'], depends_on: [] },
  'ss-bookkeeping': { paths: ['docs/**', '.shiftstone/packs/**', '.agents/skills/**', '_config/**'], depends_on: [] },
  'ss-sync-engine': { paths: ['.shiftstone/**', 'frameworks/**'], depends_on: [] },
};

function tagsFor(name) {
  if (name === 'ss-bookkeeping' || name === 'ss-docs') return ['shiftstone', 'core', 'docs'];
  if (name.startsWith('ss-')) return ['shiftstone', 'core'];
  if (name.startsWith('react-router-')) return ['react-router', 'frontend', 'rr8'];
  if (name.startsWith('supabase-')) return ['supabase', 'backend', 'rr8'];
  if (name.startsWith('cloudflare-') || name === 'jobs' || name === 'storage') return ['cloudflare', 'edge'];
  if (['ui', 'tailwind-v4', 'design-tokens', 'shadcn-ui', 'theme-management', 'web-design-guidelines'].includes(name)) return ['ui', 'design'];
  if (['vitest-testing', 'playwright-e2e'].includes(name)) return ['testing'];
  if (['docs', 'backlog', 'research-methodology', 'bookkeeping'].includes(name)) return ['docs'];
  if (['loop-author', 'skills-author', 'find-skills', 'swarm'].includes(name)) return ['meta'];
  if (name === 'stack') return ['stack', 'rr8'];
  if (name === 'zod-validation') return ['validation'];
  if (['security-headers', 'rate-limiting'].includes(name)) return ['security'];
  if (name === 'graceful-degradation') return ['resilience'];
  if (name === 'ci-cd-cloudflare') return ['ci'];
  return [];
}

function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return {};
  return parseYaml(match[1]) ?? {};
}

function wrapIndex(names, width = 200) {
  const lines = [];
  let current = '';
  for (const name of names) {
    const next = current ? `${current}, ${name}` : name;
    if (next.length > width) {
      lines.push(current);
      current = name;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.map((l) => `- ${l}`).join('\n');
}

const budget = JSON.parse(readFileSync(BUDGET_PATH, 'utf8'));

/** Wrap a message for CLI output; function form stays quiet. */
function fail(message, quiet) {
  if (!quiet) console.error(`error: ${message}`);
  throw new Error(message);
}

/**
 * Regenerate .shiftstone/context/skills-manifest.yaml + the AGENTS.md Skill INDEX
 * for `root` (defaults to this repo). Used by the CLI and by
 * .shiftstone/init/seed-governance.js when composing a workspace.
 *
 * `appPath`/`defaultAppPath` rewrite the `apps/<default>` path-scopes when
 * composition relocates the app folder (--app-path); omitted for default
 * compositions (no rewrite).
 *
 * @param {{ root?: string, quiet?: boolean, appPath?: string, defaultAppPath?: string }} [options]
 * @returns {{ skills: any[], activePacks: string[] }}
 */
export function generateSkillsManifest({ root = ROOT, quiet = false, appPath, defaultAppPath } = {}) {
  const activePacks = readPackRegistry(root).activePacks;

  // Core skills live as real dirs in .agents/skills; pack skills live under
  // .shiftstone/packs/<pack>/skills/ and may be junctioned into .agents/skills (never
  // scanned here — links would double-count their tracked source).
  const skillDirs = [
    ...listCoreSkills(root).map((name) => ({
      name,
      dir: path.join(root, '.agents', 'skills', name),
      pack: null,
    })),
    ...listActivePackSkills(root).map(({ name, pack, dir }) => ({ name, dir, pack })),
  ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const skills = [];
  const errors = [];
  const seen = new Set();
  for (const { name: dirName, dir, pack: locationPack } of skillDirs) {
    if (seen.has(dirName)) {
      errors.push(`${dirName}: provided by both a pack and .agents/skills (duplicate skill)`);
      continue;
    }
    seen.add(dirName);
    const skillPath = path.join(dir, 'SKILL.md');
    const instructionsPath = path.join(dir, 'instructions.md');
    if (!existsSync(skillPath)) {
      errors.push(`${dirName}: missing SKILL.md`);
      continue;
    }
    if (!existsSync(instructionsPath)) {
      errors.push(`${dirName}: missing instructions.md (run .shiftstone/scripts/convert-skills-3tier.js)`);
      continue;
    }
    const frontmatter = parseFrontmatter(readFileSync(skillPath, 'utf8'));
    const name = frontmatter.name ?? dirName;
    if (name !== dirName) errors.push(`${dirName}: frontmatter name "${name}" must match directory`);
    if (!frontmatter.description) errors.push(`${dirName}: SKILL.md missing description`);

    const instructions = readFileSync(instructionsPath, 'utf8');
    const isSsCore = dirName.startsWith('ss-');
    const isPackLocal = locationPack && locationPack !== 'rr8-supabase-cf';
    const config = isPackLocal
      ? { paths: ['**'], depends_on: [] }
      : (CONFIG[dirName] ?? (isSsCore ? { tier: 'manual-load', depends_on: [] } : { paths: ['**'], depends_on: [] }));
    let paths = config.paths;
    if (appPath && defaultAppPath && appPath !== defaultAppPath) {
      paths = paths?.map((p) => p.split(defaultAppPath).join(appPath));
    }
    const depends_on = Array.isArray(frontmatter.depends_on)
      ? frontmatter.depends_on
      : (config.depends_on ?? []);
    skills.push({
      name,
      pack: locationPack ?? frontmatter.pack ?? 'core',
      tier: config.tier ?? (isSsCore ? 'manual-load' : 'path-scoped'),
      ...(paths ? { paths } : {}),
      tokenCost: Math.max(1, Math.ceil(instructions.length / 4)),
      depends_on,
      description: frontmatter.description ?? '',
      tags: frontmatter.tags ?? tagsFor(dirName),
    });
  }

  if (errors.length > 0) {
    for (const error of errors) if (!quiet) console.error(`error: ${error}`);
    throw new Error(`skills manifest generation failed: ${errors.join('; ')}`);
  }

  // dependency sanity: every depends_on must exist
  const names = new Set(skills.map((s) => s.name));
  for (const skill of skills) {
    for (const dep of skill.depends_on) {
      if (!names.has(dep)) fail(`${skill.name} depends on unknown skill "${dep}"`, quiet);
    }
  }

  const manifest = {
    apiVersion: 'context/v1',
    kind: 'SkillsManifest',
    metadata: {
      generated: new Date().toISOString(),
      coreVersion: '2.1.0',
      activePacks,
    },
    spec: {
      budget: {
        static_max_lines: budget.static_max_lines,
        dynamic_max_tokens: budget.dynamic_max_tokens,
      },
      skills,
    },
  };

  const manifestPath = path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml');
  writeFileSync(
    manifestPath,
    `# Generated by .shiftstone/scripts/generate-skills-manifest.js — do not edit by hand.\n${stringifyYaml(manifest)}`,
    'utf8',
  );
  if (!quiet) console.log(`wrote ${path.relative(root, manifestPath)} (${skills.length} skills)`);

  // Refresh the generated Skill INDEX block in AGENTS.md
  const agentsPath = path.join(root, 'AGENTS.md');
  const agents = readFileSync(agentsPath, 'utf8');
  const block = `<!-- SKILL-INDEX:BEGIN -->\n${wrapIndex(skills.map((s) => s.name))}\n<!-- SKILL-INDEX:END -->`;
  const updated = agents.replace(/<!-- SKILL-INDEX:BEGIN -->[\s\S]*?<!-- SKILL-INDEX:END -->/, block);
  if (updated === agents && !agents.includes('SKILL-INDEX:BEGIN')) {
    fail('AGENTS.md missing SKILL-INDEX markers', quiet);
  }
  writeFileSync(agentsPath, updated, 'utf8');
  if (!quiet) console.log(`refreshed Skill INDEX in AGENTS.md (${skills.length} names)`);

  return { skills, activePacks };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    generateSkillsManifest();
  } catch {
    process.exit(1);
  }
}
