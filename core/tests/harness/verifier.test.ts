import { describe, expect, it } from 'vitest';
import { Verifier } from '../../harness/verifier-ladder/verifier.ts';
import {
  assertProven,
  markBaseline,
  markCurrent,
  newRedGreenProof,
} from '../../harness/verifier-ladder/red-green.ts';
import { parseViolations } from '../../harness/verifier-ladder/l2-rule.ts';
import {
  MakerCheckerViolation,
  RedGreenUnprovenError,
  type TurnOutcome,
} from '../../harness/loop-runner/types.ts';
import { humanPort, judgeStub, mapRunner, turn } from '../helpers.ts';

function verifier(
  config: Partial<ConstructorParameters<typeof Verifier>[0]> = {},
  deps: Partial<ConstructorParameters<typeof Verifier>[1]> = {},
): Verifier {
  return new Verifier(
    {
      ladder_level: 1,
      command: 'check',
      expected_exit: 0,
      critics: 1,
      success_streak: 1,
      maker_checker: false,
      judge_score_threshold: 0.8,
      ...config,
    },
    { commandRunner: mapRunner({ check: { exitCode: 0 } }), loopName: 'test-loop', ...deps },
  );
}

const noopTurn: TurnOutcome = turn();

describe('L1 — deterministic', () => {
  it('passes on the expected exit code', async () => {
    const v = verifier({}, { commandRunner: mapRunner({ check: { exitCode: 0 } }) });
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(true);
    expect(result.zone).toBe('autonomous');
  });

  it('fails on a non-zero exit code', async () => {
    const v = verifier({}, { commandRunner: mapRunner({ check: { exitCode: 3 } }) });
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(false);
    expect(result.evidence['exitCode']).toBe(3);
  });

  it('honors expected_exit overrides', async () => {
    const v = verifier({ expected_exit: 7 }, { commandRunner: mapRunner({ check: { exitCode: 7 } }) });
    expect((await v.verify(noopTurn, { disjointContext: false })).passed).toBe(true);
  });

  it('preCheck runs the deterministic command', async () => {
    const runner = mapRunner({ check: { exitCode: 1 } });
    const v = verifier({}, { commandRunner: runner });
    expect((await v.preCheck()).passed).toBe(false);
    expect(runner.calls).toEqual(['check']);
  });
});

describe('L2 — rule-based', () => {
  it('parses declared violations from stdout', async () => {
    const v = verifier(
      { ladder_level: 2 },
      { commandRunner: mapRunner({ check: { stdout: 'ERROR: foo.ts line 3\nok', exitCode: 1 } }) },
    );
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(false);
    expect(result.evidence['violations']).toEqual(['ERROR: foo.ts line 3']);
  });

  it('passes when there are no violations', async () => {
    const v = verifier({ ladder_level: 2 }, { commandRunner: mapRunner({ check: { stdout: '', exitCode: 0 } }) });
    expect((await v.verify(noopTurn, { disjointContext: false })).passed).toBe(true);
  });

  it('parseViolations treats non-zero exit with plain output as violations', () => {
    expect(parseViolations('lint: 3 problems', 1, 0)).toEqual(['lint: 3 problems']);
    expect(parseViolations('all good', 0, 0)).toEqual([]);
  });
});

describe('L3 — field truth', () => {
  it('reports the objective zone', async () => {
    const v = verifier({ ladder_level: 3 }, { commandRunner: mapRunner({ check: { exitCode: 0 } }) });
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(true);
    expect(result.zone).toBe('objective');
    expect(result.evidence['field_truth']).toBe(true);
  });
});

