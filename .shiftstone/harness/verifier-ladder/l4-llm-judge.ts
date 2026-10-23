/**
 * L4 — LLM as judge. Assisted zone. MUST use disjoint context (Maker ≠ Checker).
 *
 * A5 — independent debate / n-critics: when verification.critics = n > 1 the
 * verifier spawns n independent judge contexts and requires
 * passes >= ceil(n/2) (amendment A5 consensus rule), countering premature
 * self-trust. Each judge scores against the frozen rubric; a judge's score
 * >= judge_score_threshold counts as a passing vote.
 */

import {
  LoopHarnessError,
  MakerCheckerViolation,
  type JudgeClient,
  type VerifyOpts,
  type VerifyResult,
} from '../loop-runner/types.ts';
import {
  scoreRubric,
  type RubricScores,
  type RubricSpec,
} from '../evals/checker/rubric-template.ts';

export interface LlmJudgeConfig {
  rubric?: string;
  /** B2 — when present, verdict.dimensions (0–2 each) recompute the vote. */
  rubricSpec?: RubricSpec;
  critics: number;
  judge_score_threshold: number;
}

export async function runLlmJudge(
  config: LlmJudgeConfig,
  opts: VerifyOpts,
  judge: JudgeClient | undefined,
  loopName: string,
): Promise<VerifyResult> {
  if (!opts.disjointContext) {
    throw new MakerCheckerViolation('L4 verification requires disjoint context for the judge.');
  }
  const rubric = config.rubric;
  if (!rubric) {
    throw new LoopHarnessError(
      'L4_RUBRIC_MISSING',
      'L4 verification requires a rubric. Either lower the ladder level or add rubric.',
    );
  }
  if (!judge) {
    return {
      passed: false,
      blocked: true,
      reason: `L4 judge not configured for loop ${loopName} — escalate to a human to wire a disjoint checker.`,
      evidence: { judge_configured: false },
      zone: 'assisted',
    };
  }

  const n = Math.max(1, Math.floor(config.critics));
  const required = Math.ceil(n / 2);

  const verdicts = await Promise.all(
    Array.from({ length: n }, (_, judgeIndex) =>
      judge.judge({
        rubric,
        artifact: opts.artifact,
        judgeIndex,
        disjointContext: true,
      }),
    ),
  );

  // B2 — a verdict carrying per-dimension scores is rescored against the
  // structured rubric so the vote reflects the weighted 5-dimension total.
  const scored = verdicts.map((verdict) => {
    if (config.rubricSpec && verdict.dimensions) {
      const result = scoreRubric(verdict.dimensions as RubricScores, config.rubricSpec);
      return {
        verdict,
        vote_score: result.normalized,
        per_dimension: {
          scores: result.scores,
          weighted_total: result.weighted_total,
          threshold: config.rubricSpec.threshold,
          missing: result.missing,
        },
      };
    }
    return { verdict, vote_score: verdict.score, per_dimension: null };
  });

  const passingVotes = scored.filter((s) => s.vote_score >= config.judge_score_threshold).length;
  const passed = passingVotes >= required;

  return {
    passed,
    evidence: {
      loop: loopName,
      critics: n,
      required_passes: required,
      threshold: config.judge_score_threshold,
      passing_votes: passingVotes,
      verdicts: scored,
    },
    zone: 'assisted',
  };
}
