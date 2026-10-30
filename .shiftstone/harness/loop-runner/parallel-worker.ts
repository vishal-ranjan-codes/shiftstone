/**
 * Parallel Worktree Branch Worker Dispatcher (Unit U8 / REQ-08)
 */
import path from 'node:path';
import { GitWorktreeEngine } from '../worktree/git-worktree-engine.js';
import type { WorktreeRecord } from '../worktree/types.js';

export interface ParallelPhaseSpec {
  phaseId: string;
  dependsOn?: Array<string | { phaseId: string }>;
  sourcePaths: string[];
}

export interface PathCollisionConflict {
  phaseA: string;
  phaseB: string;
  collidingPath: string;
}

export interface PartitionPlan {
  canRunParallel: boolean;
  batches: ParallelPhaseSpec[][];
  conflicts: PathCollisionConflict[];
}

export interface ParallelWorkerResult {
  phaseId: string;
  exitCode: number;
  commitSha?: string;
  worktreePath: string;
  receipt?: any;
  error?: string;
}

export interface ParallelBatchExecutionSummary {
  allPassed: boolean;
  results: ParallelWorkerResult[];
}

export type ParallelWorkerFn = (
  phase: ParallelPhaseSpec,
  worktree: WorktreeRecord
) => Promise<{
  exitCode: number;
  commitSha?: string;
  receipt?: any;
  error?: string;
}>;

export interface ParallelWorkerDispatcherOptions {
  worktreeEngine?: GitWorktreeEngine;
  root?: string;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function pathsOverlap(a: string, b: string): boolean {
  const normA = normalizePath(a);
  const normB = normalizePath(b);
  if (normA === normB) return true;
  if (normA.startsWith(normB + '/')) return true;
  if (normB.startsWith(normA + '/')) return true;
  return false;
}

export class ParallelWorkerDispatcher {
  readonly root: string;
  readonly worktreeEngine: GitWorktreeEngine;

  constructor(options: ParallelWorkerDispatcherOptions = {}) {
    this.root = path.resolve(options.root || process.cwd());
    this.worktreeEngine =
      options.worktreeEngine ||
      new GitWorktreeEngine({
        root: this.root,
      });
  }

  /**
   * AC-U8-01: Inspects plan phases and checks for independent phases with disjoint sourcePaths.
   * If overlaps exist, partitions into conflict-free sequential batches.
   */
  partitionPhases(phases: ParallelPhaseSpec[]): PartitionPlan {
    const conflicts: PathCollisionConflict[] = [];

    // Check all pairs for path overlaps
    for (let i = 0; i < phases.length; i++) {
      for (let j = i + 1; j < phases.length; j++) {
        const phaseA = phases[i];
        const phaseB = phases[j];

        for (const pathA of phaseA.sourcePaths) {
          for (const pathB of phaseB.sourcePaths) {
            if (pathsOverlap(pathA, pathB)) {
              conflicts.push({
                phaseA: phaseA.phaseId,
                phaseB: phaseB.phaseId,
                collidingPath: pathA,
              });
            }
          }
        }
      }
    }

    if (conflicts.length === 0) {
      return {
        canRunParallel: true,
        batches: [phases],
        conflicts: [],
      };
    }

    // Partition into sequential batches using greedy bucket assignment
    const batches: ParallelPhaseSpec[][] = [];

    for (const phase of phases) {
      let placed = false;
      for (const batch of batches) {
        const hasConflict = batch.some((existing) =>
          existing.sourcePaths.some((ep) =>
            phase.sourcePaths.some((np) => pathsOverlap(ep, np))
          )
        );
        if (!hasConflict) {
          batch.push(phase);
          placed = true;
          break;
        }
      }
      if (!placed) {
        batches.push([phase]);
      }
    }

    return {
      canRunParallel: false,
      batches,
      conflicts,
    };
  }

  /**
   * AC-U8-02 & AC-U8-03: Creates isolated worktrees and dispatches workers concurrently.
   */
  async dispatchBatch(
    phases: ParallelPhaseSpec[],
    workerFn: ParallelWorkerFn
  ): Promise<ParallelBatchExecutionSummary> {
    const partition = this.partitionPhases(phases);
    if (!partition.canRunParallel && partition.conflicts.length > 0) {
      throw new Error(
        `PARALLEL_DISPATCH_CONFLICT: Cannot run phases concurrently due to path overlaps: ${partition.conflicts.map((c) => c.collidingPath).join(', ')}`
      );
    }

    // 1. Create worktrees for each phase
    const worktrees = new Map<string, WorktreeRecord>();
    try {
      for (const phase of phases) {
        const branch = `orch/phase-${phase.phaseId}`;
        const wt = this.worktreeEngine.createWorktree(phase.phaseId, branch, phase.sourcePaths);
        worktrees.set(phase.phaseId, wt);
      }

      // 2. Dispatch worker subagents concurrently
      const executions = phases.map(async (phase) => {
        const wt = worktrees.get(phase.phaseId)!;
        try {
          const res = await workerFn(phase, wt);
          return {
            phaseId: phase.phaseId,
            exitCode: res.exitCode,
            commitSha: res.commitSha,
            worktreePath: wt.path,
            receipt: res.receipt,
            error: res.error,
          };
        } catch (err: any) {
          return {
            phaseId: phase.phaseId,
            exitCode: 1,
            worktreePath: wt.path,
            error: err.message || String(err),
          };
        }
      });

      const settled = await Promise.allSettled(executions);

      const results: ParallelWorkerResult[] = settled.map((s, idx) => {
        if (s.status === 'fulfilled') {
          return s.value;
        }
        return {
          phaseId: phases[idx].phaseId,
          exitCode: 1,
          worktreePath: worktrees.get(phases[idx].phaseId)?.path || '',
          error: String(s.reason),
        };
      });

      const allPassed = results.every((r) => r.exitCode === 0 && !r.error);

      return {
        allPassed,
        results,
      };
    } finally {
      // Worktrees remain active until integration merge (or removed on error by caller)
    }
  }
}