describe('L4 — multi-critic LLM judge (A5)', () => {
  const l4 = {
    ladder_level: 4 as const,
    rubric: 'score it',
    maker_checker: true,
    critics: 1,
    success_streak: 1,
    judge_score_threshold: 0.8,
    command: 'check',
    expected_exit: 0,
  };

  it('refuses to run without disjoint context (maker ≠ checker)', async () => {
    const v = verifier(l4, { judge: judgeStub([0.9]) });
    await expect(v.verify(noopTurn, { disjointContext: false })).rejects.toThrow(
      MakerCheckerViolation,
    );
  });

  it('refuses when no rubric is declared', async () => {
    const v = verifier({ ...l4, rubric: undefined }, { judge: judgeStub([0.9]) });
    await expect(v.verify(noopTurn, { disjointContext: true })).rejects.toThrow(/rubric/);
  });

  it('blocks (escalates) when no judge is configured', async () => {
    const v = verifier(l4);
    const result = await v.verify(noopTurn, { disjointContext: true });
    expect(result.passed).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('single critic passes on score >= threshold', async () => {
    const v = verifier(l4, { judge: judgeStub([0.9]) });
    expect((await v.verify(noopTurn, { disjointContext: true })).passed).toBe(true);
  });

  it('n=2: consensus >= ceil(n/2) handles dissent', async () => {
    const v = verifier({ ...l4, critics: 2 }, { judge: judgeStub([0.9, 0.4]) });
    const result = await v.verify(noopTurn, { disjointContext: true });
    // required = ceil(2/2) = 1 → one passing vote carries
    expect(result.evidence['required_passes']).toBe(1);
    expect(result.passed).toBe(true);
    expect(result.evidence['passing_votes']).toBe(1);
  });

  it('n=3: one dissent of three fails (needs 2 of 3)', async () => {
    const v = verifier({ ...l4, critics: 3 }, { judge: judgeStub([0.9, 0.4, 0.4]) });
    const result = await v.verify(noopTurn, { disjointContext: true });
    expect(result.evidence['required_passes']).toBe(2);
    expect(result.passed).toBe(false);
  });

  it('n=3: unanimous pass succeeds', async () => {
    const v = verifier({ ...l4, critics: 3 }, { judge: judgeStub([0.9, 0.85, 1.0]) });
    expect((await v.verify(noopTurn, { disjointContext: true })).passed).toBe(true);
  });

  it('each critic gets an independent judge call (disjoint contexts)', async () => {
    const judge = judgeStub([0.9, 0.9]);
    const v = verifier({ ...l4, critics: 2 }, { judge });
    await v.verify(noopTurn, { disjointContext: true });
    expect(judge.seen).toHaveLength(2);
  });
});

describe('L5 — human checkpoint', () => {
  const l5 = { ladder_level: 5 as const, critics: 1, success_streak: 1, maker_checker: false, judge_score_threshold: 0.8 };

  it('passes when the human approves', async () => {
    const port = humanPort(true);
    const v = verifier(l5, { humanPort: port });
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(true);
    expect(port.asked[0]).toMatch(/human gate/i);
  });

  it('blocks when the human denies', async () => {
    const v = verifier(l5, { humanPort: humanPort(false) });
    const result = await v.verify(noopTurn, { disjointContext: false });
    expect(result.passed).toBe(false);
    expect(result.blocked).toBe(true);
  });

  it('blocks when no human port is wired', async () => {
    const v = verifier(l5);
    expect((await v.verify(noopTurn, { disjointContext: false })).blocked).toBe(true);
  });
});

describe('A1 — red-before / green-after proof', () => {
  it('a tautological check (green at baseline) never proves and success is refused', () => {
    const proof = newRedGreenProof(true);
    markBaseline(proof, true); // already green before the fix
    markCurrent(proof, true); // green after — no sensitivity
    expect(proof.proven).toBe(false);
    expect(() => assertProven(proof, 'tautological-loop')).toThrow(RedGreenUnprovenError);
  });

  it('red → green proves the verifier catches the bug', () => {
    const proof = newRedGreenProof(true);
    markBaseline(proof, false);
    markCurrent(proof, true);
    expect(proof.proven).toBe(true);
    expect(() => assertProven(proof, 'sensitive-loop')).not.toThrow();
  });

  it('green → red (regression) does not prove', () => {
    const proof = newRedGreenProof(true);
    markBaseline(proof, true);
    markCurrent(proof, false);
    expect(proof.proven).toBe(false);
  });

  it('proof is a no-op when red_green is disabled', () => {
    const proof = newRedGreenProof(false);
    expect(() => assertProven(proof, 'plain-loop')).not.toThrow();
  });
});
