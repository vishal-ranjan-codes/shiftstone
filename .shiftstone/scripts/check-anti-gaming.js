#!/usr/bin/env node
/**
 * Pre-Commit & Loop Anti-Gaming Gate (UG-18, UG-19 / Level 1.5 Gate / REM-15 / Phase 4 Unit U19)
 *
 * Enforces:
 *   1. Test Deletion / Assertion Regression: No test files deleted or net assertion reduction
 *      (it, test, expect) without explicit governance override.
 *   2. Test Bypass Modifiers: Blocks .skip, .only, test.todo, it.todo, xdescribe, xit.
 *   3. Typechecker & Linter Suppression: Blocks @ts-ignore, eslint-disable, biome-ignore.
 *   4. Harness & Config Tampering: Blocks unauthorized modification of test runner configs,
 *      tsconfig, or governance schemas.
 *
 * Supports --self-test flag. Exit code 0 on pass; exit code 1 on defect.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const TEST_FILE_PATTERN = /(?:^|[\\/])(?:tests?|__tests__)[\\/]|\.(?:test|spec)\.[jt]sx?$/i;
const PROTECTED_CONFIG_PATTERN = /(?:vitest\.config\.[a-z0-9]+|playwright\.config\.[a-z0-9]+|tsconfig.*\.json|core[\\/]governance[\\/]schemas[\\/].+\.schema\.json)$/i;
const CODE_FILE_PATTERN = /\.(?:[jt]sx?|[mc][jt]s|vue|svelte)$/i;

const BYPASS_MODIFIER_PATTERNS = [
  { pattern: /\.(?:skip|only)\s*\(/, name: '.skip() / .only()' },
  { pattern: /\b(?:test|it)\.todo\s*\(/, name: 'test.todo() / it.todo()' },
  { pattern: /\b(?:xdescribe|xit|xtest)\s*\(/, name: 'xdescribe() / xit() / xtest()' },
];

const SUPPRESSION_PATTERNS = [
  { pattern: /@ts-ignore\b/, name: '@ts-ignore' },
  { pattern: /eslint-disable\b/, name: 'eslint-disable' },
  { pattern: /biome-ignore\b/, name: 'biome-ignore' },
];

/**
 * Checks if an active governance approval is present in .shiftstone/governance/approvals/.
 */
