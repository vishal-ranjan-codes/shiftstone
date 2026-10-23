/**
 * Shared fixtures for the harness test suite.
 */

import type {
  CommandRunner,
  ExecResult,
  HumanApprovalPort,
  JudgeClient,
  LoopSpecification,
  LoopState,
  TurnContext,
  TurnExecutor,
  TurnOutcome,
} from '../harness/loop-runner/types.ts';

export function makeSpec(overrides?: {
  verification?: Partial<LoopSpecification['verification']>;
  execution?: Partial<LoopSpecification['execution']>;
  brakes?: {
    budget?: Partial<LoopSpecification['brakes']['budget']>;
    stagnation?: Partial<LoopSpecification['brakes']['stagnation']>;
    human_gates?: string[];
  };
  trigger?: LoopSpecification['trigger'];
  oversight?: LoopSpecification['oversight'];
  actuation?: LoopSpecification['actuation'];
  architecture?: LoopSpecification['architecture'];
  memory?: Partial<LoopSpecification['memory']>;
  name?: string;
}): LoopSpecification {
  return {
    name: overrides?.name ?? 'test-loop',
    description: 'test fixture loop',
    use_when: 'in tests',
    trigger: overrides?.trigger ?? { type: 'manual' },
    goal: { statement: 'goal met', type: 'verifiable' },
    execution: {
      isolation: { mode: 'none' },
      baseline: 'worktree-snapshot',
      ordering: 'worst-first',
      steps: ['do one thing'],
      skills: ['stack'],
      ...(overrides?.execution ?? {}),
    },
    verification: {
      ladder_level: 1,
      command: 'check',
      expected_exit: 0,
      red_green: true,
      critics: 1,
      success_streak: 1,
      maker_checker: false,
      judge_score_threshold: 0.8,
      evaluate: 'output',
      ...(overrides?.verification ?? {}),
    },
    brakes: {
      budget: { max_iterations: 10, sub_loop_multiplier: 0.5, ...(overrides?.brakes?.budget ?? {}) },
      stagnation: {
        max_barren_turns: 2,
        detector: 'consecutive_no_progress',
        ...(overrides?.brakes?.stagnation ?? {}),
      },
      human_gates: overrides?.brakes?.human_gates ?? [],
    },
    terminal_states: {
      success: 'verified done',
      no_op: 'already done',
      blocked: 'needs a human',
      stalled: 'no progress',
      exhausted: 'budget gone',
    },
    memory: {
      location: `.loops/${overrides?.name ?? 'test-loop'}/state.json`,
      format: 'json',
      curated: true,
      fresh_context_each_turn: false,
      ...(overrides?.memory ?? {}),
    },
    architecture: overrides?.architecture ?? 'solo',
    actuation: overrides?.actuation ?? '/goal',
    oversight: overrides?.oversight ?? 'out',
    pattern_families: ['A_define_done', 'B_act_without_breaking'],
    health_metric: { name: 'cost_per_accepted_change', track_dollars: true, track_tokens: true },
  };
}

/**
 * CommandRunner backed by an exit-code queue: one entry per expected call;
 * the last entry repeats. The queue is also exposed for call assertions.
 */
export function queuedRunner(exits: number[]): CommandRunner & {
  calls: string[];
  results: ExecResult[];
} {
  const calls: string[] = [];
  const results: ExecResult[] = exits.map((exitCode, i) => ({
    stdout: i === 0 && exits.length > 1 ? '' : '',
    stderr: '',
    exitCode,
  }));
  let index = 0;
  const runner = (async (command: string): Promise<ExecResult> => {
    calls.push(command);
    const result = results[Math.min(index, results.length - 1)];
    index += 1;
    return result;
  }) as CommandRunner & { calls: string[]; results: ExecResult[] };
  runner.calls = calls;
  runner.results = results;
  return runner;
}

/** CommandRunner with per-command canned outputs (exit codes / stdout). */
export function mapRunner(
  map: Record<string, { stdout?: string; exitCode?: number }>,
  fallback: { stdout?: string; exitCode?: number } = { stdout: '', exitCode: 0 },
): CommandRunner & { calls: string[] } {
  const calls: string[] = [];
  const runner = (async (command: string): Promise<ExecResult> => {
    calls.push(command);
    const spec = map[command] ?? fallback;
    return { stdout: spec.stdout ?? '', stderr: '', exitCode: spec.exitCode ?? 0 };
  }) as CommandRunner & { calls: string[] };
  runner.calls = calls;
  return runner;
}

/** Executor driven by a script of outcomes; the last outcome repeats. */
export function scriptedExecutor(
  script: TurnOutcome[] | ((ctx: TurnContext, call: number) => TurnOutcome | Promise<TurnOutcome>),
): TurnExecutor & { contexts: TurnContext[] } {
  const contexts: TurnContext[] = [];
  let call = 0;
  const executor = {
    contexts,
    execute: async (ctx: TurnContext): Promise<TurnOutcome> => {
      contexts.push({
        ...ctx,
        scratch: { ...ctx.scratch },
        worst_first_queue: [...ctx.worst_first_queue],
      });
      const i = call;
      call += 1;
      if (typeof script === 'function') return script(ctx, i);
      return script[Math.min(i, script.length - 1)];
    },
  };
  return executor as TurnExecutor & { contexts: TurnContext[] };
}

export function turn(overrides?: Partial<TurnOutcome>): TurnOutcome {
  return {
    mutations: ['edit'],
    yardstick_delta: 1,
    output_hash: `hash-${Math.random().toString(36).slice(2)}`,
    ...overrides,
  };
}

export function judgeStub(scores: number[]): JudgeClient & { seen: number[] } {
  const seen: number[] = [];
  return {
    seen,
    judge: async ({ judgeIndex }) => {
      const score = scores[Math.min(judgeIndex, scores.length - 1)];
      seen.push(score);
      return { score, reasoning: `stub verdict ${judgeIndex}` };
    },
  };
}

export function humanPort(answer: boolean): HumanApprovalPort & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    approve: async ({ message }) => {
      asked.push(message);
      return answer;
    },
  };
}

export function baseState(loop = 'test-loop'): LoopState {
  return {
    loop,
    run_id: 'run-1',
    attempt: 0,
    success_streak: 0,
    tokens_used: 0,
    dollars_used: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    yardstick: 0,
    last_yardstick_delta: 0,
    barren_turns: 0,
    addressed: [],
    waived: [],
    accepted_changes: 0,
    red_green: { required: false, proven: false, baseline: 'unknown', current: 'unknown' },
    notes: [],
    scratch: {},
  };
}
