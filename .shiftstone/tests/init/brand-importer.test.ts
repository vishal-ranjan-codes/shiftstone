import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importExternalBrand, parseBrandMarkdown, parseTokensJson } from '../../init/brand-importer.js';

describe('Unit U8 — External Brand Asset Ingestion & Conversion Engine', () => {
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    sourceDir = mkdtempSync(path.join(tmpdir(), 'brand-source-'));
    targetDir = mkdtempSync(path.join(tmpdir(), 'brand-target-'));
  });

  afterEach(() => {
    if (sourceDir && existsSync(sourceDir)) {
      rmSync(sourceDir, { recursive: true, force: true });
    }
    if (targetDir && existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  describe('TS-U8-01 (L1) — Import External Brand Assets', () => {
    it('successfully imports and converts directory containing brand blueprint and token json', () => {
      // Create external source fixtures mimicking canonical Tidal/sibling assets
      const blueprintContent = `# Tidal Brand Identity System
## Overview
Tidal is an autonomous agent operating system engineered for enterprise telemetry.

## Visual Philosophy
- Primary Aesthetic: Cyber-Minimalist
- Primary Archetype: The Sage
- Secondary Archetype: The Creator

## Typography
- Heading Font: Plus Jakarta Sans
- Body Font: Inter
- Code Font: JetBrains Mono

## Color System
- Primary: oklch(0.65 0.24 255)
- Primary Dark: oklch(0.72 0.25 255)
- Surface Light: oklch(0.99 0.005 250)
- Surface Dark: oklch(0.14 0.02 250)
- Border Light: oklch(0.90 0.01 250)
- Border Dark: oklch(0.24 0.02 250)
- Success: oklch(0.68 0.18 150)
- Warning: oklch(0.72 0.18 60)
- Error: oklch(0.62 0.22 25)
`;

      const tokensJsonContent = JSON.stringify({
        color: {
          primary: { $value: 'oklch(0.65 0.24 255)', $type: 'color' },
          primaryDark: { $value: 'oklch(0.72 0.25 255)', $type: 'color' },
          surface: {
            light: { $value: 'oklch(0.99 0.005 250)', $type: 'color' },
            dark: { $value: 'oklch(0.14 0.02 250)', $type: 'color' },
          },
          border: {
            light: { $value: 'oklch(0.90 0.01 250)', $type: 'color' },
            dark: { $value: 'oklch(0.24 0.02 250)', $type: 'color' },
          },
          semantic: {
            success: { $value: 'oklch(0.68 0.18 150)', $type: 'color' },
            warning: { $value: 'oklch(0.72 0.18 60)', $type: 'color' },
            error: { $value: 'oklch(0.62 0.22 25)', $type: 'color' },
          },
        },
        fontFamily: {
          heading: { $value: 'Plus Jakarta Sans', $type: 'fontFamily' },
          body: { $value: 'Inter', $type: 'fontFamily' },
          mono: { $value: 'JetBrains Mono', $type: 'fontFamily' },
        },
      }, null, 2);

      writeFileSync(path.join(sourceDir, 'BRAND-BLUEPRINT-DRAFT-3.md'), blueprintContent, 'utf8');
      writeFileSync(path.join(sourceDir, 'tokens.json'), tokensJsonContent, 'utf8');

      const result = importExternalBrand(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(result.blueprintPath).toBe(path.join(targetDir, 'docs', 'brand', 'BRAND-BLUEPRINT.md'));
      expect(result.tokensPath).toBe(path.join(targetDir, 'docs', 'brand', 'brand-tokens.json'));

      // Verify files exist on disk (AC-U8-02)
      expect(existsSync(result.blueprintPath)).toBe(true);
      expect(existsSync(result.tokensPath)).toBe(true);

      // Verify blueprint content was preserved
      const writtenBlueprint = readFileSync(result.blueprintPath, 'utf8');
      expect(writtenBlueprint).toContain('Tidal Brand Identity System');
      expect(writtenBlueprint).toContain('Cyber-Minimalist');

      // Verify token fidelity
      const writtenTokens = JSON.parse(readFileSync(result.tokensPath, 'utf8'));
      expect(writtenTokens.color.primary.$value).toBe('oklch(0.65 0.24 255)');
      expect(writtenTokens.fontFamily.heading.$value).toBe('Plus Jakarta Sans');
    });

    it('extracts tokens from markdown COLOR-SPECIFICATIONS and TYPOGRAPHY when no JSON tokens provided', () => {
      const colorSpecContent = `# Color Specifications
| Token | Hex | OKLCH | Description |
|---|---|---|---|
| Primary | #2563eb | oklch(0.55 0.22 260) | Main brand hue |
| Primary Dark | #3b82f6 | oklch(0.65 0.20 260) | Dark accent |
| Surface Light | #f8fafc | oklch(0.98 0.01 250) | Light surface |
| Surface Dark | #0f172a | oklch(0.15 0.02 250) | Dark surface |
| Border Light | #e2e8f0 | oklch(0.90 0.01 250) | Light border |
| Border Dark | #334155 | oklch(0.30 0.02 250) | Dark border |
| Success | #10b981 | oklch(0.70 0.17 160) | Operational ok |
| Warning | #f59e0b | oklch(0.75 0.16 65) | Degraded warning |
| Error | #ef4444 | oklch(0.62 0.22 25) | Circuit failure |
`;

      const blueprintContent = `# Nova Brand
- Heading: Orbitron
- Body: Outfit
- Code: Fira Code
`;

      writeFileSync(path.join(sourceDir, 'COLOR-SPECIFICATIONS.md'), colorSpecContent, 'utf8');
      writeFileSync(path.join(sourceDir, 'BRAND-BLUEPRINT.md'), blueprintContent, 'utf8');

      const result = importExternalBrand(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(existsSync(result.tokensPath)).toBe(true);

      const writtenTokens = JSON.parse(readFileSync(result.tokensPath, 'utf8'));
      expect(writtenTokens.color.primary.$value).toContain('oklch(0.55 0.22 260)');
      expect(writtenTokens.fontFamily.heading.$value).toBe('Orbitron');
      expect(writtenTokens.fontFamily.body.$value).toBe('Outfit');
    });

    it('handles direct file path input gracefully', () => {
      const tokenPath = path.join(sourceDir, 'brand-tokens.json');
      writeFileSync(tokenPath, JSON.stringify({
        primary: '#6366f1',
        headingFont: 'Space Grotesk',
      }), 'utf8');

      const result = importExternalBrand(tokenPath, targetDir);
      expect(result.success).toBe(true);
      expect(existsSync(result.tokensPath)).toBe(true);

      const writtenTokens = JSON.parse(readFileSync(result.tokensPath, 'utf8'));
      expect(writtenTokens.color.primary.$value).toBe('#6366f1');
      expect(writtenTokens.fontFamily.heading.$value).toBe('Space Grotesk');
    });
  });

  describe('TS-U8-02 (L1) — Schema Validation & Normalization', () => {
    it('normalizes arbitrary token formats to W3C Design Tokens Community Group format', () => {
      const rawTokens = {
        colors: {
          brand: '#8b5cf6',
          bgLight: '#ffffff',
          bgDark: '#121212',
        },
        fonts: {
          display: 'Cabinet Grotesk',
          ui: 'Satoshi',
        },
      };

      writeFileSync(path.join(sourceDir, 'tokens.json'), JSON.stringify(rawTokens), 'utf8');

      const result = importExternalBrand(sourceDir, targetDir);
      expect(result.success).toBe(true);

      const tokens = JSON.parse(readFileSync(result.tokensPath, 'utf8'));

      // Validate W3C schema compliance
      expect(tokens).toHaveProperty('$schema');
      expect(tokens.$schema).toBe('https://design-tokens.github.io/community-group/format/');
      expect(tokens.color.primary).toHaveProperty('$value');
      expect(tokens.color.primary).toHaveProperty('$type', 'color');
      expect(tokens.color.surface.light).toHaveProperty('$value');
      expect(tokens.color.surface.dark).toHaveProperty('$value');
      expect(tokens.fontFamily.heading).toHaveProperty('$value', 'Cabinet Grotesk');
      expect(tokens.fontFamily.heading).toHaveProperty('$type', 'fontFamily');
      expect(tokens.fontFamily.body).toHaveProperty('$value', 'Satoshi');
      expect(tokens.fontFamily.body).toHaveProperty('$type', 'fontFamily');
    });

    it('returns error when source path does not exist', () => {
      const result = importExternalBrand(path.join(sourceDir, 'nonexistent-path'), targetDir);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
