#!/usr/bin/env node
/**
 * Two-Gate Consequence-Aware Checker Report Validator (UG-17 / LOCK-03 / Phase 4 Unit U18)
 *
 * Enforces:
 *   1. Reports adhere strictly to checker-report.schema.json (checker-report/v1).
 *   2. Anti-Collusion: makerAgentId !== reviewerAgentId and contextIsolation === "disjoint".
 *   3. Arithmetic Integrity: weight sums, weighted scores, normalizedScore calibration.
 *   4. Finding Deduplication: unique findingId across findings array.
 *   5. Gate A (Zero-Tolerance Invariant Gate): hallucination.raw === 2 and zero unresolved
 *      critical/high findings with confidence >= 0.8.
 *   6. Gate B (Calibrated Quality Gate): normalizedScore >= thresholdScore.
 *   7. Verdict Gate: status === "APPROVED" strictly requires Gate A && Gate B pass.
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FINDING_ID_PATTERN = /^FND-[0-9]{3,}$/;
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
const VALID_AUTOFIX_CLASSES = new Set(['safe_auto', 'gated_auto', 'manual', 'advisory']);
const VALID_STATUSES = new Set(['APPROVED', 'REVISE', 'REJECTED', 'ESCALATED']);
const VALID_MODES = new Set(['lite', 'focused', 'full']);
const VALID_AUTOFIX_POLICIES = new Set(['report-only', 'safe-auto-enabled']);
const REQUIRED_DIMENSIONS = [
  'task_success',
  'tool_use_quality',
  'trajectory_compliance',
  'hallucination',
  'response_quality',
];

/**
 * Calculates Gate A, Gate B, weighted raw score, and normalized score from dimensions and findings.
 */
export function calculateCheckerScoring(dimensions, findings = [], options = {}) {
  const thresholdScore = options.thresholdScore ?? 80;
  let weightedRawScore = 0;

  for (const dimName of REQUIRED_DIMENSIONS) {
    const dim = dimensions?.[dimName];
    if (dim && typeof dim.raw === 'number' && typeof dim.weight === 'number') {
      weightedRawScore += dim.raw * dim.weight;
    }
  }

  // Round weightedRawScore to 3 decimal places
  weightedRawScore = Math.round(weightedRawScore * 1000) / 1000;
  const normalizedScore = Math.round((weightedRawScore / 2.0) * 100 * 100) / 100;

  // Gate A: hallucination raw must be 2, AND zero unresolved critical/high findings with confidence >= 0.8
  const hallucinationOk = dimensions?.hallucination?.raw === 2;
  const criticalOrHighUnresolved = findings.some(
    (f) =>
      !f.resolved &&
      (f.severity === 'critical' || f.severity === 'high') &&
      typeof f.confidence === 'number' &&
      f.confidence >= 0.8
  );
  const gateAPassed = hallucinationOk && !criticalOrHighUnresolved;

  // Gate B: normalizedScore >= thresholdScore
  const gateBPassed = normalizedScore >= thresholdScore;

  return {
    weightedRawScore,
    maxRawScore: 2.0,
    normalizedScore,
    thresholdScore,
    gateAPassed,
    gateBPassed,
  };
}

/**
 * Validates a checker report object against checker-report/v1 and LOCK-03 invariants.
 */
