import { describe, expect, it } from 'vitest';
import {
  RUBRIC_DIMENSIONS,
  RUBRIC_TEMPLATE,
  formatRubricPrompt,
  scoreRubric,
  validateRubric,
} from '../../harness/evals/checker/rubric-template.ts';
import { runLlmJudge } from '../../harness/verifier-ladder/l4-llm-judge.ts';
import type { JudgeClient } from '../../harness/loop-runner/types.ts';

describe('rubric-schema conformance (B2)', () => {
  it('accepts the shipped template (5 dimensions, weights sum to 1)', () => {
    expect(validateRubric(RUBRIC_TEMPLATE)).toEqual([]);
    expect(Object.keys(RUBRIC_TEMPLATE.dimensions)).toHaveLength(5);
    const sum = RUBRIC_DIMENSIONS.reduce((a, n) => a + RUBRIC_TEMPLATE.dimensions[n].weight, 0);
    expect(sum).toBeCloseTo(1, 6);
    expect(RUBRIC_TEMPLATE.threshold).toBeGreaterThanOrEqual(0);
    expect(RUBRIC_TEMPLATE.threshold).toBeLessThanOrEqual(2);
  });

  it('rejects freeform/non-mapping rubrics', () => {
    expect(validateRubric('score it nicely')[0]).toMatch(/must be a mapping/);
    expect(validateRubric(null)[0]).toMatch(/must be a mapping/);
    expect(validateRubric({ threshold: 1.6 })[0]).toMatch(/dimensions/);
  });

  it('rejects a missing or unknown dimension', () => {
    const rubric = JSON.parse(JSON.stringify(RUBRIC_TEMPLATE)) as Record<string, Record<string, unknown>>;
    delete rubric.dimensions.hallucination;
    expect(validateRubric(rubric)).toContain('missing required dimension: hallucination');

    const extra = JSON.parse(JSON.stringify(RUBRIC_TEMPLATE)) as Record<string, Record<string, unknown>>;
    extra.dimensions.vibes = { weight: 0.1 };
    expect(validateRubric(extra).join(' ')).toMatch(/unknown dimension: vibes/);
  });

  it('rejects weights that do not sum to 1 and out-of-range thresholds', () => {
    const rubric = JSON.parse(JSON.stringify(RUBRIC_TEMPLATE)) as Record<string, unknown>;
    (rubric.dimensions as Record<string, { weight: number }>).task_success.weight = 0.9;
    expect(validateRubric(rubric).join(' ')).toMatch(/weights must sum to 1/);

    const badThreshold = { ...JSON.parse(JSON.stringify(RUBRIC_TEMPLATE)), threshold: 7 };
    expect(validateRubric(badThreshold).join(' ')).toMatch(/threshold must be a number in \[0, 2\]/);
  });
});

describe('weighted scoring (B2)', () => {
  it('computes weighted total (0–2) and normalized (0–1) verdict', () => {
    const allTwo = Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 2]));
    const perfect = scoreRubric(allTwo, RUBRIC_TEMPLATE);
    expect(perfect.weighted_total).toBeCloseTo(2, 6);
    expect(perfect.normalized).toBeCloseTo(1, 6);
    expect(perfect.passed).toBe(true);

    const allZero = Object.fromEntries(RUBRIC_DIMENSIONS.map((d) => [d, 0]));
    const worst = scoreRubric(allZero, RUBRIC_TEMPLATE);
    expect(worst.weighted_total).toBe(0);
    expect(worst.passed).toBe(false);
  });

  it('a dimension the Checker failed to score is always a failure', () => {
    const result = scoreRubric({ task_success: 2, tool_use_quality: 2 }, RUBRIC_TEMPLATE);
    expect(result.missing).toEqual([
      'trajectory_compliance',
      'hallucination',
      'response_quality',
    ]);
    expect(result.passed).toBe(false);
  });

  it('falls under the threshold when the weak dimensions drag the total down', () => {
    // task_success 0 weights 0.3 → total 2 - 0.6 = 1.4 < 1.6
    const result = scoreRubric(
      { task_success: 0, tool_use_quality: 2, trajectory_compliance: 2, hallucination: 2, response_quality: 2 },
      RUBRIC_TEMPLATE,
    );
    expect(result.weighted_total).toBeCloseTo(1.4, 6);
    expect(result.passed).toBe(false);
  });
});

describe('the Checker returns per-dimension scores (B2)', () => {
  const rubricSpec = RUBRIC_TEMPLATE;

  it('recomputes the vote from verdict.dimensions and exposes them in evidence', async () => {
    const judge: JudgeClient = {
      judge: async () => ({
        score: 0.1, // stale headline score — must be ignored when dimensions exist
        reasoning: 'per-dimension verdict',
        dimensions: {
          task_success: 2,
          tool_use_quality: 2,
          trajectory_compliance: 2,
          hallucination: 2,
          response_quality: 2,
        },
      }),
    };
    const result = await runLlmJudge(
      { rubric: formatRubricPrompt(rubricSpec), rubricSpec, critics: 1, judge_score_threshold: 0.8 },
      { disjointContext: true },
      judge,
      'test-loop',
    );
    expect(result.passed).toBe(true);
    const evidence = result.evidence as {
      verdicts: { vote_score: number; per_dimension: { scores: Record<string, number>; weighted_total: number } }[];
    };
    expect(evidence.verdicts[0].vote_score).toBeCloseTo(1, 6);
    expect(evidence.verdicts[0].per_dimension.weighted_total).toBeCloseTo(2, 6);
    expect(Object.keys(evidence.verdicts[0].per_dimension.scores)).toHaveLength(5);
  });

  it('a low per-dimension total fails the vote even with a high headline score', async () => {
    const judge: JudgeClient = {
      judge: async () => ({
        score: 0.95,
        reasoning: 'looks great',
        dimensions: {
          task_success: 0,
          tool_use_quality: 0,
          trajectory_compliance: 0,
          hallucination: 0,
          response_quality: 0,
        },
      }),
    };
    const result = await runLlmJudge(
      { rubric: formatRubricPrompt(rubricSpec), rubricSpec, critics: 1, judge_score_threshold: 0.8 },
      { disjointContext: true },
      judge,
      'test-loop',
    );
    expect(result.passed).toBe(false);
  });

  it('the formatted prompt is the frozen 5-dimension judging contract', () => {
    const prompt = formatRubricPrompt(rubricSpec);
    for (const dimension of RUBRIC_DIMENSIONS) expect(prompt).toContain(dimension);
    expect(prompt).toContain('Pass = weighted total');
    expect(prompt).toContain('1.6');
    expect(prompt).toContain('"dimensions"');
  });
});
