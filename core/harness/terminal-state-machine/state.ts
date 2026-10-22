/**
 * The five named terminal states — state machine (blueprint §7.7).
 *
 * Hard invariants:
 *   error ≠ success   — success may only be exited with verified proof;
 *                       terminal states are absorbing, so no path can leave
 *                       'error' (or any other terminal) and reach success.
 *   exhausted ≠ success — same absorbing rule from 'exhausted'.
 *
 * Syntax note: erasable TypeScript only (Node native type stripping).
 */

import type { AnyTerminalState, TerminalState } from '../loop-runner/types.ts';

export const PHASES = ['idle', 'triggered', 'precheck', 'execute', 'verify'] as const;
export type Phase = (typeof PHASES)[number];

export const NON_SUCCESS_TERMINALS = ['error'] as const;
export const ALL_TERMINALS = [
  'success',
  'no_op',
  'blocked',
  'stalled',
  'exhausted',
  'error',
] as const;

export type MachineState = Phase | AnyTerminalState;

export interface TerminalStateDescriptions {
  success: string;
  no_op: string;
  blocked: string;
  stalled: string;
  exhausted: string;
}

export interface ExitProof {
  /** Caller asserts: streak met + red-green proven (if required) + enumeration satisfied. */
  verified: boolean;
  reason?: string;
}

export interface TerminalExit {
  state: AnyTerminalState;
  description: string;
  reason: string;
  at: string;
}

export interface TransitionRecord {
  from: MachineState;
  to: MachineState;
  at: string;
}

export class IllegalTransitionError extends Error {
  from: MachineState;
  to: MachineState;
  constructor(from: MachineState, to: MachineState) {
    super(`Illegal state transition: ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
    this.from = from;
    this.to = to;
  }
}

export class InvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolation';
  }
}

/** §7.7 diagram. 'error' is the exception path — never a positive exit. */
const ALLOWED: Record<MachineState, readonly MachineState[]> = {
  idle: ['triggered'],
  triggered: ['precheck', 'error'],
  // budget check happens at loop top (before the pre-check) ⇒ exhausted here;
  // 'success' covers a pass at pre-check that confirms the success streak
  precheck: ['execute', 'no_op', 'success', 'exhausted', 'blocked', 'error'],
  execute: ['verify', 'blocked', 'exhausted', 'error'],
  verify: [
    'success', // L1–L5 pass + streak met
    'execute', // fail but progress made, budget remains
    'precheck', // pass but streak not yet confirmed — re-verify at loop top
    'stalled', // stagnation detector fired
    'blocked', // external dependency / human decision required
    'exhausted', // budget ceiling hit
    'error',
  ],
  success: [],
  no_op: [],
  blocked: [],
  stalled: [],
  exhausted: [],
  error: [],
};

const TERMINAL_SET: ReadonlySet<MachineState> = new Set<MachineState>(ALL_TERMINALS);

export function isTerminal(state: MachineState): boolean {
  return TERMINAL_SET.has(state);
}

export function isPositiveTerminal(state: MachineState): boolean {
  return state === 'success';
}

export class StateMachine {
  current: MachineState;
  history: TransitionRecord[];
  descriptions: TerminalStateDescriptions;

  constructor(descriptions?: Partial<TerminalStateDescriptions>) {
    this.current = 'idle';
    this.history = [];
    this.descriptions = {
      success: descriptions?.success ?? 'verified success (streak confirmed)',
      no_op: descriptions?.no_op ?? 'goal already satisfied before any turn',
      blocked: descriptions?.blocked ?? 'human/external decision required',
      stalled: descriptions?.stalled ?? 'stagnation detector fired',
      exhausted: descriptions?.exhausted ?? 'budget ceiling reached',
    };
  }

  canTransition(to: MachineState): boolean {
    return ALLOWED[this.current].includes(to);
  }

  transition(to: MachineState): MachineState {
    if (!this.canTransition(to)) {
      throw new IllegalTransitionError(this.current, to);
    }
    this.history.push({ from: this.current, to, at: new Date().toISOString() });
    this.current = to;
    return this.current;
  }

  /**
   * Terminal exit. 'success' requires verified proof — the harness may never
   * exit success from an unverified turn, and terminal states are absorbing so
   * error/exhausted can never become success (§7.7 hard invariant).
   */
  exit(state: AnyTerminalState, proof?: ExitProof): TerminalExit {
    if (state === 'success') {
      if (!proof?.verified) {
        throw new InvariantViolation(
          'error ≠ success / exhausted ≠ success: exit("success") requires verified proof ' +
            '(streak met, red-green proven, enumeration satisfied).',
        );
      }
    }
    this.transition(state);
    return {
      state,
      description:
        state === 'error'
          ? 'harness error (never counted as success)'
          : this.descriptions[state as TerminalState],
      reason: proof?.reason ?? state,
      at: new Date().toISOString(),
    };
  }

  isTerminal(): boolean {
    return isTerminal(this.current);
  }
}
