import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyDefaults } from '../../harness/loop-runner/loader.ts';
import { LoopRunner } from '../../harness/loop-runner/runner.ts';
import { validateSpec } from '../../harness/loop-runner/validator.ts';
import type { LoopSpecification } from '../../harness/loop-runner/types.ts';
import { mapRunner, makeSpec } from '../helpers.ts';

type Inc = LoopSpecification['execution']['incremental'];

function rawWith(incr: unknown): Record<string, unknown> {
  const base = makeSpec() as unknown as Record<string, unknown>;
  return {
    ...base,
    execution: { ...(base['execution'] as Record<string, unknown>), incremental: incr },
  };
}

function c9Refusals(incr: unknown): string[] {
  return validateSpec(rawWith(incr)).refusals.filter((r) => r.startsWith('C9:'));
}

describe('C9 — execution.incremental validation (loop refusal gate)', () => {
  it('accepts well-formed incremental blocks', () => {
    expect(c9Refusals({ stages: [{ id: 'a', inputs: ['docs/x.md'] }] })).toEqual([]);
    expect(c9Refusals({ root: 'docs/plans/demo' })).toEqual([]);
    expect(c9Refusals({ root: 'docs/plans/demo', state: '.loops/x/deps.json', stages: [{ id: 'a', inputs: ['src'] }] })).toEqual([]);
  });

  it('refuses a non-mapping incremental block', () => {
    expect(c9Refusals('yes').join('\n')).toContain('must be a mapping');
  });

  it('refuses a block declaring neither root nor stages', () => {
    expect(c9Refusals({ state: '.loops/x/deps.json' }).join('\n')).toContain('neither root nor a non-empty stages list');
    expect(c9Refusals({ stages: [] }).join('\n')).toContain('neither root nor a non-empty stages list');
  });

  it('refuses a stage without an id', () => {
    expect(c9Refusals({ stages: [{ inputs: ['docs/x.md'] }] }).join('\n')).toContain('needs a non-empty id');
  });

  it('refuses duplicate stage ids', () => {
    const incr = {
      stages: [
        { id: 'a', inputs: ['x'] },
        { id: 'a', inputs: ['y'] },
      ],
    };
    expect(c9Refusals(incr).join('\n')).toContain('duplicate incremental stage id "a"');
  });

  it('refuses a stage with no inputs to fingerprint', () => {
    expect(c9Refusals({ stages: [{ id: 'a', inputs: [] }] }).join('\n')).toContain('declares no inputs');
    expect(c9Refusals({ stages: [{ id: 'a' }] }).join('\n')).toContain('declares no inputs');
  });

  it('refuses glob and empty input paths', () => {
    expect(c9Refusals({ stages: [{ id: 'a', inputs: ['docs/**/*.md'] }] }).join('\n')).toContain('is a glob');
    expect(c9Refusals({ stages: [{ id: 'a', inputs: [' '] }] }).join('\n')).toContain('non-empty paths');
  });

  it('loader defaults pass the block through unchanged', () => {
    const incr: Inc = {
      root: 'docs/plans/demo',
      state: '.loops/test-loop/stage-deps.json',
      stages: [{ id: 'toc', inputs: ['docs/bible/README.md'], outputs: [], depends_on: [], force_rerun: true }],
    };
    const spec = applyDefaults(rawWith(incr));
    expect(spec.execution.incremental).toEqual(incr);
    expect(applyDefaults(makeSpec() as unknown as Record<string, unknown>).execution.incremental).toBeUndefined();
  });
});

describe('C9 — LoopRunner gate via CONTEXT.md discovery (incremental.root)', () => {
  async function fixture(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'inc-root-'));
    await mkdir(path.join(root, 'stages', '01-check'), { recursive: true });
    await writeFile(path.join(root, 'source.txt'), 'v1\n', 'utf8');
    await writeFile(
      path.join(root, 'stages', '01-check', 'CONTEXT.md'),
      [
        '---',
        'type: ICM Stage',
        'timestamp: 2026-10-14T00:00:00Z',
        'stage: 01-check',
        'status: sealed',
        '---',
        '',
        '# 01-check — CONTEXT',
        '',
        '## Inputs',
        '',
        '- Layer 4 (Working): ../../source.txt',
        '',
        '## Process',
        '',
        '1. Check the source.',
        '',
        '## Outputs',
        '',
        '- check.md -> output/check.md',
        '',
      ].join('\n'),
      'utf8',
    );
    await mkdir(path.join(root, 'stages', '01-check', 'output'), { recursive: true });
    await writeFile(path.join(root, 'stages', '01-check', 'output', 'check.md'), 'checked\n', 'utf8');
    return root;
  }

  function build(root: string): { runner: LoopRunner; calls: () => string[] } {
    const spec = makeSpec({
      name: 'discover-loop',
      verification: { command: 'check', expected_exit: 0 },
      execution: { incremental: { root: 'stages' } },
    });
    const runnerDeps = mapRunner({ check: { exitCode: 0 } });
    const runner = new LoopRunner(spec, {
      executor: {
        execute: async () => {
          throw new Error('turn executed unexpectedly — the gate must skip before any turn');
        },
      },
      commandRunner: runnerDeps,
      workspaceRoot: root,
      loopsDir: path.join(root, '.loops'),
    });
    return { runner, calls: () => runnerDeps.calls };
  }

  it('run 1 falls through to the pre-check and records fingerprints; run 2 skips before the pre-check', async () => {
    const root = await fixture();
    const statePath = path.join(root, '.loops', 'discover-loop', 'stage-deps.json');

    const first = build(root);
    const outcome1 = await first.runner.run();
    expect(outcome1.state).toBe('no_op');
    expect(outcome1.reason).toBe('already done'); // spec no_op text = verifier pre-check path
    expect(first.calls()).toEqual(['check']); // pre-check ran
    expect(existsSync(statePath)).toBe(true);
    const recorded = JSON.parse(await readFile(statePath, 'utf8')) as { stages: Record<string, { completed: boolean }> };
    expect(Object.keys(recorded.stages)).toEqual(['01-check']);
    expect(recorded.stages['01-check'].completed).toBe(true);

    // fresh runner: the fingerprint gate must fire BEFORE the pre-check command
    const second = build(root);
    const outcome = await second.runner.run();
    expect(outcome.state).toBe('no_op');
    expect(outcome.reason).toContain('incremental: all 1 stage(s) unchanged since last clean run');
    expect(second.calls()).toEqual([]); // `check` never ran — Make-style skip
  });

  it('a changed source breaks the skip and the pre-check runs again', async () => {
    const root = await fixture();
    await build(root).runner.run(); // record fingerprints
    await writeFile(path.join(root, 'source.txt'), 'v2 changed\n', 'utf8');

    const third = build(root);
    const outcome = await third.runner.run();
    expect(outcome.state).toBe('no_op');
    expect(outcome.reason).toBe('already done'); // pre-check path, not the gate
    expect(third.calls()).toEqual(['check']);
  });
});
