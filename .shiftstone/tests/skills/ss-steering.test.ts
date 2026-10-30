import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CEILINGS, lineCount } from '../../scripts/validate-context-budgets.js';
import { validateSkill } from '../../scripts/validate-skills-completeness.js';

describe('Unit U13 — Author Universal AI Steering & Multi-IDE Harness Skill (ss-steering)', () => {
  const root = path.resolve(__dirname, '../../..');
  const skillDir = path.join(root, '.agents', 'skills', 'ss-steering');

  describe('TS-U13-01 (L1) — Manifest & Frontmatter Validation', () => {
    it('verifies ss-steering passes validateSkill and 8-pillar completeness checks (AC-U13-01)', () => {
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

  describe('TS-U13-02 (L2) — Steering Router & Static Rules Templates', () => {
    it('verifies resources provide valid slim router template satisfying the <= 60 lines ceiling (AC-U13-02)', () => {
      const routerTemplatePath = path.join(skillDir, 'resources', 'agents-router-template.md');
      expect(existsSync(routerTemplatePath)).toBe(true);

      const content = readFileSync(routerTemplatePath, 'utf8');
      const lines = lineCount(content);
      const bytes = Buffer.byteLength(content, 'utf8');

      expect(lines).toBeLessThanOrEqual(CEILINGS.AGENTS_MAX_LINES);
      expect(bytes).toBeLessThanOrEqual(CEILINGS.AGENTS_MAX_BYTES);

      // Verify essential sections of slim router
      expect(content).toContain('ShiftStone');
      expect(content).toContain('Universal Hard Rules');
      expect(content).toContain('Documentation Directory Map');
      expect(content).toContain('<!-- SKILL-INDEX:BEGIN -->');
    });

    it('verifies static rules templates satisfy line and byte ceilings with zero leakage', () => {
      const staticRulesTemplatePath = path.join(skillDir, 'resources', 'static-rules-templates.md');
      const pathScopedCatalogPath = path.join(skillDir, 'resources', 'path-scoped-rules-catalog.md');

      expect(existsSync(staticRulesTemplatePath)).toBe(true);
      expect(existsSync(pathScopedCatalogPath)).toBe(true);

      const staticRulesText = readFileSync(staticRulesTemplatePath, 'utf8');
      expect(staticRulesText).toContain('product.md');
      expect(staticRulesText).toContain('security.md');
      expect(staticRulesText).toContain('verification.md');

      const pathScopedText = readFileSync(pathScopedCatalogPath, 'utf8');
      expect(pathScopedText).toContain('app-rules.md');
      expect(pathScopedText).toContain('database-rules.md');
      expect(pathScopedText).toContain('worker-rules.md');
    });
  });
});
