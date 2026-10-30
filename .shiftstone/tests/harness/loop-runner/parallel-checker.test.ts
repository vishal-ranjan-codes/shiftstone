import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ParallelCheckerDispatcher,
  CheckerIllegalMutationError,
  type CheckerLensConfig,
} from '../../../harness/loop-runner/parallel-checker.js';

describe('Unit U7 — Parallel Read-Only Multi-Lens Checker Dispatcher (REQ-07)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-checker-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('TS-U7-01 (L1): Concurrent dispatch executes 4 lenses concurrently and compiles composite checker report', async () => {
    const fileA = path.join(tmpDir, 'source.ts');
    fs.writeFileSync(fileA, 'export const val = 42;\n', 'utf8');

    const executionLog: string[] = [];

    const lenses: CheckerLensConfig[] = [
      {
        lensId: 'spec-compliance',
        kind: 'types',
        run: async () => {
          executionLog.push('start:spec-compliance');
          await new Promise((r) => setTimeout(r, 20));
          executionLog.push('end:spec-compliance');
          return {
            passed: true,
            score: 1.0,
            findings: [],
          };
        },
      },
      {
        lensId: 'code-quality',
        kind: 'lint',
        run: async () => {
          executionLog.push('start:code-quality');
          await new Promise((r) => setTimeout(r, 20));
          executionLog.push('end:code-quality');
          return {
            passed: true,
            score: 1.0,
            findings: [],
          };
        },
      },
      {
        lensId: 'security-audit',
        kind: 'security',
        run: async () => {
          executionLog.push('start:security-audit');
          await new Promise((r) => setTimeout(r, 20));
          executionLog.push('end:security-audit');
          return {
            passed: true,
            score: 1.0,
            findings: [],
          };
        },
      },
      {
        lensId: 'architectural-rubric',
        kind: 'rubric',
        run: async () => {
          executionLog.push('start:architectural-rubric');
          await new Promise((r) => setTimeout(r, 20));
          executionLog.push('end:architectural-rubric');
          return {
            passed: true,
            score: 1.0,
            findings: [],
          };
        },
      },
    ];

    const dispatcher = new ParallelCheckerDispatcher({
      targetId: 'P3',
      makerAgentId: 'worker-subagent',
      reviewerAgentId: 'disjoint-checker',
      watchPaths: [tmpDir],
    });

    const report = await dispatcher.dispatch(lenses);

    // Verify concurrent dispatch: all 4 started before the first finished
    const firstEndIndex = executionLog.findIndex((entry) => entry.startsWith('end:'));
    const startEntriesBeforeFirstEnd = executionLog.slice(0, firstEndIndex).filter((e) => e.startsWith('start:'));
    expect(startEntriesBeforeFirstEnd.length).toBe(4);

    // Verify composite report adheres to checker-report/v1
    expect(report.schemaVersion).toBe('checker-report/v1');
    expect(report.targetId).toBe('P3');
    expect(report.contextIsolation).toBe('disjoint');
    expect(report.status).toBe('APPROVED');
    expect(report.scoring.gateAPassed).toBe(true);
    expect(report.scoring.gateBPassed).toBe(true);
    expect(report.scoring.normalizedScore).toBeGreaterThanOrEqual(80);
    expect(report.lensesApplied).toEqual([
      'spec-compliance',
      'code-quality',
      'security-audit',
      'architectural-rubric',
    ]);
  });

  it('TS-U7-02 (L1): Integrity assertion detects workspace mutation and flags CHECKER_ILLEGAL_MUTATION', async () => {
    const fileA = path.join(tmpDir, 'source.ts');
    fs.writeFileSync(fileA, 'export const val = 42;\n', 'utf8');

    const mutatingLens: CheckerLensConfig = {
      lensId: 'rogue-lens',
      kind: 'lint',
      run: async () => {
        // Rogue checker lens modifies source file
        fs.appendFileSync(fileA, '// rogue modification\n', 'utf8');
        return {
          passed: true,
          findings: [],
        };
      },
    };

    const dispatcher = new ParallelCheckerDispatcher({
      targetId: 'P3',
      makerAgentId: 'worker-subagent',
      reviewerAgentId: 'disjoint-checker',
      watchPaths: [tmpDir],
    });

    let error: any;
    try {
      await dispatcher.dispatch([mutatingLens]);
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(CheckerIllegalMutationError);
    expect(error.code).toBe('CHECKER_ILLEGAL_MUTATION');
    expect(error.mutatedFiles).toContain(path.resolve(fileA));
  });
});
