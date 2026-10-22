import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LoopRunner } from '../../harness/loop-runner/runner.ts';
import { ShellTurnExecutor } from '../../harness/loop-runner/execution/shell-executor.ts';
import { createCommandRunner } from '../../harness/loop-runner/exec.ts';
import {
  MandatoryCheckerError,
  type LoopSpecification,
  type TurnExecutor,
} from '../../harness/loop-runner/types.ts';
import {
  humanPort,
  judgeStub,
  makeSpec,
  queuedRunner,
  scriptedExecutor,
  turn,
} from '../helpers.ts';

interface Env {
  workspace: string;
  loopsDir: string;
}

let env: Env;

beforeEach(async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'loop-runner-'));
  const workspace = path.join(root, 'ws');
  const loopsDir = path.join(root, 'loops');
  await mkdir(workspace, { recursive: true });
  await mkdir(loopsDir, { recursive: true });
  await writeFile(path.join(workspace, 'file.txt'), 'orig', 'utf8');
  env = { workspace, loopsDir };
});

function build(
  spec: LoopSpecification,
  opts: {
    executor?: TurnExecutor;
    commandRunner?: ReturnType<typeof queuedRunner>;
    judge?: ReturnType<typeof judgeStub>;
    humanPort?: ReturnType<typeof humanPort>;
  },
): LoopRunner {
  return new LoopRunner(spec, {
    executor: opts.executor ?? scriptedExecutor([turn()]),
    commandRunner: opts.commandRunner ?? queuedRunner([1, 0]),
    judge: opts.judge,
    humanPort: opts.humanPort,
    workspaceRoot: env.workspace,
    loopsDir: env.loopsDir,
  });
}

async function readState(spec: LoopSpecification): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(env.loopsDir, spec.name, 'state.json'), 'utf8'));
}

describe('LoopRunner lifecycle — all 5 terminal states', () => {
  it('success: red → green with a verified streak (A1 proof recorded)', async () => {
    const spec = makeSpec({ name: 'success-loop' });
    const executor = scriptedExecutor([turn()]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1, 0]) }).run();

    expect(outcome.state).toBe('success');
    const state = await readState(spec);
    expect(state['terminal']).toBe('success');
    expect(state['accepted_changes']).toBe(1);
    expect((state['red_green'] as Record<string, unknown>)['proven']).toBe(true);
    expect((state['red_green'] as Record<string, unknown>)['baseline']).toBe('red');
    expect((state['red_green'] as Record<string, unknown>)['current']).toBe('green');
    expect(executor.contexts).toHaveLength(1);
  });

  it('success with success_streak=2 requires an explicit confirmation pass', async () => {
    const spec = makeSpec({ name: 'streak-loop', verification: { success_streak: 2 } });
    const executor = scriptedExecutor([turn()]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1, 0, 0]) }).run();

    expect(outcome.state).toBe('success');
    expect(executor.contexts).toHaveLength(1); // confirmation re-verifies, no second turn
    const state = await readState(spec);
    expect(state['success_streak']).toBe(2);
  });

  it('no_op: a tautological/already-green check exits no_op, never success (A1)', async () => {
    const spec = makeSpec({ name: 'noop-loop' });
    const executor = scriptedExecutor([turn()]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([0]) }).run();

    expect(outcome.state).toBe('no_op');
    expect(executor.contexts).toHaveLength(0);
    const state = await readState(spec);
    expect(state['red_green'] && (state['red_green'] as Record<string, unknown>)['proven']).toBe(false);
  });

  it('blocked: a blocked turn escalates immediately', async () => {
    const spec = makeSpec({ name: 'blocked-loop' });
    const executor = scriptedExecutor([turn({ blocked: true, blocked_reason: 'missing credentials' })]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();

    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toBe('missing credentials');
  });

  it('stalled: 2 barren turns trip the stagnation detector', async () => {
    const spec = makeSpec({ name: 'stalled-loop' });
    const executor = scriptedExecutor([
      turn({ yardstick_delta: 0 }),
      turn({ yardstick_delta: 0 }),
    ]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();

    expect(outcome.state).toBe('stalled');
    const state = await readState(spec);
    expect(state['attempt']).toBe(2);
    expect(state['barren_turns']).toBe(2);
  });

  it('exhausted: the iteration ceiling ends the run', async () => {
    const spec = makeSpec({
      name: 'exhausted-loop',
      brakes: { budget: { max_iterations: 2 }, stagnation: { max_barren_turns: 5 } },
    });
    const executor = scriptedExecutor([turn({ yardstick_delta: 0 })]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();

    expect(outcome.state).toBe('exhausted');
    expect(outcome.reason).toMatch(/max_iterations/);
  });

  it('error: harness violations terminate as error — never success (§7.7)', async () => {
    const spec = makeSpec({ name: 'error-loop' });
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn({ mutations: ['a', 'b'] })]),
      commandRunner: queuedRunner([1]),
    }).run();

    expect(outcome.state).toBe('error');
    expect(outcome.reason).toMatch(/One mutation per turn/);
  });
});

