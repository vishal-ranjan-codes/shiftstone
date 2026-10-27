import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resumePhase, suiteStatus } from '../../../scripts/lib/plan-resume.js';
import { savePhaseState } from '../../../scripts/lib/plan-storage.js';
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-resume-'));
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

function makeSyntheticHandoff(root: string, plan: any, phase: any, { status = 'complete', checkResult = 'passed' } = {}) {
  const snap = snapshot(root, phaseScopes(phase), phaseEnvironmentKeys(phase));
  const defHash = definitionHash(root, plan.suite, phase, plan.units);
  const rawPath = `${plan.suite}/output/raw.txt`;
  write(root, rawPath, 'Fixture check evidence.\n');
  const rawRef = { path: rawPath, sha256: sha256(fs.readFileSync(path.join(root, rawPath))) };

  const isComplete = status === 'complete';
  const reportPath = `${plan.suite}/output/checker-${phase.phaseId}.json`;
  const report = {
    schemaVersion: 'checker-report/v1',
    reportId: `RPT-${phase.phaseId}`,
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
    status: isComplete ? 'APPROVED' : 'REVISE',
  };
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
    event: isComplete ? 'close' : 'checkpoint',
    implementation: isComplete ? 'implemented' : 'in-progress',
    terminalState: isComplete ? 'success' : 'pending',
    summary: `Phase ${phase.phaseId} state`,
    changes: [{ path: 'source.txt', reason: 'Change', unitIds: phase.unitIds }],
    deviations: [],
    materialContext: [],
    issues: [],
    entrySnapshot: snap,
    exitSnapshot: structuredClone(snap),
    checks: phase.checks.map((check: any) => {
      const own = snapshot(root, check.sourcePaths, check.environmentKeys);
      return {
        checkId: check.id,
        result: checkResult,
        observedAt: '2026-10-27T12:00:00Z',
        sourceDigest: own.scopeDigest,
        environmentDigest: own.environmentDigest,
        exitCode: checkResult === 'passed' ? 0 : 1,
        evidenceRefs: [rawRef],
        reason: 'Check outcome',
      };
    }),
    reviewRefs: [reportRef],
    approvalRefs: [],
    reviewRequest: null,
    next: { phaseId: null, entryConditions: [], firstAction: 'Next' },
    preservation: [],
  };

  const handoffPath = `${plan.suite}/output/handoffs/${phase.phaseId}/attempt-001.json`;
  const handoffContent = JSON.stringify(handoff, null, 2) + '\n';
  const handoffRef = { path: handoffPath, sha256: sha256(Buffer.from(handoffContent)) };

  return { handoff, handoffRef };
}

describe('Unit U8 — Bounded Phase Resumption Engine & readTargets (plan-resume.js) (REQ-08)', () => {
  it('TS-U8-01 (L1): resumePhase in implement mode fails with exit code 2 when predecessor is only in-progress', () => {
    const { root, suite, plan } = makeSyntheticSuite(2);
    const p1 = plan.manifest.phases[0];

    // Save P1 as in-progress (not complete)
    const { handoff, handoffRef } = makeSyntheticHandoff(root, plan, p1, { status: 'in-progress', checkResult: 'passed' });
    savePhaseState(root, suite, { handoff, handoffRef });

    // Attempt to resume P2 in implement mode
    const res = resumePhase(root, suite, 'P2', { mode: 'implement', debug: true });
    expect(res.ready).toBe(false);
    expect(res.exitCode).toBe(2);
    expect(res.diagnostics.some((d) => d.code === 'UNMET_PREDECESSOR')).toBe(true);
    expect(res.firstAction).toContain('Resolve unmet prerequisite(s)');
  });

  it('TS-U8-02 (L2): resumePhase in remediate mode succeeds with exit code 0 on a phase with failed tests, identifying the specific check to fix', () => {
    const { root, suite, plan } = makeSyntheticSuite(2);
    const p1 = plan.manifest.phases[0];

    // Save P1 as complete so P2 prerequisites are satisfied
    const p1Data = makeSyntheticHandoff(root, plan, p1, { status: 'complete', checkResult: 'passed' });
    savePhaseState(root, suite, { handoff: p1Data.handoff, handoffRef: p1Data.handoffRef });

    // Save P2 with failed check
    const p2 = plan.manifest.phases[1];
    const p2Data = makeSyntheticHandoff(root, plan, p2, { status: 'in-progress', checkResult: 'failed' });
    savePhaseState(root, suite, { handoff: p2Data.handoff, handoffRef: p2Data.handoffRef });

    // Resume P2 in remediate mode
    const res = resumePhase(root, suite, 'P2', { mode: 'remediate' });
    expect(res.ready).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.mode).toBe('remediate');
    expect(res.firstAction).toContain('check-2');
  });

  it('TS-U8-03 (L2): Context bounding test verifies synthesized readTargets total size does not exceed 4,500 tokens', () => {
    const { root, suite, plan } = makeSyntheticSuite(2);
    const p1 = plan.manifest.phases[0];
    const p1Data = makeSyntheticHandoff(root, plan, p1, { status: 'complete', checkResult: 'passed' });
    savePhaseState(root, suite, { handoff: p1Data.handoff, handoffRef: p1Data.handoffRef });

    const res = resumePhase(root, suite, 'P2', { mode: 'implement' });
    expect(res.ready).toBe(true);
    expect(res.exitCode).toBe(0);
    expect(res.readTargets.length).toBeGreaterThan(0);

    // Assert determinism & required elements
    expect(res.readTargets.some((t) => t.endsWith('README.md'))).toBe(true);
    expect(res.readTargets.some((t) => t.endsWith('phase-2.md'))).toBe(true);
    expect(res.readTargets.some((t) => t.includes('plan-units/U2.json'))).toBe(true);
    expect(res.readTargets.some((t) => t.includes('attempt-001.json'))).toBe(true); // predecessor handoff

    // Verify regression check IDs synthesized
    expect(res.regressionCheckIds).toContain('check-2');

    // Calculate total character count and estimated token count (1 token ~= 4 chars)
    let totalChars = 0;
    for (const target of res.readTargets) {
      const full = path.join(root, target);
      if (fs.existsSync(full)) {
        totalChars += fs.readFileSync(full, 'utf8').length;
      }
    }
    const estimatedTokens = Math.ceil(totalChars / 4);
    // Bounded context requirement: <= 4,500 tokens
    expect(estimatedTokens).toBeLessThanOrEqual(4500);
  });

  it('suiteStatus correctly returns suite health and formatted status table', () => {
    const { root, suite } = makeSyntheticSuite(2);
    const status = suiteStatus(root, suite);
    expect(status.exitCode).toBe(0);
    expect(status.statusTable).toContain('| Phase | Implementation | Verification | Review | Acceptance |');
    expect(status.phases.length).toBe(2);
  });
});
