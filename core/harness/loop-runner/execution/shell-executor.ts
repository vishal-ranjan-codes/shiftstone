/**
 * Shell-actuated turn executor — runs spec.execution.turn_command as one
 * turn. Used by the CLI for command-driven loops; agent-actuated loops
 * (no turn_command) are run by an agent instead and blocked here with a
 * clear escalation reason.
 *
 * Turn command protocol:
 *   exit 0  → turn made progress (ADDRESSED:/WAIVED: lines report A4 items)
 *   exit 78  → the turn is blocked (EX_CONFIG: not configured → escalate)
 *   other   → turn failed (counts as a barren turn)
 */

import { createHash } from 'node:crypto';
import type {
  CommandRunner,
  LoopSpecification,
  TurnContext,
  TurnExecutor,
  TurnOutcome,
} from '../types.ts';
import { matchesGate } from './gates.ts';

export const BLOCKED_EXIT_CODE = 78;

const ADDRESSED_PREFIX = 'ADDRESSED:';
const WAIVED_PREFIX = 'WAIVED:';

export class ShellTurnExecutor implements TurnExecutor {
  spec: LoopSpecification;
  commandRunner: CommandRunner;

  constructor(spec: LoopSpecification, commandRunner: CommandRunner) {
    this.spec = spec;
    this.commandRunner = commandRunner;
  }

  async execute(context: TurnContext): Promise<TurnOutcome> {
    const cmd = this.spec.execution.turn_command;
    if (!cmd) {
      return {
        mutations: [],
        yardstick_delta: 0,
        output_hash: '',
        blocked: true,
        blocked_reason:
          `loop ${this.spec.name} is agent-actuated (no execution.turn_command) — ` +
          'run it from an agent (workflow/skill), not the shell executor',
      };
    }

    if (matchesGate(cmd, this.spec.brakes.human_gates)) {
      const approved = await context.gate(cmd);
      if (!approved) {
        return {
          mutations: [],
          yardstick_delta: 0,
          output_hash: '',
          blocked: true,
          blocked_reason: `human gate denied: ${cmd}`,
        };
      }
    }

    const res = await this.commandRunner(cmd);
    const outputHash = createHash('sha256').update(res.stdout).digest('hex').slice(0, 16);
    // B3 — the shell executor knows exactly which tool call it made; record it
    // so evaluate: trajectory|both has a truthful trajectory to score.
    const trajectory = [{ tool: 'shell', command: cmd, ok: res.exitCode === 0 }];
    const lines = res.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const addressed = lines
      .filter((line) => line.startsWith(ADDRESSED_PREFIX))
      .map((line) => line.slice(ADDRESSED_PREFIX.length).trim())
      .filter(Boolean);
    const waived = lines
      .filter((line) => line.startsWith(WAIVED_PREFIX))
      .map((line) => line.slice(WAIVED_PREFIX.length).trim())
      .filter(Boolean);

    if (res.exitCode === BLOCKED_EXIT_CODE) {
      return {
        mutations: [cmd],
        yardstick_delta: 0,
        output_hash: outputHash,
        trajectory,
        blocked: true,
        blocked_reason: (res.stderr || res.stdout || 'turn reported blocked (exit 78)').trim(),
        addressed,
        waived,
      };
    }
    if (res.exitCode !== 0) {
      return {
        mutations: [cmd],
        yardstick_delta: 0,
        output_hash: outputHash,
        trajectory,
        error: `turn command exited ${res.exitCode}: ${(res.stderr || res.stdout).trim()}`,
        addressed,
        waived,
      };
    }
    return {
      mutations: [cmd],
      yardstick_delta: addressed.length > 0 ? addressed.length : 1,
      output_hash: outputHash,
      trajectory,
      addressed,
      waived,
      artifact: { stdout: res.stdout },
    };
  }
}
