import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  ManifestValidationError,
  SkillsBudgetError,
  SkillsLoader,
  StageBudgetError,
  StageCrawlError,
  matchGlob,
  validateManifest,
  type ContextBudget,
  type SkillsManifest,
} from '../../context/skills-loader.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const BUDGET: ContextBudget = {
  static_max_lines: 200,
  dynamic_max_tokens: 8000,
  stage_min_tokens: 2000,
  stage_max_tokens: 8000,
};

function fixtureManifest(overrides?: Partial<SkillsManifest['spec']>): SkillsManifest {
  return {
    apiVersion: 'context/v1',
    kind: 'SkillsManifest',
    metadata: { generated: '2026-01-01T00:00:00Z', coreVersion: '2.0.0', activePacks: [] },
    spec: {
      budget: { static_max_lines: 200, dynamic_max_tokens: 8000 },
      skills: [
        { name: 'alpha', tier: 'always-load', tokenCost: 10, description: 'always on', tags: [] },
        { name: 'beta', tier: 'path-scoped', paths: ['src/**'], tokenCost: 100, depends_on: ['gamma'], description: 'beta skill', tags: ['beta'] },
        { name: 'gamma', tier: 'path-scoped', paths: ['lib/**'], tokenCost: 50, depends_on: [], description: 'gamma skill', tags: [] },
        { name: 'manual-thing', tier: 'manual-load', tokenCost: 20, description: 'explicit only', tags: [] },
      ],
      ...(overrides ?? {}),
    },
  };
}

async function tmpRootWithSkills(names: string[]): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
  for (const name of names) {
    const dir = path.join(root, '.agents', 'skills', name);
    await mkdir(path.join(dir, 'resources'), { recursive: true });
    await writeFile(path.join(dir, 'instructions.md'), `# ${name} instructions\nbody for ${name}\n`, 'utf8');
    await writeFile(path.join(dir, 'resources', 'deep.md'), `# ${name} deep reference\n`, 'utf8');
  }
  return root;
}

describe('matchGlob', () => {
  it('matches ** across depth, * within a segment, and normalizes slashes', () => {
    expect(matchGlob('**/*.test.ts', 'a/b/c.test.ts')).toBe(true);
    expect(matchGlob('**/*.test.ts', 'c.test.ts')).toBe(true);
    expect(matchGlob('docs/bible/**', 'docs/bible/01-architecture/x.md')).toBe(true);
    expect(matchGlob('apps/web/app/routes.ts', 'apps/web/app/routes.ts')).toBe(true);
    expect(matchGlob('apps/web/app/routes.ts', 'apps/web/app/routesX.ts')).toBe(false);
    expect(matchGlob('workers/**', 'apps/web/x.ts')).toBe(false);
    expect(matchGlob('docs/**', 'docs\\a\\b.md')).toBe(true);
  });
});

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const manifest = validateManifest(fixtureManifest());
    expect(manifest.spec.skills).toHaveLength(4);
  });

  it('rejects wrong apiVersion, duplicate names, missing paths and unknown deps', () => {
    expect(() => validateManifest({ ...fixtureManifest(), apiVersion: 'v0' })).toThrow(ManifestValidationError);
    const dup = fixtureManifest();
    dup.spec.skills.push({ ...dup.spec.skills[0] });
    expect(() => validateManifest(dup)).toThrow(/duplicate skill name/);
    const noPaths = fixtureManifest();
    (noPaths.spec.skills[1] as { paths?: string[] }).paths = undefined;
    expect(() => validateManifest(noPaths)).toThrow(/needs paths/);
    const badDep = fixtureManifest();
    badDep.spec.skills[1].depends_on = ['phantom'];
    expect(() => validateManifest(badDep)).toThrow(/unknown skill "phantom"/);
    const noDescription = fixtureManifest();
    noDescription.spec.skills[0].description = '';
    expect(() => validateManifest(noDescription)).toThrow(/description required/);
  });
});

