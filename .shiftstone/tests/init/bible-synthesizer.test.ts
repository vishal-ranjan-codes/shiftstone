import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { synthesizeProductChapters } from '../../init/bible-synthesizer.js';
import { validateBibleSynthesis } from '../../init/validate-bible-synthesis.js';
import { validateModularBibleStructure } from '../../init/bible-modular-structure.js';

describe('Phase 3 Cumulative — Bible Synthesizer & Modular Structure Integration', () => {
  const rootBibleDir = path.resolve(__dirname, '../../../docs/bible');
  const packOverlaysDir = path.resolve(__dirname, '../../packs/rr8-supabase-cf/bible-overlays');

  it('asserts zero {{...}} placeholders survive in active docs/bible files', () => {
    const report = validateBibleSynthesis(rootBibleDir);
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('asserts zero {{...}} placeholders survive in pack bible overlays', () => {
    const report = validateBibleSynthesis(packOverlaysDir);
    expect(report.ok).toBe(true);
    expect(report.violations).toHaveLength(0);
  });

  it('asserts pack bible overlays strictly satisfy the modular chapter subfolder standard', () => {
    const struct = validateModularBibleStructure(packOverlaysDir);
    expect(struct.ok).toBe(true);
    expect(struct.violations).toHaveLength(0);
    expect(struct.chapterCount).toBe(8);
  });
});

describe('Unit U6 — Deep Synthesis Templates for Business, Audience & PRD (REQ-INIT3-06)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'bible-synth-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U6-01 (L1) — synthesizeProductChapters', () => {
    it('emits valid markdown files for all PRD and product vision chapters without placeholders', () => {
      const mockContext = {
        projectName: 'SaaSFlow',
        productType: 'b2b_saas',
        problemSpace: 'Managing customer invoice approvals and milestone tracking for remote agency teams.',
        actors: ['Agency Admin', 'Team Member', 'Client Reviewer'],
      };

      const result = synthesizeProductChapters(mockContext, tempDir);
      expect(result.writtenFiles.length).toBe(9);

      const expectedFiles = [
        'docs/bible/PRD/index.md',
        'docs/bible/PRD/ecosystem-prd.md',
        'docs/bible/PRD/phase-1-foundation-prd.md',
        'docs/bible/00-product-and-vision/index.md',
        'docs/bible/00-product-and-vision/vision-and-mission.md',
        'docs/bible/00-product-and-vision/target-audience.md',
        'docs/bible/00-product-and-vision/product-philosophy.md',
        'docs/bible/00-product-and-vision/business-model.md',
        'docs/bible/00-product-and-vision/market-landscape.md',
      ];

      for (const relPath of expectedFiles) {
        const full = path.join(tempDir, relPath);
        expect(existsSync(full)).toBe(true);
        const text = readFileSync(full, 'utf8');
        expect(text).not.toContain('{{');
        expect(text).not.toContain('TODO');
        expect(text).toContain('SaaSFlow');
      }

      // Assert validateBibleSynthesis passes cleanly
      const report = validateBibleSynthesis(path.join(tempDir, 'docs', 'bible'));
      expect(report.ok).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });
});

