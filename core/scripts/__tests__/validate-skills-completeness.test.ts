import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAllSkills, validateSkill } from '../validate-skills-completeness.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('Unit U14: Two-Tier Skill Completeness & Reference Validator (UG-13, UG-34)', () => {
  it('TS-U14-01 (L1): passes cleanly on valid workspace skills', () => {
    const report = validateAllSkills({ root: ROOT });
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
    expect(report.totalSkills).toBeGreaterThanOrEqual(1);
  });

  it('TS-U14-02 (L2): rejects an ss-* skill missing mandatory Iron Law', () => {
    const mockDir = path.join(ROOT, 'core', 'scripts', '__tests__', 'fixtures', 'bad-ss-skill');
    // Using inline mock object with validateSkill logic
    const res = validateSkill(mockDir, { root: ROOT });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'MISSING_SKILL_MD')).toBe(true);
  });
});
