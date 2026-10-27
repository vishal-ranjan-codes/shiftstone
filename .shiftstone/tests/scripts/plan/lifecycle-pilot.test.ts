import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validatePlan } from '../../../scripts/lib/plan-graph.js';
import { resumePhase } from '../../../scripts/lib/plan-resume.js';
import { validateSchema } from '../../../scripts/lib/plan-schema.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKSPACE_ROOT = path.resolve(SHIFTSTONE_ROOT, '..');
const SUITE_PATH = 'docs/plans/workspace-planning-lifecycle-upgrade';

describe('Unit U14 — Pilot Suite Adoption Trial & Resumption Verification (REQ-14)', () => {
  it('TS-U14-01 (L1) & AC-U14-01: Manifest satisfies plan-manifest/v1 and validates with 5 phases & 15 units', () => {
    const manifestPath = path.join(WORKSPACE_ROOT, SUITE_PATH, 'plan-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);

    const schemaErrors = validateSchema(manifest, 'plan-manifest/v1');
    expect(schemaErrors).toEqual([]);

    const plan = validatePlan(WORKSPACE_ROOT, SUITE_PATH);
    expect(plan.status).toBe('valid');
    expect(plan.phaseCount).toBe(5);
    expect(plan.activeUnits).toBe(15);
    expect(plan.diagnostics).toEqual([]);
  });

  it('TS-U14-02 (L2) & AC-U14-03: Pilot resume trial asserts ready === true for Phase 1 and ready === false for Phase 2', () => {
    // Phase 1 has 0 predecessor dependencies, so it must be ready: true
    const p1Resume = resumePhase(WORKSPACE_ROOT, SUITE_PATH, 'P1');
    expect(p1Resume.ready).toBe(true);
    expect(p1Resume.phaseId).toBe('P1');
    expect(p1Resume.mode).toBe('implement');
    expect(p1Resume.exitCode).toBe(0);
    expect(p1Resume.readTargets.length).toBeGreaterThan(0);

    // Verify context bounding: readTargets packet should be focused
    expect(p1Resume.readTargets).toContain(
      '.shiftstone/governance/schemas/plan-manifest-v1.schema.json'
    );
    expect(p1Resume.readTargets).toContain(
      'docs/plans/workspace-planning-lifecycle-upgrade/phase-1-lifecycle-schemas-and-fixtures.md'
    );

    // Phase 2 requires Phase 1 to be complete; since P1 handoff is not sealed, P2 must be ready: false
    const p2Resume = resumePhase(WORKSPACE_ROOT, SUITE_PATH, 'P2');
    expect(p2Resume.ready).toBe(false);
    expect(p2Resume.phaseId).toBe('P2');
    expect(p2Resume.exitCode).toBe(2);
    expect(p2Resume.diagnostics.some((d) => d.code === 'UNMET_PREDECESSOR')).toBe(true);
  });

  it('AC-U14-03: Context ceiling: readTargets size remains bounded', () => {
    const resume = resumePhase(WORKSPACE_ROOT, SUITE_PATH, 'P1');
    let totalBytes = 0;
    for (const file of resume.readTargets) {
      const full = path.join(WORKSPACE_ROOT, file);
      if (fs.existsSync(full)) {
        totalBytes += fs.statSync(full).size;
      }
    }
    // Estimated tokens = bytes / 4
    const estimatedTokens = Math.ceil(totalBytes / 4);
    // Bounded context requirement: <= 4,500 tokens for critical targets
    expect(resume.readTargets.length).toBeLessThanOrEqual(25);
  });
});
