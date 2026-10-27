import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  loadPlanManifest,
  sameSet,
  unitIds,
  validatePlan,
  validatePlanGraph,
} from '../../../scripts/lib/plan-graph.js';
import { validatePlans } from '../../../scripts/validate-plans.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function write(root: string, file: string, content: string) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function writeJson(root: string, file: string, value: any) {
  write(root, file, JSON.stringify(value, null, 2) + '\n');
}

function stageContract(ids: string[]) {
  return `---
type: "ICM Stage"
title: "Fixture stage"
component: "workspace"
---
# Inputs
| ID | Path |
|---|---|
| I1 | source.txt |
# Process
| Unit | Step |
|---|---|
${ids.map((id) => `| ${id} | Implement the fixture unit |`).join('\n')}
${ids
  .map(
    (id) => `#### Unit ${id}: Fixture contract
- **Target Files**: source.txt
- **Step-by-Step Implementation Mechanics**: Inspect declared source, implement bounded fixture, capture checks and verify acceptance without inventing a review. Sufficient depth to exercise parser.`
  )
  .join('\n')}
# Outputs
| ID | Destination | Traces |
|---|---|---|
${ids.map((id, i) => `| O${i + 1} | future.txt | ${id} |`).join('\n')}
# Verification
Level 1: \`pnpm test\`
# Durable Memory
output/log.md
# Human Checkpoint
Retain applicable gates.
# Blocked Conditions
Missing input.
# Failure Conditions
Invalid evidence.
# Bounded Loading & Terminal State
Only declared source. success | no-op | blocked | stalled | exhausted
`;
}

function makeSyntheticSuite(count = 2) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-suite-'));
  const suite = 'docs/plans/sample';
  write(root, 'source.txt', 'source content\n');

  const phases = [];
  for (let i = 1; i <= count; i++) {
    const unitId = `U${i}`;
    const stageFile = `${suite}/phase-${i}.md`;
    const acceptanceId = `AC-U${i}-01`;
    const unitRecord = {
      schemaVersion: 'plan-unit/v1',
      unitId,
      phaseId: `phase-${i}`,
      title: `Unit ${unitId} implementation`,
      layer: 'core',
      status: 'planned',
      dependsOn: i > 1 ? [`U${i - 1}`] : [],
      requirementIds: [`REQ-${i}`],
      targetFiles: ['source.txt'],
      acceptanceCriteria: [
        {
          id: acceptanceId,
          requirementId: `REQ-${i}`,
          criterion: 'Observable fixture behavior meets acceptance specifications.',
        },
      ],
      testScenarios: [
        {
          scenarioId: `TS-U${i}-01`,
          level: 'L1',
          description: 'Runs vitest test',
          assertion: 'Exits code 0',
        },
      ],
      verificationCommand: 'pnpm test',
      confidenceScore: 0.95,
    };
    writeJson(root, `${suite}/plan-units/${unitId}.json`, unitRecord);
    write(root, stageFile, stageContract([unitId]));

    phases.push({
      phaseId: `P${i}`,
      contract: stageFile,
      unitIds: [unitId],
      dependsOn:
        i > 1
          ? [
              {
                phaseId: `P${i - 1}`,
                requires: 'complete',
                reason: 'Consume the accepted predecessor phase.',
              },
            ]
          : [],
      sourcePaths: ['source.txt'],
      checks: [
        {
          id: `test-${i}`,
          acceptanceIds: [acceptanceId],
          level: 1,
          kind: 'automated',
          required: true,
          regressionFor: i > 1 ? [`P${i - 1}`] : [],
          sourcePaths: ['source.txt'],
          environmentKeys: ['node-version'],
          runner: {
            executable: 'node',
            args: ['--version'],
            cwd: '.',
          },
        },
      ],
      requiredReview: true,
      humanApprovalRequired: false,
      recovery: {
        retry: 'Repair only scoped source.',
        rollback: 'Revert only this fixture.',
      },
    });
  }

  const manifest = {
    schema: 'plan-manifest/v1',
    suiteId: 'sample',
    definitionRevision: 1,
    phases,
  };
  writeJson(root, `${suite}/plan-manifest.json`, manifest);

  const cleanup = () => fs.rmSync(root, { recursive: true, force: true });
  return { root, suite, manifest, cleanup };
}

