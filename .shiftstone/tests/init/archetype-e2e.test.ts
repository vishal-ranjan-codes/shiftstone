/**
 * Phase 4 exit criteria (blueprint §9.1 old phase 3 + phase file):
 *   1. `--archetype=fastapi-pg` → zero RR8/Supabase/CF tokens on the
 *      composed workspace surface (full surface: docs, steering, rules,
 *      workflows, settings, skills, generated manifest — packs/ excluded
 *      by design: the pack library always ships every archetype's content)
 *   2. `--archetypes=rr8-supabase-cf,fastapi-pg` → polyglot monorepo with
 *      two independent git remotes
 *   3. Default (flagship) init preserves the pre-refactor UX: bible
 *      overlays byte-identical, pack surface overlays (path rules +
 *      workflows) byte-identical, 9 seeded ADRs, 37 pack skills junctioned
 */

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkAll } from '../../governance/index-generator.ts';
import { main } from '../../init.js';
import { composeArchetypes } from '../../init/compose.js';
import { buildVariables } from '../../init/variables.js';
import { makeWorkspace, walkFiles } from './workspace-fixture.js';

const STACK_TOKENS = /react[ -]?router|supabase|cloudflare|wrangler|tailwind|shadcn/i;

/**
 * Surfaces init composes for the active workspace. Excludes `packs/` (the
 * pack library by design retains every archetype's stack content) and
 * engine-only docs (README, blueprint, backlog) that are never part of a
 * composed workspace's operating surface.
 */
const ACTIVE_SURFACE = [
  'docs',
  '.shiftstone/static-rules',
  '.shiftstone/path-scoped-rules',
  '.shiftstone/workflows',
  '.shiftstone/context/skills-manifest.yaml',
  'AGENTS.md',
  'ANTIGRAVITY.md',
  'CLAUDE.md',
  'COMMANDCODE.md',
  'opencode.json',
  '.commandcode/settings.json',
  'package.json',
  'pnpm-workspace.yaml',
  '.agents',
];

function findStackTokens(root: string): string[] {
  const hits: string[] = [];
  const scanFile = (file: string) => {
    const content = readFileSync(path.join(root, file), 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (STACK_TOKENS.test(line)) hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
    });
  };
  const scan = (rel: string) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return;
    if (!statSync(abs).isDirectory()) {
      scanFile(rel);
      return;
    }
    for (const file of walkFiles(abs)) scanFile(`${rel}/${file}`);
  };
  for (const surface of ACTIVE_SURFACE) scan(surface);
  return hits;
}

