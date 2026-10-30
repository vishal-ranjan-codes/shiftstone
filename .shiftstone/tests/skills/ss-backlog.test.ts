import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CEILINGS, lineCount } from '../../scripts/validate-context-budgets.js';
import { validateSkill } from '../../scripts/validate-skills-completeness.js';

describe('Unit U15 — Author Actionable Task Backlog Authoring Skill (ss-backlog)', () => {
  const root = path.resolve(__dirname, '../../..');
  const skillDir = path.join(root, '.agents', 'skills', 'ss-backlog');

  describe('TS-U15-01 (L1) — Manifest & Frontmatter Validation', () => {
    it('verifies ss-backlog passes validateSkill and 8-pillar completeness checks (AC-U15-01)', () => {
      expect(existsSync(skillDir)).toBe(true);

      const validation = validateSkill(skillDir, { root });
      expect(validation.violations).toEqual([]);
      expect(validation.ok).toBe(true);
      expect(validation.isCoreSsSkill).toBe(true);
    });

    it('verifies SKILL.md and instructions.md adhere strictly to line budgets', () => {
      const skillMd = readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
      const instrMd = readFileSync(path.join(skillDir, 'instructions.md'), 'utf8');

      const skillLines = lineCount(skillMd);
      const instrLines = lineCount(instrMd);

      expect(skillLines).toBeLessThanOrEqual(CEILINGS.SKILL_MANIFEST_MAX_LINES);
      expect(instrLines).toBeLessThanOrEqual(CEILINGS.SKILL_INSTRUCTIONS_MAX_LINES);

      // Verify mandatory sections in instructions.md
      expect(instrMd).toMatch(/^##\s+Iron\s+Laws?/im);
      expect(instrMd).toMatch(/^##\s+.*(Red\s+Flags|Anti-Rationalization|Rationalization)/im);
      expect(instrMd).toMatch(/^##\s+Verification\s+Ladder/im);
      expect(instrMd).toMatch(/^##\s+Terminal\s+States/im);
    });
  });

  describe('TS-U15-02 (L2) — User Story Task Cards & Capacity Balancing', () => {
    it('verifies resources provide task card and phase templates with user stories and capacity limits (AC-U15-02)', () => {
      const taskCardTemplatePath = path.join(skillDir, 'resources', 'task-card-template.md');
      const phaseTemplatePath = path.join(skillDir, 'resources', 'backlog-phase-template.md');
      const mocTemplatePath = path.join(skillDir, 'resources', 'moc-template.md');

      expect(existsSync(taskCardTemplatePath)).toBe(true);
      expect(existsSync(phaseTemplatePath)).toBe(true);
      expect(existsSync(mocTemplatePath)).toBe(true);

      const taskCardText = readFileSync(taskCardTemplatePath, 'utf8');
      expect(taskCardText).toContain('User Story');
      expect(taskCardText).toContain('As a');
      expect(taskCardText).toContain('Acceptance Criteria');
      expect(taskCardText).toContain('Verification Gate');

      const phaseText = readFileSync(phaseTemplatePath, 'utf8');
      expect(phaseText).toContain('Phase Milestone');
      expect(phaseText).toContain('Capacity');

      const mocText = readFileSync(mocTemplatePath, 'utf8');
      expect(mocText).toContain('Map of Content');
      expect(mocText).toContain('Phase Execution Ledger');
    });
  });
});
