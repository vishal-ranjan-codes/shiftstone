import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSkill } from '../../../scripts/validate-skills-completeness.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WORKSPACE_ROOT = path.resolve(SHIFTSTONE_ROOT, '..');
const SS_EXECUTE_DIR = path.join(WORKSPACE_ROOT, '.agents/skills/ss-execute-plan');

describe('Unit U11 — Upgrade ss-execute-plan Skill with CLI Step Orchestration (REQ-11)', () => {
  it('TS-U11-01 (L1): ss-execute-plan adheres to 8-pillar standards, line ceilings, and completeness rules', () => {
    const res = validateSkill(SS_EXECUTE_DIR, { root: WORKSPACE_ROOT });
    expect(res.violations).toEqual([]);
    expect(res.ok).toBe(true);

    // Verify SKILL.md line ceiling (<= 180 lines)
    const skillMd = fs.readFileSync(path.join(SS_EXECUTE_DIR, 'SKILL.md'), 'utf8');
    const skillLines = skillMd.split(/\r?\n/).length;
    expect(skillLines).toBeLessThanOrEqual(180);

    // Verify instructions.md line ceiling (<= 450 lines)
    const instrMd = fs.readFileSync(path.join(SS_EXECUTE_DIR, 'instructions.md'), 'utf8');
    const instrLines = instrMd.split(/\r?\n/).length;
    expect(instrLines).toBeLessThanOrEqual(450);

    // Verify mandatory 8-pillar sections in instructions.md
    expect(instrMd).toMatch(/## Iron Law/i);
    expect(instrMd).toMatch(/## Red Flags/i);
    expect(instrMd).toMatch(/## Verification Ladder/i);
    expect(instrMd).toMatch(/## Terminal States/i);
  });

  it('TS-U11-02 (L2) & AC-U11-01..03: Instructions mandate running plan.js lifecycle commands in sequence', () => {
    const instrMd = fs.readFileSync(path.join(SS_EXECUTE_DIR, 'instructions.md'), 'utf8');

    // 1. Resume command and readTargets bounded context ceiling
    expect(instrMd).toContain('.shiftstone/scripts/plan.js resume');
    expect(instrMd).toContain('readTargets');

    // 2. Begin command before writing code
    expect(instrMd).toContain('.shiftstone/scripts/plan.js begin');

    // 3. Verify command during verification
    expect(instrMd).toContain('.shiftstone/scripts/plan.js verify');

    // 4. Checkpoint command
    expect(instrMd).toContain('.shiftstone/scripts/plan.js checkpoint');

    // 5. Close command
    expect(instrMd).toContain('.shiftstone/scripts/plan.js close');

    // Sequence verification: resume appears before begin, begin before verify, verify before close
    const posResume = instrMd.indexOf('.shiftstone/scripts/plan.js resume');
    const posBegin = instrMd.indexOf('.shiftstone/scripts/plan.js begin');
    const posVerify = instrMd.indexOf('.shiftstone/scripts/plan.js verify');
    const posClose = instrMd.indexOf('.shiftstone/scripts/plan.js close');

    expect(posResume).toBeGreaterThan(-1);
    expect(posBegin).toBeGreaterThan(posResume);
    expect(posVerify).toBeGreaterThan(posBegin);
    expect(posClose).toBeGreaterThan(posVerify);
  });

  it('AC-U11-04: Prohibits advancing to downstream units if plan.js close exits code 2', () => {
    const instrMd = fs.readFileSync(path.join(SS_EXECUTE_DIR, 'instructions.md'), 'utf8');
    expect(instrMd).toContain('code 2');
    expect(instrMd.toLowerCase()).toContain('prohibit');
  });

  it('Implementer prompt includes lifecycle CLI commands and bounded invariants', () => {
    const promptMd = fs.readFileSync(
      path.join(SS_EXECUTE_DIR, 'resources/implementer-prompt.md'),
      'utf8'
    );
    expect(promptMd).toContain('.shiftstone/scripts/plan.js resume');
    expect(promptMd).toContain('.shiftstone/scripts/plan.js begin');
    expect(promptMd).toContain('.shiftstone/scripts/plan.js verify');
    expect(promptMd).toContain('.shiftstone/scripts/plan.js close');
    expect(promptMd).toContain('readTargets');
  });
});
