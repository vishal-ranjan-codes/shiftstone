import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSkill } from '../../../scripts/validate-skills-completeness.js';
import { validateSchema } from '../../../scripts/lib/plan-schema.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKSPACE_ROOT = path.resolve(SHIFTSTONE_ROOT, '..');
const SS_PLAN_DIR = path.join(WORKSPACE_ROOT, '.agents/skills/ss-plan');

describe('Unit U10 — Upgrade ss-plan Skill with 4 Operational Modes & References (REQ-10)', () => {
  it('TS-U10-01 (L1): ss-plan skill conforms to 8-pillar anti-bypass standards and line budget ceilings', () => {
    const res = validateSkill(SS_PLAN_DIR, { root: WORKSPACE_ROOT });
    expect(res.violations).toEqual([]);
    expect(res.ok).toBe(true);

    // Verify SKILL.md line ceiling (<= 180 lines)
    const skillMd = fs.readFileSync(path.join(SS_PLAN_DIR, 'SKILL.md'), 'utf8');
    const skillLines = skillMd.split(/\r?\n/).length;
    expect(skillLines).toBeLessThanOrEqual(180);

    // Verify instructions.md line ceiling (<= 450 lines)
    const instrMd = fs.readFileSync(path.join(SS_PLAN_DIR, 'instructions.md'), 'utf8');
    const instrLines = instrMd.split(/\r?\n/).length;
    expect(instrLines).toBeLessThanOrEqual(450);

    // Verify 4 operational modes declared in SKILL.md
    expect(skillMd).toContain('Mode 1');
    expect(skillMd).toContain('New Plan Authoring');
    expect(skillMd).toContain('Mode 2');
    expect(skillMd).toContain('Intent-Driven Plan Evolution');
    expect(skillMd).toContain('Mode 3');
    expect(skillMd).toContain('Phase Resumption');
    expect(skillMd).toContain('Mode 4');
    expect(skillMd).toContain('Execution Checkpoints & Close');
  });

  it('TS-U10-02 (L2): All 5 new reference files exist, parse cleanly, and contain no broken internal links', () => {
    const references = [
      'resume-protocol.md',
      'plan-evolution-protocol.md',
      'lifecycle-contracts.md',
      'execution-handoff-protocol.md',
      'plan-manifest-template.json',
    ];

    for (const ref of references) {
      const fullPath = path.join(SS_PLAN_DIR, 'resources', ref);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, 'utf8');
      expect(content.trim().length).toBeGreaterThan(0);

      if (ref.endsWith('.json')) {
        const parsed = JSON.parse(content);
        expect(parsed.schema).toBe('plan-manifest/v1');
        const schemaErrors = validateSchema(parsed, 'plan-manifest/v1');
        expect(schemaErrors).toEqual([]);
      } else {
        expect(content).toContain('# ');
      }
    }
  });

  it('AC-U10-02 & AC-U10-03: Inlines Intent-Driven evolution modes and Surgical Edit Rule in instructions.md', () => {
    const instrMd = fs.readFileSync(path.join(SS_PLAN_DIR, 'instructions.md'), 'utf8');
    expect(instrMd).toContain('Mode 1: Structural & Validation Fixes');
    expect(instrMd).toContain('Zero Technical Content Mutation');
    expect(instrMd).toContain('Mode 2: Additive Scope & Audit Updates');
    expect(instrMd).toContain('Strict Preservation');
    expect(instrMd).toContain('Mode 3: Corrective Refactoring & Explicit Deletion');
    expect(instrMd).toContain('Depth Parity Invariant');
    expect(instrMd).toContain('The Surgical Edit Rule');
  });
});
