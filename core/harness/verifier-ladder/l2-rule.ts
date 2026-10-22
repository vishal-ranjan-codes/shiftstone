/**
 * L2 — Rule/Constraint: linter, schema, policy. Autonomous zone.
 *
 * Violations are stdout lines that declare themselves (ERROR / VIOLATION /
 * [error] prefix, case-insensitive), or — when the command exits non-zero —
 * every non-empty stdout line, which is how off-the-shelf linters report.
 */

import type { CommandRunner, VerifyResult } from '../loop-runner/types.ts';

export interface RuleLevelConfig {
  command?: string;
  expected_exit?: number;
}

const VIOLATION_PREFIX = /^\s*(?:error|violation|\[error\])\b/i;

export function parseViolations(stdout: string, exitCode: number, expected: number): string[] {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const declared = lines.filter((line) => VIOLATION_PREFIX.test(line));
  if (declared.length > 0) return declared;
  if (exitCode !== expected) return lines;
  return [];
}

export async function runRuleBased(
  config: RuleLevelConfig,
  runner: CommandRunner,
): Promise<VerifyResult> {
  if (!config.command) {
    return {
      passed: false,
      evidence: { skipped: true, reason: 'no rule command declared' },
      zone: 'autonomous',
    };
  }
  const expected = config.expected_exit ?? 0;
  const { stdout, stderr, exitCode } = await runner(config.command);
  const violations = parseViolations(stdout, exitCode, expected);
  return {
    passed: violations.length === 0 && exitCode === expected,
    evidence: { command: config.command, violations, exitCode, stderr },
    zone: 'autonomous',
  };
}