describe('SkillsLoader — Tier 1 and matching', () => {
  it('loads the real manifest from disk (42 skills, budgets present)', async () => {
    const loader = await SkillsLoader.fromFiles({ root: REPO_ROOT });
    expect(loader.manifest.spec.skills.length).toBeGreaterThanOrEqual(42);
    expect(loader.budget.dynamic_max_tokens).toBe(8000);
    const tier1 = loader.getManifest();
    expect(tier1.every((s) => s.name && s.description && typeof s.tokenCost === 'number')).toBe(true);
  });

  it('matches by tier: always-load, path globs, keywords, explicit only', async () => {
    const root = await tmpRootWithSkills(['alpha', 'beta', 'gamma', 'manual-thing']);
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root });

    const byPath = loader.matchSkills({ activeFile: 'src/index.ts' });
    const names = byPath.matched.map((s) => s.name);
    expect(names).toContain('alpha'); // always-load
    expect(names).toContain('beta'); // src/**
    expect(names).toContain('gamma'); // pulled as beta's dependency
    expect(names).not.toContain('manual-thing');

    const explicit = loader.matchSkills({ explicit: ['manual-thing'] });
    expect(explicit.matched.map((s) => s.name)).toContain('manual-thing');

    const keyword = loader.matchSkills({ keywords: ['gamma'] });
    expect(keyword.matched.map((s) => s.name)).toContain('gamma');
  });

  it('reports unknown dependencies instead of failing the match', async () => {
    const root = await tmpRootWithSkills(['alpha', 'beta', 'gamma']);
    const manifest = fixtureManifest();
    manifest.spec.skills[1].depends_on = ['gamma', 'phantom'];
    const loader = new SkillsLoader(manifest, BUDGET, { root });
    const { missingDeps } = loader.matchSkills({ activeFile: 'src/x.ts' });
    expect(missingDeps).toEqual(['phantom']);
  });
});

describe('SkillsLoader — Tier 2 instructions with budget + topological order', () => {
  it('loads dependencies before dependents, within budget', async () => {
    const root = await tmpRootWithSkills(['alpha', 'beta', 'gamma']);
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root });
    const bundle = await loader.getInstructions({ activeFile: 'src/index.ts' });

    expect(bundle.totalTokens).toBe(160); // 10 + 50 + 100
    const order = bundle.loaded.map((l) => l.name);
    expect(order.indexOf('gamma')).toBeLessThan(order.indexOf('beta')); // topo
    expect(order).toContain('alpha');
    expect(bundle.skipped).toEqual([]);
    expect(bundle.loaded[0].text).toContain('instructions');
  });

  it('skips optional skills that exceed the dynamic budget', async () => {
    const root = await tmpRootWithSkills(['alpha', 'beta', 'gamma']);
    const loader = new SkillsLoader(fixtureManifest(), { ...BUDGET, dynamic_max_tokens: 120 }, { root });
    const bundle = await loader.getInstructions({ activeFile: 'src/index.ts' });
    // alpha(10) + gamma(50) fit; beta(100) would push past 120
    expect(bundle.loaded.map((l) => l.name)).toEqual(['alpha', 'gamma']);
    expect(bundle.skipped).toHaveLength(1);
    expect(bundle.skipped[0]).toMatchObject({ name: 'beta', reason: expect.stringContaining('over budget') });
    expect(bundle.totalTokens).toBeLessThanOrEqual(120);
  });

  it('hard-rejects an over-budget always-load set (2.8)', async () => {
    const root = await tmpRootWithSkills(['alpha']);
    const manifest = fixtureManifest({
      skills: [{ name: 'alpha', tier: 'always-load', tokenCost: 9000, description: 'huge', tags: [] }],
    });
    const loader = new SkillsLoader(manifest, BUDGET, { root });
    await expect(loader.getInstructions({})).rejects.toThrow(SkillsBudgetError);
    await expect(loader.getInstructions({})).rejects.toThrow(/always-load skills need 9000/);
  });

  it('detects depends_on cycles', async () => {
    const root = await tmpRootWithSkills(['alpha', 'beta', 'gamma']);
    const manifest = fixtureManifest();
    manifest.spec.skills[1].depends_on = ['gamma'];
    manifest.spec.skills[2].depends_on = ['beta'];
    const loader = new SkillsLoader(manifest, BUDGET, { root });
    await expect(loader.getInstructions({ activeFile: 'src/x.ts' })).rejects.toThrow(/cycle/);
  });

  it('reports missing instructions.md as skipped', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skills-'));
    await mkdir(path.join(root, '.agents', 'skills', 'alpha'), { recursive: true });
    await writeFile(path.join(root, '.agents', 'skills', 'alpha', 'instructions.md'), '# alpha\n', 'utf8');
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root });
    const bundle = await loader.getInstructions({ activeFile: 'src/x.ts' });
    expect(bundle.loaded.map((l) => l.name)).toEqual(['alpha']);
    expect(bundle.skipped.some((s) => s.name === 'beta' && s.reason === 'instructions.md missing')).toBe(true);
    expect(bundle.skipped.some((s) => s.name === 'gamma' && s.reason === 'instructions.md missing')).toBe(true);
  });
});

