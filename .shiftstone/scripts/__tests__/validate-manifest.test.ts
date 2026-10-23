import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateManifest } from '../validate-manifest.js';

describe('Unit U4: validate-manifest (UG-06)', () => {
  it('TS-U4-02 (L2): fails with MISSING_COMPLETED_ARTIFACT when a completed unit artifact is missing', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'manifest-missing-art-'));
    try {
      mkdirSync(path.join(tmp, '.shiftstone', 'governance', 'schemas'), { recursive: true });
      mkdirSync(path.join(tmp, 'docs', 'plans'), { recursive: true });

      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'workspace-manifest.json'),
        JSON.stringify({
          apiVersion: 'workspace/v1',
          kind: 'WorkspaceManifest',
          metadata: { workspaceName: 'test', frameworkName: 'ShiftStone', version: '2.1.0', updatedAt: '2026-10-20' },
          spec: { activePacks: ['rr8'], budgets: {}, validators: [] },
        }),
      );

      writeFileSync(
        path.join(tmp, 'docs', 'plans', 'phase-1.md'),
        '---\ntype: plan\nstatus: completed\n---\n# Phase 1\n',
      );

      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'implementation-status.json'),
        JSON.stringify({
          apiVersion: 'governance/v1',
          kind: 'ImplementationStatus',
          metadata: { version: '2.1.0', updatedAt: '2026-10-20' },
          phases: {
            'phase-1': {
              planFile: 'docs/plans/phase-1.md',
              status: 'completed',
              units: ['U1'],
            },
          },
          planUnits: {
            U1: {
              phase: 'phase-1',
              status: 'completed',
              requirementIds: ['UG-01'],
              requiredArtifacts: ['.shiftstone/scripts/non-existent-script.js'],
            },
          },
          amendments: {},
        }),
      );

      const result = validateManifest({ root: tmp });
      expect(result.ok).toBe(false);
      const v = result.violations.find((x) => x.code === 'MISSING_COMPLETED_ARTIFACT');
      expect(v).toBeDefined();
      expect(v?.unitId).toBe('U1');
      expect(v?.artifact).toBe('.shiftstone/scripts/non-existent-script.js');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U4-03 (L2): fails with PHASE_STATUS_DESYNC when phase doc status disagrees with JSON status', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'manifest-desync-'));
    try {
      mkdirSync(path.join(tmp, '.shiftstone', 'governance'), { recursive: true });
      mkdirSync(path.join(tmp, 'docs', 'plans'), { recursive: true });

      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'workspace-manifest.json'),
        JSON.stringify({
          apiVersion: 'workspace/v1',
          kind: 'WorkspaceManifest',
          metadata: { workspaceName: 'test', frameworkName: 'ShiftStone', version: '2.1.0', updatedAt: '2026-10-20' },
          spec: { activePacks: ['rr8'], budgets: {}, validators: [] },
        }),
      );

      // Doc says planned
      writeFileSync(
        path.join(tmp, 'docs', 'plans', 'phase-1.md'),
        '---\ntype: plan\nstatus: planned\n---\n# Phase 1\n',
      );

      // JSON says completed
      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'implementation-status.json'),
        JSON.stringify({
          apiVersion: 'governance/v1',
          kind: 'ImplementationStatus',
          metadata: { version: '2.1.0', updatedAt: '2026-10-20' },
          phases: {
            'phase-1': {
              planFile: 'docs/plans/phase-1.md',
              status: 'completed',
              units: ['U1'],
            },
          },
          planUnits: {
            U1: {
              phase: 'phase-1',
              status: 'completed',
              requirementIds: ['UG-01'],
              requiredArtifacts: [],
            },
          },
          amendments: {},
        }),
      );

      const result = validateManifest({ root: tmp });
      expect(result.ok).toBe(false);
      const v = result.violations.find((x) => x.code === 'PHASE_STATUS_DESYNC');
      expect(v).toBeDefined();
      expect(v?.phase).toBe('phase-1');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U4-01 (L1): passes cleanly on live repository', () => {
    const result = validateManifest();
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.details.completedUnitsChecked).toBeGreaterThanOrEqual(4);
  });
});
