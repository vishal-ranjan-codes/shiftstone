/**
 * LoopSpecification and runtime types — blueprint §7.1 + amendments A1–A5, A8.
 *
 * These types describe a RESOLVED spec: loader defaults have been applied and
 * the validator has accepted it. Structural/semantic refusals live in validator.ts.
 *
 * Syntax note: this codebase targets Node's native type stripping, so only
 * erasable TypeScript syntax is allowed (no enums, no parameter properties).
 */

import type { RubricSpec } from '../evals/checker/rubric-template.ts';

export const LOOP_NAME_PATTERN = /^[a-z][a-z0-9-]*-loop$/;
export type { RubricSpec };

export type TriggerType = 'manual' | 'scheduled' | 'event';
export type GoalType = 'verifiable' | 'judged' | 'mixed';
export type IsolationMode = 'worktree' | 'container' | 'none';
/** A7 — network policy for the execution sandbox. */
export type NetworkPolicy = 'none' | 'allowlist';
/** A7 — credential scope available to the run. */
export type CredentialPolicy = 'scoped' | 'none';
/** A7 — execution.isolation block; string form (mode only) is normalized at load. */
export interface IsolationConfig {
  mode: IsolationMode;
  /** Required for unattended (non-manual) triggers: none | allowlist. */
  network?: NetworkPolicy;
  /** Hosts permitted when network: allowlist. */
  allowlist?: string[];
  /** Required for unattended (non-manual) triggers: scoped | none. */
  credentials?: CredentialPolicy;
}

export type BaselineMode = 'git-stash' | 'worktree-snapshot' | 'none'; // A2
export type OrderingMode = 'worst-first' | 'sequential'; // A3
export type LadderLevel = 1 | 2 | 3 | 4 | 5;
/** B3: which evidence gates a turn — final output, tool-call trajectory, or both. */
export type EvaluateMode = 'output' | 'trajectory' | 'both';
/** B3: one recorded tool call from a turn's trajectory. */
export interface ToolCallRecord {
  tool: string;
  command?: string;
  args?: string[];
  ok?: boolean;
}

/** B3: per-turn trajectory summary persisted to state.json; full traces rotate in runs/. */
export interface TurnTrajectorySummary {
  turn: number;
  claimed_checks: string[];
  executed_checks: string[];
  passed: boolean;
}

export type StagnationDetectorKind =
  | 'consecutive_no_progress'
  | 'output_hash_unchanged'
  | 'yardstick_delta'
  | 'composite';
export type TerminalState = 'success' | 'no_op' | 'blocked' | 'stalled' | 'exhausted';
/** 'error' is a non-success terminal: hard invariant error ≠ success (§7.7). */
export type AnyTerminalState = TerminalState | 'error';
export type MemoryFormat = 'markdown' | 'json' | 'yaml' | 'git';
export type Architecture = 'solo' | 'maker_checker' | 'manager_helpers';
export type Actuation = '/goal' | 'ralph_skeleton';
export type PatternFamily =
  | 'A_define_done'
  | 'B_act_without_breaking'
  | 'C_earn_trust'
  | 'D_sustain';
/** A8: human autonomy spectrum. */
export type OversightMode = 'in' | 'on' | 'out';

export interface SubLoopRef {
  name: string;
  spec_path?: string;
}

/** C9 — inline stage declaration for the incremental (Make-style) gate. */
export interface InlineStageSpec {
  id: string;
  /** Workspace-relative inputs (files or directories — dirs hash every file). */
  inputs: string[];
  outputs?: string[];
  depends_on?: string[];
  force_rerun?: boolean;
}

/** C9 — incremental re-run config: unchanged inputs ⇒ skip straight to no-op. */
export interface IncrementalConfig {
  /** Folder to scan for CONTEXT.md stage contracts (merged with `stages`). */
  root?: string;
  /** Fingerprint state file (default `.loops/<loop>/stage-deps.json`). */
  state?: string;
  stages?: InlineStageSpec[];
}

export interface BudgetConfig {
  max_iterations: number; // default 10; validator refuses > 10 (paper N ≤ 10)
  max_tokens?: number;
  max_dollars_usd?: number;
  max_wallclock_s?: number;
  sub_loop_multiplier: number; // default 0.5
}