describe('exit criterion — --archetype=fastapi-pg produces zero RR8/Supabase/CF tokens', () => {
  it('composes a clean python workspace', async () => {
    const root = await makeWorkspace();
    const code = await main([
      `--root=${root}`,
      '--archetype=fastapi-pg',
      '--name=PyApp',
      '--layout=monorepo',
      '-y',
    ]);
    expect(code).toBe(0);

    // The token-free claim, surface by surface
    expect(findStackTokens(root)).toEqual([]);

    // Pack rule/settings overlays were never composed, and the opencode
    // instructions list was pruned of the missing pack rule file.
    expect(existsSync(path.join(root, '.shiftstone', 'path-scoped-rules', 'stack-rules.md'))).toBe(false);
    const fastOpencode = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
    expect(fastOpencode.instructions).not.toContain('.shiftstone/path-scoped-rules/stack-rules.md');
    const fastSettings = JSON.parse(readFileSync(path.join(root, '.commandcode', 'settings.json'), 'utf8'));
    expect(fastSettings.permissions.ask.join('\n')).not.toMatch(STACK_TOKENS);

    // Registry + generated manifest reflect only the active pack
    const regPath = existsSync(path.join(root, '.shiftstone', 'packs', '_registry.yaml'))
      ? path.join(root, '.shiftstone', 'packs', '_registry.yaml')
      : path.join(root, 'packs', '_registry.yaml');
    const registry = readFileSync(regPath, 'utf8');
    expect(registry).toContain('fastapi-pg');
    expect(registry).not.toContain('rr8-supabase-cf');
    const manifest = readFileSync(path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml'), 'utf8');
    expect(manifest).toContain('activePacks:\n    - fastapi-pg');
    expect(manifest).not.toContain('react-router-routing');

    // Skills view: only the core skills, every pack junction pruned
    const skillsDir = path.join(root, '.agents', 'skills');
    const entries = walkFiles(skillsDir, '').map((f) => f.split('/')[0]);
    const dirs = [...new Set(entries)];
    expect(dirs.sort()).toEqual([
      'find-skills',
      'ss-add-skill',
      'ss-backlog-sync',
      'ss-bookkeeping',
      'ss-brainstorm',
      'ss-brand-naming',
      'ss-bug-report',
      'ss-deploy',
      'ss-diagnose',
      'ss-docs',
      'ss-execute-plan',
      'ss-import-research',
      'ss-init',
      'ss-lesson',
      'ss-loop-author',
      'ss-new-cron-job',
      'ss-new-feature',
      'ss-new-migration',
      'ss-nexus',
      'ss-plan',
      'ss-push',
      'ss-refresh-research',
      'ss-research',
      'ss-review',
      'ss-schema-sync',
      'ss-simplify',
      'ss-status',
      'ss-sync-bible',
      'ss-sync-engine',
      'ss-upgrade-research',
      'ss-upgrade-skill',
      'ss-verify',
    ]);

    // Bible stays the stack-agnostic template (no rr8 overlays)
    const architecture = readFileSync(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      'utf8',
    );
    expect(architecture).toContain('Describe the request/data flow');
    expect(architecture).not.toMatch(STACK_TOKENS);

    // 4.5: pack-seeded ADRs apply only when the pack is installed
    const decisions = readFileSync(path.join(root, 'docs', 'bible', 'DECISIONS.md'), 'utf8');
    expect(decisions).toContain('Pack-seeded ADRs are inserted here');
    expect(decisions).not.toMatch(/^## DEC-\d+ /m);

    // Pack-aware opencode: python app path allowed, no Supabase MCP
    const opencode = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
    expect(opencode.permission.external_directory['apps/api/**']).toBe('allow');
    expect(opencode.permission.external_directory['{{APP_PATH}}/**']).toBeUndefined();
    expect(opencode.mcp.supabase).toBeUndefined();

    // Identity injected from the pack's declared variables
    const product = readFileSync(path.join(root, '.shiftstone', 'static-rules', 'product.md'), 'utf8');
    expect(product).toContain('a FastAPI + PostgreSQL service');
    expect(product).toContain('Python 3.12, FastAPI');

    // Scaffold created the app with resolved (not literal) placeholders
    const mainPy = readFileSync(path.join(root, 'apps', 'api', 'main.py'), 'utf8');
    expect(mainPy).toContain('PyApp');
    expect(mainPy).not.toContain('{{');
  }, 60_000);
});

describe('exit criterion — default flagship init preserves pre-refactor UX', () => {
  it('composes the rr8 workspace byte-identically where it matters', async () => {
    const root = await makeWorkspace();
    const code = await main([`--root=${root}`, '--name=ParityApp', '--layout=monorepo', '-y']);
    expect(code).toBe(0);

    // 1. All 10 stack chapters come from the pack overlays verbatim
    //    (composed files additionally carry the substituted placeholders)
    const composition = composeArchetypes({}, { root });
    const { map } = buildVariables({
      answers: { projectName: 'ParityApp', layout: 'monorepo', packageManager: 'pnpm' },
      composition,
    });
    const overlayRel = existsSync(path.join(root, '.shiftstone', 'packs'))
      ? path.join('.shiftstone', 'packs', 'rr8-supabase-cf', 'bible-overlays')
      : path.join('packs', 'rr8-supabase-cf', 'bible-overlays');
    const overlayFiles = walkFiles(path.join(root, overlayRel));
    expect(overlayFiles.length).toBe(10);
    for (const rel of overlayFiles) {
      const composed = readFileSync(path.join(root, 'docs', 'bible', rel), 'utf8');
      let expected = readFileSync(path.join(root, overlayRel, rel), 'utf8');
      for (const [key, value] of Object.entries(map)) expected = expected.split(key).join(value);
      expect(composed, `bible chapter ${rel}`).toBe(expected);
    }

    // 1b. Pack surface overlays (path rules + workflows) byte-match the pack
    //     sources after the same substitution — stack content restored verbatim.
    const overlayTargets: Record<string, string> = {
      'path-rules': 'path-scoped-rules',
      workflows: 'workflows',
    };
    for (const [packRel, coreRel] of Object.entries(overlayTargets)) {
      const packDir = existsSync(path.join(root, '.shiftstone', 'packs'))
        ? path.join(root, '.shiftstone', 'packs', 'rr8-supabase-cf', packRel)
        : path.join(root, 'packs', 'rr8-supabase-cf', packRel);
      const targetDir = path.join(root, '.shiftstone', coreRel);
      const files = walkFiles(packDir);
      expect(files.length).toBeGreaterThan(0);
      for (const rel of files) {
        let expected = readFileSync(path.join(packDir, rel), 'utf8');
        for (const [key, value] of Object.entries(map)) expected = expected.split(key).join(value);
        expect(readFileSync(path.join(targetDir, rel), 'utf8'), `${packRel}/${rel}`).toBe(expected);
      }
    }

    // 1c. Inverse of the zero-token gate: the flagship surface carries its stack content.
    const stackRules = readFileSync(path.join(root, '.shiftstone', 'path-scoped-rules', 'stack-rules.md'), 'utf8');
    expect(stackRules).toContain('Supabase');
    expect(stackRules).toContain('wrangler');
    expect(readFileSync(path.join(root, '.shiftstone', 'workflows', 'deploy.md'), 'utf8')).toContain('wrangler');
    const ccSettings = JSON.parse(readFileSync(path.join(root, '.commandcode', 'settings.json'), 'utf8'));
    expect(ccSettings.permissions.ask).toContain('Shell(wrangler deploy:*)');
    const flagshipOpencode = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
    expect(flagshipOpencode.instructions).toContain('.shiftstone/path-scoped-rules/stack-rules.md');

    // 2. All 9 seeded ADRs rendered, marker consumed, DEC-001 byte-stable
    const decisions = readFileSync(path.join(root, 'docs', 'bible', 'DECISIONS.md'), 'utf8');
    expect(decisions).not.toContain('Pack-seeded ADRs are inserted');
    expect(decisions.match(/^## DEC-\d+ /gm)).toHaveLength(9);
    const dec001 = decisions.split('## DEC-001')[1].split('\n\n---')[0];
    expect(`## DEC-001${dec001}`).toBe(
      '## DEC-001 — React Router 8 (Framework Mode) Architecture\n\n' +
        '- **Date**: 2026-09-05\n' +
        '- **Status**: Accepted\n' +
        '- **Context**: Needed a modern, full-stack React framework with first-class server-side rendering, streaming, data loading, route-level middleware, and native Edge runtime compatibility.\n' +
        '- **Decision**: Adopt React Router 8 in framework mode (`@react-router/dev`), taking advantage of native `MiddlewareFunction` support, type-safe Context API, and automatic route type generation (`+types/`).\n' +
        '- **Consequences**: Avoids complex server/client component boundaries from RSC; provides unified loaders, actions, and middleware per route module.',
    );

    // 3. All 37 pack skills surfaced as junctions + 32 real core skills (31 ss-* + find-skills = 69)
    const skillsDir = path.join(root, '.agents', 'skills');
    const skillNames = new Set<string>();
    let junctions = 0;
    for (const { name } of readdirSync(skillsDir, { withFileTypes: true })) {
      skillNames.add(name);
      if (lstatSync(path.join(skillsDir, name)).isSymbolicLink()) junctions += 1;
    }
    expect(junctions).toBe(37);
    expect(skillNames.size).toBe(69);

    // 4. Generated manifest: 69 skills, flagship active, INDEX refreshed
    const manifest = readFileSync(path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml'), 'utf8');
    expect(manifest).toContain('- rr8-supabase-cf');
    expect((manifest.match(/^ {4}- name: /gm) ?? []).length).toBe(69);
    const agents = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('react-router-routing');
    expect(agents).toContain('loop-author');

    // 5. Workspace files from the pack's spec (pre-refactor shape)
    expect(readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')).toBe(
      "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    );
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('parityapp-workspace');
    expect(pkg.scripts.dev).toBe('pnpm -C apps/web dev');
    expect(pkg.scripts['supabase:types']).toBe('pnpm -C apps/web supabase:types');
    expect(pkg.pnpm.onlyBuiltDependencies).toEqual(['esbuild', 'workerd']);

    // 6. Identity placeholders resolved to the flagship stack
    const product = readFileSync(path.join(root, '.shiftstone', 'static-rules', 'product.md'), 'utf8');
    expect(product).toContain('ParityApp — a full-stack React Router 8 + Supabase + Cloudflare application');
    expect(product).toContain('pnpm monorepo (apps/web)');
    expect(product).not.toContain('{{');

    // 7. Pack-aware opencode merged the supabase MCP fragment
    const opencode = JSON.parse(readFileSync(path.join(root, 'opencode.json'), 'utf8'));
    expect(opencode.permission.external_directory['apps/web/**']).toBe('allow');
    expect(opencode.mcp.supabase).toBeDefined();

    // 8. Workspace descriptor written
    const metadata = JSON.parse(readFileSync(path.join(root, '.workspace-git.json'), 'utf8'));
    expect(metadata.version).toBe(2);
    expect(metadata.archetypes[0].name).toBe('rr8-supabase-cf');
  }, 60_000);
});

describe('exit criterion — polyglot monorepo with two independent git remotes', () => {
  it('composes rr8 + fastapi with independent app repos', async () => {
    const root = await makeWorkspace();
    const code = await main([
      `--root=${root}`,
      '--archetypes=rr8-supabase-cf,fastapi-pg',
      '--name=Polyglot',
      '--layout=monorepo',
      '--gh-user=octocat',
      '-y',
    ]);
    expect(code).toBe(0);

    expect(existsSync(path.join(root, 'apps', 'web', '.git'))).toBe(true);
    expect(existsSync(path.join(root, 'apps', 'api', '.git'))).toBe(true);
    const webConfig = readFileSync(path.join(root, 'apps', 'web', '.git', 'config'), 'utf8');
    const apiConfig = readFileSync(path.join(root, 'apps', 'api', '.git', 'config'), 'utf8');
    expect(webConfig).toContain('https://github.com/octocat/polyglot-app.git');
    expect(apiConfig).toContain('https://github.com/octocat/polyglot-fastapi-pg-app.git');

    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toContain('/apps/web/');
    expect(gitignore).toContain('/apps/api/');

    const metadata = JSON.parse(readFileSync(path.join(root, '.workspace-git.json'), 'utf8'));
    expect(metadata.archetypes).toHaveLength(2);
    expect(new Set(metadata.archetypes.map((a: { remote: string }) => a.remote)).size).toBe(2);

    // Both stacks coexist: rr8 bible overlays + fastapi scaffold
    const architecture = readFileSync(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      'utf8',
    );
    expect(architecture).toContain('Cloudflare'); // rr8 overlay applied
    expect(existsSync(path.join(root, 'apps', 'api', 'main.py'))).toBe(true);

    // Primary archetype owns the active skills + identity
    expect(existsSync(path.join(root, '.agents', 'skills', 'react-router-routing'))).toBe(true);
    const product = readFileSync(path.join(root, '.shiftstone', 'static-rules', 'product.md'), 'utf8');
    expect(product).toContain('a full-stack React Router 8 + Supabase + Cloudflare application');
  }, 60_000);
});

describe('composition rewrites path scopes when --app-path relocates the app folder', () => {
  it('rewrites pack path-rule scopes and generated manifest paths to the effective app path', async () => {
    const root = await makeWorkspace();
    const code = await main([
      `--root=${root}`,
      '--archetype=rr8-supabase-cf',
      '--name=ReloApp',
      '--layout=monorepo',
      '--app-path=apps/console',
      '-y',
    ]);
    expect(code).toBe(0);

    // Pack path-rule overlays: frontmatter globs + in-body literals rewritten
    const stackRules = readFileSync(path.join(root, '.shiftstone', 'path-scoped-rules', 'stack-rules.md'), 'utf8');
    expect(stackRules).toContain('"apps/console/**/*"');
    expect(stackRules).not.toContain('"apps/web/**/*"');
    expect(stackRules).not.toContain('apps/web/');

    // Generated skills manifest: every apps/<default> scope relocated
    const manifest = readFileSync(path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml'), 'utf8');
    expect(manifest).toContain('apps/console/');
    expect(manifest).not.toContain('apps/web/');
  }, 60_000);
});

describe('project-skill template parameterization (pack variables over core defaults)', () => {
  it('flagship composition restores the stack-specific template values', async () => {
    const root = await makeWorkspace();
    const code = await main([
      `--root=${root}`,
      '--archetype=rr8-supabase-cf',
      '--name=SkillApp',
      '--layout=monorepo',
      '--skills=payments',
      '-y',
    ]);
    expect(code).toBe(0);
    const instructions = readFileSync(
      path.join(root, '.agents', 'skills', 'payments', 'instructions.md'),
      'utf8',
    );
    expect(instructions).toContain('`npx wrangler secret put <KEY>`');
    expect(instructions).toContain('`.dev.vars`');
    expect(instructions).toContain('**Zod**');
    expect(instructions).toContain('`ActionResult<T>`');
    // 3-tier compliant: the manifest generator must accept the synthesized skill
    const manifest = readFileSync(path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml'), 'utf8');
    expect(manifest).toContain('- name: payments');
  }, 60_000);

  it('a non-flagship composition keeps the template token-free via core defaults', async () => {
    const root = await makeWorkspace();
    const code = await main([
      `--root=${root}`,
      '--archetype=fastapi-pg',
      '--name=SkillApp',
      '--layout=monorepo',
      '--skills=payments',
      '-y',
    ]);
    expect(code).toBe(0);
    const instructions = readFileSync(
      path.join(root, '.agents', 'skills', 'payments', 'instructions.md'),
      'utf8',
    );
    expect(instructions).toContain('`.env`');
    expect(instructions).toContain('platform secret manager');
    expect(instructions).toContain('a schema validator');
    expect(instructions).not.toMatch(STACK_TOKENS);
    const manifest = readFileSync(path.join(root, '.shiftstone', 'context', 'skills-manifest.yaml'), 'utf8');
    expect(manifest).toContain('- name: payments');
  }, 60_000);
});

describe('exit criterion — archetype-aware backlog seeding (LOCK-B3)', () => {
  const backlogSeedDir = (root: string) => {
    const namespaced = path.join(root, '.shiftstone', 'packs', 'rr8-supabase-cf', 'backlog-seed');
    return existsSync(namespaced)
      ? namespaced
      : path.join(root, 'packs', 'rr8-supabase-cf', 'backlog-seed');
  };

  it('flagship init composes docs/backlog from the pack seed (golden parity)', async () => {
    const root = await makeWorkspace();
    const code = await main([`--root=${root}`, '--name=BacklogApp', '--layout=monorepo', '-y']);
    expect(code).toBe(0);

    const seedDir = backlogSeedDir(root);
    const seedFiles = walkFiles(seedDir);
    expect(seedFiles.length).toBeGreaterThan(0);

    const composition = composeArchetypes({}, { root });
    const { map } = buildVariables({
      answers: { projectName: 'BacklogApp', layout: 'monorepo', packageManager: 'pnpm' },
      composition,
    });
    for (const rel of seedFiles) {
      const composedPath = path.join(root, 'docs', 'backlog', rel);
      expect(existsSync(composedPath), `docs/backlog/${rel} must be composed`).toBe(true);
      if (rel.endsWith('index.md')) continue; // governance-regenerated, checked below
      let expected = readFileSync(path.join(seedDir, rel), 'utf8');
      for (const [key, value] of Object.entries(map)) expected = expected.split(key).join(value);
      expect(readFileSync(composedPath, 'utf8'), `docs/backlog/${rel}`).toBe(expected);
    }
    const moc = readFileSync(path.join(root, 'docs', 'backlog', 'MOC.md'), 'utf8');
    expect(moc).toContain('BacklogApp');

    const check = await checkAll(path.join(root, 'docs', 'backlog'));
    expect([...check.missing, ...check.stale]).toEqual([]);
  }, 60_000);

  it('composing fastapi-pg over a flagship-seeded backlog purges flagship files and seeds the generic template', async () => {
    const root = await makeWorkspace();
    // Simulate a workspace previously composed from the flagship seed.
    const backlog = path.join(root, 'docs', 'backlog');
    mkdirSync(backlog, { recursive: true });
    cpSync(backlogSeedDir(root), backlog, { recursive: true });
    expect(existsSync(path.join(backlog, 'Phase 1 - Foundation & Auth Setup', '1.2-supabase-database.md'))).toBe(true);

    const code = await main([`--root=${root}`, '--archetype=fastapi-pg', '--name=PyApp', '--layout=monorepo', '-y']);
    expect(code).toBe(0);

    const files = walkFiles(backlog);
    // Zero flagship-titled task files, zero stack tokens anywhere in the backlog
    for (const rel of files) {
      expect(rel, `purged file resurfaced: ${rel}`).not.toMatch(STACK_TOKENS);
      expect(readFileSync(path.join(backlog, rel), 'utf8'), `stack token in ${rel}`).not.toMatch(STACK_TOKENS);
    }
    expect(files.some((f) => f.startsWith('Phase 1 - Foundation/'))).toBe(true);
    expect(files.some((f) => f.startsWith('Phase 2 - Feature/'))).toBe(true);
    expect(files.some((f) => f.startsWith('Phase 3 - Ship/'))).toBe(true);

    // MOC.md lists only the composed generic entries
    const moc = readFileSync(path.join(backlog, 'MOC.md'), 'utf8');
    expect(moc).toContain('PyApp');
    expect(moc).toContain('Phase 1 - Foundation');
    expect(moc).not.toContain('Foundation & Auth Setup');

    const check = await checkAll(backlog);
    expect([...check.missing, ...check.stale]).toEqual([]);
  }, 60_000);
});
