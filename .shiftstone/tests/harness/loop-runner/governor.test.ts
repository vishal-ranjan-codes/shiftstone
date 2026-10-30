import { describe, expect, it } from 'vitest';
import { PlanGovernor } from '../../../harness/loop-runner/governor.js';
import type { PlanGovernorManifest } from '../../../harness/loop-runner/types.js';

describe('Unit U4 — Governor DAG Lifecycle & Task Dispatcher (REQ-04)', () => {
  it('TS-U4-01 (L2): Mock execution of a 3-phase DAG asserts phases run in strict topological order', async () => {
    const executedPhases: string[] = [];

    const mockManifest: PlanGovernorManifest = {
      schema: 'plan-manifest/v1',
      suiteId: 'synthetic-dag-suite',
      definitionRevision: 1,
      phases: [
        {
          phaseId: 'P3',
          dependsOn: [{ phaseId: 'P2', requires: 'complete' }],
          sourcePaths: ['src/p3.ts'],
          checks: [],
        },
        {
          phaseId: 'P1',
          dependsOn: [],
          sourcePaths: ['src/p1.ts'],
          checks: [],
        },
        {
          phaseId: 'P2',
          dependsOn: [{ phaseId: 'P1', requires: 'complete' }],
          sourcePaths: ['src/p2.ts'],
          checks: [],
        },
      ],
    };

    const governor = new PlanGovernor({
      manifest: mockManifest,
      dispatcher: async (phaseId) => {
        executedPhases.push(phaseId);
        return { phaseId, exitCode: 0, status: 'success' };
      },
    });

    const summary = await governor.run();
    expect(summary.status).toBe('completed');
    expect(summary.terminalState).toBe('success');
    expect(executedPhases).toEqual(['P1', 'P2', 'P3']);
  });

  it('TS-U4-02 (L2): Blocker test confirms Governor halts immediately when Phase 2 check returns exit code 2', async () => {
    const executedPhases: string[] = [];

    const mockManifest: PlanGovernorManifest = {
      schema: 'plan-manifest/v1',
      suiteId: 'failing-dag-suite',
      definitionRevision: 1,
      phases: [
        {
          phaseId: 'P1',
          dependsOn: [],
          sourcePaths: ['src/p1.ts'],
          checks: [],
        },
        {
          phaseId: 'P2',
          dependsOn: [{ phaseId: 'P1', requires: 'complete' }],
          sourcePaths: ['src/p2.ts'],
          checks: [],
        },
        {
          phaseId: 'P3',
          dependsOn: [{ phaseId: 'P2', requires: 'complete' }],
          sourcePaths: ['src/p3.ts'],
          checks: [],
        },
      ],
    };

    const governor = new PlanGovernor({
      manifest: mockManifest,
      dispatcher: async (phaseId) => {
        executedPhases.push(phaseId);
        if (phaseId === 'P2') {
          return { phaseId, exitCode: 2, status: 'blocked', error: 'Verification check failed with exit code 2' };
        }
        return { phaseId, exitCode: 0, status: 'success' };
      },
    });

    const summary = await governor.run();
    expect(summary.status).toBe('blocked');
    expect(summary.terminalState).toBe('blocked');
    expect(executedPhases).toEqual(['P1', 'P2']);
    expect(executedPhases).not.toContain('P3');
  });
});
