/**
 * LoopRunner — the orchestrator (blueprint §7.2 + amendments A1–A4, A8, A12).
 *
 * Loop order per iteration:
 *   budget check → pre-check no-op → baseline snapshot (A2) → one turn
 *   (one-mutation-per-turn, A3) → verify (red-green proof, A1) → stagnation
 *   → terminal resolution (enumeration gate, A4; human gates, A8) →
 *   persist + context hygiene (A12) → next iteration or terminal exit.
 *
 * Hard rules:
 *   - L4+ requires maker_checker (MandatoryCheckerError, §7.2)
 *   - success exits only with verified proof: streak met, red-green proven,
 *     enumeration satisfied (StateMachine invariant, §7.7)
 *   - regression against the baseline rolls the turn back (A2)
 *   - scratch never reaches disk and never leaks across turns (A12)
 */

import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { BudgetGuard } from '../brakes/budget.ts';
import { StagnationDetector } from '../brakes/stagnation.ts';
import { StateMachine, type ExitProof } from '../terminal-state-machine/state.ts';
import {
  assertProven,
  markBaseline,
  markCurrent,
  newRedGreenProof,
} from '../verifier-ladder/red-green.ts';
import { Verifier } from '../verifier-ladder/verifier.ts';
import { CostTracker } from '../../observability/cost-tracker.ts';
import { sealStage } from '../../governance/stage-seal.ts';
import {
  discoverStages,
  loadStageState,
  planIncremental,
  recordStageState,
  resolveStageDefinition,
  type StageDefinition,
} from '../stage-deps.ts';
import {
  LoopHarnessError,
  MandatoryCheckerError,
  OneMutationViolation,
  type BaselineManager,
  type CommandRunner,
  type HumanApprovalPort,
  type JudgeClient,
  type LoopSpecification,
  type LoopState,
  type TerminalOutcome,
  type TurnContext,
  type TurnExecutor,
  type TurnOutcome,
} from './types.ts';
import { createBaselineManager } from './execution/baseline.ts';
import { matchesGate } from './execution/gates.ts';
import { createDefaultHooks, type HookManager } from '../hooks/index.ts';

export interface LoopRunnerDeps {
  executor: TurnExecutor;
  commandRunner: CommandRunner;
  judge?: JudgeClient;
  humanPort?: HumanApprovalPort;
  costTracker?: CostTracker;
  baseline?: BaselineManager;
  /** B6 — defaults to createDefaultHooks() (secret scanner, inner gear included). */
  hooks?: HookManager;
  now?: () => number;
  workspaceRoot?: string;
  loopsDir?: string;
}

function createLoopState(spec: LoopSpecification): LoopState {
  return {
    loop: spec.name,
    run_id: randomUUID(),
    attempt: 0,
    success_streak: 0,
    tokens_used: 0,
    dollars_used: 0,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    yardstick: 0,
    last_yardstick_delta: 0,
    barren_turns: 0,
    addressed: [],
    waived: [],
    accepted_changes: 0,
    red_green: newRedGreenProof(spec.verification.red_green),
    notes: [],
    scratch: {},
  };
}

function pushUnique(target: string[], items: readonly string[] | undefined): void {
  for (const item of items ?? []) {
    if (!target.includes(item)) target.push(item);
  }
}

export class LoopRunner {
  spec: LoopSpecification;
  deps: LoopRunnerDeps;

  constructor(spec: LoopSpecification, deps: LoopRunnerDeps) {
    this.spec = spec;
    this.deps = deps;
  }

