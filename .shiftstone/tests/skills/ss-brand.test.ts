import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateSkill } from '../../scripts/validate-skills-completeness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SKILL_DIR = path.join(REPO_ROOT, '.agents', 'skills', 'ss-brand');

describe('Unit U5 — Full-Spectrum Branding Skill (ss-brand) Manifest & Workflow', () => {
  describe('TS-U5-01 (L1) — Skill Completeness & 8-Pillar Hardening', () => {
    it('passes two-tier completeness validation with 0 violations across 8 pillars', () => {
      expect(existsSync(SKILL_DIR)).toBe(true);

      const result = validateSkill(SKILL_DIR, { root: REPO_ROOT });
      if (!result.ok) {
        console.error('Skill Validation Violations:', result.violations);
      }
      expect(result.ok).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('enforces line budgets on SKILL.md (<= 180 lines) and instructions.md (<= 450 lines)', () => {
      const skillMd = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
      const instrMd = readFileSync(path.join(SKILL_DIR, 'instructions.md'), 'utf8');

      const skillLines = skillMd.split(/\r?\n/).length;
      const instrLines = instrMd.split(/\r?\n/).length;

      expect(skillLines).toBeLessThanOrEqual(180);
      expect(instrLines).toBeLessThanOrEqual(450);
    });

    it('verifies all 4 mandatory resources exist and have valid content', () => {
      const resources = [
        'brand-interview-rubric.md',
        'archetype-matrix.md',
        'oklch-color-palettes.md',
        'typography-pairings.md',
      ];

      for (const res of resources) {
        const resPath = path.join(SKILL_DIR, 'resources', res);
        expect(existsSync(resPath), `Resource file ${res} must exist`).toBe(true);
        const content = readFileSync(resPath, 'utf8');
        expect(content.length).toBeGreaterThan(100);
      }
    });

    it('contains no forbidden native IDE brain artifact instructions', () => {
      const skillMd = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
      const instrMd = readFileSync(path.join(SKILL_DIR, 'instructions.md'), 'utf8');

      const forbidden = [
        /(?:write|create|output|save|export|emit|store|put)\s+(?:to\s+|in\s+)?(?:<appDataDir>\/brain|\.gemini\/antigravity\/brain)/i,
        /(?:write|create|output|save|export|emit)\s+(?:as\s+|to\s+)?(?:a\s+|an\s+)?(?:native\s+)?(?:IDE\s+)?brain\s+artifact/i,
        /<appDataDir>\/brain\/<conversation-id>/i,
      ];

      for (const pattern of forbidden) {
        expect(pattern.test(skillMd)).toBe(false);
        expect(pattern.test(instrMd)).toBe(false);
      }
    });
  });
});