export interface StagnationConfig {
  max_barren_turns: number; // default 2; validator refuses missing value
  detector: StagnationDetectorKind;
}

export interface LoopSpecification {
  name: string; // pattern: /^[a-z][a-z0-9-]*-loop$/
  description: string;
  use_when: string;

  trigger: {
    type: TriggerType;
    cron?: string; // for type=scheduled
    event_source?: string; // for type=event
  };

  goal: {
    statement: string;
    type: GoalType;
  };

  execution: {
    isolation: IsolationConfig; // A7: mode + network + credentials block (string form normalized at load)
    baseline: BaselineMode; // A2, default 'worktree-snapshot'
    ordering: OrderingMode; // A3, default 'sequential'
    steps: string[]; // one variable change per turn
    skills: string[]; // named, testable — never empty (anti-pattern #1)
    sub_loops?: SubLoopRef[]; // acyclic call graph (A6)
    enumerate?: string; // A4: command/pattern producing the full target set
    turn_command?: string; // shell-actuated turn; absent ⇒ agent-actuated (injected executor)
    /** Relative stage folder (with CONTEXT.md) sealed on loop success (C8). */
    stage_contract?: string;
    /** C9 — Make-style incremental gate over declared stages. */
    incremental?: IncrementalConfig;
  };

  verification: {
    ladder_level: LadderLevel;
    command?: string; // absence ⇒ A10 refusal ("scheduled one-shot, not a loop")
    expected_exit?: number;
    /** Required at L4 as a structured RubricSpec (B2); strings are freeform L1-L3 only. */
    rubric?: string | RubricSpec;
    red_green: boolean; // A1, default true for L1–L3 when a command exists
    critics: number; // A5, default 1; consensus >= ceil(n/2)
    success_streak: number; // default 2
    hold_out?: string;
    maker_checker: boolean; // required true when level >= 4
    judge_score_threshold: number; // default 0.8 (§7.4)
    /** B1: named eval suite under evals/<name>/ run alongside verification. */
    eval_suite?: string;
    /** B3: what evidence gates the turn — output, trajectory, or both. */
    evaluate: EvaluateMode; // default 'output'
  };

  brakes: {
    budget: BudgetConfig;
    stagnation: StagnationConfig;
    human_gates: string[]; // action patterns requiring approval
  };

  terminal_states: {
    success: string;
    no_op: string;
    blocked: string;
    stalled: string;
    exhausted: string;
  };

  memory: {
    location: string; // on-disk path
    format: MemoryFormat;
    curated: boolean; // lessons kept/discarded on evidence
    fresh_context_each_turn: boolean; // true for Ralph actuation
  };

  architecture: Architecture;
  actuation: Actuation;
  oversight: OversightMode; // A8
  /** B7: declared task class, resolved against core/context/model-routing.yaml. */
  model?: { task_class: string };

  pattern_families: PatternFamily[];

  health_metric: {
    name: 'cost_per_accepted_change';
    track_dollars: boolean;
    track_tokens: boolean;
  };
}

/** Per-run, persisted to .loops/<id>/state.json between turns (Family D). */
export interface LoopState {
  loop: string;
  run_id: string;
  attempt: number; // turns executed
  success_streak: number;
  tokens_used: number;
  dollars_used: number;
  started_at: string;
  updated_at: string;
  yardstick: number; // frozen yardstick reading (Family A)
  last_yardstick_delta: number;
  barren_turns: number;
  output_hash?: string;
  enumerated?: string[]; // A4: full target set, recorded at start
  addressed: string[]; // A4
  waived: string[]; // A4: explicit human/agent waivers
  accepted_changes: number;
  red_green: RedGreenProof; // A1
  notes: string[]; // gate/oversight/rollback events surfaced by /status
  scratch: Record<string, unknown>; // A12: per-turn, discarded after persist
  trajectory?: TurnTrajectorySummary[]; // B3: per-turn summaries only
  terminal?: AnyTerminalState;
}

export interface RedGreenProof {
  required: boolean;
  proven: boolean;
  baseline: 'red' | 'green' | 'unknown';
  current: 'red' | 'green' | 'unknown';
}

