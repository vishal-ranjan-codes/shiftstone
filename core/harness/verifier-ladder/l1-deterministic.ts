/**
 * L1 — Deterministic: exit code, assertion, golden diff. Autonomous zone.
 */

import type { CommandRunner, ExecResult, VerifyResult } from '../loop-runner/types.ts';

export interface CommandLevelConfig {
  command?: string;
  expected_exit?: number;
}

export async function runDeterministic(
  config: CommandLevelConfig,
  runner: CommandRunner,
): Promise<VerifyResult> {
  if (!config.command) {
    return {
      passed: false,
      evidence: { skipped: true, reason: 'no verification command declared' },
      zone: 'autonomous',
    };
  }
  const result: ExecResult = await runner(config.command);
  const expected = config.expected_exit ?? 0;
  return {
    passed: result.exitCode === expected,
    evidence: {
      command: config.command,
      expected_exit: expected,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    },
    zone: 'autonomous',
  };
}
