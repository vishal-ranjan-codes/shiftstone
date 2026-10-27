import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateBrandAssets,
  generateBrandBookHtml,
  generateBrandStrategyMd,
  generateBrandThemeCss,
  generateBrandTokensJson,
} from '../../init/brand-generator.js';

describe('Unit U6 — Interactive Brand Book Engine & Token Exporters', () => {
  let tempDir: string;

  const sampleBrandContext = {
    projectName: 'ShiftStone Studio',
    valueProp: 'Autonomous AI-native engineering harness',
    archetype: {
      primary: 'The Sage',
      secondary: 'The Ruler',
      summary: 'Empirical clarity meets uncompromising performance.',
    },
    aesthetic: 'Precision Minimalist (Swiss)',
    colors: {
      primary: 'oklch(0.62 0.22 260)',
      primaryDark: 'oklch(0.68 0.24 260)',
      surfaceLight: 'oklch(0.98 0.01 250)',
      surfaceDark: 'oklch(0.16 0.02 250)',
      borderLight: 'oklch(0.88 0.02 250)',
      borderDark: 'oklch(0.26 0.02 250)',
      success: 'oklch(0.65 0.20 155)',
      warning: 'oklch(0.70 0.19 55)',
      error: 'oklch(0.60 0.24 25)',
    },
    typography: {
      headingFont: 'Plus Jakarta Sans',
      bodyFont: 'Inter',
      codeFont: 'JetBrains Mono',
      scaleRatio: 1.25,
      baseSizePx: 16,
    },
    toneSliders: {
      formalVsCasual: 4,
      technicalVsAccessible: 7,
      conciseVsNarrative: 2,
      reservedVsEnergetic: 5,
    },
  };

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'brand-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U6-01 (L1) — Asset Generation & File Parity', () => {
    it('generates all 4 brand files in docs/brand/ with correct contents', async () => {
      const generated = await generateBrandAssets(tempDir, sampleBrandContext);
      expect(generated).toBeDefined();

      const brandDir = path.join(tempDir, 'docs', 'brand');
      expect(existsSync(brandDir)).toBe(true);

      const htmlPath = path.join(brandDir, 'brand-book.html');
      const tokensJsonPath = path.join(brandDir, 'brand-tokens.json');
      const themeCssPath = path.join(brandDir, 'brand-theme.css');
      const strategyMdPath = path.join(brandDir, 'brand-strategy.md');

      expect(existsSync(htmlPath)).toBe(true);
      expect(existsSync(tokensJsonPath)).toBe(true);
      expect(existsSync(themeCssPath)).toBe(true);
      expect(existsSync(strategyMdPath)).toBe(true);

      // Verify JSON tokens
      const tokensJson = readFileSync(tokensJsonPath, 'utf8');
      const parsedTokens = JSON.parse(tokensJson);
      expect(parsedTokens).toHaveProperty('color');
      expect(parsedTokens).toHaveProperty('fontFamily');
      expect(parsedTokens.color.primary.$value).toBe('oklch(0.62 0.22 260)');

      // Verify CSS Custom Properties
      const themeCss = readFileSync(themeCssPath, 'utf8');
      expect(themeCss).toContain(':root');
      expect(themeCss).toContain('.dark');
      expect(themeCss).toContain('--color-primary: oklch(0.62 0.22 260)');
      expect(themeCss).toContain('--font-sans');

      // Verify Strategy Markdown
      const strategyMd = readFileSync(strategyMdPath, 'utf8');
      expect(strategyMd).toContain('type: brand-strategy');
      expect(strategyMd).toContain('ShiftStone Studio');
      expect(strategyMd).toContain('The Sage');
      expect(strategyMd).toContain('Tone of Voice Sliders');
    });

    it('asserts brand-book.html is completely self-contained with zero external script CDNs', () => {
      const html = generateBrandBookHtml(sampleBrandContext);

      // Must not link to external script sources (no cdnjs, unpkg, cdn.tailwindcss, etc.)
      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\/[^"']*\.css["']/i);

      // Must contain interactive feature elements (AC-U6-02)
      expect(html).toContain('id="theme-toggle"');
      expect(html).toContain('contenteditable="true"');
      expect(html).toContain('ShiftStone Studio');
      expect(html).toContain('oklch(0.62 0.22 260)');
      expect(html).toContain('Copy Token');
      expect(html).toContain('WCAG');
      expect(html).toContain('Component Playground');
    });
  });
});
