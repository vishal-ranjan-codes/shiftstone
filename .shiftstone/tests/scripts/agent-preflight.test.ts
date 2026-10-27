import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  runPreflight,
  checkReceipt,
  PREFLIGHT_RECEIPT_FILENAME,
} from '../../scripts/agent-preflight.js';
import { checkAntiGaming } from '../../scripts/check-anti-gaming.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WORKSPACE_ROOT = path.resolve(SHIFTSTONE_ROOT, '..');
const FIXTURES_DIR = path.join(WORKSPACE_ROOT, '.shiftstone/tests/fixtures');

describe('Unit U12 — Preflight Gate & Anti-Gaming Integration with Plan Lifecycle (REQ-12)', () => {
  const syntheticSuiteDir = path.join(FIXTURES_DIR, 'mock-preflight-suite');
  const manifestPath = path.join(syntheticSuiteDir, 'plan-manifest.json');
  const testFilePath = path.join(syntheticSuiteDir, 'sample.test.ts');
  const receiptPath = path.join(WORKSPACE_ROOT, PREFLIGHT_RECEIPT_FILENAME);

  // Setup synthetic suite before tests
  const setupSyntheticSuite = () => {
    fs.mkdirSync(syntheticSuiteDir, { recursive: true });
    const manifest = {
      schema: 'plan-manifest/v1',
      suiteId: 'mock-preflight-suite',
      definitionRevision: 1,
      phases: [
        {
          phaseId: 'P1',
          contract: '.shiftstone/tests/fixtures/mock-preflight-suite/stage.md',
          unitIds: ['U1'],
          dependsOn: [],
          sourcePaths: [
            '.shiftstone/tests/fixtures/mock-preflight-suite/sample.ts',
            '.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts',
          ],
          checks: [
            {
              id: 'unit-check',
              acceptanceIds: ['AC-U1-01'],
              level: 1,
              kind: 'automated',
              required: true,
              regressionFor: [],
              sourcePaths: ['.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts'],
              environmentKeys: [],
              runner: {
                executable: 'node',
                args: ['.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts'],
                cwd: '.',
              },
            },
          ],
          requiredReview: false,
          humanApprovalRequired: false,
          recovery: {
            retry: 're-run',
            rollback: 'git checkout',
          },
        },
      ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    fs.writeFileSync(
      testFilePath,
      `it('adds numbers', () => { expect(1 + 1).toBe(2); });\n`,
      'utf8'
    );
  };

  const cleanupSyntheticSuite = () => {
    if (fs.existsSync(receiptPath)) {
      try {
        fs.unlinkSync(receiptPath);
      } catch {}
    }
    if (fs.existsSync(syntheticSuiteDir)) {
      try {
        fs.rmSync(syntheticSuiteDir, { recursive: true, force: true });
      } catch {}
    }
  };

  it('TS-U12-01 (L1) & AC-U12-01..02: agent-preflight.js issues valid receipt when target files match active phase scope', () => {
    setupSyntheticSuite();
    try {
      const res = runPreflight({
        root: WORKSPACE_ROOT,
        suite: '.shiftstone/tests/fixtures/mock-preflight-suite',
        phase: 'P1',
        target: '.shiftstone/tests/fixtures/mock-preflight-suite/sample.ts',
        verifyCmd: 'node .shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts',
      });

      expect(res.ok).toBe(true);
      expect(res.receipt).toBeDefined();
      expect(res.receipt.planSuite).toBe('.shiftstone/tests/fixtures/mock-preflight-suite');
      expect(res.receipt.targetPhase).toBe('P1');
      expect(res.receipt.planningDefinitionHash).toMatch(/^[a-f0-9]{64}$/);

      // Verify receipt on disk
      const receiptCheck = checkReceipt(
        '.shiftstone/tests/fixtures/mock-preflight-suite/sample.ts',
        WORKSPACE_ROOT
      );
      expect(receiptCheck.ok).toBe(true);
      expect(receiptCheck.receipt.targetPhase).toBe('P1');
      expect(receiptCheck.receipt.planSuite).toBe(
        '.shiftstone/tests/fixtures/mock-preflight-suite'
      );
    } finally {
      cleanupSyntheticSuite();
    }
  });

  it('TS-U12-02 (L2): Negative test asserts preflight blocks when target file is outside declared phase.sourcePaths', () => {
    setupSyntheticSuite();
    try {
      const res = runPreflight({
        root: WORKSPACE_ROOT,
        suite: '.shiftstone/tests/fixtures/mock-preflight-suite',
        phase: 'P1',
        target: 'some/unauthorized/outside/path.ts',
        verifyCmd: 'npm test',
      });

      expect(res.ok).toBe(false);
      expect(res.code).toMatch(/TARGET_OUTSIDE_PHASE_SCOPE|PREFLIGHT_GATE_FAILED/);
      expect(
        res.violations.some((v: string) => v.toLowerCase().includes('outside declared phase'))
      ).toBe(true);
    } finally {
      cleanupSyntheticSuite();
    }
  });

  it('TS-U12-03 (L2) & AC-U12-03: Anti-gaming test asserts modifying/weakening test assertion in manifest check triggers error', () => {
    setupSyntheticSuite();
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Scenario A: Commenting out an assertion in a manifest check test
      const commentedOutDiff = `
diff --git a/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts b/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
--- a/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
+++ b/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
@@ -1,1 +1,1 @@
-it('adds numbers', () => { expect(1 + 1).toBe(2); });
+// it('adds numbers', () => { expect(1 + 1).toBe(2); });
`;
      const resA = checkAntiGaming({
        root: WORKSPACE_ROOT,
        diff: commentedOutDiff,
        manifest,
        hasApproval: false,
      });

      expect(resA.ok).toBe(false);
      expect(
        resA.violations.some(
          (v) =>
            v.code === 'MANIFEST_CHECK_TEST_COMMENTED_OUT' ||
            v.code === 'MANIFEST_CHECK_TEST_WEAKENED' ||
            v.code === 'ASSERTION_COUNT_REGRESSION'
        )
      ).toBe(true);

      // Scenario B: Skipping a test in a manifest check test file
      const skippedDiff = `
diff --git a/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts b/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
--- a/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
+++ b/.shiftstone/tests/fixtures/mock-preflight-suite/sample.test.ts
@@ -1,1 +1,1 @@
-it('adds numbers', () => { expect(1 + 1).toBe(2); });
+it.skip('adds numbers', () => { expect(1 + 1).toBe(2); });
`;
      const resB = checkAntiGaming({
        root: WORKSPACE_ROOT,
        diff: skippedDiff,
        manifest,
        hasApproval: false,
      });

      expect(resB.ok).toBe(false);
      expect(
        resB.violations.some(
          (v) =>
            v.code === 'MANIFEST_CHECK_TEST_SKIPPED' ||
            v.code === 'TEST_BYPASS_MODIFIER_DETECTED'
        )
      ).toBe(true);
    } finally {
      cleanupSyntheticSuite();
    }
  });
});
