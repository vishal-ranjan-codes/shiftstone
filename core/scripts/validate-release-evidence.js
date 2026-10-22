#!/usr/bin/env node
/**
 * Release Evidence Certification Validator (UG-25 / Phase 6 Unit U26)
 *
 * Enforces:
 *   1. Release bundles adhere to release-evidence.schema.json (release-evidence/v1).
 *   2. Verification ladder L1–L3 gates have status: "passed".
 *   3. L4_checkerReportId points to an existing, valid Checker report with status: "APPROVED".
 *   4. L5_approvalId points to an active, non-expired human approval in core/governance/approvals/.
 *   5. trialsSummary requires exactly 3 harness trials and 6 factory trials passed for certification.
 *   6. openCriticalBugs === 0, cross-checked against docs/bugs/open-bugs.md.
 *   7. status === "CERTIFIED" required for production release.
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateApproval, loadApprovals } from './validate-protected-actions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const RELEASE_VERSION_PATTERN = /^v?[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.]+)?$/;
export const CHECKER_REPORT_ID_PATTERN = /^(CR|RPT)-[0-9A-Za-z_-]+$/;
export const APPROVAL_ID_PATTERN = /^APR-[0-9]{8}-[0-9]{3}$/;

export const REQUIRED_HARNESS_TRIALS = 3;
export const REQUIRED_FACTORY_TRIALS = 6;

/**
 * Parses docs/bugs/open-bugs.md and counts open bugs by severity.
 */
export function countOpenBugsInMarkdown(content) {
  if (!content || typeof content !== 'string') {
    return { totalOpen: 0, criticalOpen: 0, bugs: [] };
  }

  const lines = content.split('\n');
  const bugs = [];
  let tableStarted = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    // Check for header or separator row
    if (trimmed.includes('Bug ID') || trimmed.includes('---')) {
      tableStarted = true;
      continue;
    }

    if (!tableStarted) continue;

    // Extract table cells
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.length >= 4) {
      const bugId = cells[0];
      const title = cells[1];
      const status = cells[2]?.toLowerCase() ?? '';
      const severity = cells[3]?.toLowerCase() ?? '';

      // Skip empty rows or stubs
      if (!bugId || bugId.startsWith('BUG-XXX') || bugId.includes('...')) continue;

      const isResolved = ['resolved', 'closed', 'fixed', 'wontfix', 'done'].includes(status);
      const isCritical = severity.includes('critical');

      bugs.push({ bugId, title, status, severity, isOpen: !isResolved, isCritical });
    }
  }

  const openBugs = bugs.filter((b) => b.isOpen);
  const criticalOpen = openBugs.filter((b) => b.isCritical).length;

  return {
    totalOpen: openBugs.length,
    criticalOpen,
    bugs: openBugs,
  };
}

/**
 * Searches reports directory for checker report matching reportId.
 */
export function findCheckerReport(reportId, searchDirs = []) {
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = findCheckerReport(reportId, [fullPath]);
        if (nested) return nested;
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        try {
          const content = JSON.parse(readFileSync(fullPath, 'utf8'));
          if (content.reportId === reportId) {
            return { fullPath, report: content };
          }
        } catch {
          // ignore invalid json
        }
      }
    }
  }
  return null;
}

/**
 * Validates a single release evidence bundle against all Phase 6 criteria.
 */
