/**
 * Loop CLI — `node .shiftstone/harness/cli.js <command> <loop-id>`.
 *
 * Commands:
 *   run <loop>      manual trigger (A9)
 *   schedule <loop> cron trigger (A9); stays alive and fires on trigger.cron
 *   watch <loop>    event trigger via file-watch (A9)
 *   trigger <loop>  fire once for an external event source (git-hook/webhook)
 *   validate <loop> anti-pattern + A-check refusal gate
 *   status <loop>   show trigger, oversight mode (A8), state, last run
 */

import readline from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { CostTracker } from '../../observability/cost-tracker.ts';
import { loadModelRouting, resolveModelTier } from '../../context/model-routing.ts';
import { createCommandRunner } from './exec.ts';
import { ShellTurnExecutor } from './execution/shell-executor.ts';
import { loadSpec, validateSpecFile } from './loader.ts';
import { LoopRunner } from './runner.ts';
import { actuateTrigger, Scheduler } from './triggers/index.ts';
import {
  SpecRefusedError,
  type HumanApprovalPort,
  type LoopSpecification,
  type LoopState,
} from './types.ts';
import { formatValidation } from './validator.ts';

const USAGE = `Usage: node .shiftstone/harness/cli.js <command> <loop-id> [options]

Commands:
  run <loop-id>              Run the loop once (manual trigger)
  schedule <loop-id>         Fire the loop on its trigger.cron schedule
  watch <loop-id>            Fire the loop when trigger.event_source changes
  trigger <loop-id>          Fire once (receiver for git-hooks / webhooks)
  validate <loop-id|path>    Refuse-gate a spec (exit 2 when refused)
  status <loop-id>           Show trigger, oversight mode, state and last run

Exit codes: 0 success|no_op · 1 blocked|stalled|exhausted|error · 2 spec refused`;

function cliHumanPort(): HumanApprovalPort {
  return {
    approve: async ({ message }) => {
      if (!process.stdin.isTTY) return false;
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        const answer = await rl.question(`${message} [y/N] `);
        return /^y(es)?$/i.test(answer.trim());
      } finally {
        rl.close();
      }
    },
  };
}

function buildRunner(spec: LoopSpecification, root: string): LoopRunner {
  const commandRunner = createCommandRunner({ cwd: root });
  return new LoopRunner(spec, {
    executor: new ShellTurnExecutor(spec, commandRunner),
    commandRunner,
    humanPort: cliHumanPort(),
    workspaceRoot: root,
    loopsDir: path.join(root, '.loops'),
  });
}

function printValidationWarnings(warnings: string[]): void {
  for (const w of warnings) console.error(`warning: ${w}`);
}