export function hasActiveGovernanceApproval(root = ROOT) {
  const approvalsDir = path.join(root, '.shiftstone', 'governance', 'approvals');
  if (!existsSync(approvalsDir)) return false;

  try {
    const files = readdirSync(approvalsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = readFileSync(path.join(approvalsDir, file), 'utf8');
        const parsed = JSON.parse(content);
        if (
          parsed.actionClass === 'core-governance-override' &&
          (parsed.status === 'active' || parsed.status === 'approved') &&
          (!parsed.expiresAt || new Date(parsed.expiresAt) > new Date())
        ) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Parses a unified git diff into file-level hunk records.
 */
export function parseGitDiff(diffText) {
  const files = [];
  if (!diffText || typeof diffText !== 'string') return files;

  const rawFileChunks = diffText.split(/^diff --git /m);

  for (const chunk of rawFileChunks) {
    if (!chunk.trim()) continue;

    const lines = chunk.split(/\r?\n/);
    const headerLine = lines[0] || '';
    const fileMatch = headerLine.match(/a\/(.+?)\s+b\/(.+)/);
    const srcPath = fileMatch ? fileMatch[1] : '';
    const dstPath = fileMatch ? fileMatch[2] : '';

    const isDeleted =
      chunk.includes('deleted file mode') ||
      chunk.includes('+++ /dev/null') ||
      (dstPath === '/dev/null');

    const addedLines = [];
    const removedLines = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) {
        addedLines.push(line.slice(1));
      } else if (line.startsWith('-')) {
        removedLines.push(line.slice(1));
      }
    }

    files.push({
      srcPath,
      dstPath,
      filePath: isDeleted ? srcPath : (dstPath || srcPath),
      isDeleted,
      addedLines,
      removedLines,
    });
  }

  return files;
}

/**
 * Inspects a unified git diff and reports anti-gaming violations.
 */
export function checkAntiGaming(options = {}) {
  const violations = [];
  const root = options.root ? path.resolve(options.root) : ROOT;
  const diffText = options.diff !== undefined ? options.diff : getGitDiff(root);
  const diffFiles = parseGitDiff(diffText);
  const hasApproval =
    options.hasApproval ??
    (options.diff !== undefined && options.root === undefined
      ? false
      : hasActiveGovernanceApproval(root));
  const allowConfigMutation = options.allowConfigMutation ?? false;

  let totalAddedAssertions = 0;
  let totalRemovedAssertions = 0;

  for (const file of diffFiles) {
    const isTestFile = TEST_FILE_PATTERN.test(file.filePath);
    const isProtectedConfig = PROTECTED_CONFIG_PATTERN.test(file.filePath);

    // 1. Test File Deletion
    if (file.isDeleted && isTestFile) {
      if (!hasApproval) {
        violations.push({
          code: 'TEST_FILE_DELETION',
          file: file.filePath,
          message: `Test file "${file.filePath}" was deleted without core-governance-override approval`,
        });
      }
    }

    // 2. Harness & Config Tampering
    if (isProtectedConfig && !allowConfigMutation && !hasApproval) {
      violations.push({
        code: 'HARNESS_CONFIG_TAMPERING',
        file: file.filePath,
        message: `Protected configuration/schema file "${file.filePath}" modified without authorization`,
      });
    }

    // Assertion count tracking for test files
    if (isTestFile && !file.isDeleted) {
      for (const line of file.addedLines) {
        const matches = line.match(/\b(?:it|test|expect)\s*\(/g);
        if (matches) totalAddedAssertions += matches.length;
      }
      for (const line of file.removedLines) {
        const matches = line.match(/\b(?:it|test|expect)\s*\(/g);
        if (matches) totalRemovedAssertions += matches.length;
      }
    }

    const isCodeFile = CODE_FILE_PATTERN.test(file.filePath);

    // 3. Test Bypass Modifiers (in code files, especially tests)
    if (isCodeFile) {
      for (const line of file.addedLines) {
        for (const bypass of BYPASS_MODIFIER_PATTERNS) {
          if (bypass.pattern.test(line)) {
            violations.push({
              code: 'TEST_BYPASS_MODIFIER_DETECTED',
              file: file.filePath,
              line: line.trim(),
              message: `Added prohibited test bypass modifier "${bypass.name}": "${line.trim()}"`,
            });
          }
        }

        // 4. Typechecker & Linter Suppression Directives
        for (const supp of SUPPRESSION_PATTERNS) {
          if (supp.pattern.test(line)) {
            violations.push({
              code: 'SUPPRESSION_DIRECTIVE_DETECTED',
              file: file.filePath,
              line: line.trim(),
              message: `Added prohibited suppression directive "${supp.name}": "${line.trim()}"`,
            });
          }
        }

        // @ts-expect-error outside negative test paths
        if (/@ts-expect-error\b/.test(line) && !isTestFile) {
          violations.push({
            code: 'SUPPRESSION_DIRECTIVE_DETECTED',
            file: file.filePath,
            line: line.trim(),
            message: `Added @ts-expect-error outside designated test file: "${line.trim()}"`,
          });
        }
      }
    }
  }

  // Check Net Assertion Count Regression
  if (!hasApproval && totalRemovedAssertions > totalAddedAssertions) {
    violations.push({
      code: 'ASSERTION_COUNT_REGRESSION',
      message: `Net assertion reduction detected across test files (added: ${totalAddedAssertions}, removed: ${totalRemovedAssertions}, net: -${totalRemovedAssertions - totalAddedAssertions}) without approval`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
    filesInspected: diffFiles.length,
    assertions: {
      added: totalAddedAssertions,
      removed: totalRemovedAssertions,
    },
  };
}

/**
 * Gets the current git diff from working tree against HEAD, or staged diff.
 */
function getGitDiff(root) {
  try {
    const unstaged = execSync('git diff HEAD', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (unstaged && unstaged.trim().length > 0) return unstaged;
    const staged = execSync('git diff --cached', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return staged || '';
  } catch {
    return '';
  }
}

/**
 * Self-test suite verifying anti-gaming detection against synthetic diffs.
 */
export function runAntiGamingSelfTest() {
  const testsPassed = [];
  const testsFailed = [];

  // Scenario 1: Clean diff passes
  const cleanDiff = `
diff --git a/app/routes/profile.tsx b/app/routes/profile.tsx
index 1234567..89abcdef 100644
--- a/app/routes/profile.tsx
+++ b/app/routes/profile.tsx
@@ -10,3 +10,4 @@
 export function Profile() {
+  return <div>Profile Page</div>;
 }
`;
  const res1 = checkAntiGaming({ diff: cleanDiff });
  if (res1.ok && res1.violations.length === 0) {
    testsPassed.push('Clean Diff Accepted');
  } else {
    testsFailed.push(`Clean Diff Accepted: ${JSON.stringify(res1.violations)}`);
  }

  // Scenario 2: Test file deletion blocked
  const deleteTestDiff = `
diff --git a/.shiftstone/tests/auth.test.ts b/.shiftstone/tests/auth.test.ts
deleted file mode 100644
--- a/.shiftstone/tests/auth.test.ts
+++ /dev/null
@@ -1,10 +0,0 @@
-describe('auth', () => {
-  it('logs in', () => { expect(true).toBe(true); });
-});
`;
  const res2 = checkAntiGaming({ diff: deleteTestDiff, hasApproval: false });
  if (!res2.ok && res2.violations.some((v) => v.code === 'TEST_FILE_DELETION')) {
    testsPassed.push('Test File Deletion Blocked');
  } else {
    testsFailed.push('Test File Deletion Blocked failed to catch violation');
  }

  // Scenario 3: Test bypass modifier (.skip) blocked
  const skipDiff = `
diff --git a/.shiftstone/tests/login.test.ts b/.shiftstone/tests/login.test.ts
--- a/.shiftstone/tests/login.test.ts
+++ b/.shiftstone/tests/login.test.ts
@@ -5,3 +5,3 @@
-it('validates email', () => {
+it.skip('validates email', () => {
   expect(true).toBe(true);
 });
`;
  const res3 = checkAntiGaming({ diff: skipDiff, hasApproval: false });
  if (!res3.ok && res3.violations.some((v) => v.code === 'TEST_BYPASS_MODIFIER_DETECTED')) {
    testsPassed.push('Test Bypass Modifier (.skip) Blocked');
  } else {
    testsFailed.push('Test Bypass Modifier (.skip) Blocked failed to catch violation');
  }

  // Scenario 4: Suppression directive (@ts-ignore) blocked
  const tsIgnoreDiff = `
diff --git a/app/utils.ts b/app/utils.ts
--- a/app/utils.ts
+++ b/app/utils.ts
@@ -2,2 +2,3 @@
 function parse(val: any) {
+  // @ts-ignore
   return val.invalidProperty;
 }
`;
  const res4 = checkAntiGaming({ diff: tsIgnoreDiff, hasApproval: false });
  if (!res4.ok && res4.violations.some((v) => v.code === 'SUPPRESSION_DIRECTIVE_DETECTED')) {
    testsPassed.push('Suppression Directive (@ts-ignore) Blocked');
  } else {
    testsFailed.push('Suppression Directive (@ts-ignore) Blocked failed to catch violation');
  }

  // Scenario 5: Assertion regression blocked
  const regressionDiff = `
diff --git a/.shiftstone/tests/math.test.ts b/.shiftstone/tests/math.test.ts
--- a/.shiftstone/tests/math.test.ts
+++ b/.shiftstone/tests/math.test.ts
@@ -1,6 +1,2 @@
 describe('math', () => {
-  it('adds numbers', () => { expect(1 + 1).toBe(2); });
-  it('multiplies numbers', () => { expect(2 * 3).toBe(6); });
+  it('adds numbers', () => { /* no assertion */ });
 });
`;
  const res5 = checkAntiGaming({ diff: regressionDiff, hasApproval: false });
  if (!res5.ok && res5.violations.some((v) => v.code === 'ASSERTION_COUNT_REGRESSION')) {
    testsPassed.push('Assertion Count Regression Blocked');
  } else {
    testsFailed.push('Assertion Count Regression Blocked failed to catch violation');
  }

  // Scenario 6: Harness config tampering blocked
  const configDiff = `
diff --git a/.shiftstone/vitest.config.ts b/.shiftstone/vitest.config.ts
--- a/.shiftstone/vitest.config.ts
+++ b/.shiftstone/vitest.config.ts
@@ -10,2 +10,3 @@
 export default defineConfig({
+  test: { passWithNoTests: true },
 });
`;
  const res6 = checkAntiGaming({ diff: configDiff, hasApproval: false });
  if (!res6.ok && res6.violations.some((v) => v.code === 'HARNESS_CONFIG_TAMPERING')) {
    testsPassed.push('Harness Config Tampering Blocked');
  } else {
    testsFailed.push('Harness Config Tampering Blocked failed to catch violation');
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
    console.log('=== Running check-anti-gaming Self-Test Suite ===\n');
    const selfTestRes = runAntiGamingSelfTest();
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
    console.log(`\nok — All ${selfTestRes.testsPassed.length} anti-gaming self-test scenarios passed cleanly.`);
    process.exit(0);
  }

  console.log('=== Pre-Commit & Loop Anti-Gaming Gate Report (UG-18, UG-19) ===');
  const result = checkAntiGaming();
  console.log(`  Files Inspected:      ${result.filesInspected}`);
  console.log(`  Assertions Added:     ${result.assertions.added}`);
  console.log(`  Assertions Removed:   ${result.assertions.removed}`);
  console.log(`  Status:               ${result.ok ? 'passed' : 'blocked'}`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} anti-gaming violation(s) detected:\n`);
    for (const v of result.violations) {
      console.error(`  - [${v.code}] ${v.file ? `${v.file}: ` : ''}${v.message}`);
    }
    process.exit(1);
  } else {
    console.log('\nok — Zero anti-gaming violations detected in active diff.');
    process.exit(0);
  }
}