export interface TurnContext {
  spec: LoopSpecification;
  state: LoopState;
  turn: number;
  /** Per-turn scratchpad — cleared after state persistence (A12). */
  scratch: Record<string, unknown>;
  /** Worst-first queue derived from the enumerated set (A3). */
  worst_first_queue: string[];
  /** Ask permission before an irreversible action (A8). Returns false if denied. */
  gate: (action: string) => Promise<boolean>;
}

export interface TurnOutcome {
  /** Declared mutations — more than one ⇒ refusal (A3, hard invariant). */
  mutations: string[];
  /** Negative ⇒ regression detected against baseline (A2 rollback). */
  yardstick_delta: number;
  /** Hash of the turn's observable output (stagnation detector input). */
  output_hash: string;
  addressed?: string[]; // A4 items resolved this turn
  waived?: string[]; // A4 items waived this turn
  artifact?: unknown;
  blocked?: boolean;
  blocked_reason?: string;
  /** Actions the turn wants to perform that match spec human_gates (A8). */
  gated_actions?: string[];
  /** B3: tool-call sequence recorded during the turn. */
  trajectory?: ToolCallRecord[];
  /** B3: checks the turn claims it ran — each must appear in the trajectory. */
  claimed_checks?: string[];
  tokens_used?: number;
  dollars_used?: number;
  /** Infrastructure failure inside the turn — counts as a barren turn. */
  error?: string;
}

export interface VerifyResult {
  passed: boolean;
  evidence: Record<string, unknown>;
  zone: 'autonomous' | 'objective' | 'assisted';
  blocked?: boolean;
  reason?: string;
}

export interface VerifyOpts {
  disjointContext: boolean;
  rubric?: string | RubricSpec;
  artifact?: unknown;
  turn?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CommandRunner = (command: string) => Promise<ExecResult>;

export interface JudgeRequest {
  rubric: string;
  artifact: unknown;
  judgeIndex: number;
  disjointContext: boolean;
}

export interface JudgeVerdict {
  score: number; // 0..1
  reasoning: string;
  /** B2: per-dimension scores (0–2) — when present they recompute the vote. */
  dimensions?: Record<string, number>;
}

/** L4 judge port — disjoint from the maker context (Family C). */
export interface JudgeClient {
  judge(request: JudgeRequest): Promise<JudgeVerdict>;
}

export interface HumanApprovalRequest {
  message: string;
  artifact?: unknown;
}

/** L5 human checkpoint port — blocks until the user answers. */
export interface HumanApprovalPort {
  approve(request: HumanApprovalRequest): Promise<boolean>;
}

export interface TurnExecutor {
  execute(context: TurnContext): Promise<TurnOutcome>;
}

/** A2: photograph the "before" state prior to each turn. */
export interface BaselineManager {
  capture(): Promise<string>; // returns baseline ref/id
  restore(ref: string): Promise<void>;
}

export interface TerminalOutcome {
  state: AnyTerminalState;
  reason: string;
  state_snapshot: LoopState;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export class LoopHarnessError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'LoopHarnessError';
    this.code = code;
  }
}

export class MandatoryCheckerError extends LoopHarnessError {
  constructor(message: string) {
    super('MANDATORY_CHECKER', message);
    this.name = 'MandatoryCheckerError';
  }
}

export class MakerCheckerViolation extends LoopHarnessError {
  constructor(message: string) {
    super('MAKER_CHECKER', message);
    this.name = 'MakerCheckerViolation';
  }
}

export class OneMutationViolation extends LoopHarnessError {
  constructor(message: string) {
    super('ONE_MUTATION', message);
    this.name = 'OneMutationViolation';
  }
}

export class RedGreenUnprovenError extends LoopHarnessError {
  constructor(message: string) {
    super('RED_GREEN_UNPROVEN', message);
    this.name = 'RedGreenUnprovenError';
  }
}

export class SpecRefusedError extends LoopHarnessError {
  refusals: string[];
  constructor(refusals: string[]) {
    super('SPEC_REFUSED', `Loop spec refused:\n  - ${refusals.join('\n  - ')}`);
    this.name = 'SpecRefusedError';
    this.refusals = refusals;
  }
}
