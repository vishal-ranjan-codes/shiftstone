import { describe, expect, it } from 'vitest';
import {
  checkAntiGaming,
  parseGitDiff,
  runAntiGamingSelfTest,
} from '../check-anti-gaming.js';
import {
  resolveCheckerLenses,
  runAntiGamingGate,
  validateLevel4CheckerReport,
} from '../../harness/loop-runner/validator.ts';

describe('Unit U19: check-anti-gaming & loop-runner wiring (UG-18, UG-19)', () => {
  it('accepts a clean, non-gaming git diff', () => {
    const diff = `
diff --git a/app/components/button.tsx b/app/components/button.tsx
--- a/app/components/button.tsx
+++ b/app/components/button.tsx
@@ -1,3 +1,4 @@
 export function Button() {
+  return <button className="btn">Click</button>;
 }
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('TS-U19-01 (L2): blocks synthetic git diff containing it.skip(', () => {
    const diff = `
diff --git a/core/tests/feature.test.ts b/core/tests/feature.test.ts
--- a/core/tests/feature.test.ts
+++ b/core/tests/feature.test.ts
@@ -10,3 +10,3 @@
-it('runs critical verification', () => {
+it.skip('runs critical verification', () => {
   expect(true).toBe(true);
 });
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'TEST_BYPASS_MODIFIER_DETECTED')).toBe(true);
    expect(res.violations[0].line).toContain('it.skip');
  });

  it('TS-U19-01 (L2): blocks synthetic git diff containing // @ts-ignore', () => {
    const diff = `
diff --git a/app/services/api.ts b/app/services/api.ts
--- a/app/services/api.ts
+++ b/app/services/api.ts
@@ -20,2 +20,3 @@
 export function fetchData() {
+  // @ts-ignore ignore type error
   return window.unknownApi();
 }
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'SUPPRESSION_DIRECTIVE_DETECTED')).toBe(true);
    expect(res.violations[0].line).toContain('@ts-ignore');
  });

  it('TS-U19-01 (L2): blocks net deleted test assertions without approval', () => {
    const diff = `
diff --git a/core/tests/suite.test.ts b/core/tests/suite.test.ts
--- a/core/tests/suite.test.ts
+++ b/core/tests/suite.test.ts
@@ -1,10 +1,4 @@
 describe('suite', () => {
-  it('first check', () => { expect(1).toBe(1); });
-  it('second check', () => { expect(2).toBe(2); });
-  it('third check', () => { expect(3).toBe(3); });
+  it('only remaining check', () => { expect(1).toBe(1); });
 });
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'ASSERTION_COUNT_REGRESSION')).toBe(true);
  });

  it('allows net assertion deletion when governance approval is active', () => {
    const diff = `
diff --git a/core/tests/suite.test.ts b/core/tests/suite.test.ts
--- a/core/tests/suite.test.ts
+++ b/core/tests/suite.test.ts
@@ -1,10 +1,4 @@
 describe('suite', () => {
-  it('deprecated check', () => { expect(1).toBe(1); });
-  it('another deprecated check', () => { expect(2).toBe(2); });
+  it('new check', () => { expect(1).toBe(1); });
 });
`;
    const res = checkAntiGaming({ diff, hasApproval: true });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('blocks deleted test files without approval', () => {
    const diff = `
diff --git a/core/tests/old-feature.test.ts b/core/tests/old-feature.test.ts
deleted file mode 100644
--- a/core/tests/old-feature.test.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-it('old feature', () => {
-  expect(true).toBe(true);
-});
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'TEST_FILE_DELETION')).toBe(true);
  });

  it('blocks modification to protected configs without authorization', () => {
    const diff = `
diff --git a/core/vitest.config.ts b/core/vitest.config.ts
--- a/core/vitest.config.ts
+++ b/core/vitest.config.ts
@@ -5,2 +5,3 @@
 export default defineConfig({
+  test: { bail: 1 },
 });
`;
    const res = checkAntiGaming({ diff });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'HARNESS_CONFIG_TAMPERING')).toBe(true);
  });

  it('runs all self-test scenarios cleanly', () => {
    const selfTest = runAntiGamingSelfTest();
    expect(selfTest.ok).toBe(true);
    expect(selfTest.testsPassed.length).toBe(6);
    expect(selfTest.testsFailed).toHaveLength(0);
  });

  it('TS-U19-02 (L2): wires Level 1.5 anti-gaming gate into loop-runner validator.ts', () => {
    const gamingDiff = `
diff --git a/core/tests/foo.test.ts b/core/tests/foo.test.ts
--- a/core/tests/foo.test.ts
+++ b/core/tests/foo.test.ts
@@ -1,2 +1,2 @@
-it('test', () => { expect(1).toBe(1); });
+it.only('test', () => { expect(1).toBe(1); });
`;
    const result = runAntiGamingGate({ diff: gamingDiff });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.code === 'TEST_BYPASS_MODIFIER_DETECTED')).toBe(true);
  });

  it('TS-U19-02 (L2): wires Level 4 Two-Gate Checker report validator into loop-runner validator.ts', () => {
    const badReport = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-TEST-001',
      timestamp: '2026-10-21T12:00:00.000Z',
      targetId: 'STAGE-01',
      makerAgentId: 'agent-1',
      reviewerAgentId: 'agent-1', // Collusion
      contextIsolation: 'disjoint',
      executionMode: 'full',
      autofixPolicy: 'report-only',
      lensesApplied: ['security-invariants'],
      dimensions: {
        task_success: { raw: 2, weight: 0.3, weighted: 0.6, rationale: 'ok' },
        tool_use_quality: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'ok' },
        trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'ok' },
        hallucination: { raw: 2, weight: 0.15, weighted: 0.3, rationale: 'ok' },
        response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'ok' },
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

    const res = validateLevel4CheckerReport(badReport);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'COLLUSION_DETECTED')).toBe(true);
  });

  it('TS-U19-02 (L2): wires conditional lens resolver into loop-runner validator.ts', () => {
    const matched = resolveCheckerLenses(['app/routes/users.tsx', 'supabase/migrations/01_init.sql']);
    expect(matched.length).toBeGreaterThan(0);
    const lensIds = matched.map((l: any) => l.lensId);
    expect(lensIds).toContain('route-loader-action');
    expect(lensIds).toContain('rls-security');
  });
});
