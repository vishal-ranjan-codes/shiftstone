import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { generate as generateBibleToc } from '../../governance/bible/index-generator.ts';
import {
  buildDriftDashboard,
  chapterStaleness,
  findDeliverables,
  renderDriftDashboard,
} from '../../observability/drift-dashboard.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'drift-dashboard.js');

const FINDINGS = `---
type: stage-output
timestamp: 2026-10-14T00:00:00Z
inputs:
  - ../../notes.md
---

# Findings

original finding line
`;

const CTX = `---
type: ICM Stage
timestamp: 2026-10-14T00:00:00Z
stage: 01-source
status: sealed
---

# 01-source — CONTEXT

## Inputs

- Layer 4 (Working): ../notes.md

## Process

1. Summarize.

## Outputs

- findings.md -> output/findings.md
`;

const DELIVERABLE = `---
type: document
timestamp: 2026-10-14T00:00:00Z
---

# Deliverable

Built from [findings](01-source/output/findings.md).
`;

function git(root: string, args: string[], env?: Record<string, string>): void {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30_000, env: { ...process.env, ...env } });
  if (res.status !== 0 && args[0] !== 'init') {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
}

async function gitFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'drift-dash-'));
  git(root, ['init']);
  git(root, ['config', 'user.email', 'fixture@example.test']);
  git(root, ['config', 'user.name', 'fixture']);

  await mkdir(path.join(root, '01-source', 'output'), { recursive: true });
  await mkdir(path.join(root, 'core'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'bible', '01-architecture'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'plans', 'demo', 'output'), { recursive: true });

  await writeFile(path.join(root, 'core', 'dummy.ts'), 'export {};\n', 'utf8');
  await writeFile(path.join(root, 'notes.md'), 'source notes v1\n', 'utf8');
  await writeFile(path.join(root, '01-source', 'CONTEXT.md'), CTX, 'utf8');
  await writeFile(path.join(root, '01-source', 'output', 'findings.md'), FINDINGS, 'utf8');
  await writeFile(path.join(root, 'deliverable.md'), DELIVERABLE, 'utf8');
  await writeFile(
    path.join(root, 'docs', 'bible', '01-architecture', 'index.md'),
    '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 01-architecture\n',
    'utf8',
  );
  await writeFile(path.join(root, 'docs', 'plans', 'demo', 'output', 'deliverable.md'), DELIVERABLE, 'utf8');
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'baseline']);

  // an old chapter: committed back in 2020 → stale by any sane threshold
  await mkdir(path.join(root, 'docs', 'bible', '02-old'), { recursive: true });
  await writeFile(
    path.join(root, 'docs', 'bible', '02-old', 'index.md'),
    '---\ntype: index\ntimestamp: 2020-01-01T00:00:00.000Z\n---\n# 02-old\n',
    'utf8',
  );
  git(root, ['add', '-A']);
  git(root, ['commit', '-m', 'old chapter'], {
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  });
  return root;
}

describe('drift-dashboard — chapter staleness (old 5.5)', () => {
  it('reports per-chapter last commit, age and stale flag', async () => {
    const root = await gitFixture();
    const items = await chapterStaleness(root, { maxAgeDays: 30 });
    const byChapter = new Map(items.map((i) => [i.chapter, i]));

    const fresh = byChapter.get('docs/bible/01-architecture');
    expect(fresh?.last_commit).toBeTruthy();
    expect(fresh?.stale).toBe(false);

    const old = byChapter.get('docs/bible/02-old');
    expect(old?.last_commit).toContain('2020-01-01');
    expect(old?.age_days).toBeGreaterThan(30);
    expect(old?.stale).toBe(true);
  });

  it('returns an empty list outside a workspace with a bible', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'drift-dash-empty-'));
    expect(await chapterStaleness(root)).toEqual([]);
  });

  it('flags a stale bible README ToC and clears the note after regeneration (6.2/6.5 hookup)', async () => {
    const root = await gitFixture();
    await writeFile(
      path.join(root, 'docs', 'bible', 'README.md'),
      [
        '---',
        'type: readme',
        'timestamp: 2026-10-14T00:00:00.000Z',
        '---',
        '# Bible',
        '',
        '## Table of Contents',
        '',
        '| Section | Description | File |',
        '|---|---|---|',
        '| **Ghost** | stale hand-written row | `01-architecture/gone.md` |',
        '',
      ].join('\n'),
      'utf8',
    );
    const stale = await buildDriftDashboard(root, { deliverables: [] });
    expect(stale.notes.some((note) => note.includes('bible README ToC is stale'))).toBe(true);

    await generateBibleToc(path.join(root, 'docs', 'bible'));
    const fresh = await buildDriftDashboard(root, { deliverables: [] });
    expect(fresh.notes.some((note) => note.includes('bible README ToC is stale'))).toBe(false);
  });
});

describe('drift-dashboard — lineage results consumed (task 5.11 / C10)', () => {
  it('shows the drift entry point, not just staleness', async () => {
    const root = await gitFixture();
    await writeFile(
      path.join(root, '01-source', 'output', 'findings.md'),
      FINDINGS.replace('original finding line', 'TAMPERED finding line'),
      'utf8',
    );

    const input = await buildDriftDashboard(root, { deliverables: ['deliverable.md'] });
    expect(input.lineage).toHaveLength(1);
    expect(input.lineage[0].clean).toBe(false);
    expect(input.lineage[0].first_divergent_stage).toBe('01-source');

    const dash = renderDriftDashboard(input);
    expect(dash).toContain('# Drift Dashboard');
    expect(dash).toContain('## Lineage — where drift entered');
    expect(dash).toContain('DRIFT');
    expect(dash).toContain('entry 01-source');
    expect(dash).toContain('suspect:');
    expect(dash).toContain('findings.md -> output/findings.md');
    expect(dash).toContain('## Bible chapter staleness');
    expect(dash).toContain('| docs/bible/01-architecture |');
    expect(dash).toContain('**STALE**');
    expect(dash).toContain(') last committed:');
    expect(input.code_last_commit).toBeTruthy(); // core/dummy.ts committed
  });

  it('renders CLEAN for a clean deliverable and discovers deliverables under docs/plans', async () => {
    const root = await gitFixture();
    const found = await findDeliverables(root);
    expect(found).toEqual(['docs/plans/demo/output/deliverable.md']);

    const input = await buildDriftDashboard(root, { deliverables: ['deliverable.md'] });
    const dash = renderDriftDashboard(input);
    expect(dash).toContain('CLEAN');
    expect(dash).not.toContain('DRIFT');
  });

  it('CLI exits 1 on drift and 0 when clean', async () => {
    const root = await gitFixture();
    const clean = spawnSync(process.execPath, [CLI, 'deliverable.md', '--root', root], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('# Drift Dashboard');

    await writeFile(
      path.join(root, '01-source', 'output', 'findings.md'),
      FINDINGS.replace('original finding line', 'drifted'),
      'utf8',
    );
    const drifted = spawnSync(process.execPath, [CLI, 'deliverable.md', '--root', root], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(drifted.status).toBe(1);
    expect(drifted.stdout).toContain('entry 01-source');
  });
});
