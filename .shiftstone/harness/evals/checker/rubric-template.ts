/**
 * Rubric checker helpers (amendment B2) — the 5 required scoring dimensions
 * (Osmani 06, leader rec #2), schema validation, and weighted scoring.
 *
 * rubric-schema.json is the declarative source of truth; validateRubric()
 * mirrors it (the harness ships no JSON-Schema engine). Keep both in sync.
 *
 * Scoring: each dimension 0-2, weights sum to 1, pass = weighted total >= threshold.
 */

export const RUBRIC_DIMENSIONS = [
  'task_success',
  'tool_use_quality',
  'trajectory_compliance',
  'hallucination',
  'response_quality',
] as const;

export type RubricDimensionName = (typeof RUBRIC_DIMENSIONS)[number];

export interface RubricDimensionSpec {
  weight: number;
  guidance?: string;
}

export interface RubricSpec {
  dimensions: Record<RubricDimensionName, RubricDimensionSpec>;
  /** Weighted total on the 0–2 scale; 1.6 == the 0.8 verdict gate. */
  threshold: number;
  guidance?: string;
}

/** Per-dimension scores the Checker must return (0 | 1 | 2). */
export type RubricScores = Partial<Record<RubricDimensionName, number>>;

/** Copy-paste starting point for a new L4 rubric. */
export const RUBRIC_TEMPLATE: RubricSpec = {
  dimensions: {
    task_success: { weight: 0.3, guidance: '2 = outcome fully achieved and evidenced; 1 = partial; 0 = not achieved' },
    tool_use_quality: { weight: 0.15, guidance: '2 = right tools/skills used efficiently; 1 = roundabout; 0 = wrong or unused' },
    trajectory_compliance: { weight: 0.2, guidance: '2 = every claimed check was actually executed; 1 = minor gap; 0 = claims skipped checks' },
    hallucination: { weight: 0.15, guidance: '2 = no invented APIs/deps/paths; 1 = one unverifiable claim; 0 = fabricated reference' },
    response_quality: { weight: 0.2, guidance: '2 = scoped, documented, regression-free; 1 = minor drift; 0 = scope creep or doc drift' },
  },
  threshold: 1.6,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns validation problems (empty = conforms to rubric-schema.json). */
export function validateRubric(rubric: unknown): string[] {
  const problems: string[] = [];
  if (!isRecord(rubric)) {
    return ['rubric must be a mapping with dimensions + threshold (see .shiftstone/harness/evals/rubric-template)'];
  }
  const dimensions = rubric['dimensions'];
  if (!isRecord(dimensions)) {
    return ['rubric.dimensions must declare all 5 scoring dimensions'];
  }
  for (const required of RUBRIC_DIMENSIONS) {
    const dim = dimensions[required];
    if (dim === undefined) {
      problems.push(`missing required dimension: ${required}`);
      continue;
    }
    if (!isRecord(dim)) {
      problems.push(`dimension ${required} must be a mapping with weight`);
      continue;
    }
    const weight = dim['weight'];
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      problems.push(`dimension ${required}.weight must be a number > 0`);
    }
    for (const key of Object.keys(dim)) {
      if (key !== 'weight' && key !== 'guidance') {
        problems.push(`dimension ${required} has unknown field: ${key}`);
      }
    }
  }
  for (const key of Object.keys(dimensions)) {
    if (!(RUBRIC_DIMENSIONS as readonly string[]).includes(key)) {
      problems.push(`unknown dimension: ${key} (allowed: ${RUBRIC_DIMENSIONS.join(', ')})`);
    }
  }
  const weights = RUBRIC_DIMENSIONS.map((name) => dimensions[name])
    .filter((d): d is RubricDimensionSpec => isRecord(d) && typeof d['weight'] === 'number')
    .map((d) => d.weight);
  if (weights.length === RUBRIC_DIMENSIONS.length) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 1e-6) {
      problems.push(`dimension weights must sum to 1 (got ${sum})`);
    }
  }
  const threshold = rubric['threshold'];
  if (typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < 0 || threshold > 2) {
    problems.push('rubric.threshold must be a number in [0, 2] (weighted-total scale)');
  }
  for (const key of Object.keys(rubric)) {
    if (key !== 'dimensions' && key !== 'threshold' && key !== 'guidance') {
      problems.push(`unknown rubric field: ${key}`);
    }
  }
  return problems;
}