describe('1.6b A3 — one-mutation-per-turn hard invariant', () => {
  it('a second mutation in a turn is refused and rolled back', async () => {
    const spec = makeSpec({ name: 'mutation-loop' });
    const file = path.join(env.workspace, 'file.txt');
    const executor = scriptedExecutor([
      turn({
        mutations: ['edit file.txt', 'edit other.txt'],
        yardstick_delta: 0,
      }),
    ]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();

    expect(outcome.state).toBe('error');
    expect(outcome.reason).toMatch(/declared 2 mutations/);
    expect(await readFile(file, 'utf8')).toBe('orig'); // rolled back to baseline
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toMatch(/rolled back to baseline/);
  });
});

describe('1.6a A2 — baseline snapshot + regression rollback', () => {
  it('a negative yardstick delta restores the baseline and records a note', async () => {
    const spec = makeSpec({ name: 'regression-loop' });
    const file = path.join(env.workspace, 'file.txt');
    let call = 0;
    const executor = scriptedExecutor(async () => {
      call += 1;
      await writeFile(file, `worse-${call}`, 'utf8'); // the mutation regresses the yardstick
      return turn({ yardstick_delta: -1, output_hash: `regress-${call}` });
    });
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();

    expect(outcome.state).toBe('stalled'); // two regression turns = 2 barren
    expect(await readFile(file, 'utf8')).toBe('orig'); // rolled back both times
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toMatch(/rolled back to baseline snap-/);
  });
});

describe('1.6c A4 — exhaustive enumeration gates success', () => {
  it('success is blocked while unaddressed items remain, then succeeds', async () => {
    const spec = makeSpec({ name: 'enumerate-loop', execution: { enumerate: 'list-targets' } });
    let checkCalls = 0;
    const runner = new LoopRunner(spec, {
      executor: scriptedExecutor([
        turn({ addressed: ['a'], yardstick_delta: 1 }),
        turn({ addressed: ['b'], yardstick_delta: 1 }),
      ]),
      commandRunner: async (command: string) => {
        if (command === 'list-targets') return { stdout: 'a\nb\n', stderr: '', exitCode: 0 };
        // pre-check is red on the first call; green afterwards
        checkCalls += 1;
        return { stdout: '', stderr: '', exitCode: checkCalls === 1 ? 1 : 0 };
      },
      workspaceRoot: env.workspace,
      loopsDir: env.loopsDir,
    });

    const outcome = await runner.run();
    expect(outcome.state).toBe('success');
    const state = await readState(spec);
    expect(state['enumerated']).toEqual(['a', 'b']);
    expect(state['addressed']).toEqual(['a', 'b']);
    expect(state['notes'] && JSON.stringify(state['notes'])).toMatch(/success withheld/);
  });
});

describe('1.6d A8 — oversight and human gates', () => {
  it('oversight:in with a denied gate blocks and records the denial', async () => {
    const spec = makeSpec({
      name: 'gate-denied-loop',
      oversight: 'in',
      brakes: { human_gates: ['git push'] },
    });
    const port = humanPort(false);
    const executor = scriptedExecutor(async (ctx) => {
      const ok = await ctx.gate('git push origin main');
      return turn({ blocked: !ok, blocked_reason: ok ? '' : 'gate denied: git push' });
    });
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]), humanPort: port }).run();

    expect(outcome.state).toBe('blocked');
    expect(port.asked).toHaveLength(1);
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toMatch(/gate denied/);
  });

  it('oversight:in with an approved gate proceeds to success', async () => {
    const spec = makeSpec({
      name: 'gate-approved-loop',
      oversight: 'in',
      brakes: { human_gates: ['git push'] },
    });
    const port = humanPort(true);
    const executor = scriptedExecutor(async (ctx) => {
      const ok = await ctx.gate('git push');
      expect(ok).toBe(true);
      return turn();
    });
    const outcome = await build(spec, {
      executor,
      commandRunner: queuedRunner([1, 0]),
      humanPort: port,
    }).run();

    expect(outcome.state).toBe('success');
    expect(port.asked).toHaveLength(1);
  });

  it('gated actions reported without approval are refused under oversight:in', async () => {
    const spec = makeSpec({
      name: 'sneaky-gate-loop',
      oversight: 'in',
      brakes: { human_gates: ['git push'] },
    });
    const executor = scriptedExecutor([turn({ gated_actions: ['git push'] })]);
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]), humanPort: humanPort(true) }).run();

    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/not approved under oversight:in/);
  });

  it('oversight:out allows gated actions with a monitoring note', async () => {
    const spec = makeSpec({
      name: 'monitor-loop',
      oversight: 'out',
      brakes: { human_gates: ['git push'] },
    });
    const executor = scriptedExecutor(async (ctx) => {
      const ok = await ctx.gate('git push'); // no human approval needed when oversight:out
      expect(ok).toBe(true);
      return turn();
    });
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1, 0]) }).run();

    expect(outcome.state).toBe('success');
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toMatch(/oversight:out/);
  });
});

