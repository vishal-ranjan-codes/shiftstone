import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CEILINGS, lineCount } from '../../scripts/validate-context-budgets.js';
import { validateSkill } from '../../scripts/validate-skills-completeness.js';

describe('Unit U14 — Author Development Bible & PRD Authoring Skill (ss-bible)', () => {
  const root = path.resolve(__dirname, '../../..');
  const skillDir = path.join(root, '.agents', 'skills', 'ss-bible');

  describe('TS-U14-01 (L1) — Manifest & Frontmatter Validation', () => {
    it('verifies ss-bible passes validateSkill and 8-pillar completeness checks (AC-U14-01)', () => {
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

  describe('TS-U14-02 (L2) — PRD & Modular Chapter Templates', () => {
    it('verifies resources provide PRD suite and Product Vision templates without placeholders (AC-U14-02)', () => {
      const prdTemplatePath = path.join(skillDir, 'resources', 'prd-templates.md');
      const visionTemplatePath = path.join(skillDir, 'resources', 'product-vision-templates.md');
      const techTemplatePath = path.join(skillDir, 'resources', 'technical-chapter-templates.md');

      expect(existsSync(prdTemplatePath)).toBe(true);
      expect(existsSync(visionTemplatePath)).toBe(true);
      expect(existsSync(techTemplatePath)).toBe(true);

      const prdText = readFileSync(prdTemplatePath, 'utf8');
      expect(prdText).toContain('ecosystem-prd.md');
      expect(prdText).toContain('phase-1-foundation-prd.md');
      expect(prdText).toContain('Anti-Goals');

      const visionText = readFileSync(visionTemplatePath, 'utf8');
      expect(visionText).toContain('vision-and-mission.md');
      expect(visionText).toContain('target-audience.md');
      expect(visionText).toContain('product-philosophy.md');

      const techText = readFileSync(techTemplatePath, 'utf8');
      expect(techText).toContain('schema-reference.md');
      expect(techText).toContain('webhooks.md');
      expect(techText).toContain('third-party-services.md');
    });
  });
});
