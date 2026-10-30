import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  calculateOklchContrast,
  synthesizeBrandPalettes,
  generatePalettePickerHtml,
  renderPaletteSelectionPrompt,
  generateBrandTokensJson,
  generateBrandThemeCss,
  syncApplicationStylesheet,
} from '../../init/brand-generator.js';
import { evaluateGateResolution } from '../../init/interview.js';
import { resolvePaletteSelection, executeStep9Orchestration } from '../../init/pipeline-runner.js';
import { generateInitializationPlan } from '../../init/init-plan-generator.js';
import { computeEngineDiff, syncEngine, DEFAULT_PARENT_ROOT, DEFAULT_CHILD_ROOT } from '../../scripts/sync-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 2: Product-Grounded Dynamic Palette Synthesis Engine (U3, U4)', () => {
  describe('Unit U3 — Dynamic Palette Generator Algorithm (REQ-03)', () => {
    // TS-U3-01 (L1): Unit test asserts synthesizeBrandPalettes generates exactly 3–4 distinct variations for any given context.
    it('TS-U3-01 (L1): generates exactly 3 to 4 distinct variations for any given context with complete token contracts', () => {
      const context = {
        projectName: 'DevPulse',
        valueProp: 'High-velocity developer performance telemetry CLI',
        archetype: { primary: 'The Creator' },
        aesthetic: 'Vibrant Precision',
      };

      const variations = synthesizeBrandPalettes(context);

      expect(Array.isArray(variations)).toBe(true);
      expect(variations.length).toBeGreaterThanOrEqual(3);
      expect(variations.length).toBeLessThanOrEqual(4);

      // Verify each variation satisfies AC-U3-02
      const requiredFields = [
        'id',
        'name',
        'description',
        'vibe',
        'primary',
        'primaryDark',
        'accent',
        'surfaceLight',
        'surfaceDark',
        'borderLight',
        'borderDark',
      ];

      for (const variation of variations) {
        for (const field of requiredFields) {
          expect(variation, `variation missing field ${field}`).toHaveProperty(field);
          expect(typeof (variation as Record<string, any>)[field]).toBe('string');
        }

        // Must provide OKLCH color strings
        expect(variation.primary).toMatch(/^oklch\(/);
        expect(variation.primaryDark).toMatch(/^oklch\(/);
        expect(variation.surfaceLight).toMatch(/^oklch\(/);
        expect(variation.surfaceDark).toMatch(/^oklch\(/);

        // Must include Hex approximation
        expect(variation.primaryHex).toMatch(/^#[0-9a-fA-F]{6}$/);

        // Must include semantic state tokens
        expect(variation.colors || variation).toHaveProperty('success');
        expect(variation.colors || variation).toHaveProperty('warning');
        expect(variation.colors || variation).toHaveProperty('error');
      }

      // Check variations have distinct IDs and primary hues
      const ids = new Set(variations.map((v) => v.id));
      expect(ids.size).toBe(variations.length);

      const primaries = new Set(variations.map((v) => v.primary));
      expect(primaries.size).toBe(variations.length);
    });

    // TS-U3-02 (L2): Unit test confirms different product descriptions produce completely distinct color palettes.
    it('TS-U3-02 (L2): adapts dynamically and produces distinct palettes for developer tools vs sustainability products', () => {
      const devContext = {
        projectName: 'HyperCLI',
        valueProp: 'AI Developer CLI and cloud compiler',
        keywords: ['developer', 'cli', 'compiler', 'velocity'],
      };

      const ecoContext = {
        projectName: 'TerraHarvest',
        valueProp: 'Organic Coffee Marketplace and regenerative agricultural sourcing',
        keywords: ['organic', 'coffee', 'sustainability', 'wellness', 'earth'],
      };

      const devPalettes = synthesizeBrandPalettes(devContext);
      const ecoPalettes = synthesizeBrandPalettes(ecoContext);

      expect(devPalettes.length).toBeGreaterThanOrEqual(3);
      expect(ecoPalettes.length).toBeGreaterThanOrEqual(3);

      // Primary colors must be completely different between developer tools and organic coffee marketplace
      const devPrimaryHues = devPalettes.map((p) => p.primary);
      const ecoPrimaryHues = ecoPalettes.map((p) => p.primary);

      // No exact primary color collision
      for (const devPrimary of devPrimaryHues) {
        expect(ecoPrimaryHues).not.toContain(devPrimary);
      }

      // Developer tools should lean toward cobalt/cyan/cool angles
      // Eco tools should lean toward green/terracotta/earth angles
      expect(devPalettes[0].name).not.toBe(ecoPalettes[0].name);
      expect(devPalettes[0].description).not.toBe(ecoPalettes[0].description);
    });
  });

  describe('Unit U4 — Mathematical OKLCH Contrast Verification (REQ-04)', () => {
    // TS-U4-01 (L1): Vitest test verifies contrast calculation against known WCAG reference pairs.
    it('TS-U4-01 (L1): verifies contrast calculation against known WCAG reference pairs (black on white = 21:1)', () => {
      const blackOnWhite = calculateOklchContrast('#000000', '#ffffff');
      expect(blackOnWhite).toBeCloseTo(21.0, 1);

      const whiteOnBlack = calculateOklchContrast('#ffffff', '#000000');
      expect(whiteOnBlack).toBeCloseTo(21.0, 1);

      // Identical colors must yield 1.0 contrast
      const sameColor = calculateOklchContrast('#ffffff', '#ffffff');
      expect(sameColor).toBeCloseTo(1.0, 1);

      // Known OKLCH black on OKLCH white
      const oklchBlackOnWhite = calculateOklchContrast('oklch(0 0 0)', 'oklch(1 0 0)');
      expect(oklchBlackOnWhite).toBeCloseTo(21.0, 1);
    });

    // TS-U4-02 (L2): Assert 100% of generated palette variations pass the WCAG AA >= 4.5:1 contract check.
    it('TS-U4-02 (L2): 100% of generated palette variations clear WCAG AA >= 4.5:1 contrast in both light and dark mode', () => {
      const testContexts = [
        { projectName: 'FintechEngine', valueProp: 'B2B enterprise banking and ledger platform' },
        { projectName: 'EcoMarket', valueProp: 'Regenerative wellness and organic goods' },
        { projectName: 'DevOpsHub', valueProp: 'Autonomous continuous delivery terminal' },
        { projectName: 'DesignCollective', valueProp: 'Consumer creative portfolio and media gallery' },
      ];

      for (const ctx of testContexts) {
        const palettes = synthesizeBrandPalettes(ctx);
        expect(palettes.length).toBeGreaterThanOrEqual(3);

        for (const palette of palettes) {
          // Light mode: primary text/accent against light surface
          const lightContrast = calculateOklchContrast(palette.primary, palette.surfaceLight);
          expect(
            lightContrast,
            `Palette "${palette.name}" failed light mode WCAG AA contract (ratio: ${lightContrast.toFixed(2)}:1)`
          ).toBeGreaterThanOrEqual(4.5);

          // Dark mode: primaryDark accent against dark surface
          const darkContrast = calculateOklchContrast(palette.primaryDark, palette.surfaceDark);
          expect(
            darkContrast,
            `Palette "${palette.name}" failed dark mode WCAG AA contract (ratio: ${darkContrast.toFixed(2)}:1)`
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  });

  describe('Phase 3: Interactive Palette Picker Prototype & Terminal Formatter (U5, U6)', () => {
    const sampleContext = {
      projectName: 'ShiftStone Studio',
      valueProp: 'Autonomous AI-native software engineering operating system',
      archetype: { primary: 'The Sage', secondary: 'The Ruler' },
      aesthetic: 'Precision Minimalist (Swiss)',
    };

    const tempOutputDir = path.resolve(__dirname, '../fixtures/temp-palette-picker');
    const tempOutputFile = path.join(tempOutputDir, 'palette-picker-test.html');

    afterAll(() => {
      try {
        if (existsSync(tempOutputDir)) {
          rmSync(tempOutputDir, { recursive: true, force: true });
        }
      } catch {
        // ignore cleanup error
      }
    });

    describe('Unit U5 — Interactive Single-File Prototype Generator (REQ-05)', () => {
      // TS-U5-01 (L1): Unit test asserts palette-picker.html is generated on disk and contains valid HTML5 doctype and syntax.
      it('TS-U5-01 (L1): generates palette-picker.html on disk with valid HTML5 doctype and syntax', () => {
        mkdirSync(tempOutputDir, { recursive: true });
        const variations = synthesizeBrandPalettes(sampleContext);
        const html = generatePalettePickerHtml(sampleContext, variations, tempOutputFile);

        expect(existsSync(tempOutputFile)).toBe(true);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html');
        expect(html).toContain('</html>');
        expect(html).toContain('ShiftStone Studio');
        // zero external CDN scripts or stylesheet dependencies
        expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);
        expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:\/\//i);
      });

      // TS-U5-02 (L2): Assert generated HTML includes all 3–4 synthesized variations embedded as JSON/data attributes and tab controls.
      it('TS-U5-02 (L2): includes all 3–4 synthesized variations embedded as JSON/data attributes with dynamic theme switching', () => {
        const variations = synthesizeBrandPalettes(sampleContext);
        const html = generatePalettePickerHtml(sampleContext, variations);

        expect(variations.length).toBeGreaterThanOrEqual(3);
        for (const variation of variations) {
          expect(html).toContain(variation.name);
          expect(html).toContain(variation.id);
        }
        // Includes embedded variations JSON or data attributes
        expect(html).toMatch(/data-palette|data-variations|const\s+variations\s*=/i);
        // Interactive tab switching logic and CSS custom properties
        expect(html).toContain('--primary');
        expect(html).toContain('--border');
        expect(html).toContain('--bg');
        expect(html).toContain('--text');
        // Sample components: Nav, Hero, Metric Cards, Buttons, Inputs, Data Table, Theme toggle
        expect(html).toContain('theme-toggle');
        expect(html).toMatch(/Metric|Stats/i);
        expect(html).toMatch(/Button/i);
      });
    });

    describe('Unit U6 — Universal Terminal Clickable Link & Markdown Formatter (REQ-06)', () => {
      // TS-U6-01 (L1): Unit test verifies prompt string contains valid file:/// URI and correctly structured Markdown table.
      it('TS-U6-01 (L1): formats valid file:/// URI and correctly structured Markdown table', () => {
        const variations = synthesizeBrandPalettes(sampleContext);
        const testFilePath = 'd:/Website/shiftstone/docs/brand/palette-picker.html';
        const prompt = renderPaletteSelectionPrompt(variations, testFilePath);

        // Verify file:/// URI format
        expect(prompt).toContain('file:///');
        expect(prompt).toMatch(/file:\/\/\/[A-Za-z]:\/[^\s)]+/);

        // Verify Markdown comparison table
        expect(prompt).toContain('| # | Palette Name | Vibe | Primary (Light / Dark) | Surface | Contrast (L / D) |');
        expect(prompt).toContain('|---|---|---|---|---|---|');
        for (const v of variations) {
          expect(prompt).toContain(v.name);
        }
      });

      // TS-U6-02 (L1): Asserts prompt provides clear guidance for selecting via number (1-4), name, or typing custom hex codes.
      it('TS-U6-02 (L1): provides clear guidance for selecting via number (1-4), name, or typing custom hex codes', () => {
        const variations = synthesizeBrandPalettes(sampleContext);
        const prompt = renderPaletteSelectionPrompt(variations, 'd:/Website/shiftstone/docs/brand/palette-picker.html');

        expect(prompt).toMatch(/select/i);
        expect(prompt).toMatch(/number|1-4|\[1\]/i);
        expect(prompt).toMatch(/name/i);
        expect(prompt).toMatch(/hex/i);
      });
    });
  });

  describe('Phase 4: Smart Skip, PRD Ingestion & Initializer Pipeline Integration (U7, U8, U9)', () => {
    describe('Unit U7 — Smart Skip & Pre-Existing Brand Ingestion (REQ-07)', () => {
      // TS-U7-01 (L1): Unit test asserts that context with colors.primary: '#3b82f6' skips the interactive palette picker.
      it('TS-U7-01 (L1): context with pre-existing brand colors (colors.primary: #3b82f6) skips interactive palette picker', async () => {
        const prdContext = {
          projectName: 'AquaFlow',
          valueProp: 'Smart water metering IoT dashboard',
          traitMatrix: {
            brand_preferences: {
              colors: { primary: '#3b82f6' },
              score: 0.9,
            },
          },
          colors: { primary: '#3b82f6' },
        };

        const resolution = evaluateGateResolution(prdContext.traitMatrix, 'step_5_branding');
        expect(resolution.resolved).toBe(true);
        expect(resolution.confidence).toBeGreaterThanOrEqual(0.8);
        expect(resolution.palette_picker).toBe('skipped_due_to_preexisting_brand');

        let promptCalled = false;
        const promptFn = async () => {
          promptCalled = true;
          return '1';
        };

        const result = await resolvePaletteSelection({
          context: prdContext,
          traitMatrix: prdContext.traitMatrix,
          promptFn,
        });

        expect(result.skipped).toBe(true);
        expect(result.reason).toBe('skipped_due_to_preexisting_brand');
        expect(promptCalled).toBe(false);
      });

      // TS-U7-02 (L2): Asserts that blank/unspecified context generates palette-picker.html and prompts for user selection.
      it('TS-U7-02 (L2): blank/unspecified context generates palette-picker.html and prompts for user selection', async () => {
        const blankContext = {
          projectName: 'BlankSlate',
          valueProp: 'General modern web application',
          traitMatrix: {},
        };

        const resolution = evaluateGateResolution(blankContext.traitMatrix, 'step_5_branding');
        expect(resolution.resolved).toBe(false);

        let promptCalled = false;
        const promptFn = async (promptText: string) => {
          promptCalled = true;
          expect(promptText).toContain('Interactive Brand Palette Picker');
          return '1';
        };

        const result = await resolvePaletteSelection({
          context: blankContext,
          traitMatrix: blankContext.traitMatrix,
          promptFn,
        });

        expect(result.skipped).toBe(false);
        expect(promptCalled).toBe(true);
        expect(result.selectedPalette).toBeDefined();
        expect(result.selectedPalette.primary).toMatch(/^oklch\(/);
      });
    });

    describe('Unit U8 — End-to-End Multi-Stack Stylesheet & Token Materialization (REQ-08)', () => {
      const tempTestDir = path.resolve(__dirname, '../fixtures/temp-u8-materialization');
      const tempGlobalsCss = path.join(tempTestDir, 'app/globals.css');
      const tempThemeTs = path.join(tempTestDir, 'app/config/theme.ts');

      beforeEach(() => {
        mkdirSync(path.dirname(tempGlobalsCss), { recursive: true });
        mkdirSync(path.dirname(tempThemeTs), { recursive: true });
      });

      afterEach(() => {
        try {
          if (existsSync(tempTestDir)) rmSync(tempTestDir, { recursive: true, force: true });
        } catch {}
      });

      // TS-U8-01 (L1): Unit test asserts syncApplicationStylesheet injects selected palette tokens into globals.css without altering surrounding layout CSS.
      it('TS-U8-01 (L1): syncApplicationStylesheet injects selected palette tokens into globals.css without altering surrounding layout CSS', () => {
        const initialCss = `@import "tailwindcss";\n\n/* Custom App Layout CSS */\n.main-layout {\n  display: grid;\n  grid-template-columns: 240px 1fr;\n}\n`;
        writeFileSync(tempGlobalsCss, initialCss, 'utf8');

        const sampleVariation = {
          id: 'cobalt-precision',
          name: 'Cobalt Precision',
          primary: 'oklch(0.550 0.220 250.0)',
          primaryDark: 'oklch(0.720 0.240 250.0)',
          surfaceLight: 'oklch(0.985 0.010 250.0)',
          surfaceDark: 'oklch(0.150 0.020 250.0)',
          borderLight: 'oklch(0.880 0.020 250.0)',
          borderDark: 'oklch(0.260 0.020 250.0)',
          accent: 'oklch(0.700 0.200 150.0)',
        };

        const res = syncApplicationStylesheet(tempGlobalsCss, sampleVariation);
        expect(res.success).toBe(true);

        const updatedCss = readFileSync(tempGlobalsCss, 'utf8');
        expect(updatedCss).toContain('/* Custom App Layout CSS */');
        expect(updatedCss).toContain('.main-layout {');
        expect(updatedCss).toContain('grid-template-columns: 240px 1fr;');

        // Injected 3-tier theme tokens
        expect(updatedCss).toContain('@theme {');
        expect(updatedCss).toContain(':root {');
        expect(updatedCss).toContain('.dark {');
        expect(updatedCss).toContain('--color-primary: oklch(0.550 0.220 250.0);');
        expect(updatedCss).toContain('--primary: oklch(0.550 0.220 250.0);');
        expect(updatedCss).toContain('--color-primary-dark: oklch(0.720 0.240 250.0);');
      });

      // TS-U8-02 (L2): Verifies generated brand-tokens.json parses as valid W3C design tokens containing the chosen primary and accent colors.
      it('TS-U8-02 (L2): generated brand-tokens.json parses as valid W3C design tokens containing chosen primary and accent colors', () => {
        const sampleVariation = {
          id: 'emerald-leaf',
          name: 'Emerald Leaf',
          primary: 'oklch(0.520 0.180 145.0)',
          primaryDark: 'oklch(0.740 0.200 145.0)',
          accent: 'oklch(0.700 0.210 50.0)',
          surfaceLight: 'oklch(0.985 0.010 145.0)',
          surfaceDark: 'oklch(0.150 0.020 145.0)',
          borderLight: 'oklch(0.880 0.020 145.0)',
          borderDark: 'oklch(0.260 0.020 145.0)',
        };

        const tokensJson = generateBrandTokensJson(sampleVariation);
        expect(tokensJson.$schema).toBe('https://design-tokens.github.io/community-group/format/');
        expect(tokensJson.color.primary.$value).toBe('oklch(0.520 0.180 145.0)');
        expect(tokensJson.color.primaryDark.$value).toBe('oklch(0.740 0.200 145.0)');
        expect(tokensJson.color.accent.$value).toBe('oklch(0.700 0.210 50.0)');

        // Verify stringifies and parses cleanly as JSON
        const rawJson = JSON.stringify(tokensJson, null, 2);
        const parsed = JSON.parse(rawJson);
        expect(parsed.color.primary.$value).toBe(sampleVariation.primary);
        expect(parsed.color.accent.$value).toBe(sampleVariation.accent);
      });
    });

    describe('Unit U9 — Initializer Plan Execution via ss-execute-plan Orchestration (REQ-09)', () => {
      const tempPlanDir = path.resolve(__dirname, '../fixtures/temp-u9-init-plan');

      afterEach(() => {
        try {
          if (existsSync(tempPlanDir)) rmSync(tempPlanDir, { recursive: true, force: true });
        } catch {}
      });

      // TS-U9-01 (L1): Unit test asserts init-plan-generator.js embeds active brand palette variables into the generated Tier 2 Phase 2 contract file.
      it('TS-U9-01 (L1): init-plan-generator.js embeds active brand palette variables into generated Tier 2 Phase 2 contract file', () => {
        const context = {
          projectName: 'OmniDash',
          valueProp: 'Real-time telemetry and metrics aggregator',
          tokens: {
            color: {
              primary: { $value: 'oklch(0.510 0.230 265.0)' },
              primaryDark: { $value: 'oklch(0.710 0.250 265.0)' },
              surface: {
                light: { $value: 'oklch(0.985 0.010 265.0)' },
                dark: { $value: 'oklch(0.150 0.020 265.0)' },
              },
              accent: { $value: 'oklch(0.720 0.210 160.0)' },
            },
          },
        };

        const result = generateInitializationPlan(tempPlanDir, context);
        expect(result.success).toBe(true);

        const phase2ContractPath = path.join(tempPlanDir, 'docs/plans/workspace-initialization/phase-2-app-scaffolding-and-theming.md');
        expect(existsSync(phase2ContractPath)).toBe(true);

        const phase2Content = readFileSync(phase2ContractPath, 'utf8');
        expect(phase2Content).toContain('oklch(0.510 0.230 265.0)');
        expect(phase2Content).not.toContain('{{COLOR_PRIMARY}}');
      });

      // TS-U9-02 (L2): Pipeline test verifies Step 9 orchestrator prepares and delegates execution parameters for plan.js orchestrate with zero context rot.
      it('TS-U9-02 (L2): Step 9 orchestrator prepares and delegates execution parameters for plan.js orchestrate with zero context rot', async () => {
        const orchestrationPayload = await executeStep9Orchestration({
          root: tempPlanDir,
          planPath: path.join(tempPlanDir, 'docs/plans/workspace-initialization'),
          dryRun: true,
        });

        expect(orchestrationPayload).toBeDefined();
        expect(orchestrationPayload.command).toContain('plan.js orchestrate');
        expect(orchestrationPayload.command).toContain('docs/plans/workspace-initialization');
        expect(orchestrationPayload.delegatedTo).toBe('ss-execute-plan');
        expect(orchestrationPayload.governorMode).toBe('autonomous');
      });
    });
  });

  describe('Phase 5: Automated Verification & Child Framework Parity (U10, U11)', () => {
    describe('Unit U10 — Dynamic Palette & Prototype Test Suite (REQ-10)', () => {
      // TS-U10-01 (L1): Vitest suite executes cleanly with all tests passing across 6 acceptance points.
      it('TS-U10-01 (L1): comprehensive test suite certifies dynamic synthesis, WCAG AA contrast, prototype generation, markdown prompt, smart-skip, and Step 9 delegation', async () => {
        const testContext = {
          projectName: 'NexusTelemetry',
          valueProp: 'Autonomous distributed streaming observability platform',
          archetype: { primary: 'The Sage' },
          aesthetic: 'Technical Precision',
        };

        // 1. Dynamic synthesis generates 3–4 distinct variations
        const variations = synthesizeBrandPalettes(testContext);
        expect(Array.isArray(variations)).toBe(true);
        expect(variations.length).toBeGreaterThanOrEqual(3);
        expect(variations.length).toBeLessThanOrEqual(4);

        // 2. 100% of variations satisfy WCAG AA >= 4.5:1 contrast
        for (const v of variations) {
          const lightRatio = calculateOklchContrast(v.primary, v.surfaceLight);
          const darkRatio = calculateOklchContrast(v.primaryDark, v.surfaceDark);
          expect(lightRatio).toBeGreaterThanOrEqual(4.5);
          expect(darkRatio).toBeGreaterThanOrEqual(4.5);
        }

        // 3. generatePalettePickerHtml produces a valid offline-capable HTML document
        const html = generatePalettePickerHtml(testContext, variations);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html');
        expect(html).toContain('</html>');
        expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//i);

        // 4. Terminal link prompt includes valid file:/// URI and Markdown table
        const prompt = renderPaletteSelectionPrompt(variations, 'd:/Website/shiftstone/docs/brand/palette-picker.html');
        expect(prompt).toContain('file:///');
        expect(prompt).toContain('| # | Palette Name | Vibe | Primary (Light / Dark) | Surface | Contrast (L / D) |');

        // 5. Smart-skip logic successfully bypasses picker when pre-existing colors supplied
        const preBrandContext = {
          projectName: 'PreBrandApp',
          valueProp: 'Enterprise platform with existing visual identity',
          traitMatrix: {
            brand_preferences: {
              colors: { primary: '#2563eb' },
              score: 0.95,
            },
          },
          colors: { primary: '#2563eb' },
        };
        const skipResolution = evaluateGateResolution(preBrandContext.traitMatrix, 'step_5_branding');
        expect(skipResolution.resolved).toBe(true);
        expect(skipResolution.palette_picker).toBe('skipped_due_to_preexisting_brand');

        let promptInvoked = false;
        const skipResult = await resolvePaletteSelection({
          context: preBrandContext,
          traitMatrix: preBrandContext.traitMatrix,
          promptFn: async () => {
            promptInvoked = true;
            return '1';
          },
        });
        expect(skipResult.skipped).toBe(true);
        expect(promptInvoked).toBe(false);

        // 6. Initializer Step 9 hands off to ss-execute-plan Governor
        const tempStep9Dir = path.resolve(__dirname, '../fixtures/temp-u10-step9');
        const step9Result = await executeStep9Orchestration({
          root: tempStep9Dir,
          planPath: path.join(tempStep9Dir, 'docs/plans/workspace-initialization'),
          dryRun: true,
        });
        expect(step9Result.delegatedTo).toBe('ss-execute-plan');
        expect(step9Result.governorMode).toBe('autonomous');
      });

      // TS-U10-02 (L2): Validates that HTML prototype renders with zero console errors in simulated DOM / script execution environment.
      it('TS-U10-02 (L2): validates that HTML prototype renders with zero console errors in simulated DOM / runtime environment', () => {
        const testContext = {
          projectName: 'PrototypeInspector',
          valueProp: 'Visual test validation tool',
        };
        const variations = synthesizeBrandPalettes(testContext);
        const html = generatePalettePickerHtml(testContext, variations);

        // Validate document shell and metadata
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toMatch(/<meta\s+charset=["']UTF-8["']/i);
        expect(html).toContain('<title>PrototypeInspector');

        // Verify all variations are present in the HTML
        for (const v of variations) {
          expect(html).toContain(v.name);
          expect(html).toContain(v.id);
        }

        // Extract inline <script> tags and evaluate syntax and runtime execution
        const scriptMatches = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi)];
        expect(scriptMatches.length).toBeGreaterThan(0);

        for (const match of scriptMatches) {
          const scriptCode = match[1].trim();
          if (!scriptCode) continue;

          // Syntax check via node:vm Script compilation
          expect(() => new vm.Script(scriptCode)).not.toThrow();

          // Runtime mock check for console errors
          const consoleErrors: string[] = [];
          const consoleWarns: string[] = [];
          const createMockElement = () => ({
            style: { setProperty: () => {} },
            classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
            setAttribute: () => {},
            addEventListener: () => {},
            appendChild: () => {},
            textContent: '',
            innerHTML: '',
          });
          const mockDoc = {
            getElementById: createMockElement,
            querySelector: createMockElement,
            querySelectorAll: () => [createMockElement()],
            createElement: createMockElement,
            documentElement: createMockElement(),
            addEventListener: () => {},
          };
          const sandbox = {
            window: {},
            document: mockDoc,
            console: {
              log: () => {},
              warn: (m: string) => consoleWarns.push(m),
              error: (m: string) => consoleErrors.push(m),
            },
          };
          const vmContext = vm.createContext(sandbox);
          expect(() => vm.runInContext(scriptCode, vmContext)).not.toThrow();
          expect(consoleErrors).toHaveLength(0);
        }
      });
    });

    describe('Unit U11 — Bi-Directional Engine Synchronization & Parity Certification (REQ-11)', () => {
      // TS-U11-01 (L1): Automated drift check confirms zero files pending update between parent and child framework.
      it('TS-U11-01 (L1): automated drift check confirms zero files pending update between parent and child framework', () => {
        const diff = computeEngineDiff({ direction: 'outward' });
        expect(diff.created, `Pending created files: ${diff.created.map((f) => f.rel).join(', ')}`).toHaveLength(0);
        expect(diff.updated, `Pending updated files: ${diff.updated.map((f) => f.rel).join(', ')}`).toHaveLength(0);

        const checkResult = syncEngine({ check: true });
        expect(checkResult.ok).toBe(true);
        expect(checkResult.stats.created).toBe(0);
        expect(checkResult.stats.updated).toBe(0);
      });

      // TS-U11-02 (L2): Parity check confirms critical engine files are identical across parent lab and child starter.
      it('TS-U11-02 (L2): child framework parity check confirms critical engine files are identical across parent lab and child starter', () => {
        const criticalFiles = [
          'init/brand-generator.js',
          'init/brand-importer.js',
          'init/pipeline-runner.js',
          'scripts/sync-engine.js',
          'tests/init/palette-picker.test.ts',
        ];

        for (const rel of criticalFiles) {
          const parentPath = path.join(DEFAULT_PARENT_ROOT, '.shiftstone', rel);
          const childPath = path.join(DEFAULT_CHILD_ROOT, '.shiftstone', rel);

          expect(existsSync(parentPath), `Parent file missing: ${parentPath}`).toBe(true);
          expect(existsSync(childPath), `Child file missing: ${childPath}`).toBe(true);

          const parentContent = readFileSync(parentPath);
          const childContent = readFileSync(childPath);

          const parentHash = createHash('sha256').update(parentContent).digest('hex');
          const childHash = createHash('sha256').update(childContent).digest('hex');

          expect(childHash, `Hash mismatch for .shiftstone/${rel}`).toBe(parentHash);
        }
      });
    });
  });
});