describe('SkillsLoader — Tier 3 resources and index-first access', () => {
  it('loads a resource and refuses path traversal', async () => {
    const root = await tmpRootWithSkills(['alpha']);
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root });
    expect(await loader.getResource('alpha', 'deep.md')).toContain('deep reference');
    await expect(loader.getResource('alpha', '../../alpha/instructions.md')).rejects.toThrow(/escapes/);
    await expect(loader.getResource('alpha', '..\\..\\x.md')).rejects.toThrow(/escapes/);
  });

  it('getIndex reads index.md first and returns null when absent', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'idx-'));
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root });
    expect(await loader.getIndex(root)).toBeNull();
    await writeFile(path.join(root, 'index.md'), '# Index\n- [a](./a.md)\n', 'utf8');
    expect(await loader.getIndex(root)).toContain('# Index');
  });
});

describe('C2 — scoped stage input loading', () => {
  async function stage(files: Record<string, string>): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), 'stage-'));
    for (const [name, content] of Object.entries(files)) {
      const full = path.join(dir, name);
      await mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content, 'utf8');
    }
    return dir;
  }

  const CONTEXT = [
    '# S — CONTEXT',
    '',
    '## Inputs',
    '- Layer 3 (Reference): ref.md',
    '- Layer 4 (Working): working/output.md',
    '',
    '## Process',
    '1. do',
    '',
    '## Outputs',
    '- a.md -> output/a.md',
    '',
  ].join('\n');

  it('loads ONLY the declared inputs, no crawling', async () => {
    const dir = await stage({
      'CONTEXT.md': CONTEXT,
      'ref.md': 'reference material '.repeat(50),
      'working/output.md': 'working artifact '.repeat(50),
      'UNDECLARED.md': 'this must never be loaded '.repeat(50),
    });
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root: dir });
    const bundle = await loader.loadStageInputs(path.join(dir, 'CONTEXT.md'));
    expect(bundle.inputs.map((i) => i.path)).toEqual(['ref.md', 'working/output.md']);
    expect(JSON.stringify(bundle)).not.toContain('UNDECLARED');
    expect(bundle.inputs[0].layer).toBe('Layer 3');
    expect(bundle.inputs[0].kind).toBe('Reference');
    expect(bundle.inputs[1].kind).toBe('Working');
    expect(bundle.totalTokens).toBe(bundle.inputs.reduce((sum, i) => sum + i.tokens, 0));
    expect(bundle.warnings.join(' ')).toMatch(/below the 2000-token floor/);
  });

  it('refuses directory inputs (crawl attempt)', async () => {
    const dir = await stage({
      'CONTEXT.md': '# S\n\n## Inputs\n- Layer 3 (Reference): subdir\n\n## Process\n1. x\n\n## Outputs\n- a -> output/a\n',
      'subdir/keep.md': 'x',
    });
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root: dir });
    await expect(loader.loadStageInputs(path.join(dir, 'CONTEXT.md'))).rejects.toThrow(StageCrawlError);
    await expect(loader.loadStageInputs(path.join(dir, 'CONTEXT.md'))).rejects.toThrow(/directory crawls are refused/);
  });

  it('refuses glob inputs and missing files', async () => {
    const globDir = await stage({
      'CONTEXT.md': '# S\n\n## Inputs\n- Layer 3 (Reference): *.md\n\n## Process\n1. x\n\n## Outputs\n- a -> output/a\n',
      'x.md': 'x',
    });
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root: globDir });
    await expect(loader.loadStageInputs(path.join(globDir, 'CONTEXT.md'))).rejects.toThrow(/glob/);

    const missingDir = await stage({
      'CONTEXT.md': '# S\n\n## Inputs\n- Layer 3 (Reference): ghost.md\n\n## Process\n1. x\n\n## Outputs\n- a -> output/a\n',
    });
    const loader2 = new SkillsLoader(fixtureManifest(), BUDGET, { root: missingDir });
    await expect(loader2.loadStageInputs(path.join(missingDir, 'CONTEXT.md'))).rejects.toThrow(/not found/);
  });

  it('refuses stage loads above the 8K token budget', async () => {
    const big = 'x'.repeat(40_000); // 10k tokens
    const dir = await stage({
      'CONTEXT.md': '# S\n\n## Inputs\n- Layer 4 (Working): big.md\n\n## Process\n1. x\n\n## Outputs\n- a -> output/a\n',
      'big.md': big,
    });
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root: dir });
    await expect(loader.loadStageInputs(path.join(dir, 'CONTEXT.md'))).rejects.toThrow(StageBudgetError);
  });

  it('rejects a CONTEXT.md without an Inputs section', async () => {
    const dir = await stage({ 'CONTEXT.md': '# S\n\n## Process\n1. x\n' });
    const loader = new SkillsLoader(fixtureManifest(), BUDGET, { root: dir });
    await expect(loader.loadStageInputs(path.join(dir, 'CONTEXT.md'))).rejects.toThrow(/no "## Inputs" section/);
  });
});
