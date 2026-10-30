import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compileBrandBook,
  generateBibleDesignTokensMd,
  generateBrandAssets,
  generateBrandBookHtml,
  generateBrandStrategyMd,
  generateBrandThemeCss,
  generateBrandTokensJson,
  syncApplicationStylesheet,
} from '../../init/brand-generator.js';

describe('Brand Asset, Living Brand Book & Token Transformer (U8, U9, U10)', () => {
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

  describe('TS-U9-01 (L1) — Self-Contained Living Brand Book Generator', () => {
    it('compileBrandBook writes docs/brand/brand-book.html with size > 10 KB and zero external CDNs', () => {
      const tokens = generateBrandTokensJson(sampleBrandContext);
      const html = compileBrandBook(tokens, sampleBrandContext, tempDir);

      const bookPath = path.join(tempDir, 'docs', 'brand', 'brand-book.html');
      expect(existsSync(bookPath)).toBe(true);

      const stats = statSync(bookPath);
      expect(stats.size).toBeGreaterThan(10000); // Exceeds 10 KB (AC-U9-01)

      expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
      expect(html).not.toMatch(/<link[^>]+href=["']https?:\/\/[^"']*\.css["']/i);
    });
  });

  describe('TS-U9-02 (L2) — Brand Book Interactive Features & DOM Validation', () => {
    it('verifies theme toggle, color swatches, editable typography specimen, and component cards', () => {
      const tokens = generateBrandTokensJson(sampleBrandContext);
      const html = compileBrandBook(tokens, sampleBrandContext);

      expect(html).toContain('id="theme-toggle"');
      expect(html).toContain('contenteditable="true"');
      expect(html).toContain('swatch');
      expect(html).toContain('WCAG');
      expect(html).toContain('btn-primary');
      expect(html).toContain('btn-secondary');
      expect(html).toContain('badge');
    });
  });

  describe('TS-U10-01 (L1) — Theme Token Transformer (syncApplicationStylesheet)', () => {
    it('safely and idempotently injects CSS custom properties into existing stylesheet', () => {
      const appCssPath = path.join(tempDir, 'globals.css');
      const initialCss = `@import "tailwindcss";

body {
  margin: 0;
  font-family: sans-serif;
}
`;
      writeFileSync(appCssPath, initialCss, 'utf8');

      const tokens = generateBrandTokensJson(sampleBrandContext);
      const result = syncApplicationStylesheet(appCssPath, tokens);

      expect(result.success).toBe(true);

      const updatedCss = readFileSync(appCssPath, 'utf8');
      expect(updatedCss).toContain('@import "tailwindcss";');
      expect(updatedCss).toContain('--color-primary: oklch(0.62 0.22 260)');
      expect(updatedCss).toContain(':root');
      expect(updatedCss).toContain('.dark');

      // Test idempotency: syncing twice does not duplicate tokens
      const result2 = syncApplicationStylesheet(appCssPath, tokens);
      expect(result2.success).toBe(true);
      const twiceCss = readFileSync(appCssPath, 'utf8');
      const countPrimary = (twiceCss.match(/--color-primary:/g) || []).length;
      expect(countPrimary).toBe(3); // One in @theme, one in :root, one in .dark
    });

    it('creates stylesheet if it does not exist', () => {
      const missingPath = path.join(tempDir, 'nested', 'app', 'globals.css');
      const tokens = generateBrandTokensJson(sampleBrandContext);
      const result = syncApplicationStylesheet(missingPath, tokens);

      expect(result.success).toBe(true);
      expect(existsSync(missingPath)).toBe(true);
      const content = readFileSync(missingPath, 'utf8');
      expect(content).toContain('--color-primary:');
    });
  });

  describe('TS-U10-02 (L1) — Development Bible Design Tokens Specification', () => {
    it('generates docs/bible/07-frontend/design-tokens.md with token tables and contrast matrix', () => {
      const tokens = generateBrandTokensJson(sampleBrandContext);
      const md = generateBibleDesignTokensMd(tokens, sampleBrandContext, tempDir);

      const bibleTokenPath = path.join(tempDir, 'docs', 'bible', '07-frontend', 'design-tokens.md');
      expect(existsSync(bibleTokenPath)).toBe(true);

      const content = readFileSync(bibleTokenPath, 'utf8');
      expect(content).toContain('type: bible-architecture');
      expect(content).toContain('Frontend Design Tokens');
      expect(content).toContain('--color-primary');
      expect(content).toContain('WCAG');
      expect(content).toContain('Tailwind CSS v4');
    });
  });
});