async function runOnce(id: string, root: string): Promise<number> {
  try {
    const { spec, validation, source } = await loadSpec(id, { root });
    printValidationWarnings(validation.warnings);
    console.error(`loaded ${spec.name} from ${path.relative(root, source)}`);
    const outcome = await buildRunner(spec, root).run();
    console.log(`TERMINAL: ${outcome.state}`);
    console.log(`reason: ${outcome.reason}`);
    return outcome.state === 'success' || outcome.state === 'no_op' ? 0 : 1;
  } catch (err) {
    if (err instanceof SpecRefusedError) {
      console.error(err.message);
      return 2;
    }
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function status(id: string, root: string): Promise<number> {
  try {
    const { spec, source } = await loadSpec(id, { root });
    console.log(`loop:        ${spec.name}`);
    console.log(`source:      ${path.relative(root, source)}`);
    console.log(`trigger:     ${spec.trigger.type}${spec.trigger.cron ? ` (cron: ${spec.trigger.cron})` : ''}${spec.trigger.event_source ? ` (event: ${spec.trigger.event_source})` : ''}`);
    console.log(`oversight:   ${spec.oversight}`);
    console.log(`ladder:      L${spec.verification.ladder_level} (maker_checker: ${spec.verification.maker_checker}, critics: ${spec.verification.critics}, red_green: ${spec.verification.red_green})`);
    try {
      const routing = loadModelRouting();
      const resolution = resolveModelTier(routing, {
        task_class: spec.model?.task_class,
        loop: spec.name,
      });
      console.log(
        `model:       ${resolution.tier} tier (task_class: ${resolution.task_class}, source: ${resolution.source})`,
      );
    } catch {
      console.log('model:       (model-routing.yaml unavailable)');
    }
    console.log(`budget:      ${spec.brakes.budget.max_iterations} iterations, stagnation: ${spec.brakes.stagnation.max_barren_turns} barren (${spec.brakes.stagnation.detector})`);
    console.log(`human_gates: ${spec.brakes.human_gates.length > 0 ? spec.brakes.human_gates.join(', ') : '(none)'}`);

    const stateFile = path.join(root, '.loops', spec.name, 'state.json');
    try {
      const state = JSON.parse(await readFile(stateFile, 'utf8')) as LoopState;
      console.log(`state:       terminal=${state.terminal ?? 'running'} attempts=${state.attempt} streak=${state.success_streak} accepted=${state.accepted_changes} red_green=${state.red_green.proven ? 'proven' : 'unproven'}`);
      const recent = state.notes.slice(-5);
      if (recent.length > 0) console.log('notes:');
      for (const note of recent) console.log(`  - ${note}`);
    } catch {
      console.log('state:       (no run yet)');
    }

    const runsFile = path.join(root, '.loops', spec.name, 'runs.jsonl');
    try {
      const lines = (await readFile(runsFile, 'utf8')).trim().split(/\r?\n/);
      const last = JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
      console.log(`last run:    ${String(last.terminal_state)} at ${String(last.timestamp)} (${String(last.attempts)} attempts)`);
    } catch {
      console.log('last run:    (none)');
    }
    return 0;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function schedule(id: string, root: string): Promise<number> {
  try {
    const { spec, validation } = await loadSpec(id, { root });
    printValidationWarnings(validation.warnings);
    const cron = spec.trigger.cron;
    if (!cron) {
      console.error(`loop ${spec.name} has no trigger.cron — nothing to schedule`);
      return 1;
    }
    const scheduler = new Scheduler(cron, async () => {
      console.error(`[scheduler] firing ${spec.name} at ${new Date().toISOString()}`);
      await runOnce(id, root);
    }, { onError: (err) => console.error('[scheduler]', err) });
    scheduler.start();
    console.log(`scheduled ${spec.name} (cron: ${cron})`);
    console.log(`next fire:  ${scheduler.nextFire?.toISOString()}`);
    console.log('press Ctrl+C to stop');
    process.on('SIGINT', () => {
      scheduler.stop();
      process.exit(0);
    });
    return await new Promise<number>(() => undefined); // run until interrupted
  } catch (err) {
    if (err instanceof SpecRefusedError) {
      console.error(err.message);
      return 2;
    }
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

async function watch(id: string, root: string): Promise<number> {
  try {
    const { spec, validation } = await loadSpec(id, { root });
    printValidationWarnings(validation.warnings);
    const source = spec.trigger.event_source;
    if (!source) {
      console.error(`loop ${spec.name} has no trigger.event_source — nothing to watch`);
      return 1;
    }
    const handle = actuateTrigger(
      spec,
      () => {
        console.error(`[event] firing ${spec.name} (${source} changed)`);
        void runOnce(id, root);
      },
      { root },
    );
    console.log(`watching ${source} for ${spec.name} — press Ctrl+C to stop`);
    process.on('SIGINT', () => {
      handle.stop();
      process.exit(0);
    });
    return await new Promise<number>(() => undefined);
  } catch (err) {
    if (err instanceof SpecRefusedError) {
      console.error(err.message);
      return 2;
    }
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

export async function main(argv: string[]): Promise<number> {
  const [command, target, ...rest] = argv;
  const root = process.cwd();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return command ? 0 : 1;
  }
  if (!target) {
    console.error(`error: missing <loop-id>\n\n${USAGE}`);
    return 1;
  }

  switch (command) {
    case 'run':
      return runOnce(target, root);
    case 'trigger': {
      const source = rest.includes('--event') ? rest[rest.indexOf('--event') + 1] : 'manual';
      console.error(`[trigger] ${target} fired by ${source}`);
      return runOnce(target, root);
    }
    case 'validate': {
      const res = await validateSpecFile(target, { root });
      console.log(formatValidation(res));
      console.log(`source: ${path.relative(root, res.source)}`);
      return res.ok ? 0 : 2;
    }
    case 'status':
      return status(target, root);
    case 'schedule':
      return schedule(target, root);
    case 'watch':
      return watch(target, root);
    default:
      console.error(`error: unknown command "${command}"\n\n${USAGE}`);
      return 1;
  }
}
