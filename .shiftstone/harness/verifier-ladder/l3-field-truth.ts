/**
 * L3 — Field Truth (delayed): integration test, staging deploy, real event.
 * Objective zone — the check runs against the outside world, not the repo.
 *
 * The command is expected to perform (or poll for) the field check itself and
 * report through its exit code; this level only owns the zone classification
 * so /verify and the two-gear boundary can reason about it.
 */

import type { CommandRunner, VerifyResult } from '../loop-runner/types.ts';

export interface FieldTruthLevelConfig {
  command?: string;
  expected_exit?: number;
}

export async function runFieldTruth(
  config: FieldTruthLevelConfig,
  runner: CommandRunner,
): Promise<VerifyResult> {
  if (!config.command) {
    return {
      passed: false,
      evidence: { skipped: true, reason: 'no field-truth command declared' },
      zone: 'objective',
    };
  }
  const expected = config.expected_exit ?? 0;
  const { stdout, stderr, exitCode } = await runner(config.command);
  return {
    passed: exitCode === expected,
    evidence: {
      command: config.command,
      field_truth: true,
      expected_exit: expected,
      exitCode,
      stdout,
      stderr,
    },
    zone: 'objective',
  };
}