export interface RubricScoreResult {
  /** sum(score × weight) on the 0–2 scale. */
  weighted_total: number;
  /** weighted_total / 2 on the 0–1 scale (the verdict gate). */
  normalized: number;
  passed: boolean;
  /** Dimensions the Checker failed to score — always a failure (B2). */
  missing: RubricDimensionName[];
  scores: RubricScores;
}

export function scoreRubric(scores: RubricScores, rubric: RubricSpec): RubricScoreResult {
  const missing: RubricDimensionName[] = [];
  let weightedTotal = 0;
  for (const name of RUBRIC_DIMENSIONS) {
    const score = scores[name];
    if (typeof score !== 'number' || Number.isNaN(score)) {
      missing.push(name);
      continue;
    }
    const clamped = Math.min(2, Math.max(0, score));
    weightedTotal += clamped * (rubric.dimensions[name]?.weight ?? 0);
  }
  const normalized = weightedTotal / 2;
  return {
    weighted_total: weightedTotal,
    normalized,
    passed: missing.length === 0 && weightedTotal >= rubric.threshold,
    missing,
    scores,
  };
}

/** Render a structured rubric as the frozen judge prompt (JudgeRequest.rubric). */
export function formatRubricPrompt(rubric: RubricSpec): string {
  const lines: string[] = ['Score this artifact against the 5-dimension rubric. Each dimension: 0, 1, or 2.'];
  if (rubric.guidance) lines.push(`Guidance: ${rubric.guidance}`);
  lines.push('');
  lines.push('Dimensions:');
  for (const name of RUBRIC_DIMENSIONS) {
    const dim = rubric.dimensions[name];
    lines.push(`- ${name} (weight ${dim.weight})${dim.guidance ? `: ${dim.guidance}` : ''}`);
  }
  lines.push('');
  lines.push(`Pass = weighted total (sum of score × weight) >= ${rubric.threshold} on the 0–2 scale.`);
  lines.push(
    'Return JSON: {"score": <normalized 0..1>, "dimensions": {"task_success": 0..2, ...}, "reasoning": "..."}',
  );
  return lines.join('\n');
}

/** Finding structure matching checker-report/v1 (LOCK-03). */
export interface CheckerFinding {
  findingId: string;
  lensId: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  autofixClass: 'safe_auto' | 'gated_auto' | 'manual' | 'advisory';
  file: string;
  line?: number;
  message: string;
  remediation: string;
  resolved: boolean;
}

/** Two-Gate Evaluation result enforcing LOCK-03 invariant gates. */
export interface TwoGateEvaluationResult {
  gateAPassed: boolean;
  gateBPassed: boolean;
  approved: boolean;
  weightedRawScore: number;
  normalizedScore: number;
  thresholdScore: number;
  hallucinationPassed: boolean;
  unresolvedCriticalOrHighFindings: CheckerFinding[];
}

/**
 * Evaluates scores and findings against the LOCK-03 Two-Gate contract:
 * - Gate A: hallucination === 2 AND zero unresolved findings with severity critical/high and confidence >= 0.8
 * - Gate B: normalizedScore >= thresholdScore
 * - Verdict: APPROVED requires Gate A && Gate B
 */
export function evaluateTwoGateReport(
  scores: RubricScores,
  rubric: RubricSpec,
  findings: CheckerFinding[] = [],
  thresholdScore = 80,
): TwoGateEvaluationResult {
  const scored = scoreRubric(scores, rubric);
  const normalizedScore = Math.round(scored.normalized * 100 * 100) / 100;

  const hallucinationPassed = scores.hallucination === 2;
  const unresolvedCriticalOrHigh = findings.filter(
    (f) =>
      !f.resolved &&
      (f.severity === 'critical' || f.severity === 'high') &&
      typeof f.confidence === 'number' &&
      f.confidence >= 0.8,
  );

  const gateAPassed = hallucinationPassed && unresolvedCriticalOrHigh.length === 0;
  const gateBPassed = scored.passed && normalizedScore >= thresholdScore;

  return {
    gateAPassed,
    gateBPassed,
    approved: gateAPassed && gateBPassed,
    weightedRawScore: scored.weighted_total,
    normalizedScore,
    thresholdScore,
    hallucinationPassed,
    unresolvedCriticalOrHighFindings: unresolvedCriticalOrHigh,
  };
}