export function validateCheckerReport(report, options = {}) {
  const violations = [];
  const reportLabel = options.filePath || report?.reportId || '<unnamed-report>';

  if (typeof report !== 'object' || report === null || Array.isArray(report)) {
    violations.push({
      code: 'INVALID_REPORT_OBJECT',
      file: reportLabel,
      message: 'Report must be a valid JSON object',
    });
    return { ok: false, violations };
  }

  // 1. schemaVersion
  if (report.schemaVersion !== 'checker-report/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      file: reportLabel,
      field: 'schemaVersion',
      message: `schemaVersion must be "checker-report/v1", got ${JSON.stringify(report.schemaVersion)}`,
    });
  }

  // 2. reportId
  if (typeof report.reportId !== 'string' || report.reportId.trim().length < 5) {
    violations.push({
      code: 'INVALID_REPORT_ID',
      file: reportLabel,
      field: 'reportId',
      message: 'reportId must be a string of at least 5 characters',
    });
  }

  // 3. timestamp
  if (typeof report.timestamp !== 'string' || Number.isNaN(Date.parse(report.timestamp))) {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      file: reportLabel,
      field: 'timestamp',
      message: 'timestamp must be a valid ISO date-time string',
    });
  }

  // 4. targetId
  if (typeof report.targetId !== 'string' || report.targetId.trim().length < 2) {
    violations.push({
      code: 'INVALID_TARGET_ID',
      file: reportLabel,
      field: 'targetId',
      message: 'targetId must be a string of at least 2 characters',
    });
  }

  // 5. Anti-Collusion checks: makerAgentId !== reviewerAgentId and contextIsolation === "disjoint"
  if (typeof report.makerAgentId !== 'string' || report.makerAgentId.trim().length < 2) {
    violations.push({
      code: 'INVALID_MAKER_ID',
      file: reportLabel,
      field: 'makerAgentId',
      message: 'makerAgentId must be a string of at least 2 characters',
    });
  }

  if (typeof report.reviewerAgentId !== 'string' || report.reviewerAgentId.trim().length < 2) {
    violations.push({
      code: 'INVALID_REVIEWER_ID',
      file: reportLabel,
      field: 'reviewerAgentId',
      message: 'reviewerAgentId must be a string of at least 2 characters',
    });
  }

  if (
    typeof report.makerAgentId === 'string' &&
    typeof report.reviewerAgentId === 'string' &&
    report.makerAgentId.trim() === report.reviewerAgentId.trim()
  ) {
    violations.push({
      code: 'COLLUSION_DETECTED',
      file: reportLabel,
      field: 'reviewerAgentId',
      message: `makerAgentId ("${report.makerAgentId}") cannot be the same as reviewerAgentId (LOCK-03 anti-collusion)`,
    });
  }

  if (report.contextIsolation !== 'disjoint') {
    violations.push({
      code: 'COLLUSION_DETECTED',
      file: reportLabel,
      field: 'contextIsolation',
      message: `contextIsolation must be "disjoint", got ${JSON.stringify(report.contextIsolation)}`,
    });
  }

  // 6. executionMode & autofixPolicy
  if (typeof report.executionMode !== 'string' || !VALID_MODES.has(report.executionMode)) {
    violations.push({
      code: 'INVALID_EXECUTION_MODE',
      file: reportLabel,
      field: 'executionMode',
      message: `executionMode must be one of lite|focused|full (got ${JSON.stringify(report.executionMode)})`,
    });
  }

  if (typeof report.autofixPolicy !== 'string' || !VALID_AUTOFIX_POLICIES.has(report.autofixPolicy)) {
    violations.push({
      code: 'INVALID_AUTOFIX_POLICY',
      file: reportLabel,
      field: 'autofixPolicy',
      message: `autofixPolicy must be report-only|safe-auto-enabled (got ${JSON.stringify(report.autofixPolicy)})`,
    });
  }

  // 7. lensesApplied
  if (!Array.isArray(report.lensesApplied) || report.lensesApplied.length === 0) {
    violations.push({
      code: 'INVALID_LENSES_APPLIED',
      file: reportLabel,
      field: 'lensesApplied',
      message: 'lensesApplied must be a non-empty array of applied lens identifiers',
    });
  }

  // 8. Dimensions & Arithmetic Integrity
  const dims = report.dimensions;
  let weightSum = 0;
  let computedWeightedSum = 0;

  if (typeof dims !== 'object' || dims === null || Array.isArray(dims)) {
    violations.push({
      code: 'MISSING_DIMENSIONS',
      file: reportLabel,
      field: 'dimensions',
      message: 'dimensions must be an object containing the 5 universal scoring dimensions',
    });
  } else {
    for (const reqDim of REQUIRED_DIMENSIONS) {
      const dim = dims[reqDim];
      if (!dim) {
        violations.push({
          code: 'MISSING_DIMENSION',
          file: reportLabel,
          field: `dimensions.${reqDim}`,
          message: `Missing required dimension "${reqDim}"`,
        });
        continue;
      }

      if (typeof dim.raw !== 'number' || ![0, 1, 2].includes(dim.raw)) {
        violations.push({
          code: 'INVALID_DIMENSION_RAW',
          file: reportLabel,
          field: `dimensions.${reqDim}.raw`,
          message: `raw score for ${reqDim} must be 0, 1, or 2 (got ${dim.raw})`,
        });
      }

      if (typeof dim.weight !== 'number' || dim.weight < 0.05 || dim.weight > 0.6) {
        violations.push({
          code: 'INVALID_DIMENSION_WEIGHT',
          file: reportLabel,
          field: `dimensions.${reqDim}.weight`,
          message: `weight for ${reqDim} must be a number between 0.05 and 0.6 (got ${dim.weight})`,
        });
      } else {
        weightSum += dim.weight;
      }

      const expectedWeighted = Math.round((dim.raw * dim.weight) * 1000) / 1000;
      if (typeof dim.weighted !== 'number' || Math.abs(dim.weighted - expectedWeighted) > 0.005) {
        violations.push({
          code: 'SUM_MISMATCH',
          file: reportLabel,
          field: `dimensions.${reqDim}.weighted`,
          message: `weighted score for ${reqDim} must equal raw * weight (${expectedWeighted}, got ${dim.weighted})`,
        });
      } else {
        computedWeightedSum += dim.weighted;
      }

      if (typeof dim.rationale !== 'string' || dim.rationale.trim().length < 5) {
        violations.push({
          code: 'INVALID_DIMENSION_RATIONALE',
          file: reportLabel,
          field: `dimensions.${reqDim}.rationale`,
          message: `rationale for ${reqDim} must be at least 5 characters`,
        });
      }
    }

    // Weight sum check
    if (Math.abs(weightSum - 1.0) > 0.005) {
      violations.push({
        code: 'SUM_MISMATCH',
        file: reportLabel,
        field: 'dimensions',
        message: `Sum of dimension weights must equal 1.0 (got ${weightSum.toFixed(4)})`,
      });
    }
  }

  // 9. Findings & Deduplication
  const findings = report.findings;
  const seenFindingIds = new Set();

  if (!Array.isArray(findings)) {
    violations.push({
      code: 'INVALID_FINDINGS',
      file: reportLabel,
      field: 'findings',
      message: 'findings must be an array of finding objects',
    });
  } else {
    findings.forEach((fnd, idx) => {
      const fndLabel = `findings[${idx}]`;
      if (typeof fnd !== 'object' || fnd === null || Array.isArray(fnd)) {
        violations.push({
          code: 'INVALID_FINDING_OBJECT',
          file: reportLabel,
          field: fndLabel,
          message: 'Finding entry must be a valid object',
        });
        return;
      }

      // findingId
      if (typeof fnd.findingId !== 'string' || !FINDING_ID_PATTERN.test(fnd.findingId)) {
        violations.push({
          code: 'INVALID_FINDING_ID',
          file: reportLabel,
          field: `${fndLabel}.findingId`,
          message: `findingId "${fnd.findingId}" must match pattern ^FND-[0-9]{3,}$`,
        });
      } else {
        if (seenFindingIds.has(fnd.findingId)) {
          violations.push({
            code: 'DUPLICATE_FINDING_ID',
            file: reportLabel,
            field: `${fndLabel}.findingId`,
            message: `Duplicate findingId "${fnd.findingId}" detected`,
          });
        }
        seenFindingIds.add(fnd.findingId);
      }

      // severity
      if (typeof fnd.severity !== 'string' || !VALID_SEVERITIES.has(fnd.severity)) {
        violations.push({
          code: 'INVALID_SEVERITY',
          file: reportLabel,
          field: `${fndLabel}.severity`,
          message: `severity must be one of critical|high|medium|low (got ${JSON.stringify(fnd.severity)})`,
        });
      }

      // confidence
      if (typeof fnd.confidence !== 'number' || fnd.confidence < 0.0 || fnd.confidence > 1.0) {
        violations.push({
          code: 'INVALID_CONFIDENCE',
          file: reportLabel,
          field: `${fndLabel}.confidence`,
          message: `confidence must be a number between 0.0 and 1.0 (got ${fnd.confidence})`,
        });
      }

      // autofixClass
      if (typeof fnd.autofixClass !== 'string' || !VALID_AUTOFIX_CLASSES.has(fnd.autofixClass)) {
        violations.push({
          code: 'INVALID_AUTOFIX_CLASS',
          file: reportLabel,
          field: `${fndLabel}.autofixClass`,
          message: `autofixClass must be one of safe_auto|gated_auto|manual|advisory (got ${JSON.stringify(fnd.autofixClass)})`,
        });
      }

      // file, message, remediation, resolved
      if (typeof fnd.file !== 'string' || fnd.file.trim().length === 0) {
        violations.push({
          code: 'INVALID_FINDING_FILE',
          file: reportLabel,
          field: `${fndLabel}.file`,
          message: 'Finding file must be a non-empty string',
        });
      }

      if (typeof fnd.message !== 'string' || fnd.message.trim().length < 5) {
        violations.push({
          code: 'INVALID_FINDING_MESSAGE',
          file: reportLabel,
          field: `${fndLabel}.message`,
          message: 'Finding message must be at least 5 characters',
        });
      }

      if (typeof fnd.remediation !== 'string' || fnd.remediation.trim().length < 5) {
        violations.push({
          code: 'INVALID_FINDING_REMEDIATION',
          file: reportLabel,
          field: `${fndLabel}.remediation`,
          message: 'Finding remediation must be at least 5 characters',
        });
      }

      if (typeof fnd.resolved !== 'boolean') {
        violations.push({
          code: 'INVALID_FINDING_RESOLVED',
          file: reportLabel,
          field: `${fndLabel}.resolved`,
          message: 'Finding resolved must be a boolean',
        });
      }
    });
  }

  // 10. Scoring Object & Invariant Gates
  const scoring = report.scoring;
  if (typeof scoring !== 'object' || scoring === null || Array.isArray(scoring)) {
    violations.push({
      code: 'MISSING_SCORING',
      file: reportLabel,
      field: 'scoring',
      message: 'scoring must be an object with weightedRawScore, maxRawScore, normalizedScore, thresholdScore, gateAPassed, gateBPassed',
    });
  } else {
    // Arithmetic checks on scoring
    if (scoring.maxRawScore !== 2.0) {
      violations.push({
        code: 'SUM_MISMATCH',
        file: reportLabel,
        field: 'scoring.maxRawScore',
        message: `maxRawScore must be 2.0, got ${scoring.maxRawScore}`,
      });
    }

    if (
      typeof scoring.weightedRawScore !== 'number' ||
      Math.abs(scoring.weightedRawScore - computedWeightedSum) > 0.01
    ) {
      violations.push({
        code: 'SUM_MISMATCH',
        file: reportLabel,
        field: 'scoring.weightedRawScore',
        message: `weightedRawScore (${scoring.weightedRawScore}) does not match sum of weighted dimensions (${computedWeightedSum.toFixed(3)})`,
      });
    }

    const expectedNormalized = Math.round(((scoring.weightedRawScore ?? 0) / 2.0) * 100 * 100) / 100;
    if (
      typeof scoring.normalizedScore !== 'number' ||
      Math.abs(scoring.normalizedScore - expectedNormalized) > 0.05
    ) {
      violations.push({
        code: 'SUM_MISMATCH',
        file: reportLabel,
        field: 'scoring.normalizedScore',
        message: `normalizedScore (${scoring.normalizedScore}) does not match expected (${expectedNormalized})`,
      });
    }

    const threshold = typeof scoring.thresholdScore === 'number' ? scoring.thresholdScore : 80;

    // Gate A calculation verification
    const hallucinationRaw = dims?.hallucination?.raw;
    const hasUnresolvedHighOrCritical = Array.isArray(findings) && findings.some(
      (f) =>
        !f.resolved &&
        (f.severity === 'critical' || f.severity === 'high') &&
        typeof f.confidence === 'number' &&
        f.confidence >= 0.8
    );
    const expectedGateA = hallucinationRaw === 2 && !hasUnresolvedHighOrCritical;

    if (scoring.gateAPassed !== expectedGateA) {
      violations.push({
        code: 'GATE_A_CALCULATION_MISMATCH',
        file: reportLabel,
        field: 'scoring.gateAPassed',
        message: `gateAPassed was reported as ${scoring.gateAPassed}, but calculated value is ${expectedGateA} (hallucination.raw=${hallucinationRaw}, unresolvedHighOrCritical=${hasUnresolvedHighOrCritical})`,
      });
    }

    // Gate B calculation verification
    const expectedGateB = (scoring.normalizedScore ?? 0) >= threshold;
    if (scoring.gateBPassed !== expectedGateB) {
      violations.push({
        code: 'GATE_B_CALCULATION_MISMATCH',
        file: reportLabel,
        field: 'scoring.gateBPassed',
        message: `gateBPassed was reported as ${scoring.gateBPassed}, but calculated value is ${expectedGateB} (normalizedScore=${scoring.normalizedScore}, threshold=${threshold})`,
      });
    }

    // 11. Status & Verdict Gate
    if (typeof report.status !== 'string' || !VALID_STATUSES.has(report.status)) {
      violations.push({
        code: 'INVALID_STATUS',
        file: reportLabel,
        field: 'status',
        message: `status must be one of APPROVED|REVISE|REJECTED|ESCALATED (got ${JSON.stringify(report.status)})`,
      });
    } else if (report.status === 'APPROVED') {
      if (!expectedGateA) {
        violations.push({
          code: 'GATE_A_FAILED',
          file: reportLabel,
          field: 'status',
          message: 'Report cannot be APPROVED because Gate A failed (zero-tolerance on hallucination < 2 or unresolved critical/high finding at confidence >= 0.8)',
        });
      }
      if (!expectedGateB) {
        violations.push({
          code: 'GATE_B_FAILED',
          file: reportLabel,
          field: 'status',
          message: `Report cannot be APPROVED because Gate B failed (normalizedScore ${scoring.normalizedScore} < thresholdScore ${threshold})`,
        });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    report,
  };
}

/**
 * Self-test suite verifying positive and negative validation invariants.
 */
export function runCheckerReportSelfTest() {
  const testsPassed = [];
  const testsFailed = [];

  const baseValidReport = {
    schemaVersion: 'checker-report/v1',
    reportId: 'RPT-20261021-001',
    timestamp: '2026-10-21T12:00:00.000Z',
    targetId: 'STAGE-04',
    makerAgentId: 'maker-agent-alpha',
    reviewerAgentId: 'checker-agent-beta',
    contextIsolation: 'disjoint',
    executionMode: 'focused',
    autofixPolicy: 'report-only',
    lensesApplied: ['security-invariants', 'architecture-boundaries'],
    dimensions: {
      task_success: { raw: 2, weight: 0.3, weighted: 0.6, rationale: 'All plan requirements satisfied' },
      tool_use_quality: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Proper tools invoked' },
      trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'All steps executed per plan' },
      hallucination: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'No hallucinations detected' },
      response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Clean documentation and code' },
    },
    scoring: {
      weightedRawScore: 2.0,
      maxRawScore: 2.0,
      normalizedScore: 100,
      thresholdScore: 80,
      gateAPassed: true,
      gateBPassed: true,
    },
    findings: [],
    status: 'APPROVED',
  };

  // Test 1: Positive valid approved report
  const res1 = validateCheckerReport(baseValidReport);
  if (res1.ok) {
    testsPassed.push('Positive Valid Approved Report');
  } else {
    testsFailed.push(`Positive Valid Approved Report: ${JSON.stringify(res1.violations)}`);
  }

  // Test 2: Gate A failure (unresolved high finding with confidence 0.92) marked APPROVED
  const gateAReport = {
    ...baseValidReport,
    reportId: 'RPT-GATE-A-FAIL',
    dimensions: {
      ...baseValidReport.dimensions,
      task_success: { raw: 1, weight: 0.3, weighted: 0.3, rationale: 'Partial success' },
    },
    scoring: {
      weightedRawScore: 1.7,
      maxRawScore: 2.0,
      normalizedScore: 85,
      thresholdScore: 80,
      gateAPassed: true, // Erroneously claims Gate A passed
      gateBPassed: true,
    },
    findings: [
      {
        findingId: 'FND-001',
        lensId: 'security-invariants',
        ruleId: 'SEC-NO-HARDCODED-SECRETS',
        severity: 'high',
        confidence: 0.92,
        autofixClass: 'manual',
        file: 'app/routes/login.tsx',
        message: 'Potential secret exposed in code',
        remediation: 'Move secret to environment variable',
        resolved: false,
      },
    ],
    status: 'APPROVED',
  };
  const res2 = validateCheckerReport(gateAReport);
  if (!res2.ok && res2.violations.some((v) => v.code === 'GATE_A_FAILED')) {
    testsPassed.push('Gate A Failure Rejected on APPROVED');
  } else {
    testsFailed.push(`Gate A Failure Rejected on APPROVED expected violations`);
  }

  // Test 3: Gate B failure (normalizedScore 75 < 80) marked APPROVED
  const gateBReport = {
    ...baseValidReport,
    reportId: 'RPT-GATE-B-FAIL',
    dimensions: {
      task_success: { raw: 1, weight: 0.3, weighted: 0.3, rationale: 'Partial' },
      tool_use_quality: { raw: 1, weight: 0.15, weighted: 0.15, rationale: 'Roundabout' },
      trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Checks executed' },
      hallucination: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Zero hallucination' },
      response_quality: { raw: 1, weight: 0.2, weighted: 0.2, rationale: 'Minor drift' },
    },
    scoring: {
      weightedRawScore: 1.35,
      maxRawScore: 2.0,
      normalizedScore: 67.5,
      thresholdScore: 80,
      gateAPassed: true,
      gateBPassed: false,
    },
    findings: [],
    status: 'APPROVED',
  };
  const res3 = validateCheckerReport(gateBReport);
  if (!res3.ok && res3.violations.some((v) => v.code === 'GATE_B_FAILED')) {
    testsPassed.push('Gate B Failure Rejected on APPROVED');
  } else {
    testsFailed.push('Gate B Failure Rejected on APPROVED expected violations');
  }

  // Test 4: Collusion detected (makerAgentId === reviewerAgentId)
  const collusionReport = {
    ...baseValidReport,
    reportId: 'RPT-COLLUSION-FAIL',
    makerAgentId: 'agent-sam-context',
    reviewerAgentId: 'agent-sam-context',
  };
  const res4 = validateCheckerReport(collusionReport);
  if (!res4.ok && res4.violations.some((v) => v.code === 'COLLUSION_DETECTED')) {
    testsPassed.push('Collusion Detected on Shared Agent ID');
  } else {
    testsFailed.push('Collusion Detected expected violations');
  }

  // Test 5: Arithmetic sum mismatch
  const arithmeticReport = {
    ...baseValidReport,
    reportId: 'RPT-ARITHMETIC-FAIL',
    dimensions: {
      ...baseValidReport.dimensions,
      task_success: { raw: 2, weight: 0.4, weighted: 0.8, rationale: 'Weight is now 0.4 instead of 0.3' },
    },
  };
  const res5 = validateCheckerReport(arithmeticReport);
  if (!res5.ok && res5.violations.some((v) => v.code === 'SUM_MISMATCH')) {
    testsPassed.push('Arithmetic Sum Mismatch Rejected');
  } else {
    testsFailed.push('Arithmetic Sum Mismatch expected violations');
  }

  return {
    ok: testsFailed.length === 0,
    testsPassed,
    testsFailed,
  };
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--self-test')) {
    console.log('=== Running validate-checker-report Self-Test Suite ===\n');
    const selfTestRes = runCheckerReportSelfTest();
    for (const p of selfTestRes.testsPassed) {
      console.log(`  ✓ ${p}`);
    }
    if (!selfTestRes.ok) {
      console.error('\nSelf-Test Failed:');
      for (const f of selfTestRes.testsFailed) {
        console.error(`  ✗ ${f}`);
      }
      process.exit(1);
    }
    console.log('\nok — All 5 self-test scenarios passed cleanly.');
    process.exit(0);
  }

  const filePath = process.argv[2];
  if (!filePath || filePath.startsWith('-')) {
    console.error('Usage: node .shiftstone/scripts/validate-checker-report.js <path-to-report.json> | --self-test');
    process.exit(1);
  }

  try {
    const content = readFileSync(path.resolve(filePath), 'utf8');
    const report = JSON.parse(content);
    const result = validateCheckerReport(report, { filePath });

    console.log('=== Checker Report Validation Report (UG-17 / LOCK-03) ===');
    console.log(`  Report ID: ${report.reportId || 'unknown'}`);
    console.log(`  Status:    ${result.ok ? 'valid' : 'invalid'}`);

    if (!result.ok) {
      console.error(`\nFAIL — ${result.violations.length} violation(s):\n`);
      for (const v of result.violations) {
        console.error(`  - [${v.code}] ${v.field ? `(${v.field}) ` : ''}${v.message}`);
      }
      process.exit(1);
    } else {
      console.log('\nok — Checker report satisfies checker-report/v1 and LOCK-03 Two-Gate invariants.');
      process.exit(0);
    }
  } catch (err) {
    console.error(`Error reading report file: ${err.message}`);
    process.exit(1);
  }
}
