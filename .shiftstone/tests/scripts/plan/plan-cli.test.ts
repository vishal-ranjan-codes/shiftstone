import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runCli } from '../../../scripts/plan.js';
import { renderStatus } from '../../../scripts/lib/plan-render.js';
import { snapshot, sha256 } from '../../../scripts/lib/plan-source.js';

const SHIFTSTONE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKSPACE_ROOT = path.resolve(SHIFTSTONE_DIR, '..');
const PLAN_CLI_PATH = path.join(WORKSPACE_ROOT, '.shiftstone/scripts/plan.js');
const BIN_PLAN_PATH = path.join(WORKSPACE_ROOT, 'bin/plan.js');

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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-cli-'));
  const suite = 'docs/plans/sample';
  write(root, 'source.txt', 'source content\n');
  const readmeContent = `# Sample Plan Suite

## Overview
This is a sample implementation plan suite.

<!-- plan-status:start -->
| Phase | Implementation | Verification | Review | Acceptance |
|---|---|---|---|---|
| P1 | planned | not-run | not-requested | open |
<!-- plan-status:end -->

## Details
Additional immutable details preserved across status rendering.
`;
  write(root, `${suite}/README.md`, readmeContent);

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

  return { root, suite };
}

describe('Unit U9 — Plan CLI Orchestrator & README Span Renderer (REQ-09)', () => {
  it('TS-U9-01 (L1): CLI test runs plan.js status and asserts exit code 0 with formatted status table', () => {
    const { root, suite } = makeSyntheticSuite(2);

    // Call CLI status in-process
    const code = runCli(['node', 'plan.js', 'status', suite], root);
    expect(code).toBe(0);

    // Call CLI status via child process
    const output = execFileSync(process.execPath, [PLAN_CLI_PATH, 'status', suite], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(output).toContain('Suite: sample');
    expect(output).toContain('| Phase | Implementation | Verification | Review | Acceptance |');
    expect(output).toContain('| P1 | planned | not-run | not-requested | open |');
  });

  it('TS-U9-02 (L2): Execution test simulates begin -> verify -> checkpoint -> close lifecycle', () => {
    const { root, suite } = makeSyntheticSuite(1);

    // 1. Begin phase P1
    const beginCode = runCli(['node', 'plan.js', 'begin', suite, '--phase', 'P1'], root);
    expect(beginCode).toBe(0);
    const attempt1Path = path.join(root, `${suite}/output/handoffs/P1/attempt-001.json`);
    expect(fs.existsSync(attempt1Path)).toBe(true);

    const attempt1 = JSON.parse(fs.readFileSync(attempt1Path, 'utf8'));
    expect(attempt1.implementation).toBe('in-progress');
    expect(attempt1.event).toBe('checkpoint');

    // 2. Verify check-1
    const verifyCode = runCli(['node', 'plan.js', 'verify', suite, '--phase', 'P1', '--check', 'check-1'], root);
    expect(verifyCode).toBe(0);

    // Check evidence was written
    const checksDir = path.join(root, `${suite}/output/checks`);
    expect(fs.existsSync(checksDir)).toBe(true);
    const checkFiles = fs.readdirSync(checksDir);
    expect(checkFiles.some((f) => f.startsWith('check-1'))).toBe(true);
    const checkEvidencePath = path.join(checksDir, checkFiles[0]);
    const checkEvidenceRef = {
      path: `${suite}/output/checks/${checkFiles[0]}`,
      sha256: sha256(fs.readFileSync(checkEvidencePath)),
    };

    // 3. Create independent checker report for P1
    const snap = snapshot(root, ['source.txt'], ['node-version']);
    const reportPath = `${suite}/output/checker-p1.json`;
    const report = {
      schemaVersion: 'checker-report/v1',
      reportId: 'RPT-CLI-P1',
      timestamp: '2026-10-27T12:00:00.000Z',
      targetId: 'P1',
      makerAgentId: 'synthetic-maker',
      reviewerAgentId: 'independent-reviewer',
      contextIsolation: 'disjoint',
      executionMode: 'full',
      autofixPolicy: 'report-only',
      lensesApplied: ['core-lens'],
      dimensions: {
        task_success: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Full task completion' },
        tool_use_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Full task completion' },
        trajectory_compliance: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Full task completion' },
        hallucination: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Full task completion' },
        response_quality: { raw: 2, weight: 0.2, weighted: 0.4, rationale: 'Full task completion' },
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
    write(root, reportPath, JSON.stringify(report, null, 2) + '\n');
    const reportRef = { path: reportPath, sha256: sha256(fs.readFileSync(path.join(root, reportPath))) };

    // 4. Checkpoint phase with facts
    const facts = {
      actor: { id: 'synthetic-maker', role: 'maker' },
      summary: 'Completed unit implementation and verified runner',
      changes: [{ path: 'source.txt', reason: 'Implemented U1', unitIds: ['U1'] }],
      checks: [
        {
          checkId: 'check-1',
          result: 'passed',
          observedAt: new Date().toISOString(),
          sourceDigest: snap.scopeDigest,
          environmentDigest: snap.environmentDigest,
          exitCode: 0,
          evidenceRefs: [checkEvidenceRef],
          reason: 'Automated runner passed.',
        },
      ],
      reviewRefs: [reportRef],
    };
    const factsFile = `${suite}/output/facts.json`;
    write(root, factsFile, JSON.stringify(facts, null, 2) + '\n');

    const checkpointCode = runCli(
      ['node', 'plan.js', 'checkpoint', suite, '--phase', 'P1', '--facts', factsFile],
      root
    );
    expect(checkpointCode).toBe(0);

    const attempt2Path = path.join(root, `${suite}/output/handoffs/P1/attempt-002.json`);
    expect(fs.existsSync(attempt2Path)).toBe(true);

    // 5. Close phase P1
    const closeCode = runCli(['node', 'plan.js', 'close', suite, '--phase', 'P1', '--facts', factsFile], root);
    expect(closeCode).toBe(0);

    // Verify state.json was updated with acceptance === complete
    const statePath = path.join(root, `${suite}/output/state.json`);
    expect(fs.existsSync(statePath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const p1State = state.phases.find((p: any) => p.phaseId === 'P1');
    expect(p1State?.implementation).toBe('implemented');
    expect(p1State?.verification).toBe('passed');
    expect(p1State?.review).toBe('approved');
    expect(p1State?.acceptance).toBe('complete');
  });

  it('TS-U9-03 (L2): Render test asserts render --write updates only markdown status span and leaves surrounding text byte-identical', () => {
    const { root, suite } = makeSyntheticSuite(1);
    const readmeFull = path.join(root, `${suite}/README.md`);
    const initialContent = fs.readFileSync(readmeFull, 'utf8');

    const beforeSpan = initialContent.split('<!-- plan-status:start -->')[0];
    const afterSpan = initialContent.split('<!-- plan-status:end -->')[1];

    // Call render with --write
    const res = renderStatus(root, suite, { write: true });
    expect(res.exitCode).toBe(0);
    expect(res.success).toBe(true);

    const updatedContent = fs.readFileSync(readmeFull, 'utf8');
    const updatedBefore = updatedContent.split('<!-- plan-status:start -->')[0];
    const updatedAfter = updatedContent.split('<!-- plan-status:end -->')[1];

    // Surrounding text before and after markers must remain byte-identical
    expect(updatedBefore).toBe(beforeSpan);
    expect(updatedAfter).toBe(afterSpan);
    expect(updatedContent).toContain('| Phase | Implementation | Verification | Review | Acceptance |');
  });

  it('AC-U9-04: bin/plan.js wrapper executes seamlessly', () => {
    const { root, suite } = makeSyntheticSuite(1);

    const output = execFileSync(process.execPath, [BIN_PLAN_PATH, 'status', suite], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(output).toContain('Suite: sample');
    expect(output).toContain('| Phase | Implementation | Verification | Review | Acceptance |');
  });

  it('TS-U9-05: close emits verbose diagnostics when acceptance fails and auto-binds active governance approvals', () => {
    const { root, suite } = makeSyntheticSuite(1);
    const snap = snapshot(root, ['source.txt'], ['node-version']);

    const factsFile = `${suite}/output/unverified-facts.json`;
    write(
      root,
      factsFile,
      JSON.stringify(
        {
          actor: { id: 'synthetic-maker', role: 'maker' },
          summary: 'Incomplete implementation',
          changes: [{ path: 'source.txt', reason: 'Attempt 1', unitIds: ['U1'] }],
          checks: [
            {
              checkId: 'check-1',
              result: 'failed',
              observedAt: new Date().toISOString(),
              sourceDigest: snap.scopeDigest,
              environmentDigest: snap.environmentDigest,
              exitCode: 1,
              evidenceRefs: [],
              reason: 'Failed test',
            },
          ],
        },
        null,
        2
      )
    );

    const errors: string[] = [];
    const origError = console.error;
    console.error = (msg: string) => {
      errors.push(msg);
    };

    try {
      const code = runCli(['node', 'plan.js', 'close', suite, '--phase', 'P1', '--facts', factsFile], root);
      expect(code).toBe(2);
      const combined = errors.join('\n');
      expect(combined).toContain('Close blocked: acceptance is open for phase P1.');
      expect(combined).toContain('Unmet gate checklist:');
      expect(combined).toContain('verification:   failed (expected: passed)');
    } finally {
      console.error = origError;
    }
  });

  it('TS-U9-06: close auto-binds active governance approval for protected action paths', () => {
    const { root, suite } = makeSyntheticSuite(1);

    const unit1Path = path.join(root, `${suite}/plan-units/U1.json`);
    const unit1 = JSON.parse(fs.readFileSync(unit1Path, 'utf8'));
    unit1.targetFiles = ['.shiftstone/governance/rules.md'];
    fs.writeFileSync(unit1Path, JSON.stringify(unit1, null, 2) + '\n');

    const manifestPath = path.join(root, `${suite}/plan-manifest.json`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest.phases[0].sourcePaths = ['.shiftstone/governance/rules.md'];
    manifest.phases[0].checks[0].sourcePaths = ['.shiftstone/governance/rules.md'];
    manifest.phases[0].requiredReview = false;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

    const approvalsDir = path.join(root, '.shiftstone/governance/approvals');
    fs.mkdirSync(approvalsDir, { recursive: true });
    const approval = {
      schemaVersion: 'protected-action-approval/v1',
      approvalId: 'APR-20261030-999',
      actionClass: 'core-governance-override',
      scopePaths: ['.shiftstone/governance/**'],
      gitTreeHash: 'workspace-head',
      approver: 'lead-architect@shiftstone.dev',
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      justification: 'Automated test approval',
      status: 'active',
    };
    write(root, '.shiftstone/governance/approvals/APR-20261030-999.json', JSON.stringify(approval, null, 2) + '\n');

    write(root, '.shiftstone/governance/rules.md', '# Protected rules');
    write(root, `${suite}/output/checks/check-1.txt`, 'evidence\n');
    const evRef = {
      path: `${suite}/output/checks/check-1.txt`,
      sha256: sha256(Buffer.from('evidence\n')),
    };
    const snap = snapshot(root, ['.shiftstone/governance/rules.md'], ['node-version']);

    const facts = {
      actor: { id: 'synthetic-maker', role: 'maker' },
      summary: 'Updated governance rules',
      changes: [{ path: '.shiftstone/governance/rules.md', reason: 'Rule update', unitIds: ['U1'] }],
      checks: [
        {
          checkId: 'check-1',
          result: 'passed',
          observedAt: new Date().toISOString(),
          sourceDigest: snap.scopeDigest,
          environmentDigest: snap.environmentDigest,
          exitCode: 0,
          evidenceRefs: [evRef],
          reason: 'Pass',
        },
      ],
    };

    const factsFile = `${suite}/output/gov-facts.json`;
    write(root, factsFile, JSON.stringify(facts, null, 2) + '\n');

    const code = runCli(['node', 'plan.js', 'close', suite, '--phase', 'P1', '--facts', factsFile], root);
    expect(code).toBe(0);

    const attempt1 = JSON.parse(
      fs.readFileSync(path.join(root, `${suite}/output/handoffs/P1/attempt-001.json`), 'utf8')
    );
    expect(attempt1.approvalRefs.length).toBeGreaterThanOrEqual(1);
    expect(attempt1.approvalRefs[0].path).toBe('.shiftstone/governance/approvals/APR-20261030-999.json');
  });
});
