import { describe, expect, it } from 'vitest';
import {
  calculateCheckerScoring,
  runCheckerReportSelfTest,
  validateCheckerReport,
} from '../validate-checker-report.js';

const VALID_REPORT = {
  schemaVersion: 'checker-report/v1',
  reportId: 'RPT-20261021-002',
  timestamp: '2026-10-21T14:30:00.000Z',
  targetId: 'STAGE-02',
  makerAgentId: 'maker-alpha',
  reviewerAgentId: 'checker-beta',
  contextIsolation: 'disjoint',
  executionMode: 'full',
  autofixPolicy: 'report-only',
  lensesApplied: ['security-invariants', 'rls-security'],
  dimensions: {
    task_success: { raw: 2, weight: 0.3, weighted: 0.6, rationale: 'Full task completion' },
    tool_use_quality: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Clean and optimal tool calls' },
    trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'All steps verified' },
    hallucination: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Zero fabricated APIs' },
    response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Complete documentation' },
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

describe('Unit U18: validate-checker-report (UG-17, LOCK-03)', () => {
  it('validates a well-formed report cleanly', () => {
    const res = validateCheckerReport(VALID_REPORT);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('TS-U18-01 (L2): rejects report marked APPROVED when Gate A fails (normalizedScore: 88, 1 unresolved high finding at confidence 0.92)', () => {
    const reportWithGateAFail = {
      ...VALID_REPORT,
      reportId: 'RPT-GATE-A-FAIL',
      dimensions: {
        task_success: { raw: 2, weight: 0.3, weighted: 0.6, rationale: 'Complete' },
        tool_use_quality: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Clean' },
        trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Verified' },
        hallucination: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'Clean' },
        response_quality: { raw: 1, weight: 0.2, weighted: 0.2, rationale: 'Minor issue' },
      },
      scoring: {
        weightedRawScore: 1.8,
        maxRawScore: 2.0,
        normalizedScore: 90, // Even with > 80 score
        thresholdScore: 80,
        gateAPassed: true, // Erroneous claim
        gateBPassed: true,
      },
      findings: [
        {
          findingId: 'FND-101',
          lensId: 'security-invariants',
          ruleId: 'SEC-NO-HARDCODED-SECRETS',
          severity: 'high',
          confidence: 0.92,
          autofixClass: 'manual',
          file: 'apps/web/app/routes/api.ts',
          message: 'Hardcoded API secret token found in route handler',
          remediation: 'Use environment secrets binding',
          resolved: false,
        },
      ],
      status: 'APPROVED',
    };

    const res = validateCheckerReport(reportWithGateAFail);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'GATE_A_FAILED')).toBe(true);
  });

  it('TS-U18-02 (L2): detects collusion when makerAgentId === reviewerAgentId', () => {
    const reportWithCollusion = {
      ...VALID_REPORT,
      makerAgentId: 'agent-twin',
      reviewerAgentId: 'agent-twin',
    };
    const res = validateCheckerReport(reportWithCollusion);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'COLLUSION_DETECTED')).toBe(true);
  });

  it('TS-U18-02 (L2): detects collusion when contextIsolation is not disjoint', () => {
    const reportWithSharedContext = {
      ...VALID_REPORT,
      contextIsolation: 'shared',
    };
    const res = validateCheckerReport(reportWithSharedContext);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'COLLUSION_DETECTED')).toBe(true);
  });

  it('TS-U18-02 (L2): detects arithmetic SUM_MISMATCH when dimension weights do not sum to 1.0', () => {
    const reportWithBadWeights = {
      ...VALID_REPORT,
      dimensions: {
        ...VALID_REPORT.dimensions,
        task_success: { raw: 2, weight: 0.5, weighted: 1.0, rationale: 'Weight too high' },
      },
    };
    const res = validateCheckerReport(reportWithBadWeights);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'SUM_MISMATCH')).toBe(true);
  });

  it('rejects duplicate findingId', () => {
    const reportWithDuplicateFindings = {
      ...VALID_REPORT,
      findings: [
        {
          findingId: 'FND-201',
          lensId: 'security-invariants',
          ruleId: 'SEC-SAFE-DESERIALIZATION',
          severity: 'low',
          confidence: 0.5,
          autofixClass: 'advisory',
          file: 'test.ts',
          message: 'Check eval',
          remediation: 'Remove eval',
          resolved: true,
        },
        {
          findingId: 'FND-201',
          lensId: 'architecture-boundaries',
          ruleId: 'ARCH-ACYCLIC-DEPENDENCIES',
          severity: 'low',
          confidence: 0.5,
          autofixClass: 'advisory',
          file: 'test2.ts',
          message: 'Check cyclic',
          remediation: 'Decouple',
          resolved: true,
        },
      ],
    };
    const res = validateCheckerReport(reportWithDuplicateFindings);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'DUPLICATE_FINDING_ID')).toBe(true);
  });

  it('calculates checker scoring accurately using calculateCheckerScoring', () => {
    const dims = {
      task_success: { raw: 2, weight: 0.3 },
      tool_use_quality: { raw: 1, weight: 0.15 },
      trajectory_compliance: { raw: 2, weight: 0.2 },
      hallucination: { raw: 2, weight: 0.15 },
      response_quality: { raw: 2, weight: 0.2 },
    };
    const scoring = calculateCheckerScoring(dims, [], { thresholdScore: 80 });
    // weightedRawScore = (2*0.3) + (1*0.15) + (2*0.2) + (2*0.15) + (2*0.2) = 0.6 + 0.15 + 0.4 + 0.3 + 0.4 = 1.85
    expect(scoring.weightedRawScore).toBe(1.85);
    // normalized = (1.85 / 2) * 100 = 92.5
    expect(scoring.normalizedScore).toBe(92.5);
    expect(scoring.gateAPassed).toBe(true);
    expect(scoring.gateBPassed).toBe(true);
  });

  it('runs all self-test scenarios cleanly', () => {
    const selfTest = runCheckerReportSelfTest();
    expect(selfTest.ok).toBe(true);
    expect(selfTest.testsPassed.length).toBe(5);
    expect(selfTest.testsFailed).toHaveLength(0);
  });
});