export function validateReleaseEvidence(bundle, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];

  if (!bundle || typeof bundle !== 'object') {
    return {
      ok: false,
      violations: [{ code: 'INVALID_BUNDLE', message: 'Release evidence must be a JSON object' }],
    };
  }

  // 1. schemaVersion
  if (bundle.schemaVersion !== 'release-evidence/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion must be 'release-evidence/v1', got '${bundle.schemaVersion}'`,
    });
  }

  // 2. releaseVersion
  if (!bundle.releaseVersion || typeof bundle.releaseVersion !== 'string' || !RELEASE_VERSION_PATTERN.test(bundle.releaseVersion)) {
    violations.push({
      code: 'INVALID_RELEASE_VERSION',
      message: `releaseVersion must be semver formatted (e.g. v2.1.0), got '${bundle.releaseVersion}'`,
    });
  }

  // 3. gitCommitHash
  if (!bundle.gitCommitHash || typeof bundle.gitCommitHash !== 'string' || bundle.gitCommitHash.trim().length < 7) {
    violations.push({
      code: 'INVALID_GIT_COMMIT_HASH',
      message: 'gitCommitHash must be at least 7 characters long',
    });
  }

  // 4. timestamp
  if (!bundle.timestamp || isNaN(Date.parse(bundle.timestamp))) {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      message: `timestamp must be a valid ISO-8601 string, got '${bundle.timestamp}'`,
    });
  }

  // 5. verificationLadder
  const vl = bundle.verificationLadder;
  if (!vl || typeof vl !== 'object') {
    violations.push({
      code: 'MISSING_VERIFICATION_LADDER',
      message: 'verificationLadder object is required',
    });
  } else {
    // L1 (Typecheck, Lint, Formatter)
    if (!vl.L1 || vl.L1.status !== 'passed') {
      violations.push({
        code: 'FAILED_GATE_L1',
        message: `verificationLadder.L1 must have status: 'passed', got '${vl.L1?.status}'`,
      });
    }

    // L1_5_antiGaming
    if (!vl.L1_5_antiGaming || vl.L1_5_antiGaming.status !== 'passed') {
      violations.push({
        code: 'FAILED_GATE_L1_5',
        message: `verificationLadder.L1_5_antiGaming must have status: 'passed', got '${vl.L1_5_antiGaming?.status}'`,
      });
    }

    // L2 (Unit/Integration Tests)
    if (!vl.L2 || vl.L2.status !== 'passed') {
      violations.push({
        code: 'FAILED_GATE_L2',
        message: `verificationLadder.L2 must have status: 'passed', got '${vl.L2?.status}'`,
      });
    }

    // L3 (Build/Smoke)
    if (!vl.L3 || vl.L3.status !== 'passed') {
      violations.push({
        code: 'FAILED_GATE_L3',
        message: `verificationLadder.L3 must have status: 'passed', got '${vl.L3?.status}'`,
      });
    }

    // L4_checkerReportId
    if (!vl.L4_checkerReportId || typeof vl.L4_checkerReportId !== 'string' || !CHECKER_REPORT_ID_PATTERN.test(vl.L4_checkerReportId)) {
      violations.push({
        code: 'INVALID_L4_CHECKER_REPORT_ID',
        message: `verificationLadder.L4_checkerReportId must match pattern ^(CR|RPT)-[0-9A-Za-z_-]+$, got '${vl.L4_checkerReportId}'`,
      });
    } else {
      // Cross-check checker report
      let checkerReport = null;
      if (options.checkerReports) {
        checkerReport = options.checkerReports.find((r) => r.reportId === vl.L4_checkerReportId);
      } else {
        const searchDirs = [
          path.join(root, 'docs', 'reports'),
          path.join(root, 'core', 'reports'),
        ];
        const found = findCheckerReport(vl.L4_checkerReportId, searchDirs);
        if (found) checkerReport = found.report;
      }

      if (!checkerReport) {
        violations.push({
          code: 'MISSING_CHECKER_REPORT',
          message: `L4 checker report '${vl.L4_checkerReportId}' not found on disk`,
        });
      } else if (checkerReport.status !== 'APPROVED') {
        violations.push({
          code: 'UNAPPROVED_CHECKER_REPORT',
          message: `L4 checker report '${vl.L4_checkerReportId}' has status '${checkerReport.status}', must be 'APPROVED'`,
        });
      }
    }

    // L5_approvalId
    if (!vl.L5_approvalId || typeof vl.L5_approvalId !== 'string' || !APPROVAL_ID_PATTERN.test(vl.L5_approvalId)) {
      violations.push({
        code: 'INVALID_L5_APPROVAL_ID',
        message: `verificationLadder.L5_approvalId must match pattern ^APR-[0-9]{8}-[0-9]{3}$, got '${vl.L5_approvalId}'`,
      });
    } else {
      // Cross-check L5 human approval
      let approval = null;
      if (options.approvals) {
        approval = options.approvals.find((a) => (a.data?.approvalId ?? a.approvalId) === vl.L5_approvalId);
        if (approval && approval.data) approval = approval.data;
      } else {
        const approvalsDir = path.join(root, 'core', 'governance', 'approvals');
        const loaded = loadApprovals(approvalsDir);
        const match = loaded.find((a) => a.data?.approvalId === vl.L5_approvalId);
        if (match) approval = match.data;
      }

      if (!approval) {
        violations.push({
          code: 'MISSING_L5_APPROVAL',
          message: `L5 human approval '${vl.L5_approvalId}' not found in core/governance/approvals/`,
        });
      } else {
        const appVal = validateApproval(approval, {
          now: options.now ? new Date(options.now) : new Date(),
          checkExpiration: true,
        });
        if (!appVal.ok) {
          violations.push({
            code: 'INVALID_L5_APPROVAL',
            message: `L5 approval '${vl.L5_approvalId}' failed validation: ${appVal.violations.map((v) => v.message).join('; ')}`,
          });
        } else if (approval.status !== 'active') {
          violations.push({
            code: 'INVALID_L5_APPROVAL_STATUS',
            message: `L5 approval '${vl.L5_approvalId}' must be 'active', got '${approval.status}'`,
          });
        }
      }
    }
  }

  // 6. trialsSummary
  const ts = bundle.trialsSummary;
  if (!ts || typeof ts !== 'object') {
    violations.push({
      code: 'MISSING_TRIALS_SUMMARY',
      message: 'trialsSummary object is required',
    });
  } else {
    if (ts.harnessTrialsPassed !== REQUIRED_HARNESS_TRIALS) {
      violations.push({
        code: 'INCOMPLETE_HARNESS_TRIALS',
        message: `harnessTrialsPassed must be exactly ${REQUIRED_HARNESS_TRIALS}, got ${ts.harnessTrialsPassed}`,
      });
    }
    if (ts.factoryTrialsPassed !== REQUIRED_FACTORY_TRIALS) {
      violations.push({
        code: 'INCOMPLETE_FACTORY_TRIALS',
        message: `factoryTrialsPassed must be exactly ${REQUIRED_FACTORY_TRIALS}, got ${ts.factoryTrialsPassed}`,
      });
    }
  }

  // 7. openCriticalBugs & Registry Cross-Check
  if (typeof bundle.openCriticalBugs !== 'number' || bundle.openCriticalBugs !== 0) {
    violations.push({
      code: 'OPEN_CRITICAL_BUGS',
      message: `openCriticalBugs must be 0 for certified release, got ${bundle.openCriticalBugs}`,
    });
  }

  // Cross-check docs/bugs/open-bugs.md
  const bugsPath = options.bugsPath ?? path.join(root, 'docs', 'bugs', 'open-bugs.md');
  if (existsSync(bugsPath)) {
    const bugContent = readFileSync(bugsPath, 'utf8');
    const { criticalOpen } = countOpenBugsInMarkdown(bugContent);
    if (criticalOpen > 0) {
      violations.push({
        code: 'CRITICAL_BUGS_IN_REGISTRY',
        message: `docs/bugs/open-bugs.md contains ${criticalOpen} open critical bug(s); release cannot be certified`,
      });
    }
  }

  // 8. status
  if (bundle.status !== 'CERTIFIED') {
    violations.push({
      code: 'STATUS_NOT_CERTIFIED',
      message: `status must be 'CERTIFIED', got '${bundle.status}'`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Self-test suite.
 */
export function runSelfTest(root = ROOT) {
  const testNow = new Date('2026-10-21T12:00:00.000Z');

  const validApproval = {
    schemaVersion: 'protected-action-approval/v1',
    approvalId: 'APR-20261021-999',
    actionClass: 'production-deploy',
    scopePaths: ['*'],
    gitTreeHash: 'workspace-head',
    approver: 'release-manager@shiftstone.dev',
    approvedAt: '2026-10-21T10:00:00.000Z',
    expiresAt: '2026-10-22T10:00:00.000Z',
    justification: 'v2.1.0 release sign-off',
    status: 'active',
  };

  const validCheckerReport = {
    schemaVersion: 'checker-report/v1',
    reportId: 'CR-20261021-001',
    status: 'APPROVED',
    normalizedScore: 92,
  };

  const baseBundle = {
    schemaVersion: 'release-evidence/v1',
    releaseVersion: 'v2.1.0',
    gitCommitHash: '9f8b3c4a2d1e0f9b8a7c6d5e4f3a2b1c0d9e8f7a',
    timestamp: '2026-10-21T12:00:00.000Z',
    verificationLadder: {
      L1: { status: 'passed', command: 'pnpm typecheck && pnpm lint' },
      L1_5_antiGaming: { status: 'passed', details: 'Zero deleted tests or dropped assertions' },
      L2: { status: 'passed', command: 'pnpm test' },
      L3: { status: 'passed', command: 'pnpm build' },
      L4_checkerReportId: 'CR-20261021-001',
      L5_approvalId: 'APR-20261021-999',
    },
    trialsSummary: {
      harnessTrialsPassed: 3,
      factoryTrialsPassed: 6,
    },
    openCriticalBugs: 0,
    status: 'CERTIFIED',
  };

  // 1. Valid bundle passes
  const validRes = validateReleaseEvidence(baseBundle, {
    root,
    now: testNow,
    approvals: [validApproval],
    checkerReports: [validCheckerReport],
  });
  if (!validRes.ok) {
    throw new Error(`Self-test failed: valid bundle should pass, got ${JSON.stringify(validRes.violations)}`);
  }

  // 2. Open critical bugs fails
  const bugBundle = { ...baseBundle, openCriticalBugs: 1 };
  const bugRes = validateReleaseEvidence(bugBundle, {
    root,
    now: testNow,
    approvals: [validApproval],
    checkerReports: [validCheckerReport],
  });
  if (bugRes.ok || !bugRes.violations.some((v) => v.code === 'OPEN_CRITICAL_BUGS')) {
    throw new Error('Self-test failed: openCriticalBugs: 1 must fail validation');
  }

  // 3. REVISE checker report fails
  const reviseReport = { ...validCheckerReport, status: 'REVISE' };
  const reviseRes = validateReleaseEvidence(baseBundle, {
    root,
    now: testNow,
    approvals: [validApproval],
    checkerReports: [reviseReport],
  });
  if (reviseRes.ok || !reviseRes.violations.some((v) => v.code === 'UNAPPROVED_CHECKER_REPORT')) {
    throw new Error('Self-test failed: REVISE checker report must fail validation');
  }

  // 4. Incomplete trials fails
  const trialBundle = {
    ...baseBundle,
    trialsSummary: { harnessTrialsPassed: 2, factoryTrialsPassed: 6 },
  };
  const trialRes = validateReleaseEvidence(trialBundle, {
    root,
    now: testNow,
    approvals: [validApproval],
    checkerReports: [validCheckerReport],
  });
  if (trialRes.ok || !trialRes.violations.some((v) => v.code === 'INCOMPLETE_HARNESS_TRIALS')) {
    throw new Error('Self-test failed: incomplete harness trials must fail validation');
  }

  // 5. Missing L5 approval fails
  const missingL5Res = validateReleaseEvidence(baseBundle, {
    root,
    now: testNow,
    approvals: [],
    checkerReports: [validCheckerReport],
  });
  if (missingL5Res.ok || !missingL5Res.violations.some((v) => v.code === 'MISSING_L5_APPROVAL')) {
    throw new Error('Self-test failed: missing L5 approval must fail validation');
  }

  return true;
}

// CLI Execution
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const selfTest = args.includes('--self-test');

  if (selfTest) {
    try {
      runSelfTest();
      console.log('PASS: validate-release-evidence --self-test completed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('FAIL: validate-release-evidence --self-test failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  // Default mode: validate all bundles in docs/reports/release-evidence/
  const releasesDir = path.join(ROOT, 'docs', 'reports', 'release-evidence');
  if (!existsSync(releasesDir)) {
    console.log(`No release bundles found in ${releasesDir} (clean).`);
    process.exit(0);
  }

  const files = readdirSync(releasesDir).filter((f) => f.endsWith('.json') && f.startsWith('REL-'));
  if (files.length === 0) {
    console.log(`No release bundles found in ${releasesDir} (clean).`);
    process.exit(0);
  }

  let hasErrors = false;
  console.log(`=== Release Evidence Certification Report ===`);
  for (const file of files) {
    const fullPath = path.join(releasesDir, file);
    try {
      const bundle = JSON.parse(readFileSync(fullPath, 'utf8'));
      const val = validateReleaseEvidence(bundle);
      if (!val.ok) {
        hasErrors = true;
        console.error(`FAIL: ${file}`);
        for (const v of val.violations) {
          console.error(`  [${v.code}] ${v.message}`);
        }
      } else {
        console.log(`ok: ${file} (Version: ${bundle.releaseVersion} - Status: ${bundle.status})`);
      }
    } catch (err) {
      hasErrors = true;
      console.error(`FAIL: ${file} - invalid JSON: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }
  console.log('ok — All release evidence bundles pass certification validation.');
  process.exit(0);
}
