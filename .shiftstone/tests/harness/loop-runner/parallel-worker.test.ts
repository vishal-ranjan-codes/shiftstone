import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ParallelWorkerDispatcher,
  type ParallelPhaseSpec,
} from '../../../harness/loop-runner/parallel-worker.js';
import { GitWorktreeEngine } from '../../../harness/worktree/git-worktree-engine.js';

describe('Unit U8 — Parallel Worktree Branch Worker Dispatcher (REQ-08)', () => {
  let tmpRoot: string;
  let worktreeEngine: GitWorktreeEngine;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-worker-test-'));
    // Initialize a mock git repo in tmpRoot so GitWorktreeEngine can operate
    // Or mock GitWorktreeEngine
  });

  afterEach(() => {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('TS-U8-01 (L2): Parallel dispatch executes independent phases concurrently in isolated worktrees', async () => {
    const phases: ParallelPhaseSpec[] = [
      {
        phaseId: 'phase-frontend',
        dependsOn: [],
        sourcePaths: ['frontend/components/Button.tsx', 'frontend/pages/index.tsx'],
      },
      {
        phaseId: 'phase-backend',
        dependsOn: [],
        sourcePaths: ['backend/api/health.ts', 'backend/services/user.ts'],
      },
    ];

    const executionLog: string[] = [];

    // Mock worktree engine
    const mockWorktreeEngine = {
      createWorktree: (phaseId: string, branch: string, sourcePaths: string[]) => {
        const wtPath = path.join(tmpRoot, phaseId);
        fs.mkdirSync(wtPath, { recursive: true });
        return {
          phaseId,
          branch,
          path: wtPath,
          sourcePaths,
          createdAt: new Date().toISOString(),
          status: 'active' as const,
        };
      },
      removeWorktree: (phaseId: string) => {
        const wtPath = path.join(tmpRoot, phaseId);
        if (fs.existsSync(wtPath)) {
          fs.rmSync(wtPath, { recursive: true, force: true });
        }
      },
    } as unknown as GitWorktreeEngine;

    const dispatcher = new ParallelWorkerDispatcher({
      worktreeEngine: mockWorktreeEngine,
      root: tmpRoot,
    });

    const result = await dispatcher.dispatchBatch(phases, async (phase, worktree) => {
      executionLog.push(`start:${phase.phaseId}`);
      await new Promise((r) => setTimeout(r, 25));
      // Write mock file in worktree
      fs.writeFileSync(path.join(worktree.path, 'receipt.json'), JSON.stringify({ ok: true }));
      executionLog.push(`end:${phase.phaseId}`);
      return {
        exitCode: 0,
        commitSha: `commit-${phase.phaseId}`,
        receipt: { phaseId: phase.phaseId, closed: true },
      };
    });

    // Check concurrency: both phases started before any finished
    const firstEndIdx = executionLog.findIndex((e) => e.startsWith('end:'));
    const startsBeforeFirstEnd = executionLog.slice(0, firstEndIdx).filter((e) => e.startsWith('start:'));
    expect(startsBeforeFirstEnd.length).toBe(2);

    expect(result.allPassed).toBe(true);
    expect(result.results.length).toBe(2);
    expect(result.results.find((r) => r.phaseId === 'phase-frontend')?.commitSha).toBe('commit-phase-frontend');
    expect(result.results.find((r) => r.phaseId === 'phase-backend')?.commitSha).toBe('commit-phase-backend');
  });

  it('TS-U8-02 (L2): Path overlap guard detects colliding source paths and routes them into sequential execution', async () => {
    const overlappingPhases: ParallelPhaseSpec[] = [
      {
        phaseId: 'phase-auth',
        dependsOn: [],
        sourcePaths: ['src/common/config.ts', 'src/auth/login.ts'],
      },
      {
        phaseId: 'phase-billing',
        dependsOn: [],
        sourcePaths: ['src/common/config.ts', 'src/billing/stripe.ts'], // Shared config.ts!
      },
    ];

    const dispatcher = new ParallelWorkerDispatcher({
      root: tmpRoot,
    });

    // Partition test
    const plan = dispatcher.partitionPhases(overlappingPhases);
    expect(plan.canRunParallel).toBe(false);
    expect(plan.batches.length).toBe(2); // Separated into 2 sequential batches of 1
    expect(plan.conflicts.length).toBeGreaterThan(0);
    expect(plan.conflicts[0].collidingPath).toBe('src/common/config.ts');
  });
});
