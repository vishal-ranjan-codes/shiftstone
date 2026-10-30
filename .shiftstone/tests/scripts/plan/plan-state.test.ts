import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveState, projectionAxes, dependencyReady, renderStatusTable } from '../../../scripts/lib/plan-state.js';
import { validateSchema } from '../../../scripts/lib/plan-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURES_DIR = path.join(ROOT, 'tests/fixtures/planning');

function loadJson(file: string) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8'));
}

describe('Unit U7 — Deterministic State Projector (plan-state.js) (REQ-07)', () => {
  const manifest = loadJson('manifest-valid.json');
  const handoff = loadJson('handoff-valid.json');

  it('AC-U7-01 / TS-U7-01 (L1): deriveState projects 4 status axes and marks acceptance complete only when all gates pass with 0 blocking issues', () => {
    // 1. Fully compliant case: implemented, all checks passed, disjoint review approved, 0 blocking issues
    const validReport = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-20261027-001',
      timestamp: '2026-10-27T12:00:00.000Z',
      targetId: 'P1',
      makerAgentId: 'synthetic-maker',
      reviewerAgentId: 'synthetic-reviewer',
      contextIsolation: 'disjoint',
      executionMode: 'full',
      autofixPolicy: 'report-only',
      lensesApplied: ['core-lens'],
      dimensions: {
        task_success: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Passes specs' },
        tool_use_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Clean tools' },
        trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Strict ICM' },
        hallucination: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'No hallucinations' },
        response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Thorough output' },
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

    const stateComplete = deriveState(manifest, [handoff], [validReport]);
    expect(stateComplete.schema).toBe('plan-state/v1');
    expect(stateComplete.suiteId).toBe(manifest.suiteId);

    const schemaErrors = validateSchema(stateComplete, 'plan-state/v1');
    expect(schemaErrors).toEqual([]);

    const p1State = stateComplete.phases.find((p) => p.phaseId === 'P1');
    expect(p1State).toBeDefined();
    expect(p1State?.implementation).toBe('implemented');
    expect(p1State?.verification).toBe('passed');
    expect(p1State?.review).toBe('approved');
    expect(p1State?.acceptance).toBe('complete');
  });

  it('AC-U7-02 (REQ-07): Evaluates verification freshness: failing check -> failed; missing check -> pending; unattempted -> not-run', () => {
    // A: Failing check
    const failingHandoff = structuredClone(handoff);
    failingHandoff.checks[0].result = 'failed';
    failingHandoff.checks[0].exitCode = 1;
    const stateFailed = deriveState(manifest, [failingHandoff], []);
    const p1Failed = stateFailed.phases.find((p) => p.phaseId === 'P1');
    expect(p1Failed?.verification).toBe('failed');
    expect(p1Failed?.acceptance).toBe('open');

    // B: Pending check (e.g. stale digest / fresh === false or pending visual test) -> pending
    const pendingHandoff = structuredClone(handoff);
    pendingHandoff.checks[0].fresh = false; // Stale digest or pending
    const statePending = deriveState(manifest, [pendingHandoff], []);
    const p1Pending = statePending.phases.find((p) => p.phaseId === 'P1');
    expect(p1Pending?.verification).toBe('pending');
    expect(p1Pending?.acceptance).toBe('open');

    // C: Not run
    const notRunHandoff = structuredClone(handoff);
    notRunHandoff.checks = notRunHandoff.checks.map((c: any) => ({ ...c, result: 'not-run' }));
    const stateNotRun = deriveState(manifest, [notRunHandoff], []);
    const p1NotRun = stateNotRun.phases.find((p) => p.phaseId === 'P1');
    expect(p1NotRun?.verification).toBe('not-run');
  });

  it('AC-U7-03 (REQ-07): Evaluates independent review: maps disjoint + distinct reviewer report, rejects same actor or nondisjoint', () => {
    // Same actor (maker === reviewer) -> review pending / invalid
    const invalidActorReport = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-20261027-002',
      targetId: 'P1',
      makerAgentId: 'synthetic-maker',
      reviewerAgentId: 'synthetic-maker', // SAME actor!
      contextIsolation: 'disjoint',
      status: 'APPROVED',
      scoring: { normalizedScore: 90 },
    };
    const stateSameActor = deriveState(manifest, [handoff], [invalidActorReport]);
    const p1SameActor = stateSameActor.phases.find((p) => p.phaseId === 'P1');
    expect(p1SameActor?.review).toBe('pending');
    expect(p1SameActor?.acceptance).toBe('open');

    // Non-disjoint report
    const nonDisjointReport = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-20261027-003',
      targetId: 'P1',
      makerAgentId: 'synthetic-maker',
      reviewerAgentId: 'distinct-reviewer',
      contextIsolation: 'shared', // NOT disjoint!
      status: 'APPROVED',
      scoring: { normalizedScore: 90 },
    };
    const stateNonDisjoint = deriveState(manifest, [handoff], [nonDisjointReport]);
    const p1NonDisjoint = stateNonDisjoint.phases.find((p) => p.phaseId === 'P1');
    expect(p1NonDisjoint?.review).toBe('pending');

    // Rejected report
    const rejectedReport = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-20261027-004',
      targetId: 'P1',
      makerAgentId: 'synthetic-maker',
      reviewerAgentId: 'distinct-reviewer',
      contextIsolation: 'disjoint',
      status: 'REJECTED',
      scoring: { normalizedScore: 50 },
    };
    const stateRejected = deriveState(manifest, [handoff], [rejectedReport]);
    const p1Rejected = stateRejected.phases.find((p) => p.phaseId === 'P1');
    expect(p1Rejected?.review).toBe('rejected');
    expect(p1Rejected?.acceptance).toBe('open');
  });

  it('asserts blocking issues hold acceptance open even when all other gates pass', () => {
    const validReport = {
      targetId: 'P1',
      reviewerAgentId: 'distinct-reviewer',
      contextIsolation: 'disjoint',
      status: 'APPROVED',
      scoring: { normalizedScore: 95 },
    };

    const blockedHandoff = structuredClone(handoff);
    blockedHandoff.issues = [
      {
        id: 'critical-blocking-issue',
        summary: 'Regression found in core',
        owner: 'qa',
        impact: 'blocks release',
        blockingPhaseIds: ['P1'],
        evidenceRefs: [],
      },
    ];

    const stateBlocked = deriveState(manifest, [blockedHandoff], [validReport]);
    const p1 = stateBlocked.phases.find((p) => p.phaseId === 'P1');
    expect(p1?.acceptance).toBe('open');
  });

  it('renders markdown status table correctly', () => {
    const phases = [
      { phaseId: 'P1', implementation: 'implemented', verification: 'passed', review: 'approved', acceptance: 'complete' },
      { phaseId: 'P2', implementation: 'in-progress', verification: 'pending', review: 'not-requested', acceptance: 'open' },
    ];
    const table = renderStatusTable(phases);
    expect(table).toContain('| Phase | Implementation | Verification | Review | Acceptance |');
    expect(table).toContain('| P1 | implemented | passed | approved | complete |');
    expect(table).toContain('| P2 | in-progress | pending | not-requested | open |');
  });

  it('dependencyReady correctly verifies predecessor readiness', () => {
    const completeAxes = { implementation: 'implemented', verification: 'passed', review: 'approved', acceptance: 'complete' };
    const openAxes = { implementation: 'in-progress', verification: 'pending', review: 'not-requested', acceptance: 'open' };

    expect(dependencyReady(completeAxes, { phaseId: 'P1', requires: 'complete', reason: 'Consumes P1' })).toBe(true);
    expect(dependencyReady(openAxes, { phaseId: 'P1', requires: 'complete', reason: 'Consumes P1' })).toBe(false);
    expect(dependencyReady(completeAxes, { phaseId: 'P1', requires: 'complete', reason: 'Consumes P1' }, { blockingIssue: true })).toBe(false);
  });

  it('AC-U7-05: projectionAxes correctly marks open acceptance and captures failed/unapproved states', () => {
    const axes = projectionAxes({
      implementation: 'in-progress',
      checks: [{ id: 'chk-1', required: true, result: 'failed', fresh: true }],
      definitionFresh: true,
      requiredReview: true,
      reviewVerdict: 'REJECTED',
      reviewRequested: true,
      reviewFresh: true,
      disjoint: true,
      distinctActor: true,
      humanApprovalRequired: true,
      humanApprovalValid: false,
      blockingIssue: true,
    });

    expect(axes.acceptance).toBe('open');
    expect(axes.verification).toBe('failed');
    expect(axes.review).toBe('rejected');
    expect(axes.implementation).toBe('in-progress');
  });
});
