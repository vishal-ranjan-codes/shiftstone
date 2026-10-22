import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { scoreTrajectory } from '../../harness/evals/trajectory/scorer.ts';
import { runEvals } from '../../harness/evals/runner.ts';
import { LoopRunner } from '../../harness/loop-runner/runner.ts';
import { Verifier } from '../../harness/verifier-ladder/verifier.ts';
import { makeSpec, queuedRunner, scriptedExecutor, turn } from '../helpers.ts';

describe('trajectory scorer (B3)', () => {
  it('fails a fluent-but-skipped-verification turn: claimed checks never ran', () => {
    const score = scoreTrajectory({
      trace: [{ tool: 'shell', command: 'pnpm typecheck', ok: true }],
      claimed_checks: ['pnpm typecheck', 'pnpm test'],
    });
    expect(score.passed).toBe(false);
    expect(score.missing_claims).toEqual(['pnpm test']);
    expect(score.detail).toMatch(/never executed: pnpm test/);
  });

  it('passes when every claimed check appears in the trajectory', () => {
    const score = scoreTrajectory({
      trace: [
        { tool: 'shell', command: 'pnpm -C core typecheck', ok: true },
        { tool: 'shell', command: 'pnpm -C core test', ok: true },
      ],
      claimed_checks: ['pnpm typecheck', 'pnpm test'],
    });
    expect(score.passed).toBe(true);
    expect(score.missing_claims).toEqual([]);
  });

  it('fails when nothing at all was recorded — unproven verification', () => {
    const score = scoreTrajectory({ trace: [], claimed_checks: [] });
    expect(score.passed).toBe(false);
    expect(score.detail).toMatch(/nothing recorded/);
  });

  it('claims with an empty trace fail — the agent proved nothing', () => {
    const score = scoreTrajectory({ trace: [], claimed_checks: ['pnpm test'] });
    expect(score.passed).toBe(false);
    expect(score.missing_claims).toEqual(['pnpm test']);
  });

  it('a recorded but failing check still counts as executed (the output side catches it)', () => {
    const score = scoreTrajectory({
      trace: [{ tool: 'shell', command: 'pnpm test', ok: false }],
      claimed_checks: ['pnpm test'],
    });
    expect(score.passed).toBe(true);
  });
});

describe('verification.evaluate modes (B3)', () => {
  const evaluator = (evaluate: 'output' | 'trajectory' | 'both') =>
    new Verifier(
      {
        ladder_level: 1,
        command: 'check',
        expected_exit: 0,
        critics: 1,
        success_streak: 1,
        maker_checker: false,
        judge_score_threshold: 0.8,
        evaluate,
      },
      { commandRunner: queuedRunner([0, 0, 0, 0]), loopName: 'test-loop' },
    );

  it("evaluate: 'trajectory' fails a turn that claims checks it never ran", async () => {
    const result = await evaluator('trajectory').verify(
      turn({ claimed_checks: ['pnpm test'], trajectory: [{ tool: 'shell', command: 'pnpm typecheck' }] }),
      { disjointContext: false },
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/never executed: pnpm test/);
  });

  it("evaluate: 'trajectory' passes the same turn once the check actually ran", async () => {
    const result = await evaluator('trajectory').verify(
      turn({
        claimed_checks: ['pnpm test'],
        trajectory: [{ tool: 'shell', command: 'pnpm test', ok: true }],
      }),
      { disjointContext: false },
    );
    expect(result.passed).toBe(true);
    expect(result.evidence.trajectory).toMatchObject({ passed: true });
  });

  it("evaluate: 'both' requires output AND trajectory to pass", async () => {
    const both = evaluator('both');
    const goodOutcome = turn({
      claimed_checks: ['pnpm test'],
      trajectory: [{ tool: 'shell', command: 'pnpm test', ok: true }],
    });
    expect((await both.verify(goodOutcome, { disjointContext: false })).passed).toBe(true);

    // trajectory passes, but the L1 command fails (queuedRunner next exit = 1)
    const failing = new Verifier(
      {
        ladder_level: 1,
        command: 'check',
        expected_exit: 0,
        critics: 1,
        success_streak: 1,
        maker_checker: false,
        judge_score_threshold: 0.8,
        evaluate: 'both',
      },
      { commandRunner: queuedRunner([1]), loopName: 'test-loop' },
    );
    const result = await failing.verify(goodOutcome, { disjointContext: false });
    expect(result.passed).toBe(false);
  });
});

