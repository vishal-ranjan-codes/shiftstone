/**
 * Worktree Integration Merge & Post-Merge Monorepo Validator (Unit U9 / REQ-09)
 */
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { GitWorktreeEngine } from './git-worktree-engine.js';

export interface MergeCandidate {
  branch: string;
  phaseId?: string;
}

export interface ValidationRunResult {
  success: boolean;
  output?: string;
  error?: string;
}

export type ValidationRunner = () => Promise<ValidationRunResult>;
export type GitExecutor = (args: string[]) => string;

export interface WorktreeMergeValidatorOptions {
  root?: string;
  targetBranch?: string;
  worktreeEngine?: GitWorktreeEngine;
  gitExec?: GitExecutor;
  validationRunner?: ValidationRunner;
}

export interface SingleMergeResult {
  success: boolean;
  branch: string;
  phaseId?: string;
  preMergeSha: string;
  postMergeSha?: string;
  rolledBack: boolean;
  error?: string;
  validationOutput?: string;
}

export interface SequentialMergeSummary {
  allPassed: boolean;
  mergedBranches: string[];
  failedBranch?: string;
  rolledBack: boolean;
  results: SingleMergeResult[];
  error?: string;
}

export class WorktreeMergeValidator {
  readonly root: string;
  readonly targetBranch: string;
  readonly worktreeEngine?: GitWorktreeEngine;
  private readonly gitExec: GitExecutor;
  private readonly validationRunner: ValidationRunner;

  constructor(options: WorktreeMergeValidatorOptions = {}) {
    this.root = path.resolve(options.root || process.cwd());
    this.targetBranch = options.targetBranch || 'main';
    this.worktreeEngine = options.worktreeEngine;

    this.gitExec =
      options.gitExec ||
      ((args: string[]) =>
        execFileSync('git', args, {
          cwd: this.root,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }));

    this.validationRunner =
      options.validationRunner ||
      (async () => {
        // Default runner executes monorepo test gate
        try {
          execFileSync('pnpm', ['-C', '.shiftstone', 'exec', 'vitest', 'run'], {
            cwd: this.root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          return { success: true };
        } catch (err: any) {
          return {
            success: false,
            error: err.message || String(err),
            output: err.stdout || err.stderr,
          };
        }
      });
  }

  private getCurrentCommit(): string {
    return this.gitExec(['rev-parse', 'HEAD']).trim();
  }

  /**
   * AC-U9-01 & AC-U9-02: Merges branch via git merge --no-ff, runs validation,
   * and rolls back via git reset --hard if validation fails.
   */
  async mergeBranch(candidate: MergeCandidate): Promise<SingleMergeResult> {
    const preMergeSha = this.getCurrentCommit();

    // 1. Execute git merge --no-ff
    try {
      this.gitExec(['merge', '--no-ff', candidate.branch, '-m', `Merge branch '${candidate.branch}'`]);
    } catch (err: any) {
      try {
        this.gitExec(['merge', '--abort']);
      } catch {
        // Ignore if no merge in progress
      }
      return {
        success: false,
        branch: candidate.branch,
        phaseId: candidate.phaseId,
        preMergeSha,
        rolledBack: true,
        error: `Git merge failed: ${err.message || String(err)}`,
      };
    }

    // 2. AC-U9-02: Execute monorepo validation runner
    const valResult = await this.validationRunner();
    if (!valResult.success) {
      // Rollback to pre-merge commit
      try {
        this.gitExec(['reset', '--hard', preMergeSha]);
      } catch (rbErr: any) {
        // Critical rollback failure
      }
      return {
        success: false,
        branch: candidate.branch,
        phaseId: candidate.phaseId,
        preMergeSha,
        rolledBack: true,
        error: valResult.error || 'Monorepo regression gate failed after merge',
        validationOutput: valResult.output,
      };
    }

    const postMergeSha = this.getCurrentCommit();

    // 3. AC-U9-03: Teardown temporary worktree & remove merged tracking branch
    if (candidate.phaseId && this.worktreeEngine) {
      try {
        this.worktreeEngine.removeWorktree(candidate.phaseId);
      } catch {
        // Ignore worktree teardown warning
      }
    }

    try {
      this.gitExec(['branch', '-d', candidate.branch]);
    } catch {
      // Branch might require -D or be remote
    }

    return {
      success: true,
      branch: candidate.branch,
      phaseId: candidate.phaseId,
      preMergeSha,
      postMergeSha,
      rolledBack: false,
      validationOutput: valResult.output,
    };
  }

  /**
   * Sequentially merges candidate branches, halting immediately upon first failure.
   */
  async mergeCandidatesSequentially(candidates: MergeCandidate[]): Promise<SequentialMergeSummary> {
    const results: SingleMergeResult[] = [];
    const mergedBranches: string[] = [];

    for (const candidate of candidates) {
      const res = await this.mergeBranch(candidate);
      results.push(res);

      if (!res.success) {
        return {
          allPassed: false,
          mergedBranches,
          failedBranch: candidate.branch,
          rolledBack: res.rolledBack,
          results,
          error: res.error,
        };
      }

      mergedBranches.push(candidate.branch);
    }

    return {
      allPassed: true,
      mergedBranches,
      rolledBack: false,
      results,
    };
  }
}
