/**
 * Trajectory scorer (amendment B3) — did the agent actually run the checks it
 * claimed? A fluent output that skipped verification is more dangerous than
 * one with a visible error, so a claimed-but-unexecuted check fails the turn.
 *
 * Matching is token-subset based: claim "pnpm test" is satisfied by an
 * executed "pnpm -C core test" (every claim token appears in the command).
 * A tool call with ok:false still counts as executed — it ran and pushed back;
 * whether it passed is the output side of verification.
 */

import type { ToolCallRecord } from '../../loop-runner/types.ts';

export interface TrajectoryInput {
  trace?: ToolCallRecord[];
  claimed_checks?: string[];
}

export interface TrajectoryScore {
  passed: boolean;
  detail: string;
  /** Claims with no corresponding executed tool call. */
  missing_claims: string[];
  executed_checks: string[];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function commandOf(call: ToolCallRecord): string {
  if (call.command) return call.command;
  if (call.args?.length) return call.args.join(' ');
  return call.tool;
}

function claimSatisfiedBy(claim: string, executedCommand: string): boolean {
  const claimTokens = normalize(claim).split(' ').filter(Boolean);
  const executedTokens = new Set(normalize(executedCommand).split(' ').filter(Boolean));
  if (claimTokens.length === 0) return false;
  return claimTokens.every((token) => executedTokens.has(token));
}

export function scoreTrajectory(input: TrajectoryInput): TrajectoryScore {
  const trace = input.trace ?? [];
  const claims = (input.claimed_checks ?? []).map((c) => c.trim()).filter(Boolean);
  const executedChecks = trace.map(commandOf);

  if (trace.length === 0 && claims.length === 0) {
    return {
      passed: false,
      detail:
        'trajectory evaluation: nothing recorded — no tool calls and no claims, so verification is unproven',
      missing_claims: [],
      executed_checks: [],
    };
  }

  const missing = claims.filter(
    (claim) => !executedChecks.some((command) => claimSatisfiedBy(claim, command)),
  );

  if (missing.length > 0) {
    return {
      passed: false,
      detail:
        `trajectory evaluation: claimed check(s) never executed: ${missing.join('; ')} ` +
        `(recorded tool calls: ${trace.length})`,
      missing_claims: missing,
      executed_checks: executedChecks,
    };
  }

  return {
    passed: true,
    detail:
      claims.length > 0
        ? `all ${claims.length} claimed check(s) appear in the recorded trajectory`
        : `trajectory recorded ${trace.length} tool call(s) with no unproven claims`,
    missing_claims: [],
    executed_checks: executedChecks,
  };
}
