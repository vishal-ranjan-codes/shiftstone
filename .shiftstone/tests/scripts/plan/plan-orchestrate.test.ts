import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../../../scripts/plan.js';
import { runOrchestrate } from '../../../scripts/lib/plan-orchestrate.js';
import { validateSchema } from '../../../scripts/lib/plan-schema.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');

describe('Unit U11 — Author plan.js orchestrate CLI Command (REQ-11)', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-orchestrate-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('TS-U11-01 (L1): CLI argument parsing validates --phase, --parallel-checkers, and --worktree options', () => {
    const argv = [
      'node',
      'plan.js',
      'orchestrate',
      'docs/plans/sample-suite',
      '--phase',
      'P2',
      '--parallel-checkers',
      '--worktree',
      '--json',
    ];

    const parsed = parseArgs(argv);
    expect(parsed.action).toBe('orchestrate');
    expect(parsed.suite).toBe('docs/plans/sample-suite');
    expect(parsed.options.phase).toBe('P2');
    expect(parsed.options.parallelCheckers).toBe(true);
    expect(parsed.options.worktree).toBe(true);
    expect(parsed.options.json).toBe(true);
  });

  it('TS-U11-02 (L1): Vitest simulation asserts CLI exits with correct status codes matching Governor terminal states', async () => {
    const suiteDir = path.join(tmpRoot, 'docs', 'plans', 'mock-suite');
    fs.mkdirSync(suiteDir, { recursive: true });

    const mockManifest = {
      schema: 'plan-manifest/v1',
      suiteId: 'mock-suite',
      definitionRevision: 1,
      phases: [
        {
          phaseId: 'P1',
          contract: 'docs/plans/mock-suite/p1.md',
          unitIds: ['U1'],
          dependsOn: [],
          sourcePaths: ['.shiftstone/scripts'],
          checks: [
            {
              id: 'c1',
              acceptanceIds: ['AC-U1-01'],
              level: 1,
              kind: 'automated',
              required: true,
              regressionFor: [],
              sourcePaths: ['.shiftstone/scripts'],
              environmentKeys: ['node-version'],
              runner: { executable: 'node', args: ['--version'], cwd: '.' },
            },
          ],
          requiredReview: true,
          humanApprovalRequired: false,
          recovery: { retry: 'retry', rollback: 'rollback' },
        },
      ],
    };

    fs.writeFileSync(path.join(suiteDir, 'plan-manifest.json'), JSON.stringify(mockManifest, null, 2), 'utf8');

    // 1. Success simulation -> exit code 0
    const successResult = await runOrchestrate(tmpRoot, 'docs/plans/mock-suite', {
      dispatcher: async (phaseId) => ({
        phaseId,
        exitCode: 0,
        status: 'success' as const,
      }),
    });
    expect(successResult.exitCode).toBe(0);
    expect(successResult.status).toBe('completed');

    // 2. Blocked simulation -> exit code 2
    const blockedResult = await runOrchestrate(tmpRoot, 'docs/plans/mock-suite', {
      dispatcher: async (phaseId) => ({
        phaseId,
        exitCode: 2,
        status: 'blocked' as const,
        error: 'External dependency unavailable',
      }),
    });
    expect(blockedResult.exitCode).toBe(2);
    expect(blockedResult.status).toBe('blocked');

    // 3. Fatal error / non-existent suite -> exit code 1
    const errorResult = await runOrchestrate(tmpRoot, 'docs/plans/non-existent-suite', {});
    expect(errorResult.exitCode).toBe(1);
    expect(errorResult.status).toBe('failed');
  });
});

describe('Unit U10 & U12 — Skill Upgrades & Manifest Template Hardening (REQ-10, REQ-12)', () => {
  it('TS-U10-02 (L2): Governor prompt template verifies zero placeholders and proper token constraints', () => {
    const promptPath = path.resolve(REPO_ROOT, '.agents/skills/ss-execute-plan/resources/governor-prompt.md');
    expect(fs.existsSync(promptPath)).toBe(true);
    const content = fs.readFileSync(promptPath, 'utf8');

    // Zero TODO / TBD placeholders
    expect(content).not.toMatch(/\b(TODO|TBD|PLACEHOLDER)\b/i);

    // Enforces <= 4500 token ceiling
    expect(content).toMatch(/4,?500\s*tokens?/);

    // References Autonomous Governor
    expect(content).toMatch(/Autonomous Governor/);
  });

  it('TS-U12-02 (L2): Template validation verifies plan-manifest-template.json adheres to plan-manifest-v1.schema.json', () => {
    const templatePath = path.resolve(REPO_ROOT, '.agents/skills/ss-plan/resources/plan-manifest-template.json');
    expect(fs.existsSync(templatePath)).toBe(true);
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    const errors = validateSchema(template, 'plan-manifest/v1');
    expect(errors).toEqual([]);
    expect(template.phases.length).toBeGreaterThanOrEqual(1);
  });
});
