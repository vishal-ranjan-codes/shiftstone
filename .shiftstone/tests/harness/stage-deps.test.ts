import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  discoverStages,
  hashPaths,
  loadStageState,
  parseContextContract,
  planIncremental,
  recordStageState,
  resolveStageDefinition,
  runStages,
  topoSort,
  upstreamOf,
  type StageDefinition,
} from '../../harness/stage-deps.ts';

const CTX_01 = `---
type: ICM Stage
timestamp: 2026-10-14T00:00:00Z
stage: 01-source
status: open
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
status: open
---

# 02-build — CONTEXT

## Inputs

- Layer 4 (Working): ../01-source/output/findings.md
- Layer 3 (Reference): ../review-notes.md

## Process

1. Build the report from the findings.

## Outputs

- report.md -> output/report.md
`;

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'stage-deps-'));
  await writeFile(path.join(root, 'notes.md'), 'original notes v1\n', 'utf8');
  await writeFile(path.join(root, 'review-notes.md'), 'review v1\n', 'utf8');
  await mkdir(path.join(root, '01-source', 'output'), { recursive: true });
  await writeFile(path.join(root, '01-source', 'CONTEXT.md'), CTX_01, 'utf8');
  await writeFile(path.join(root, '01-source', 'output', 'findings.md'), 'findings v1\n', 'utf8');
  await mkdir(path.join(root, '02-build', 'output'), { recursive: true });
  await writeFile(path.join(root, '02-build', 'CONTEXT.md'), CTX_02, 'utf8');
  await writeFile(path.join(root, '02-build', 'output', 'report.md'), 'report v1\n', 'utf8');
  return root;
}

describe('C9 — contract parsing + discovery', () => {
  it('parses declared Inputs and Outputs from CONTEXT.md', () => {
    const contract = parseContextContract(CTX_02);
    expect(contract.inputs).toEqual(['../01-source/output/findings.md', '../review-notes.md']);
    expect(contract.outputs).toEqual(['output/report.md']);
    expect(contract.force_rerun).toBe(false);
  });

  it('honors the force_rerun escape flag from frontmatter', () => {
    const contract = parseContextContract(CTX_01.replace('status: open', 'status: open\nforce_rerun: true'));
    expect(contract.force_rerun).toBe(true);
  });

  it('discovers stage folders and derives upstream edges from declared inputs', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    expect(stages.map((s) => s.id)).toEqual(['01-source', '02-build']);

    const source = stages.find((s) => s.id === '01-source')!;
    const build = stages.find((s) => s.id === '02-build')!;
    expect(source.inputs).toEqual([path.join(root, 'notes.md')]);
    expect(build.outputs).toEqual([path.join(root, '02-build', 'output', 'report.md')]);

    expect(upstreamOf(build, stages)).toEqual(['01-source']);
    expect(upstreamOf(source, stages)).toEqual([]);
    expect(topoSort(stages).map((s) => s.id)).toEqual(['01-source', '02-build']);
  });

  it('refuses dependency cycles', () => {
    const a: StageDefinition = { id: 'a', inputs: [], outputs: [], depends_on: ['b'], force_rerun: false };
    const b: StageDefinition = { id: 'b', inputs: [], outputs: [], depends_on: ['a'], force_rerun: false };
    expect(() => topoSort([a, b])).toThrow(/cycle: /);
  });

  it('hashPaths tracks content, presence and directory contents', async () => {
    const root = await fixture();
    const notes = path.join(root, 'notes.md');
    const before = await hashPaths([notes]);
    expect(await hashPaths([notes])).toBe(before); // stable
    await writeFile(notes, 'original notes v2\n', 'utf8');
    expect(await hashPaths([notes])).not.toBe(before); // content change flips
    expect(await hashPaths([path.join(root, 'nope.md')])).not.toBe(await hashPaths([notes])); // presence flips the hash
    expect(await hashPaths([path.join(root, 'nope.md')])).toBe(await hashPaths([path.join(root, 'nope.md')])); // stable
    const dirBefore = await hashPaths([path.join(root, '01-source')]);
    await writeFile(path.join(root, '01-source', 'output', 'extra.md'), 'x\n', 'utf8');
    expect(await hashPaths([path.join(root, '01-source')])).not.toBe(dirBefore); // dir hashes contents
  });
});

