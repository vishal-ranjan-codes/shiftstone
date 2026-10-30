import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSuite } from '../../../scripts/lib/plan-schema.js';
import { generateWorkerSpec } from '../../../scripts/lib/plan-worker-spec.js';
import { runOrchestrate } from '../../../scripts/lib/plan-orchestrate.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');

describe('Unit 1: Harness Hardening & CLI Ergonomics', () => {
  it('TS-U1-01: normalizeSuite automatically resolves docs/plans/ prefix and cleans slashes', () => {
    const slug = 'universal-design-system-and-palette-picker';
    const normalized = normalizeSuite(REPO_ROOT, slug);
    expect(normalized).toBe(`docs/plans/${slug}`);

    const withTrailing = normalizeSuite(REPO_ROOT, `${slug}/`);
    expect(withTrailing).toBe(`docs/plans/${slug}`);

    const direct = normalizeSuite(REPO_ROOT, `docs/plans/${slug}`);
    expect(direct).toBe(`docs/plans/${slug}`);
  });

  it('TS-U1-02: generateWorkerSpec emits valid bounded invocation spec under 4,500 tokens', () => {
    const result = generateWorkerSpec(
      REPO_ROOT,
      'universal-design-system-and-palette-picker',
      'P1'
    );

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.phaseId).toBe('P1');
    expect(result.tokenEstimate).toBeLessThanOrEqual(4500);

    const spec = result.spec;
    expect(spec.TypeName).toBe('self');
    expect(spec.Role).toBe('Ephemeral Plan Worker [P1]');
    expect(spec.Workspace).toBe('inherit');
    expect(spec.Prompt).toContain('Active Assignment: Phase P1');
    expect(spec.Prompt).toContain('Bounded readTargets');
    expect(spec.Prompt).toContain('Required Execution Commands');
  });

  it('TS-U1-03: runOrchestrate halts with exit code 2 when a downstream phase is blocked or incomplete', async () => {
    const res = await runOrchestrate(REPO_ROOT, 'universal-design-system-and-palette-picker');
    expect(res.exitCode).toBe(2);
    expect(res.status).toBe('blocked');
    expect(res.summary.phaseResults['P1']?.status).toBe('success');
    const incompletePhase = Object.values(res.summary.phaseResults).find((p) => p.status !== 'success');
    expect(incompletePhase?.status).toBe('blocked');
  });
});
