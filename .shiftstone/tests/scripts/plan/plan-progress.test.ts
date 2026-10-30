import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderProgressBar,
  extractPhaseTitle,
  renderPlanProgressTable,
  renderPhaseCompletionCard,
} from '../../../scripts/lib/plan-progress.js';
import { runCli } from '../../../scripts/plan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function write(root: string, rel: string, content: string) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function writeJson(root: string, rel: string, data: any) {
  write(root, rel, JSON.stringify(data, null, 2) + '\n');
}

function stageContract(ids: string[]) {
  return `---
type: "ICM Stage"
title: "Phase 1 — Test Feature Title"
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

function makeSyntheticSuite(count = 3) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-progress-'));
  const suite = 'docs/plans/sample-progress';
  write(root, 'source.txt', 'source content\n');
  write(root, `${suite}/README.md`, '# Sample Progress Suite\n\nOverview.\n');

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
                reason: 'Consume predecessor phase.',
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
      requiredReview: false,
      humanApprovalRequired: false,
      recovery: {
        retry: 'Repair source and retry check.',
        rollback: 'Revert uncommitted modifications.',
      },
    });
  }

  writeJson(root, `${suite}/plan-manifest.json`, {
    schema: 'plan-manifest/v1',
    suiteId: 'sample-progress',
    definitionRevision: 1,
    phases,
  });

  return { root, suite };
}

describe('Visual Plan Progress Engine (plan-progress.js)', () => {
  describe('renderProgressBar', () => {
    it('computes correct Unicode block progress bar at 0%, 50%, 60%, and 100%', () => {
      expect(renderProgressBar(0, 5, 10)).toBe('[░░░░░░░░░░] 0% (0/5 Phases Complete)');
      expect(renderProgressBar(3, 5, 10)).toBe('[██████░░░░] 60% (3/5 Phases Complete)');
      expect(renderProgressBar(5, 5, 10)).toBe('[██████████] 100% (5/5 Phases Complete)');
      expect(renderProgressBar(1, 2, 10)).toBe('[█████░░░░░] 50% (1/2 Phases Complete)');
    });

    it('handles boundary conditions safely without NaN', () => {
      expect(renderProgressBar(0, 0)).toBe('[░░░░░░░░░░] 0% (0/0 Phases Complete)');
      expect(renderProgressBar(10, 5)).toBe('[██████████] 100% (5/5 Phases Complete)');
      expect(renderProgressBar(-1, 5)).toBe('[░░░░░░░░░░] 0% (0/5 Phases Complete)');
    });
  });

  describe('extractPhaseTitle', () => {
    it('extracts title from frontmatter title attribute', () => {
      const { root, suite } = makeSyntheticSuite(1);
      const title = extractPhaseTitle(root, `${suite}/phase-1.md`, 'Fallback');
      expect(title).toBe('Phase 1 — Test Feature Title');
    });

    it('extracts title from markdown H1 when frontmatter is absent', () => {
      const { root, suite } = makeSyntheticSuite(1);
      write(root, `${suite}/h1-only.md`, '# Core Architecture Setup\n\nSome body text.');
      const title = extractPhaseTitle(root, `${suite}/h1-only.md`, 'Fallback');
      expect(title).toBe('Core Architecture Setup');
    });

    it('falls back gracefully when file does not exist', () => {
      const title = extractPhaseTitle(ROOT, 'docs/non-existent.md', 'Default Fallback');
      expect(title).toBe('Default Fallback');
    });
  });

  describe('renderPlanProgressTable', () => {
    it('renders structured markdown table with progress bar and correct badges', () => {
      const { root, suite } = makeSyntheticSuite(3);

      // Simulate P1 completed in state.json
      const state = {
        schema: 'plan-state/v1',
        suiteId: 'sample-progress',
        phases: [
          { phaseId: 'P1', implementation: 'implemented', verification: 'passed', review: 'approved', acceptance: 'complete' },
          { phaseId: 'P2', implementation: 'in-progress', verification: 'pending', review: 'not-requested', acceptance: 'open' },
          { phaseId: 'P3', implementation: 'planned', verification: 'not-run', review: 'not-requested', acceptance: 'open' },
        ],
      };
      writeJson(root, `${suite}/output/state.json`, state);

      const table = renderPlanProgressTable(root, suite, {
        activePhase: 'P2',
        worker: 'Ephemeral Plan Worker [P2]',
      });

      expect(table).toContain('### 🚀 Plan Execution Progress: `sample-progress`');
      expect(table).toContain('[███░░░░░░░] 33% (1/3 Phases Complete)');
      expect(table).toContain('| **P1** | Test Feature Title | ✅ **Complete** |');
      expect(table).toContain('| **P2** | Test Feature Title | 🔄 **In Progress** | Worker: `Ephemeral Plan Worker [P2]` |');
      expect(table).toContain('| **P3** | Test Feature Title | ⏳ **Pending** |');
      expect(table).toContain('**Active Assignment:** Phase P2');
      expect(table).toContain('**Subagent Worker:** `Ephemeral Plan Worker [P2]`');
    });
  });

  describe('renderPhaseCompletionCard', () => {
    it('formats clean milestone card with summary, artifacts, and verification', () => {
      const { root, suite } = makeSyntheticSuite(1);
      const handoff = {
        summary: 'Synthesized dynamic palettes and rendered preview',
        changes: [{ path: 'source.txt' }, { path: 'docs/brand/tokens.json' }],
        checks: [{ checkId: 'check-1', result: 'passed' }],
      };

      const card = renderPhaseCompletionCard(root, suite, 'P1', handoff);
      expect(card).toContain('### ✅ Phase P1 Closed Successfully: Phase 1 — Test Feature Title');
      expect(card).toContain('- **Summary:** Synthesized dynamic palettes and rendered preview');
      expect(card).toContain('- **Key Artifacts:** `source.txt`, `docs/brand/tokens.json`');
      expect(card).toContain('- **Verification:** 1/1 check(s) passed green');
    });
  });

  describe('CLI plan.js progress command', () => {
    it('runs plan.js progress and outputs formatted table with exit code 0', () => {
      const { root, suite } = makeSyntheticSuite(2);
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (msg: string) => { logs.push(msg); };

      try {
        const code = runCli(['node', 'plan.js', 'progress', suite, '--active', 'P1'], root);
        expect(code).toBe(0);
        const output = logs.join('\n');
        expect(output).toContain('### 🚀 Plan Execution Progress: `sample-progress`');
        expect(output).toContain('| Phase | Scope / Title | Status | Details |');
        expect(output).toContain('**P1**');
        expect(output).toContain('🔄 **In Progress**');
      } finally {
        console.log = origLog;
      }
    });
  });
});
