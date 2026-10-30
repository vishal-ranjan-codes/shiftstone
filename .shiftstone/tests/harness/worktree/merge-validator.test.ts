import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  WorktreeMergeValidator,
  type MergeCandidate,
} from '../../../harness/worktree/merge-validator.js';
import type { GitWorktreeEngine } from '../../../harness/worktree/git-worktree-engine.js';

describe('Unit U9 — Worktree Integration Merge & Post-Merge Monorepo Validator (REQ-09)', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-merge-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('TS-U9-01 (L2): Clean merge simulation merges branches sequentially and validates monorepo regression gate', async () => {
    const gitCommandsExecuted: string[][] = [];
    const removedWorktrees: string[] = [];

    const mockGitExec = (args: string[]) => {
      gitCommandsExecuted.push(args);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return 'main-commit-sha-123\n';
      }
      return '';
    };

    const mockWorktreeEngine = {
      removeWorktree: (phaseId: string) => {
        removedWorktrees.push(phaseId);
      },
    } as unknown as GitWorktreeEngine;

    let testsRan = 0;
    const mockValidationRunner = async () => {
      testsRan++;
      return { success: true, output: '10/10 tests green' };
    };

    const validator = new WorktreeMergeValidator({
      root: tmpRoot,
      targetBranch: 'main',
      worktreeEngine: mockWorktreeEngine,
      gitExec: mockGitExec,
      validationRunner: mockValidationRunner,
    });

    const candidates: MergeCandidate[] = [
      { branch: 'orch/phase-backend', phaseId: 'phase-backend' },
      { branch: 'orch/phase-frontend', phaseId: 'phase-frontend' },
    ];

    const result = await validator.mergeCandidatesSequentially(candidates);

    expect(result.allPassed).toBe(true);
    expect(result.mergedBranches).toEqual(['orch/phase-backend', 'orch/phase-frontend']);
    expect(testsRan).toBe(2);
    expect(removedWorktrees).toEqual(['phase-backend', 'phase-frontend']);

    // Check git merge --no-ff command called
    const mergeCalls = gitCommandsExecuted.filter((c) => c[0] === 'merge' && c[1] === '--no-ff');
    expect(mergeCalls.length).toBe(2);
    expect(mergeCalls[0][2]).toBe('orch/phase-backend');
    expect(mergeCalls[1][2]).toBe('orch/phase-frontend');

    // Check git branch -d called
    const branchDeleteCalls = gitCommandsExecuted.filter((c) => c[0] === 'branch' && c[1] === '-d');
    expect(branchDeleteCalls.length).toBe(2);
  });

  it('TS-U9-02 (L2): Failure rollback test asserts broken post-merge tests trigger rollback to pre-merge commit', async () => {
    const gitCommandsExecuted: string[][] = [];
    const removedWorktrees: string[] = [];

    const mockGitExec = (args: string[]) => {
      gitCommandsExecuted.push(args);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return 'pre-merge-commit-sha-999\n';
      }
      return '';
    };

    const mockWorktreeEngine = {
      removeWorktree: (phaseId: string) => {
        removedWorktrees.push(phaseId);
      },
    } as unknown as GitWorktreeEngine;

    // Fail validation runner on purpose
    const failingValidationRunner = async () => {
      return { success: false, output: 'Regression: broken test suite', error: 'AssertionError: expected true to be false' };
    };

    const validator = new WorktreeMergeValidator({
      root: tmpRoot,
      targetBranch: 'main',
      worktreeEngine: mockWorktreeEngine,
      gitExec: mockGitExec,
      validationRunner: failingValidationRunner,
    });

    const candidates: MergeCandidate[] = [
      { branch: 'orch/phase-broken', phaseId: 'phase-broken' },
    ];

    const result = await validator.mergeCandidatesSequentially(candidates);

    expect(result.allPassed).toBe(false);
    expect(result.mergedBranches.length).toBe(0);
    expect(result.failedBranch).toBe('orch/phase-broken');
    expect(result.rolledBack).toBe(true);

    // Verify rollback command git reset --hard pre-merge-commit-sha-999
    const resetCalls = gitCommandsExecuted.filter((c) => c[0] === 'reset' && c[1] === '--hard');
    expect(resetCalls.length).toBe(1);
    expect(resetCalls[0][2]).toBe('pre-merge-commit-sha-999');

    // Worktree should NOT be deleted on failure, so developer/agent can inspect
    expect(removedWorktrees.length).toBe(0);
  });
});