describe('1.6e A12 — context hygiene', () => {
  it('scratch never leaks between turns and never reaches disk (Ralph re-init)', async () => {
    const spec = makeSpec({
      name: 'scratch-loop',
      actuation: 'ralph_skeleton',
      memory: { fresh_context_each_turn: true },
    });
    const seenScratch: string[] = [];
    const executor = scriptedExecutor((ctx, call) => {
      seenScratch.push(JSON.stringify(ctx.scratch));
      if (call === 0) {
        ctx.scratch['secret'] = 'turn-1-data';
        return turn({ yardstick_delta: 0, output_hash: 'h1' });
      }
      return turn({ yardstick_delta: 1, output_hash: 'h2' });
    });
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1, 1, 1, 0]) }).run();

    expect(outcome.state).toBe('success');
    expect(seenScratch[0]).toBe('{}'); // start of turn 1
    expect(seenScratch[1]).toBe('{}'); // turn 2 must not see turn 1's scratch
    expect(seenScratch.join('|')).not.toContain('turn-1-data');
    const state = await readState(spec);
    expect(state['scratch']).toEqual({});
  });
});

describe('A7 — unattended-loop security sandbox', () => {
  it('a scheduled loop without network/credential isolation refuses to start', async () => {
    const spec = makeSpec({
      name: 'unsandboxed-loop',
      trigger: { type: 'scheduled', cron: '0 3 * * *' },
      execution: { isolation: { mode: 'none' } },
    });
    await expect(build(spec, {}).run()).rejects.toThrow(/refuses to start.*execution\.isolation/s);
  });

  it('a sandboxed scheduled loop starts and runs its lifecycle', async () => {
    const spec = makeSpec({
      name: 'sandboxed-loop',
      trigger: { type: 'scheduled', cron: '0 3 * * *' },
      execution: {
        isolation: { mode: 'worktree', network: 'none', credentials: 'scoped' },
      },
    });
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn()]),
      commandRunner: queuedRunner([1, 0]),
    }).run();
    expect(outcome.state).toBe('success');
  });
});

describe('L4+ rules', () => {
  const l4Spec = (name: string): LoopSpecification =>
    makeSpec({
      name,
      verification: {
        ladder_level: 4,
        command: 'check',
        rubric: 'score it fairly',
        maker_checker: true,
        red_green: false,
        success_streak: 1,
      },
      architecture: 'maker_checker',
    });

  it('throws MandatoryCheckerError when L4 declares maker_checker=false', async () => {
    const spec = makeSpec({
      name: 'self-approve-loop',
      verification: { ladder_level: 4, command: 'check', rubric: 'r', maker_checker: false, red_green: false },
      architecture: 'maker_checker',
    });
    await expect(build(spec, {}).run()).rejects.toThrow(MandatoryCheckerError);
  });

  it('L4 success requires a passing disjoint judge verdict', async () => {
    const spec = l4Spec('judge-loop');
    const judge = judgeStub([0.9]);
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn()]),
      commandRunner: queuedRunner([1, 0]),
      judge,
    }).run();

    expect(outcome.state).toBe('success');
    expect(judge.seen).toHaveLength(1);
  });

  it('L4 without a configured judge blocks (escalates), never fakes a pass', async () => {
    const spec = l4Spec('judgeless-loop');
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn()]),
      commandRunner: queuedRunner([1]),
    }).run();

    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/judge not configured/);
  });
});

