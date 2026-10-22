import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateReleaseEvidence,
  countOpenBugsInMarkdown,
} from '../validate-release-evidence.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('Unit U26: Release Evidence Certification Schema & Validator (UG-25)', () => {
  const testNow = new Date('2026-10-21T12:00:00.000Z');

  const validApproval = {
    schemaVersion: 'protected-action-approval/v1',
    approvalId: 'APR-20261021-100',
    actionClass: 'production-deploy',
    scopePaths: ['*'],
    gitTreeHash: 'workspace-head',
    approver: 'release-lead@shiftstone.dev',
    approvedAt: '2026-10-21T10:00:00.000Z',
    expiresAt: '2026-10-22T10:00:00.000Z',
    justification: 'Release certification sign-off',
    status: 'active',
  };

  const validCheckerReport = {
    schemaVersion: 'checker-report/v1',
    reportId: 'CR-20261021-001',
    status: 'APPROVED',
    normalizedScore: 90,
  };

  const validBundle = {
    schemaVersion: 'release-evidence/v1',
    releaseVersion: 'v2.1.0',
    gitCommitHash: 'abcdef0123456789abcdef0123456789abcdef01',
    timestamp: '2026-10-21T12:00:00.000Z',
    verificationLadder: {
      L1: { status: 'passed', command: 'pnpm typecheck && pnpm lint' },
      L1_5_antiGaming: { status: 'passed', details: 'Zero deleted tests or bypass flags' },
      L2: { status: 'passed', command: 'pnpm test' },
      L3: { status: 'passed', command: 'pnpm build' },
      L4_checkerReportId: 'CR-20261021-001',
      L5_approvalId: 'APR-20261021-100',
    },
    trialsSummary: {
      harnessTrialsPassed: 3,
      factoryTrialsPassed: 6,
    },
    openCriticalBugs: 0,
    status: 'CERTIFIED',
  };

  it('TS-U26-01 (L2): passes on valid release evidence bundle', () => {
    const res = validateReleaseEvidence(validBundle, {
      root: ROOT,
      now: testNow,
      approvals: [validApproval],
      checkerReports: [validCheckerReport],
    });

    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('TS-U26-01 (L2): rejects bundle when openCriticalBugs > 0', () => {
    const invalid = {
      ...validBundle,
      openCriticalBugs: 1,
    };

    const res = validateReleaseEvidence(invalid, {
      root: ROOT,
      now: testNow,
      approvals: [validApproval],
      checkerReports: [validCheckerReport],
    });

    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'OPEN_CRITICAL_BUGS')).toBe(true);
  });

  it('TS-U26-01 (L2): rejects bundle when L4 checker report verdict is REVISE or REJECTED', () => {
    const reviseReport = {
      ...validCheckerReport,
      status: 'REVISE',
    };

    const res = validateReleaseEvidence(validBundle, {
      root: ROOT,
      now: testNow,
      approvals: [validApproval],
      checkerReports: [reviseReport],
    });

    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'UNAPPROVED_CHECKER_REPORT')).toBe(true);
  });

  it('rejects bundle when L5 human approval is missing or expired', () => {
    // 1. Missing approval
    const missingRes = validateReleaseEvidence(validBundle, {
      root: ROOT,
      now: testNow,
      approvals: [],
      checkerReports: [validCheckerReport],
    });
    expect(missingRes.ok).toBe(false);
    expect(missingRes.violations.some((v) => v.code === 'MISSING_L5_APPROVAL')).toBe(true);

    // 2. Expired approval
    const expiredApproval = {
      ...validApproval,
      expiresAt: '2026-10-20T10:00:00.000Z',
    };
    const expiredRes = validateReleaseEvidence(validBundle, {
      root: ROOT,
      now: testNow,
      approvals: [expiredApproval],
      checkerReports: [validCheckerReport],
    });
    expect(expiredRes.ok).toBe(false);
    expect(expiredRes.violations.some((v) => v.code === 'INVALID_L5_APPROVAL')).toBe(true);
  });

  it('rejects bundle when trialsSummary does not satisfy 3 harness and 6 factory trials', () => {
    const incompleteTrials = {
      ...validBundle,
      trialsSummary: {
        harnessTrialsPassed: 2, // Must be 3
        factoryTrialsPassed: 6,
      },
    };

    const res = validateReleaseEvidence(incompleteTrials, {
      root: ROOT,
      now: testNow,
      approvals: [validApproval],
      checkerReports: [validCheckerReport],
    });

    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'INCOMPLETE_HARNESS_TRIALS')).toBe(true);
  });

  it('parses markdown open bugs table accurately', () => {
    const mockBugMarkdown = `
# Open Bugs
| Bug ID | Title | Status | Severity | Date Captured |
|---|---|---|---|---|
| BUG-001 | Auth redirect loop | open | critical | 2026-10-20 |
| BUG-002 | Typo in button | open | low | 2026-10-20 |
| BUG-003 | Deprecated import | resolved | critical | 2026-10-19 |
`;

    const parsed = countOpenBugsInMarkdown(mockBugMarkdown);
    expect(parsed.totalOpen).toBe(2);
    expect(parsed.criticalOpen).toBe(1);
    expect(parsed.bugs[0].bugId).toBe('BUG-001');
  });
});
