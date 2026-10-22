import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  renderLineage,
  traceLineage,
  walkLineage,
} from '../../observability/lineage-tracer.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'core', 'scripts', 'lineage-tracer.js');

const CTX_01 = `---
type: ICM Stage
timestamp: 2026-10-14T00:00:00Z
stage: 01-source
status: sealed
---

# 01-source — CONTEXT

## Inputs

- Layer 4 (Working): ../notes.md

## Process

1. Summarize the notes.

## Outputs

- findings.md -> output/findings.md
`;

const CTX_02 = `---
type: ICM Stage
timestamp: 2026-10-14T00:00:00Z
stage: 02-build
status: sealed
---

# 02-build — CONTEXT

## Inputs

- Layer 4 (Working): ../01-source/output/findings.md

## Process

1. Build the report.

## Outputs

- report.md -> output/report.md
`;

const FINDINGS = `---
type: stage-output
timestamp: 2026-10-14T00:00:00Z
inputs:
  - ../../notes.md
---

# Findings

original finding line
`;

const REPORT = `---
type: stage-output
timestamp: 2026-10-14T00:00:00Z
inputs:
  - ../../01-source/output/findings.md
---

# Report

See [findings](../../01-source/output/findings.md).
`;

const DELIVERABLE = `---
type: document
timestamp: 2026-10-14T00:00:00Z
---

# Deliverable

Built from [the report](02-build/output/report.md).
`;

function git(root: string, ...args: string[]): void {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30_000 });
  if (res.status !== 0 && !args.every((a) => a === 'init')) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
  }
}

async function gitFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'lineage-'));
  git(root, 'init');
  git(root, 'config', 'user.email', 'fixture@example.test');
  git(root, 'config', 'user.name', 'fixture');
  await mkdir(path.join(root, '01-source', 'output'), { recursive: true });
  await mkdir(path.join(root, '02-build', 'output'), { recursive: true });
  await writeFile(path.join(root, 'notes.md'), 'source notes v1\n', 'utf8');
  await writeFile(path.join(root, '01-source', 'CONTEXT.md'), CTX_01, 'utf8');
  await writeFile(path.join(root, '01-source', 'output', 'findings.md'), FINDINGS, 'utf8');
  await writeFile(path.join(root, '02-build', 'CONTEXT.md'), CTX_02, 'utf8');
  await writeFile(path.join(root, '02-build', 'output', 'report.md'), REPORT, 'utf8');
  await writeFile(path.join(root, 'deliverable.md'), DELIVERABLE, 'utf8');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'baseline');
  return root;
}

describe('C10 — lineage walk', () => {
  it('walks relative links backward from deliverable → stage outputs → sources', async () => {
    const root = await gitFixture();
    const chain = await walkLineage(root, 'deliverable.md');
    const files = chain.map((n) => n.file);
    expect(files[0]).toBe('deliverable.md');
    expect(files).toContain('02-build/output/report.md');
    expect(files).toContain('01-source/output/findings.md');
    expect(files).toContain('notes.md'); // reached through OKF inputs citation

    const byFile = new Map(chain.map((n) => [n.file, n]));
    expect(byFile.get('deliverable.md')?.stage).toBeNull();
    expect(byFile.get('02-build/output/report.md')?.stage).toBe('02-build');
    expect(byFile.get('01-source/output/findings.md')?.stage).toBe('01-source');
    expect(byFile.get('notes.md')?.stage).toBeNull();
  });

  it('a clean worktree traces clean', async () => {
    const root = await gitFixture();
    const report = await traceLineage('deliverable.md', { root });
    expect(report.clean).toBe(true);
    expect(report.first_divergent_stage).toBeNull();
    expect(report.suspect).toBeNull();
    expect(report.stages).toEqual(['01-source', '02-build']);
    expect(renderLineage(report)).toContain('CLEAN');
  });
});

describe('C10 — injected drift is traced to the entry stage + contract line', () => {
  it('stage-output content drift → first divergent stage + Outputs line', async () => {
    const root = await gitFixture();
    await writeFile(
      path.join(root, '01-source', 'output', 'findings.md'),
      FINDINGS.replace('original finding line', 'TAMPERED finding line'),
      'utf8',
    );

    const report = await traceLineage('deliverable.md', { root });
    expect(report.clean).toBe(false);
    expect(report.first_divergent_stage).toBe('01-source');
    expect(report.divergences.map((d) => d.file)).toEqual(['01-source/output/findings.md']);
    expect(report.divergences[0].severity).toBe('content');
    expect(report.suspect).not.toBeNull();
    expect(report.suspect!.section).toBe('Outputs');
    expect(report.suspect!.file).toBe(path.join('01-source', 'CONTEXT.md').split(path.sep).join('/'));
    expect(report.suspect!.line).toBeGreaterThan(0);
    expect(report.suspect!.text).toContain('findings.md -> output/findings.md');

    const rendered = renderLineage(report);
    expect(rendered).toContain('DRIFT');
    expect(rendered).toContain('entry 01-source');
    expect(rendered).toContain('suspect:');
  });

  it('source drift with untouched outputs → the consuming stage + Inputs line', async () => {
    const root = await gitFixture();
    await writeFile(path.join(root, 'notes.md'), 'source notes v1 — CHANGED without rebuilding\n', 'utf8');

    const report = await traceLineage('deliverable.md', { root });
    expect(report.clean).toBe(false);
    expect(report.first_divergent_stage).toBe('01-source'); // declares notes.md as an input
    expect(report.suspect?.section).toBe('Inputs');
    expect(report.suspect?.text).toContain('../notes.md');
    expect(report.notes.some((n) => n.includes('notes.md'))).toBe(true);
  });

  it('structural drift (added link) in a downstream stage is reported', async () => {
    const root = await gitFixture();
    await writeFile(
      path.join(root, '02-build', 'output', 'report.md'),
      `${REPORT}\nAlso see [notes](../../notes.md).\n`,
      'utf8',
    );
    const report = await traceLineage('deliverable.md', { root });
    expect(report.clean).toBe(false);
    expect(report.first_divergent_stage).toBe('02-build');
    expect(report.divergences[0].severity).toBe('structural');
  });

  it('formatting-only diffs are never false divergence (risk table)', async () => {
    const root = await gitFixture();
    await writeFile(
      path.join(root, '01-source', 'output', 'findings.md'),
      FINDINGS.replace('original finding line', '   original finding line   '),
      'utf8',
    );
    const report = await traceLineage('deliverable.md', { root });
    expect(report.divergences.map((d) => d.severity)).toEqual(['formatting']);
    expect(report.clean).toBe(true);
    expect(report.first_divergent_stage).toBeNull();
    expect(report.suspect).toBeNull();
  });

  it('CLI prints the trace and exits 1 on drift, 0 when clean', async () => {
    const root = await gitFixture();
    const clean = spawnSync(process.execPath, [CLI, 'deliverable.md', '--root', root], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('CLEAN');
    expect(existsSync(path.join(root, 'deliverable.md'))).toBe(true);

    await writeFile(
      path.join(root, '01-source', 'output', 'findings.md'),
      FINDINGS.replace('original finding line', 'drifted line'),
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