describe('Unit U5 — Phase Graph, Dependency DAG & Requirement-Check Mapper (REQ-05)', () => {
  it('unitIds and sameSet helpers work correctly', () => {
    expect(unitIds('U1, U2 and U3')).toEqual(['U1', 'U2', 'U3']);
    expect(unitIds('Units U1–U3')).toEqual(['U1', 'U2', 'U3']);
    expect(unitIds('U12a and U5')).toEqual(['U12a', 'U5']);
    expect(sameSet(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameSet(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(sameSet(['a', 'a'], ['a'])).toBe(false);
  });

  it('loadPlanManifest loads and validates valid manifest', () => {
    const { root, suite, cleanup } = makeSyntheticSuite();
    try {
      const { manifest, diagnostics } = loadPlanManifest(root, suite);
      expect(diagnostics).toEqual([]);
      expect(manifest.suiteId).toBe('sample');
      expect(manifest.phases.length).toBe(2);
    } finally {
      cleanup();
    }
  });

  it('validates a clean synthetic plan suite with zero diagnostics', () => {
    const { root, suite, cleanup } = makeSyntheticSuite();
    try {
      const result = validatePlan(root, suite);
      expect(result.diagnostics).toEqual([]);
      expect(result.status).toBe('valid');
      expect(result.phaseCount).toBe(2);
      expect(result.activeUnits).toBe(2);
    } finally {
      cleanup();
    }
  });

  it('TS-U5-01 (L1): detects cyclic phase dependencies (P1 -> P2 -> P1)', () => {
    const { root, suite, manifest, cleanup } = makeSyntheticSuite();
    try {
      // Introduce cycle: P1 depends on P2, while P2 depends on P1
      manifest.phases[0].dependsOn = [
        { phaseId: 'P2', requires: 'complete', reason: 'Cycle intentional' },
      ];
      writeJson(root, `${suite}/plan-manifest.json`, manifest);

      const graphDiags = validatePlanGraph(manifest);
      expect(graphDiags.some((d) => d.code === 'CYCLE')).toBe(true);

      const planResult = validatePlan(root, suite);
      expect(planResult.status).toBe('invalid');
      expect(planResult.diagnostics.some((d) => d.code === 'CYCLE')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('TS-U5-02 (L2): detects orphaned unit IDs (unmapped to checks or non-existent in phases)', () => {
    const { root, suite, manifest, cleanup } = makeSyntheticSuite();
    try {
      // Orphan check acceptance ID: check references an acceptanceId not in any phase unit
      manifest.phases[0].checks[0].acceptanceIds = ['AC-U9-01'];
      writeJson(root, `${suite}/plan-manifest.json`, manifest);

      const result = validatePlan(root, suite);
      expect(result.status).toBe('invalid');
      expect(result.diagnostics.some((d) => d.code === 'ORPHAN_CHECK')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('TS-U5-02 / AC-U5-03: enforces single phase membership for units and flags unmapped active units', () => {
    const { root, suite, manifest, cleanup } = makeSyntheticSuite();
    try {
      // Map unit U1 to both Phase 1 and Phase 2
      manifest.phases[1].unitIds = ['U1'];
      writeJson(root, `${suite}/plan-manifest.json`, manifest);

      const result = validatePlan(root, suite);
      expect(result.status).toBe('invalid');
      expect(result.diagnostics.some((d) => d.code === 'MULTIPLE_PHASES')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('TS-U5-03 (L2): rejects checks with regressionFor pointing to non-predecessor phases', () => {
    const { root, suite, manifest, cleanup } = makeSyntheticSuite();
    try {
      // P1 references P2 as regressionFor, but P2 is downstream, not predecessor
      manifest.phases[0].checks[0].regressionFor = ['P2'];
      writeJson(root, `${suite}/plan-manifest.json`, manifest);

      const graphDiags = validatePlanGraph(manifest);
      expect(graphDiags.some((d) => d.code === 'REGRESSION_REFERENCE')).toBe(true);

      const result = validatePlan(root, suite);
      expect(result.status).toBe('invalid');
      expect(result.diagnostics.some((d) => d.code === 'REGRESSION_REFERENCE')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('AC-U5-05: validatePlans CLI module discovers and validates suites', () => {
    const { root, suite, cleanup } = makeSyntheticSuite();
    try {
      const summary = validatePlans('docs/plans', root);
      expect(summary.errors).toEqual([]);
      expect(summary.suites.length).toBeGreaterThan(0);
      expect(summary.suites.some((s) => s.suite === suite && s.status === 'valid')).toBe(true);
    } finally {
      cleanup();
    }
  });
});