describe('C9 — incremental plan (Vitest: skip / cascade)', () => {
  it('second run with no changes skips every stage', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');

    // first pass: everything runs, fingerprints recorded
    const first = await runStages({ root, stages, statePath, execute: async () => {} });
    expect(first.ran).toEqual(['01-source', '02-build']);

    const prev = await loadStageState(statePath);
    const plan = await planIncremental({ root, stages, prev });
    expect(plan.every((d) => d.action === 'skip')).toBe(true);

    const second = await runStages({ root, stages, statePath, execute: async () => { throw new Error('must not run'); } });
    expect(second.skipped).toEqual(['01-source', '02-build']);
    expect(second.ran).toEqual([]);
  });

  it('unchanged upstream → downstream skipped; upstream output change → downstream cascades', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');
    await runStages({ root, stages, statePath, execute: async () => {} });

    // (a) upstream source changes; the rebuilt output is identical
    //     → downstream stays skipped ("skip stages whose upstream outputs are unchanged")
    await writeFile(path.join(root, 'notes.md'), 'original notes v2 (same output)\n', 'utf8');
    const sameOutput = await runStages({
      root,
      stages,
      statePath,
      execute: async (stage) => {
        if (stage.id === '01-source') {
          // rebuild produces byte-identical findings
          await writeFile(path.join(root, '01-source', 'output', 'findings.md'), 'findings v1\n', 'utf8');
        }
      },
    });
    expect(sameOutput.ran).toEqual(['01-source']);
    expect(sameOutput.skipped).toEqual(['02-build']);

    // (b) a further upstream change rebuilds a different output → downstream cascades
    await writeFile(path.join(root, 'notes.md'), 'original notes v3 (new output)\n', 'utf8');
    const cascaded = await runStages({
      root,
      stages,
      statePath,
      execute: async (stage) => {
        if (stage.id === '01-source') {
          await writeFile(path.join(root, '01-source', 'output', 'findings.md'), 'findings v2 (new)\n', 'utf8');
        }
      },
    });
    expect(cascaded.ran).toEqual(['01-source', '02-build']);
    expect(cascaded.decisions.find((d) => d.id === '02-build')?.reason).toMatch(/changed \(cascade\)|inputs changed/);
  });

  it('conservative plan flags downstream as run when upstream is not fresh', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');
    await recordStageState(stages, statePath);
    const prev = await loadStageState(statePath);

    await writeFile(path.join(root, 'notes.md'), 'changed again\n', 'utf8');
    const plan = await planIncremental({ root, stages, prev });
    expect(plan.find((d) => d.id === '01-source')?.action).toBe('run');
    expect(plan.find((d) => d.id === '01-source')?.reason).toBe('inputs changed');
    expect(plan.find((d) => d.id === '02-build')?.action).toBe('run');
    expect(plan.find((d) => d.id === '02-build')?.reason).toContain('cascade');
  });

  it('reruns only the stage whose own input changed', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');
    await runStages({ root, stages, statePath, execute: async () => {} });

    await writeFile(path.join(root, 'review-notes.md'), 'review v2\n', 'utf8');
    const plan = await planIncremental({ root, stages, prev: await loadStageState(statePath) });
    expect(plan.find((d) => d.id === '01-source')?.action).toBe('skip');
    expect(plan.find((d) => d.id === '02-build')?.action).toBe('run');
    expect(plan.find((d) => d.id === '02-build')?.reason).toBe('inputs changed');
  });

  it('reruns when outputs were edited behind the engine (drift rebuild)', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');
    await runStages({ root, stages, statePath, execute: async () => {} });

    await writeFile(path.join(root, '02-build', 'output', 'report.md'), 'tampered report\n', 'utf8');
    const plan = await planIncremental({ root, stages, prev: await loadStageState(statePath) });
    expect(plan.find((d) => d.id === '02-build')?.reason).toBe('outputs modified since last run');
  });

  it('force_rerun and --force escape hatches', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'deps.json');
    await runStages({ root, stages, statePath, execute: async () => {} });

    const forcedAll = await planIncremental({ root, stages, prev: await loadStageState(statePath), force: true });
    expect(forcedAll.every((d) => d.action === 'run')).toBe(true);

    const flagged = stages.map((s) =>
      s.id === '01-source'
        ? { ...s, force_rerun: true }
        : s,
    );
    const plan = await planIncremental({ root, stages: flagged, prev: await loadStageState(statePath) });
    expect(plan.find((d) => d.id === '01-source')).toEqual({ id: '01-source', action: 'run', reason: 'force_rerun flag set' });
    expect(plan.find((d) => d.id === '02-build')?.action).toBe('skip');
  });

  it('runs every stage again when no fingerprints were ever recorded', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const plan = await planIncremental({ root, stages, prev: { version: 1, stages: {} } });
    expect(plan.every((d) => d.action === 'run')).toBe(true);
    expect(plan.every((d) => d.reason === 'no recorded fingerprint')).toBe(true);
  });
});

describe('C9 — inline stage declarations (loop specs)', () => {
  it('resolves spec-declared stages against the workspace root', async () => {
    const root = await fixture();
    const stage = resolveStageDefinition(root, {
      id: 'notes',
      inputs: ['notes.md'],
      outputs: ['01-source/output/findings.md'],
    });
    expect(stage.inputs).toEqual([path.join(root, 'notes.md')]);
    expect(stage.depends_on).toEqual([]);

    const statePath = path.join(root, '.state', 'inline.json');
    const first = await runStages({ root, stages: [stage], statePath, execute: async () => {} });
    expect(first.ran).toEqual(['notes']);

    await writeFile(path.join(root, 'notes.md'), 'v2\n', 'utf8');
    const second = await runStages({ root, stages: [stage], statePath, execute: async () => {} });
    expect(second.ran).toEqual(['notes']);

    await writeFile(path.join(root, 'notes.md'), 'v2\n', 'utf8'); // no further change
    const third = await runStages({ root, stages: [stage], statePath, execute: async () => { throw new Error('skip'); } });
    expect(third.skipped).toEqual(['notes']);
  });

  it('recordStageState round-trips through loadStageState', async () => {
    const root = await fixture();
    const stages = await discoverStages(root);
    const statePath = path.join(root, '.state', 'roundtrip.json');
    const recorded = await recordStageState(stages, statePath);
    const loaded = await loadStageState(statePath);
    expect(loaded.stages).toEqual(recorded.stages);
    expect(Object.values(loaded.stages).every((s) => s.completed)).toBe(true);
    expect(loaded.stages['01-source'].output_hash).not.toBeNull();
    expect(await readFile(statePath, 'utf8')).toContain('"version": 1');
  });
});