describe('eval suite trajectory cases (B3)', () => {
  it('scores trajectory cases through the eval runner', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'evals-traj-'));
    await mkdir(path.join(root, 'evals', 'traj-suite'), { recursive: true });
    await writeFile(
      path.join(root, 'evals', 'traj-suite', 'cases.jsonl'),
      [
        JSON.stringify({
          id: 'claimed-check-ran',
          kind: 'trajectory',
          claimed_checks: ['pnpm test'],
          trajectory: [{ tool: 'shell', command: 'pnpm -C core test', ok: true }],
          cluster: 'trajectory',
        }),
        JSON.stringify({
          id: 'claimed-check-skipped',
          kind: 'trajectory',
          claimed_checks: ['pnpm test'],
          trajectory: [{ tool: 'shell', command: 'pnpm typecheck', ok: true }],
          cluster: 'trajectory',
        }),
        '',
      ].join('\n'),
      'utf8',
    );

    const report = await runEvals({ root, suites: ['traj-suite'] });
    const cases = report.suites[0].cases;
    expect(cases.find((c) => c.case_id === 'claimed-check-ran')?.passed).toBe(true);
    expect(cases.find((c) => c.case_id === 'claimed-check-skipped')?.passed).toBe(false);
    expect(report.ok).toBe(false);
  });
});

describe('runner trajectory capture (B3)', () => {
  let workspace: string;
  let loopsDir: string;

  beforeEach(async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'traj-runner-'));
    workspace = path.join(root, 'ws');
    loopsDir = path.join(root, 'loops');
    await mkdir(workspace, { recursive: true });
    await mkdir(loopsDir, { recursive: true });
    await writeFile(path.join(workspace, 'file.txt'), 'orig', 'utf8');
  });

  it('a fluent-but-skipped turn never reaches success and is recorded as failed', async () => {
    const spec = makeSpec({
      name: 'skipped-checks-loop',
      verification: { evaluate: 'trajectory', success_streak: 1 },
    });
    const executor = scriptedExecutor([
      turn({
        yardstick_delta: 1,
        claimed_checks: ['pnpm test'],
        trajectory: [{ tool: 'shell', command: 'pnpm typecheck', ok: true }],
      }),
    ]);
    const runner = new LoopRunner(spec, {
      executor,
      commandRunner: queuedRunner([1, 0]),
      workspaceRoot: workspace,
      loopsDir,
    });

    const outcome = await runner.run();
    expect(outcome.state).not.toBe('success');
    const state = JSON.parse(await readFile(path.join(loopsDir, spec.name, 'state.json'), 'utf8'));
    expect(state.trajectory[0]).toMatchObject({ turn: 1, passed: false });
    expect(state.trajectory[0].claimed_checks).toEqual(['pnpm test']);
  });

  it('persists per-turn summaries in state and rotates full traces to runs/', async () => {
    const spec = makeSpec({
      name: 'traced-loop',
      verification: { evaluate: 'trajectory', success_streak: 1 },
    });
    const executor = scriptedExecutor([
      turn({
        claimed_checks: ['pnpm test'],
        trajectory: [{ tool: 'shell', command: 'pnpm test', ok: true }],
      }),
    ]);
    const runner = new LoopRunner(spec, {
      executor,
      commandRunner: queuedRunner([1, 0]),
      workspaceRoot: workspace,
      loopsDir,
    });

    const outcome = await runner.run();
    expect(outcome.state).toBe('success');

    const state = JSON.parse(await readFile(path.join(loopsDir, spec.name, 'state.json'), 'utf8'));
    expect(state.trajectory).toHaveLength(1);
    expect(state.trajectory[0]).toMatchObject({ turn: 1, passed: true });

    const runsDir = path.join(loopsDir, spec.name, 'runs');
    const traceFile = (await readdir(runsDir))[0];
    expect(traceFile).toMatch(/^trajectory-.*\.jsonl$/);
    const traceLine = JSON.parse(
      await readFile(path.join(runsDir, traceFile), 'utf8'),
    );
    expect(traceLine.turn).toBe(1);
    expect(traceLine.trace[0].command).toBe('pnpm test');
  });
});
