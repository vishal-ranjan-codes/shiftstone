import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { withLock, recoverJournal, commitTransaction, savePhaseState } from '../../../scripts/lib/plan-storage.js';
import { validatePlan } from '../../../scripts/lib/plan-graph.js';
import { snapshot, sha256, definitionHash } from '../../../scripts/lib/plan-source.js';
import { phaseScopes, phaseEnvironmentKeys } from '../../../scripts/lib/plan-state.js';

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-storage-'));
  const suite = 'docs/plans/sample';
  write(root, 'source.txt', 'source content\n');
  write(root, `${suite}/README.md`, `# Sample Suite\n\n<!-- plan-status:start -->\n<!-- plan-status:end -->\n`);

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
          id: `check-${i}`,
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
        retry: 'Repair source and retry check.',
        rollback: 'Revert uncommitted modifications.',
      },
    });
  }

  writeJson(root, `${suite}/plan-manifest.json`, {
    schema: 'plan-manifest/v1',
    suiteId: 'sample',
    definitionRevision: 1,
    phases,
  });

  return { root, suite, plan: validatePlan(root, suite) };
}

function makeSyntheticHandoff(root: string, plan: any, phase = plan.manifest.phases[0]) {
  const snap: any = snapshot(root, phaseScopes(phase), phaseEnvironmentKeys(phase));
  const defHash = definitionHash(root, plan.suite, phase, plan.units);
  const rawPath = `${plan.suite}/output/raw.txt`;
  write(root, rawPath, 'Fixture test output.\n');
  const rawRef = { path: rawPath, sha256: sha256(fs.readFileSync(path.join(root, rawPath))) };

  const report = {
    schemaVersion: 'checker-report/v1',
    reportId: 'RPT-20261027-100',
    timestamp: '2026-10-27T12:00:00.000Z',
    targetId: phase.phaseId,
    makerAgentId: 'synthetic-maker',
    reviewerAgentId: 'synthetic-reviewer',
    contextIsolation: 'disjoint',
    executionMode: 'full',
    autofixPolicy: 'report-only',
    lensesApplied: ['core-lens'],
    dimensions: {
      task_success: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Meets full specification' },
      tool_use_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Meets full specification' },
      trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Meets full specification' },
      hallucination: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Meets full specification' },
      response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Meets full specification' },
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
  const reportPath = `${plan.suite}/output/checker.json`;
  write(root, reportPath, JSON.stringify(report, null, 2) + '\n');
  const reportRef = { path: reportPath, sha256: sha256(fs.readFileSync(path.join(root, reportPath))) };

  const handoff = {
    schema: 'plan-handoff/v1',
    suiteId: plan.manifest.suiteId,
    phaseId: phase.phaseId,
    attempt: 1,
    previousRef: null,
    definitionSha256: defHash,
    recordedAt: '2026-10-27T12:00:00Z',
    actor: { id: 'synthetic-maker', role: 'maker' },
    event: 'close',
    implementation: 'implemented',
    terminalState: 'success',
    summary: 'Synthetic handoff completion.',
    changes: [{ path: 'source.txt', reason: 'Unit implementation', unitIds: phase.unitIds }],
    deviations: [],
    materialContext: [],
    issues: [],
    entrySnapshot: snap,
    exitSnapshot: structuredClone(snap),
    checks: phase.checks.map((check: any) => {
      const own = snapshot(root, check.sourcePaths, check.environmentKeys);
      return {
        checkId: check.id,
        result: 'passed',
        observedAt: '2026-10-27T12:00:00Z',
        sourceDigest: own.scopeDigest,
        environmentDigest: own.environmentDigest,
        exitCode: 0,
        evidenceRefs: [rawRef],
        reason: 'Automated runner passed.',
      };
    }),
    reviewRefs: [reportRef],
    approvalRefs: [],
    reviewRequest: null,
    next: { phaseId: null, entryConditions: [], firstAction: 'Next phase' },
    preservation: [],
  };

  const handoffPath = `${plan.suite}/output/handoffs/${phase.phaseId}/attempt-001.json`;
  const handoffContent = JSON.stringify(handoff, null, 2) + '\n';
  const handoffRef = { path: handoffPath, sha256: sha256(Buffer.from(handoffContent)) };

  return { handoff, handoffRef, report, reportRef };
}

describe('Unit U7 — Storage, CAS Concurrency & Transaction Journal (plan-storage.js) (REQ-07)', () => {
  it('AC-U7-04: withLock provides exclusive per-suite lock and throws exitCode 3 on contention', () => {
    const { root, suite } = makeSyntheticSuite(1);

    withLock(root, suite, () => {
      // Trying to acquire lock on the same suite from within should fail with LOCK_CONTENTION and exitCode 3
      expect(() => {
        withLock(root, suite, () => {});
      }).toThrowError(/Lock contention/);

      try {
        withLock(root, suite, () => {});
      } catch (err: any) {
        expect(err.code).toBe('LOCK_CONTENTION');
        expect(err.exitCode).toBe(3);
      }
    });

    // After release, locking succeeds again
    let ran = false;
    withLock(root, suite, () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  it('TS-U7-02 (L2): CAS revision guard prevents stale state updates and throws exitCode 3', () => {
    const { root, suite, plan } = makeSyntheticSuite(1);
    const { handoff, handoffRef } = makeSyntheticHandoff(root, plan);

    // Initial state does not exist -> revision 0. Saving with expectedRevision: 0 succeeds.
    const res1 = savePhaseState(root, suite, {
      handoff,
      handoffRef,
      expectedRevision: 0,
    });
    expect(res1.revision).toBe(1);

    // Attempting to save again with stale expectedRevision: 0 fails with exitCode 3
    expect(() => {
      savePhaseState(root, suite, {
        handoff,
        handoffRef,
        expectedRevision: 0,
      });
    }).toThrowError(/CAS mismatch/);

    try {
      savePhaseState(root, suite, {
        handoff,
        handoffRef,
        expectedRevision: 0,
      });
    } catch (err: any) {
      expect(err.code).toBe('CAS_MISMATCH');
      expect(err.exitCode).toBe(3);
    }

    // Saving with matching expectedRevision: 1 succeeds
    const res2 = savePhaseState(root, suite, {
      handoff,
      handoffRef,
      expectedRevision: 1,
    });
    expect(res2.revision).toBe(2);
  });

  it('TS-U7-03 (L2): Transaction journal test simulates crash before rename and automatically recovers on subsequent run', () => {
    const { root, suite } = makeSyntheticSuite(1);
    const outputDir = path.join(root, `${suite}/output`);
    fs.mkdirSync(outputDir, { recursive: true });

    const targetFile = `${suite}/output/recovered-file.txt`;
    const fullTarget = path.join(root, targetFile);
    const content = 'Uncommitted content to be recovered\n';

    // Simulate an uncommitted transaction journal
    const journal = {
      transactionId: 'txn-recovery-test',
      oldRevision: 0,
      newRevision: 1,
      handoffRef: null,
      pendingWrites: [{ path: targetFile, content }],
    };
    fs.writeFileSync(path.join(outputDir, '.transaction.json'), JSON.stringify(journal, null, 2) + '\n');

    expect(fs.existsSync(fullTarget)).toBe(false);

    // Run journal recovery
    recoverJournal(root, suite);

    expect(fs.existsSync(fullTarget)).toBe(true);
    expect(fs.readFileSync(fullTarget, 'utf8')).toBe(content);
    expect(fs.existsSync(path.join(outputDir, '.transaction.json'))).toBe(false);
  });
});