  async run(): Promise<TerminalOutcome> {
    const spec = this.spec;

    // HARD-ENFORCED CHECK: maker-checker for L4+ (§7.2)
    if (spec.verification.ladder_level >= 4 && !spec.verification.maker_checker) {
      throw new MandatoryCheckerError(
        `Loop ${spec.name} declares L${spec.verification.ladder_level} verification ` +
          `but maker_checker=false. L4+ requires a disjoint checker subagent.`,
      );
    }

    // HARD-ENFORCED CHECK: A7 — an unattended trigger never starts without
    // declared network isolation + scoped credentials (validator refuses at
    // load; the runner refuses again at start as defense in depth).
    if (spec.trigger.type !== 'manual') {
      const isolation = spec.execution.isolation;
      if (
        (isolation.network !== 'none' && isolation.network !== 'allowlist') ||
        (isolation.credentials !== 'scoped' && isolation.credentials !== 'none')
      ) {
        throw new LoopHarnessError(
          'SANDBOX_REQUIRED',
          `Loop ${spec.name} refuses to start: unattended trigger (${spec.trigger.type}) requires ` +
            'execution.isolation.network: none|allowlist and execution.isolation.credentials: scoped|none (A7)',
        );
      }
    }

    const root = this.deps.workspaceRoot ?? process.cwd();
    const loopsDir = this.deps.loopsDir ?? path.join(root, '.loops');
    const now = this.deps.now ?? Date.now;

    const sm = new StateMachine(spec.terminal_states);
    sm.transition('triggered');

    const state = createLoopState(spec);
    const budget = new BudgetGuard(spec.brakes.budget, { now });
    const stagnation = new StagnationDetector(spec.brakes.stagnation);
    const verifier = new Verifier(
      {
        ladder_level: spec.verification.ladder_level,
        command: spec.verification.command,
        expected_exit: spec.verification.expected_exit,
        rubric: spec.verification.rubric,
        critics: spec.verification.critics,
        success_streak: spec.verification.success_streak,
        hold_out: spec.verification.hold_out,
        maker_checker: spec.verification.maker_checker,
        judge_score_threshold: spec.verification.judge_score_threshold,
        eval_suite: spec.verification.eval_suite,
        evaluate: spec.verification.evaluate,
      },
      {
        commandRunner: this.deps.commandRunner,
        judge: this.deps.judge,
        humanPort: this.deps.humanPort,
        loopName: spec.name,
      },
    );
    const cost =
      this.deps.costTracker ?? new CostTracker(spec.name, { root, loopsDir });
    const baseline =
      this.deps.baseline ??
      createBaselineManager(spec.execution.baseline, {
        workspaceRoot: root,
        storeDir: path.join(loopsDir, spec.name, 'baselines'),
      });
    // B6 — lifecycle hooks fire on every gear; the default wiring carries the
    // non-bypassable secret scanner.
    const hooks = this.deps.hooks ?? createDefaultHooks();

    const stateFile = path.join(loopsDir, spec.name, 'state.json');
    // C9 — incremental (Make-style) gate state: resolved inside the try block.
    let incStages: StageDefinition[] = [];
    let incStatePath: string | null = null;
    const persist = async (): Promise<void> => {
      // A12: scratch never reaches disk; it is discarded at persistence time.
      state.scratch = {};
      state.updated_at = new Date().toISOString();
      await mkdir(path.dirname(stateFile), { recursive: true });
      await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8');
    };

    const unaddressed = (): string[] => {
      const done = new Set([...state.addressed, ...state.waived]);
      return (state.enumerated ?? []).filter((item) => !done.has(item));
    };

    const finish = async (
      terminalState: TerminalOutcome['state'],
      reason: string,
      proof: ExitProof,
    ): Promise<TerminalOutcome> => {
      // C9 — a clean exit records the stage fingerprints that power the next
      // run's incremental skip; non-clean terminals never refresh them.
      if (
        (terminalState === 'success' || terminalState === 'no_op') &&
        incStatePath !== null &&
        incStages.length > 0
      ) {
        try {
          await recordStageState(incStages, incStatePath);
        } catch (error) {
          state.notes.push(
            `stage fingerprint record failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      state.terminal = terminalState;
      state.notes.push(`${terminalState}: ${reason}`);
      await persist();
      await cost.record({ terminal_state: terminalState, reason, state });
      sm.exit(terminalState, proof);
      return { state: terminalState, reason, state_snapshot: JSON.parse(JSON.stringify(state)) };
    };

    // C8 — seal the declared stage contract on success. The seal is refused
    // (and noted) when outputs lack OKF frontmatter; it is never faked.
    const maybeSealStage = async (): Promise<void> => {
      const stageContract = spec.execution.stage_contract;
      if (!stageContract) return;
      try {
        const report = await sealStage(path.resolve(root, stageContract));
        if (report.sealed) {
          state.notes.push(`stage sealed: ${stageContract}`);
        } else {
          state.notes.push(
            `stage NOT sealed: ${report.problems.map((p) => `${p.file}: ${p.problem}`).join('; ')}`,
          );
        }
      } catch (error) {
        state.notes.push(`stage seal failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const approvedThisTurn = new Set<string>();
    const gate = async (action: string): Promise<boolean> => {
      if (!matchesGate(action, spec.brakes.human_gates)) return true;
      if (spec.oversight === 'in') {
        if (!this.deps.humanPort) {
          state.notes.push(
            `gate '${action}' requires approval (oversight:in) but no approval port is configured — escalated`,
          );
          return false;
        }
        const ok = await this.deps.humanPort.approve({
          message: `Loop ${spec.name}: approve gated action "${action}"?`,
        });
        if (ok) {
          approvedThisTurn.add(action);
        } else {
          state.notes.push(`gate denied: ${action}`);
        }
        return ok;
      }
      approvedThisTurn.add(action);
      state.notes.push(`oversight:${spec.oversight} — gated action allowed with monitoring: ${action}`);
      return true;
    };

    // Phase enters 'precheck' once before the loop; the loop top is re-entered
    // from 'verify' at the end of each iteration (verify → precheck is the
    // diagram's loop-back edge).
    sm.transition('precheck');

    try {
      // C9 — resolve the incremental stage set: CONTEXT.md folders under
      // incremental.root merged with inline incremental.stages.
      const incCfg = spec.execution.incremental;
      if (incCfg) {
        const defs: StageDefinition[] = [];
        if (incCfg.root) defs.push(...(await discoverStages(path.resolve(root, incCfg.root))));
        for (const raw of incCfg.stages ?? []) defs.push(resolveStageDefinition(root, raw));
        incStages = defs;
        incStatePath = incCfg.state
          ? path.resolve(root, incCfg.state)
          : path.join(loopsDir, spec.name, 'stage-deps.json');
      }

      // A4 — exhaustive enumeration: record the whole target surface up front.
      if (spec.execution.enumerate) {
        const res = await this.deps.commandRunner(spec.execution.enumerate);
        state.enumerated = res.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean);
        state.notes.push(`enumerated ${state.enumerated.length} item(s)`);
      }

      while (true) {
        // Step 1: budget check (all ceilings, §7.8)
        const exhausted = budget.exhausted({
          attempts: state.attempt,
          tokens: state.tokens_used,
          dollars: state.dollars_used,
        });
        if (exhausted) {
          return await finish('exhausted', exhausted.reason, { verified: false });
        }

        // Step 1b: C9 — Make-style incremental gate. Every declared stage
        // fresh (fingerprints recorded by the last clean exit, inputs and
        // upstream outputs unchanged) ⇒ no work to do, exit no-op without
        // even running the pre-check command.
        if (incStatePath !== null && incStages.length > 0) {
          const prev = await loadStageState(incStatePath);
          const decisions = await planIncremental({ root, stages: incStages, prev });
          if (decisions.length > 0 && decisions.every((d) => d.action === 'skip')) {
            return await finish(
              'no_op',
              `incremental: all ${decisions.length} stage(s) unchanged since last clean run (C9)`,
              { verified: false, reason: 'incremental skip' },
            );
          }
        }

        // Step 2: pre-execution checks.
        //   (a) streak > 0 ⇒ this iteration CONFIRMS the previous pass by
        //       re-running the declared ladder level (Family A success streak).
        //   (b) streak = 0 ⇒ no-op check: effective satisfaction = check passes
        //       AND the enumerated surface is fully addressed/waived (A4).
        if (state.success_streak > 0) {
          const confirm = await verifier.verify(
            { mutations: [], yardstick_delta: 0, output_hash: state.output_hash ?? '' },
            {
              disjointContext: spec.verification.maker_checker,
              rubric: spec.verification.rubric,
            },
          );
          const confirmSatisfied = confirm.passed && unaddressed().length === 0;
          markCurrent(state.red_green, confirmSatisfied);
          if (confirm.blocked) {
            return await finish('blocked', confirm.reason ?? spec.terminal_states.blocked, {
              verified: false,
            });
          }
          if (confirmSatisfied) {
            state.success_streak += 1;
            if (state.success_streak >= spec.verification.success_streak) {
              assertProven(state.red_green, spec.name);
              await maybeSealStage();
              return await finish(
                'success',
                `verification passed ${state.success_streak}/${spec.verification.success_streak} consecutive time(s)`,
                { verified: true, reason: 'streak confirmed' },
              );
            }
            await persist();
            continue;
          }
          // confirmation failed — fall through to a new turn
          state.success_streak = 0;
          markBaseline(state.red_green, false);
        } else {
          const pre = await verifier.preCheck();
          const preSatisfied = pre.passed && unaddressed().length === 0;
          markBaseline(state.red_green, preSatisfied); // A1: red reading when unsatisfied
          if (preSatisfied) {
            return await finish('no_op', spec.terminal_states.no_op, {
              verified: false,
              reason: 'pre-check satisfied before any turn',
            });
          }
          if (pre.passed && unaddressed().length > 0) {
            state.notes.push(
              `check passes but ${unaddressed().length} enumerated item(s) unaddressed — continuing (A4)`,
            );
          }
        }

        sm.transition('execute');

        // Step 3: baseline snapshot before mutation (A2)
        const baselineRef = await baseline.capture();
        approvedThisTurn.clear();

        const queue = (state.enumerated ?? []).filter(
          (item) => !state.addressed.includes(item) && !state.waived.includes(item),
        );
        const context: TurnContext = {
          spec,
          state,
          turn: state.attempt + 1,
          scratch: state.scratch,
          worst_first_queue: queue, // A3: worst-first ordering surface
          gate, // A8: approval before irreversible actions
        };

        // B6 — pre-tool-call hook point: refuse the turn before any tool runs.
        const preTool = await hooks.fire('pre-tool-call', {
          loop: spec.name,
          turn: context.turn,
          tool: 'turn-executor',
          command: spec.execution.turn_command,
        });
        if (preTool.warnings.length) state.notes.push(...preTool.warnings);
        if (!preTool.allowed) {
          const reason = `hook "${preTool.blocked_by}" refused the turn: ${preTool.reason ?? 'blocked'}`;
          state.notes.push(reason);
          return await finish('blocked', reason, { verified: false });
        }

        // Step 4: execute ONE turn (one variable change, A3)
        let outcome: TurnOutcome;
        try {
          outcome = await this.deps.executor.execute(context);
        } catch (err) {
          outcome = {
            mutations: [],
            yardstick_delta: 0,
            output_hash: '',
            error: err instanceof Error ? err.message : String(err),
          };
        }

        if (outcome.mutations.length > 1) {
          // A3 hard invariant: a turn declares exactly one mutation.
          await baseline.restore(baselineRef);
          const violation = new OneMutationViolation(
            `Loop ${spec.name}: turn declared ${outcome.mutations.length} mutations ` +
              `(${outcome.mutations.join(', ')}). One mutation per turn — rolled back to baseline.`,
          );
          state.notes.push(violation.message);
          return await finish('error', violation.message, { verified: false });
        }

        // B6 — post-file-edit hook point: inspect what the turn changed.
        const postEdit = await hooks.fire('post-file-edit', {
          loop: spec.name,
          turn: state.attempt + 1,
          mutations: outcome.mutations,
        });
        if (postEdit.warnings.length) state.notes.push(...postEdit.warnings);
        if (!postEdit.allowed) {
          const reason = `hook "${postEdit.blocked_by}" refused the edited files: ${postEdit.reason ?? 'blocked'}`;
          state.notes.push(reason);
          if (spec.execution.baseline !== 'none') await baseline.restore(baselineRef);
          return await finish('blocked', reason, { verified: false });
        }

        // A8: gated actions performed without approval while oversight:in
        if (spec.oversight === 'in') {
          const unapproved = (outcome.gated_actions ?? []).filter(
            (action) => matchesGate(action, spec.brakes.human_gates) && !approvedThisTurn.has(action),
          );
          if (unapproved.length > 0) {
            return await finish(
              'blocked',
              `gated action(s) not approved under oversight:in — ${unapproved.join(', ')}`,
              { verified: false },
            );
          }
        }

        sm.transition('verify');

        // Step 5: verify (L1–L5; L4+ with disjoint maker-checker)
        const verify = await verifier.verify(outcome, {
          disjointContext: spec.verification.maker_checker,
          rubric: spec.verification.rubric,
        });

        const prevHash = state.output_hash;
        state.attempt += 1;
        state.last_yardstick_delta = outcome.yardstick_delta;
        state.yardstick += outcome.yardstick_delta;
        state.tokens_used += outcome.tokens_used ?? 0;
        state.dollars_used += outcome.dollars_used ?? 0;
        if (outcome.output_hash) state.output_hash = outcome.output_hash;
        pushUnique(state.addressed, outcome.addressed);
        pushUnique(state.waived, outcome.waived);
        if (outcome.blocked_reason) state.notes.push(`blocked: ${outcome.blocked_reason}`);

        // B3 — per-turn trajectory summary stays in state.json; the full
        // tool-call trace rotates to .loops/<id>/runs/ (bounded growth).
        if (spec.verification.evaluate !== 'output') {
          const trajEvidence = (
            verify.evidence as
              | { trajectory?: { passed?: boolean; executed_checks?: string[] } }
              | undefined
          )?.trajectory;
          state.trajectory = [
            ...(state.trajectory ?? []),
            {
              turn: state.attempt,
              claimed_checks: outcome.claimed_checks ?? [],
              executed_checks:
                trajEvidence?.executed_checks ??
                (outcome.trajectory ?? []).map((t) => t.command ?? t.tool),
              passed: trajEvidence?.passed ?? false,
            },
          ];
          if (outcome.trajectory?.length) {
            const runsDir = path.join(loopsDir, spec.name, 'runs');
            await mkdir(runsDir, { recursive: true });
            await appendFile(
              path.join(runsDir, `trajectory-${state.run_id}.jsonl`),
              `${JSON.stringify({
                timestamp: new Date().toISOString(),
                run_id: state.run_id,
                turn: state.attempt,
                trace: outcome.trajectory,
              })}\n`,
              'utf8',
            );
          }
        }

        const remaining = unaddressed();
        const effectivePass = verify.passed && remaining.length === 0;
        markCurrent(state.red_green, effectivePass); // A1: green reading

        const progress =
          effectivePass ||
          outcome.yardstick_delta > 0 ||
          (outcome.addressed?.length ?? 0) > 0 ||
          (outcome.waived?.length ?? 0) > 0;
        const barren = stagnation.recordTurn({
          progress,
          output_hash_unchanged:
            !!prevHash && !!outcome.output_hash && prevHash === outcome.output_hash,
          yardstick_delta: outcome.yardstick_delta,
        });
        state.barren_turns = barren;

        // Step 6: terminal-state resolution

        // (a) blocked — external dependency or human decision
        if (outcome.blocked || verify.blocked) {
          return await finish(
            'blocked',
            outcome.blocked_reason ?? verify.reason ?? spec.terminal_states.blocked,
            { verified: false },
          );
        }

        // (b) regression against baseline → auto-rollback, keep looping (A2)
        if (outcome.yardstick_delta < 0) {
          state.success_streak = 0;
          if (spec.execution.baseline !== 'none') {
            await baseline.restore(baselineRef);
            state.notes.push(
              `regression (yardstick delta ${outcome.yardstick_delta}) — rolled back to baseline ${baselineRef}`,
            );
          } else {
            state.notes.push(`regression (yardstick delta ${outcome.yardstick_delta}) — no baseline to roll back`);
          }
        } else if (effectivePass) {
          state.success_streak += 1;
          state.accepted_changes += 1;
          if (state.success_streak >= spec.verification.success_streak) {
            assertProven(state.red_green, spec.name); // A1: refuses tautological passes
            if (remaining.length === 0) {
              await maybeSealStage();
              return await finish(
                'success',
                `verification passed ${state.success_streak}/${spec.verification.success_streak} consecutive time(s); ` +
                  `enumeration satisfied (${state.addressed.length} addressed, ${state.waived.length} waived)`,
                { verified: true, reason: 'streak met; red-green proven; enumeration complete' },
              );
            }
          }
        } else {
          state.success_streak = 0;
          if (verify.passed && remaining.length > 0) {
            state.notes.push(`success withheld: ${remaining.length} enumerated item(s) remain (A4)`);
          }
        }

        // (c) stagnation detector
        if (stagnation.isStalled()) {
          return await finish(
            'stalled',
            `${barren} consecutive barren turn(s) (detector: ${spec.brakes.stagnation.detector}); ` +
              spec.terminal_states.stalled,
            { verified: false },
          );
        }

        // (d) budget ceilings reached mid-run (tokens/dollars/wall-clock)
        const midExhausted = budget.exhausted({
          attempts: state.attempt,
          tokens: state.tokens_used,
          dollars: state.dollars_used,
        });
        if (midExhausted) {
          return await finish('exhausted', midExhausted.reason, { verified: false });
        }

        // Step 7: persist + context hygiene (A12); Ralph re-inits from disk only
        await persist();
        state.scratch = {};
        if (spec.actuation === 'ralph_skeleton') {
          const onDisk = JSON.parse(await readFile(stateFile, 'utf8')) as LoopState;
          onDisk.scratch = {};
          Object.assign(state, onDisk, { scratch: {} });
        }

        // verify → precheck: the loop-back edge of §7.7
        sm.transition('precheck');
      }
    } catch (err) {
      // Invariant/harness errors terminate as 'error' — never as success (§7.7).
      const message = err instanceof Error ? err.message : String(err);
      state.notes.push(`harness error: ${message}`);
      return await finish('error', message, { verified: false });
    }
  }
}