describe('shell turn executor', () => {
  it('blocks agent-actuated loops with a clear escalation reason', async () => {
    const spec = makeSpec({ name: 'agent-loop' });
    const executor = new ShellTurnExecutor(spec, createCommandRunner({ cwd: env.workspace }));
    const outcome = await build(spec, { executor, commandRunner: queuedRunner([1]) }).run();
    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/agent-actuated/);
  });

  it('maps exit 78 to blocked and parses ADDRESSED lines (A4)', async () => {
    const spec = makeSpec({
      name: 'shell-loop',
      execution: { turn_command: 'turn-cmd', enumerate: 'list-targets' },
    });
    let checkCalls = 0;
    const runner = new LoopRunner(spec, {
      executor: new ShellTurnExecutor(spec, async (command) => {
        if (command === 'turn-cmd') {
          return { stdout: 'ADDRESSED: x\nall done', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: 'not configured', exitCode: 78 };
      }),
      commandRunner: async (command) => {
        if (command === 'list-targets') return { stdout: 'x', stderr: '', exitCode: 0 };
        checkCalls += 1;
        return { stdout: '', stderr: '', exitCode: checkCalls === 1 ? 1 : 0 };
      },
      workspaceRoot: env.workspace,
      loopsDir: env.loopsDir,
    });
    const outcome = await runner.run();
    expect(outcome.state).toBe('success');
    const state = await readState(spec);
    expect(state['addressed']).toEqual(['x']);
  });

  it('a turn command exiting 78 blocks with the reported reason', async () => {
    const spec = makeSpec({
      name: 'blocked-turn-loop',
      execution: { turn_command: 'turn-cmd' },
    });
    const runner = new LoopRunner(spec, {
      executor: new ShellTurnExecutor(spec, async () => ({
        stdout: '',
        stderr: 'sources not configured — escalate',
        exitCode: 78,
      })),
      commandRunner: async () => ({ stdout: '', stderr: '', exitCode: 1 }),
      workspaceRoot: env.workspace,
      loopsDir: env.loopsDir,
    });
    const outcome = await runner.run();
    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/not configured/);
  });
});

describe('2.16 — stage seal validation in the runner (C8)', () => {
  const CONTEXT = [
    '---',
    'type: ICM Stage',
    'timestamp: 2026-10-12T00:00:00Z',
    'stage: 03-impl',
    'status: open',
    '---',
    '',
    '# 03-impl — CONTEXT',
    '',
    '## Inputs',
    '- Layer 3 (Reference): ref.md',
    '',
    '## Process',
    '1. build it',
    '',
    '## Outputs',
    '- out.md -> output/out.md',
    '',
  ].join('\n');
  const VALID_OUTPUT = [
    '---',
    'type: stage-output',
    'timestamp: 2026-10-12T01:00:00Z',
    'inputs: [ref.md]',
    '---',
    '',
    '# Deliverable',
    '',
  ].join('\n');

  async function stageWith(outputContent: string): Promise<void> {
    await mkdir(path.join(env.workspace, 'stage', 'output'), { recursive: true });
    await writeFile(path.join(env.workspace, 'stage', 'CONTEXT.md'), CONTEXT, 'utf8');
    await writeFile(path.join(env.workspace, 'stage', 'output', 'out.md'), outputContent, 'utf8');
  }

  it('seals a compliant stage when the loop succeeds', async () => {
    await stageWith(VALID_OUTPUT);
    const spec = makeSpec({ name: 'seal-ok-loop', execution: { stage_contract: 'stage' } });
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn()]),
      commandRunner: queuedRunner([1, 0]),
    }).run();

    expect(outcome.state).toBe('success');
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toContain('stage sealed: stage');
    const context = await readFile(path.join(env.workspace, 'stage', 'CONTEXT.md'), 'utf8');
    expect(context).toContain('status: sealed');
  });

  it('records a refused seal when an output lacks OKF frontmatter', async () => {
    await stageWith('# output with no frontmatter\n');
    const spec = makeSpec({ name: 'seal-refused-loop', execution: { stage_contract: 'stage' } });
    const outcome = await build(spec, {
      executor: scriptedExecutor([turn()]),
      commandRunner: queuedRunner([1, 0]),
    }).run();

    expect(outcome.state).toBe('success'); // terminal state is not faked away…
    const state = await readState(spec);
    expect(state['notes'] && JSON.stringify(state['notes'])).toContain('stage NOT sealed');
    const context = await readFile(path.join(env.workspace, 'stage', 'CONTEXT.md'), 'utf8');
    expect(context).toContain('status: open'); // …but the seal is refused
  });
});
