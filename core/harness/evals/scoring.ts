/**
 * Pure case scorers for the eval runner (B1). Command execution is injected
 * so scoring stays deterministic and unit-testable without spawning shells.
 */

import type { EvalCase } from './types.ts';

export interface ExecProbe {
  (command: string): { exitCode: number; stdout: string; stderr: string };
}

export interface ScoreOutcome {
  passed: boolean;
  skipped?: boolean;
  detail: string;
}

export function scoreCase(evalCase: EvalCase, exec: ExecProbe): ScoreOutcome {
  switch (evalCase.kind) {
    case 'exact':
      if (evalCase.input === evalCase.expected) {
        return { passed: true, detail: 'exact match' };
      }
      return { passed: false, detail: `expected ${JSON.stringify(evalCase.expected)}, got ${JSON.stringify(evalCase.input)}` };

    case 'contains':
      if (typeof evalCase.input === 'string' && typeof evalCase.expected === 'string' && evalCase.input.includes(evalCase.expected)) {
        return { passed: true, detail: `contains ${JSON.stringify(evalCase.expected)}` };
      }
      return { passed: false, detail: `input does not contain ${JSON.stringify(evalCase.expected)}` };

    case 'regex': {
      if (typeof evalCase.input !== 'string' || typeof evalCase.expected !== 'string') {
        return { passed: false, detail: 'regex cases require input and expected' };
      }
      try {
        const re = new RegExp(evalCase.expected);
        if (re.test(evalCase.input)) return { passed: true, detail: `matches /${evalCase.expected}/` };
        return { passed: false, detail: `no match for /${evalCase.expected}/` };
      } catch (error) {
        return { passed: false, detail: `invalid regex: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case 'command': {
      if (!evalCase.command) return { passed: false, detail: 'command case has no command' };
      const expectedExit = evalCase.exit_code ?? 0;
      try {
        const res = exec(evalCase.command);
        if (res.exitCode === expectedExit) {
          return { passed: true, detail: `exit ${res.exitCode} as expected` };
        }
        return {
          passed: false,
          detail: `exit ${res.exitCode}, expected ${expectedExit}: ${(res.stderr || res.stdout).trim().slice(0, 300)}`,
        };
      } catch (error) {
        return { passed: false, detail: `command failed to run: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    case 'trajectory':
    case 'rubric':
      // Scored by the trajectory scorer (B3) / rubric checker (B2) — wired by runner.
      return { passed: false, skipped: true, detail: `${evalCase.kind} cases are scored by a specialized scorer` };

    default:
      return { passed: false, skipped: true, detail: `unknown case kind: ${String((evalCase as EvalCase).kind)}` };
  }
}
