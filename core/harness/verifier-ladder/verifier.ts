/**
 * The Verification Ladder — dispatcher (blueprint §7.3).
 *
 * verify() routes to the declared ladder level; preCheck() is the cheap
 * deterministic gate used at loop top for the no-op check and the A1
 * baseline (red) reading.
 */

import type {
  EvaluateMode,
  HumanApprovalPort,
  JudgeClient,
  CommandRunner,
  RubricSpec,
  TurnOutcome,
  VerifyOpts,
  VerifyResult,
} from '../loop-runner/types.ts';
import { formatRubricPrompt } from '../evals/checker/rubric-template.ts';
import { scoreTrajectory } from '../evals/trajectory/scorer.ts';
import { runDeterministic } from './l1-deterministic.ts';
import { runRuleBased } from './l2-rule.ts';
import { runFieldTruth } from './l3-field-truth.ts';
import { runLlmJudge } from './l4-llm-judge.ts';
import { runHumanCheckpoint } from './l5-human.ts';

export interface VerifierConfig {
  ladder_level: 1 | 2 | 3 | 4 | 5;
  command?: string;
  expected_exit?: number;
  rubric?: string | RubricSpec;
  critics: number;
  success_streak: number;
  hold_out?: string;
  maker_checker: boolean;
  judge_score_threshold: number;
  /** B1: named suite under evals/<name>/ run alongside every verification. */
  eval_suite?: string;
  /** B3: which evidence gates the turn (default 'output'). */
  evaluate?: EvaluateMode;
}

export interface VerifierDeps {
  commandRunner: CommandRunner;
  judge?: JudgeClient;
  humanPort?: HumanApprovalPort;
  loopName: string;
}

/** B3 — the trajectory gate: did the turn run the checks it claimed? */
function trajectoryResult(turnResult: TurnOutcome): VerifyResult {
  const score = scoreTrajectory({
    trace: turnResult.trajectory,
    claimed_checks: turnResult.claimed_checks,
  });
  return {
    passed: score.passed,
    evidence: { trajectory: score },
    zone: 'autonomous',
    reason: score.passed ? undefined : score.detail,
  };
}

function mergeResults(base: VerifyResult, extra: VerifyResult): VerifyResult {
  const blocked = base.blocked === true || extra.blocked === true;
  let reason = base.reason;
  if (blocked) reason = base.reason ?? extra.reason;
  else if (!extra.passed) reason = extra.reason ?? base.reason;
  return {
    passed: base.passed && extra.passed,
    evidence: { ...base.evidence, ...extra.evidence },
    zone: base.zone,
    blocked,
    reason,
  };
}

export class Verifier {
  config: VerifierConfig;
  deps: VerifierDeps;

  constructor(config: VerifierConfig, deps: VerifierDeps) {
    this.config = config;
    this.deps = deps;
  }

  /** Cheap deterministic reading at loop top (no-op check + A1 baseline red). */
  async preCheck(): Promise<VerifyResult> {
    const base = await runDeterministic(
      { command: this.config.command, expected_exit: this.config.expected_exit },
      this.deps.commandRunner,
    );
    return this.withEvalSuite(base);
  }

  async verify(turnResult: TurnOutcome, opts: VerifyOpts): Promise<VerifyResult> {
    const effectiveOpts: VerifyOpts = {
      ...opts,
      artifact: opts.artifact ?? turnResult.artifact,
      turn: opts.turn,
    };
    const evaluate = this.config.evaluate ?? 'output';

    // B3 — 'output' gates on the ladder level alone, 'trajectory' on the
    // recorded tool-call sequence alone, 'both' requires each to pass.
    let combined: VerifyResult;
    if (evaluate === 'trajectory') {
      combined = trajectoryResult(turnResult);
    } else {
      combined = await this.runLevel(effectiveOpts);
      if (evaluate === 'both') {
        combined = mergeResults(combined, trajectoryResult(turnResult));
      }
    }
    return this.withEvalSuite(combined);
  }

  private async runLevel(opts: VerifyOpts): Promise<VerifyResult> {
    switch (this.config.ladder_level) {
      case 1:
        return runDeterministic(
          { command: this.config.command, expected_exit: this.config.expected_exit },
          this.deps.commandRunner,
        );
      case 2:
        return runRuleBased(
          { command: this.config.command, expected_exit: this.config.expected_exit },
          this.deps.commandRunner,
        );
      case 3:
        return runFieldTruth(
          { command: this.config.command, expected_exit: this.config.expected_exit },
          this.deps.commandRunner,
        );
      case 4: {
        // B2 — structured rubrics are formatted into the frozen judge prompt.
        const rubricInput = opts.rubric ?? this.config.rubric;
        const rubricSpec = typeof rubricInput === 'object' ? rubricInput : undefined;
        const prompt =
          typeof rubricInput === 'string'
            ? rubricInput
            : rubricSpec
              ? formatRubricPrompt(rubricSpec)
              : undefined;
        return runLlmJudge(
          {
            rubric: prompt,
            rubricSpec,
            critics: this.config.critics,
            judge_score_threshold: this.config.judge_score_threshold,
          },
          opts,
          this.deps.judge,
          this.deps.loopName,
        );
      }
      case 5:
        return runHumanCheckpoint({}, opts, this.deps.humanPort, this.deps.loopName);
    }
  }

  /**
   * B1 — the registered eval suite is part of verification: a regression in
   * the suite fails the turn even when the ladder-level check passes.
   */
  private async withEvalSuite(base: VerifyResult): Promise<VerifyResult> {
    if (!this.config.eval_suite) return base;
    const command = `node core/harness/evals/run.js --suite ${this.config.eval_suite} --strict`;
    const res = await this.deps.commandRunner(command);
    const evalPassed = res.exitCode === 0;
    return {
      passed: base.passed && evalPassed,
      evidence: {
        ...base.evidence,
        eval_suite: {
          name: this.config.eval_suite,
          exit_code: res.exitCode,
          tail: res.stdout.split(/\r?\n/).slice(-15).join('\n'),
        },
      },
      zone: base.zone,
      blocked: base.blocked,
      reason: base.blocked
        ? base.reason
        : evalPassed
          ? base.reason
          : `eval suite "${this.config.eval_suite}" regressed (exit ${res.exitCode})`,
    };
  }
}
