/**
 * Loop Runner State Machine & Terminal State Governance (UG-24 / Phase 6 Unit U25)
 *
 * Enforces:
 *   1. Re-exports core StateMachine and terminal state invariants from terminal-state-machine/state.ts.
 *   2. Strict distinction between terminal states:
 *      - "blocked": Mechanical halt when an unapproved Level 5 protected action is attempted,
 *                   a stage contract input is superseded, or an external hard dependency is missing.
 *      - "escalated": Human direction request when an agent encounters an ambiguous requirement
 *                     or architectural trade-off requiring human judgment (non-mechanical).
 *   3. Helper function transitionToBlocked() to deterministically transition to "blocked"
 *      when PROTECTED_ACTION_BLOCKED is encountered.
 */

import {
  StateMachine,
  type ExitProof,
  type TerminalExit,
  type MachineState,
} from '../terminal-state-machine/state.ts';
import type { AnyTerminalState, TerminalState } from './types.ts';

export * from '../terminal-state-machine/state.ts';

export interface ProtectedActionBlockedDetails {
  actionClass: string;
  target?: string;
  trigger?: string;
  reason: string;
}

/**
 * Validates whether a state is strictly "blocked" (terminal mechanical refusal).
 */
export function isBlocked(state: MachineState): boolean {
  return state === 'blocked';
}

/**
 * Validates whether an event represents an escalation for architectural judgment
 * (distinct from mechanical "blocked").
 */
export function isEscalated(outcome: { status?: string; state?: string }): boolean {
  return outcome.status === 'ESCALATED' || outcome.state === 'escalated';
}

/**
 * Transitions the loop runner state machine immediately to terminal state "blocked".
 * Enforces the Level 5 human governance gate requirement (UG-24).
 */
export function transitionToBlocked(
  sm: StateMachine,
  details: ProtectedActionBlockedDetails | string,
): TerminalExit {
  const reason = typeof details === 'string' ? details : details.reason;

  if (sm.current === 'blocked') {
    return {
      state: 'blocked',
      description: sm.descriptions.blocked,
      reason,
      at: new Date().toISOString(),
    };
  }

  return sm.exit('blocked', {
    verified: false,
    reason,
  });
}
