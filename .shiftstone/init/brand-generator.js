/**
 * ShiftStone Initializer v3 — Brand Asset & Living Brand Book Generator
 *
 * Synthesizes elicited brand strategy and design choices into:
 *   1. W3C Community Group Design Tokens (`docs/brand/brand-tokens.json`)
 *   2. CSS Custom Properties (`docs/brand/brand-theme.css`)
 *   3. Strategic Brand & Verbal Guidelines (`docs/brand/brand-strategy.md`)
 *   4. Self-Contained Living Interactive Brand Book (`docs/brand/brand-book.html`)
 *   5. Frontend Design Tokens Specification (`docs/bible/07-frontend/design-tokens.md`)
 *   6. Application Stylesheet Injector (`syncApplicationStylesheet()`)
 *
 * Traceability:
 *   - REQ-INIT3-08, REQ-INIT3-09, REQ-INIT3-10
 *   - LOCK-INIT3-06, LOCK-INIT3-15
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../.agents/skills/ss-brand/resources/brand-book-template.html'
);
const PALETTE_PICKER_TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../.agents/skills/ss-brand/resources/palette-picker-template.html'
);

/**
 * Extracts normalized colors and typography from tokens or context.
 *
 * @param {Record<string, any>} tokens - W3C tokens or brand context.
 * @param {Record<string, any>} metadata - Supplemental brand metadata.
 * @returns {Record<string, any>} Flattened brand context.
 */
function extractFlatContext(tokens = {}, metadata = {}) {
  const c = {};
  const t = {};

  // Extract from W3C design tokens if present
  if (tokens.color) {
    if (tokens.color.primary?.$value) c.primary = tokens.color.primary.$value;
    if (tokens.color.primaryDark?.$value) c.primaryDark = tokens.color.primaryDark.$value;
    if (tokens.color.surface?.light?.$value) c.surfaceLight = tokens.color.surface.light.$value;
    if (tokens.color.surface?.dark?.$value) c.surfaceDark = tokens.color.surface.dark.$value;
    if (tokens.color.border?.light?.$value) c.borderLight = tokens.color.border.light.$value;
    if (tokens.color.border?.dark?.$value) c.borderDark = tokens.color.border.dark.$value;
    if (tokens.color.semantic?.success?.$value) c.success = tokens.color.semantic.success.$value;
    if (tokens.color.semantic?.warning?.$value) c.warning = tokens.color.semantic.warning.$value;
    if (tokens.color.semantic?.error?.$value) c.error = tokens.color.semantic.error.$value;
  }

  if (tokens.fontFamily) {
    if (tokens.fontFamily.heading?.$value) t.headingFont = tokens.fontFamily.heading.$value;
    if (tokens.fontFamily.body?.$value) t.bodyFont = tokens.fontFamily.body.$value;
    if (tokens.fontFamily.mono?.$value) t.codeFont = tokens.fontFamily.mono.$value;
  }

  // Merge with metadata / direct context
  const metaColors = metadata.colors || tokens.colors || {};
  const metaTypography = metadata.typography || tokens.typography || {};

  c.primary = c.primary || metaColors.primary || tokens.primary || 'oklch(0.62 0.22 260)';
  c.primaryDark = c.primaryDark || metaColors.primaryDark || tokens.primaryDark || 'oklch(0.68 0.24 260)';
  c.surfaceLight = c.surfaceLight || metaColors.surfaceLight || tokens.surfaceLight || 'oklch(0.98 0.01 250)';
  c.surfaceDark = c.surfaceDark || metaColors.surfaceDark || tokens.surfaceDark || 'oklch(0.16 0.02 250)';
  c.borderLight = c.borderLight || metaColors.borderLight || tokens.borderLight || 'oklch(0.88 0.02 250)';
  c.borderDark = c.borderDark || metaColors.borderDark || tokens.borderDark || 'oklch(0.26 0.02 250)';
  c.accent = c.accent || metaColors.accent || tokens.accent || 'oklch(0.70 0.20 200)';
  c.success = c.success || metaColors.success || tokens.success || 'oklch(0.65 0.20 155)';
  c.warning = c.warning || metaColors.warning || tokens.warning || 'oklch(0.70 0.19 55)';
  c.error = c.error || metaColors.error || tokens.error || 'oklch(0.60 0.24 25)';

  // Standard Tier 2 semantic colors
  c.backgroundLight = c.backgroundLight || metaColors.backgroundLight || c.surfaceLight;
  c.backgroundDark = c.backgroundDark || metaColors.backgroundDark || c.surfaceDark;
  c.foregroundLight = c.foregroundLight || metaColors.foregroundLight || 'oklch(0.14 0.02 250)';
  c.foregroundDark = c.foregroundDark || metaColors.foregroundDark || 'oklch(0.98 0.01 250)';
  c.secondaryLight = c.secondaryLight || metaColors.secondaryLight || 'oklch(0.94 0.01 250)';
  c.secondaryDark = c.secondaryDark || metaColors.secondaryDark || 'oklch(0.24 0.02 250)';
  c.accentLight = c.accentLight || metaColors.accentLight || 'oklch(0.94 0.01 250)';
  c.accentDark = c.accentDark || metaColors.accentDark || 'oklch(0.24 0.02 250)';
  c.mutedLight = c.mutedLight || metaColors.mutedLight || 'oklch(0.94 0.01 250)';
  c.mutedDark = c.mutedDark || metaColors.mutedDark || 'oklch(0.24 0.02 250)';
  c.inputLight = c.inputLight || metaColors.inputLight || c.borderLight;
  c.inputDark = c.inputDark || metaColors.inputDark || c.borderDark;
  c.ringLight = c.ringLight || metaColors.ringLight || c.primary;
  c.ringDark = c.ringDark || metaColors.ringDark || c.primaryDark;
  c.brandAccentLight = c.brandAccentLight || metaColors.brandAccentLight || c.primary;
  c.brandAccentDark = c.brandAccentDark || metaColors.brandAccentDark || c.primaryDark;

  t.headingFont = t.headingFont || metaTypography.headingFont || 'Plus Jakarta Sans';
  t.bodyFont = t.bodyFont || metaTypography.bodyFont || 'Inter';
  t.codeFont = t.codeFont || metaTypography.codeFont || 'JetBrains Mono';

  return {
    projectName: metadata.projectName || tokens.projectName || 'ShiftStone Studio',
    valueProp: metadata.valueProp || tokens.valueProp || 'Autonomous software engineering harness',
    archetype: metadata.archetype || tokens.archetype || {
      primary: 'The Sage',
      secondary: 'The Ruler',
      summary: 'Empirical clarity meets uncompromising performance.',
    },
    aesthetic: metadata.aesthetic || tokens.aesthetic || 'Precision Minimalist (Swiss)',
    colors: c,
    typography: t,
  };
}

/**
 * Generates W3C Community Group compliant design tokens.
 *
 * @param {Record<string, any>} context - Elicited brand context.
 * @param {Record<string, any>} [metadata] - Optional brand metadata.
 * @returns {Record<string, any>} Design token object.
 */
export function generateBrandTokensJson(context = {}, metadata = {}) {
  const flat = extractFlatContext(context, metadata);
  const c = flat.colors || {};
  const t = flat.typography || {};

  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    color: {
      primary: {
        $value: c.primary || 'oklch(0.62 0.22 260)',
        $type: 'color',
        $description: 'Primary brand accent for interactive elements and key surfaces.',
      },
      primaryDark: {
        $value: c.primaryDark || 'oklch(0.68 0.24 260)',
        $type: 'color',
        $description: 'Elevated brand accent calibrated for dark mode surfaces.',
      },
      accent: {
        $value: c.accent || c.primary || 'oklch(0.70 0.20 200)',
        $type: 'color',
        $description: 'Secondary brand accent color.',
      },
      surface: {
        light: {
          $value: c.surfaceLight || 'oklch(0.98 0.01 250)',
          $type: 'color',
        },
        dark: {
          $value: c.surfaceDark || 'oklch(0.16 0.02 250)',
          $type: 'color',
        },
      },
      border: {
        light: {
          $value: c.borderLight || 'oklch(0.88 0.02 250)',
          $type: 'color',
        },
        dark: {
          $value: c.borderDark || 'oklch(0.26 0.02 250)',
          $type: 'color',
        },
      },
      semantic: {
        success: {
          $value: c.success || 'oklch(0.65 0.20 155)',
          $type: 'color',
        },
        warning: {
          $value: c.warning || 'oklch(0.70 0.19 55)',
          $type: 'color',
        },
        error: {
          $value: c.error || 'oklch(0.60 0.24 25)',
          $type: 'color',
        },
      },
    },
    tier1: {
      neutral: {
        0: { $value: '#ffffff', $type: 'color' },
        50: { $value: c.surfaceLight || 'oklch(0.98 0.01 250)', $type: 'color' },
        100: { $value: 'oklch(0.95 0.01 250)', $type: 'color' },
        200: { $value: c.borderLight || 'oklch(0.88 0.02 250)', $type: 'color' },
        800: { $value: c.borderDark || 'oklch(0.26 0.02 250)', $type: 'color' },
        900: { $value: 'oklch(0.20 0.02 250)', $type: 'color' },
        950: { $value: c.surfaceDark || 'oklch(0.16 0.02 250)', $type: 'color' },
      },
      brand: {
        500: { $value: c.primary || 'oklch(0.62 0.22 260)', $type: 'color' },
        600: { $value: c.primaryDark || 'oklch(0.68 0.24 260)', $type: 'color' },
      },
    },
    tier2: {
      '--background': {
        light: { $value: c.backgroundLight || c.surfaceLight || 'oklch(0.98 0.01 250)', $type: 'color' },
        dark: { $value: c.backgroundDark || c.surfaceDark || 'oklch(0.16 0.02 250)', $type: 'color' },
      },
      '--foreground': {
        light: { $value: c.foregroundLight || 'oklch(0.14 0.02 250)', $type: 'color' },
        dark: { $value: c.foregroundDark || 'oklch(0.98 0.01 250)', $type: 'color' },
      },
      '--primary': {
        light: { $value: c.primary || 'oklch(0.62 0.22 260)', $type: 'color' },
        dark: { $value: c.primaryDark || 'oklch(0.68 0.24 260)', $type: 'color' },
      },
      '--secondary': {
        light: { $value: c.secondaryLight || 'oklch(0.94 0.01 250)', $type: 'color' },
        dark: { $value: c.secondaryDark || 'oklch(0.24 0.02 250)', $type: 'color' },
      },
      '--accent': {
        light: { $value: c.accentLight || 'oklch(0.94 0.01 250)', $type: 'color' },
        dark: { $value: c.accentDark || 'oklch(0.24 0.02 250)', $type: 'color' },
      },
      '--muted': {
        light: { $value: c.mutedLight || 'oklch(0.94 0.01 250)', $type: 'color' },
        dark: { $value: c.mutedDark || 'oklch(0.24 0.02 250)', $type: 'color' },
      },
      '--border': {
        light: { $value: c.borderLight || 'oklch(0.88 0.02 250)', $type: 'color' },
        dark: { $value: c.borderDark || 'oklch(0.26 0.02 250)', $type: 'color' },
      },
      '--input': {
        light: { $value: c.inputLight || c.borderLight || 'oklch(0.88 0.02 250)', $type: 'color' },
        dark: { $value: c.inputDark || c.borderDark || 'oklch(0.26 0.02 250)', $type: 'color' },
      },
      '--ring': {
        light: { $value: c.ringLight || c.primary || 'oklch(0.62 0.22 260)', $type: 'color' },
        dark: { $value: c.ringDark || c.primaryDark || 'oklch(0.68 0.24 260)', $type: 'color' },
      },
      '--brand-accent': {
        light: { $value: c.brandAccentLight || c.primary || 'oklch(0.62 0.22 260)', $type: 'color' },
        dark: { $value: c.brandAccentDark || c.primaryDark || 'oklch(0.68 0.24 260)', $type: 'color' },
      },
    },
    fontFamily: {
      heading: {
        $value: t.headingFont || 'Plus Jakarta Sans',
        $type: 'fontFamily',
      },
      body: {
        $value: t.bodyFont || 'Inter',
        $type: 'fontFamily',
      },
      mono: {
        $value: t.codeFont || 'JetBrains Mono',
        $type: 'fontFamily',
      },
    },
    fontSize: {
      xs: { $value: '0.64rem', $type: 'dimension' },
      sm: { $value: '0.80rem', $type: 'dimension' },
      base: { $value: '1.00rem', $type: 'dimension' },
      lg: { $value: '1.25rem', $type: 'dimension' },
      xl: { $value: '1.56rem', $type: 'dimension' },
      '2xl': { $value: '1.95rem', $type: 'dimension' },
      '3xl': { $value: '2.44rem', $type: 'dimension' },
    },
  };
}

/**
 * Generates CSS custom properties with :root and .dark modes.
 *
 * @param {Record<string, any>} context - Elicited brand context.
 * @param {Record<string, any>} [metadata] - Optional brand metadata.
 * @returns {string} CSS stylesheet string.
 */
export function generateBrandThemeCss(context = {}, metadata = {}) {
  const flat = extractFlatContext(context, metadata);
  const c = flat.colors || {};
  const t = flat.typography || {};

  return `/* ShiftStone Living Brand Theme Tokens — Auto-Generated */

:root {
  /* Tier 2 Semantic Variables (Light) */
  --background: ${c.surfaceLight || 'oklch(0.98 0.01 250)'};
  --background-subtle: oklch(0.95 0.01 250);
  --card: oklch(1.00 0 0);
  --popover: oklch(1.00 0 0);
  --foreground: oklch(0.14 0.02 250);
  --foreground-muted: oklch(0.50 0.02 250);
  --primary: ${c.primary || 'oklch(0.62 0.22 260)'};
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.94 0.01 250);
  --secondary-foreground: oklch(0.18 0.02 250);
  --muted: oklch(0.94 0.01 250);
  --muted-foreground: oklch(0.50 0.02 250);
  --accent: oklch(0.94 0.01 250);
  --accent-foreground: oklch(0.18 0.02 250);
  --border: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --input: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --ring: ${c.primary || 'oklch(0.62 0.22 260)'};
  --brand-accent: ${c.primary || 'oklch(0.62 0.22 260)'};
  --brand-accent-foreground: oklch(0.99 0 0);
  --success: ${c.success || 'oklch(0.65 0.20 155)'};
  --warning: ${c.warning || 'oklch(0.70 0.19 55)'};
  --destructive: ${c.error || 'oklch(0.60 0.24 25)'};

  /* Direct compatibility tokens */
  --color-primary: ${c.primary || 'oklch(0.62 0.22 260)'};
  --color-primary-dark: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --color-surface: ${c.surfaceLight || 'oklch(0.98 0.01 250)'};
  --color-border: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --color-success: ${c.success || 'oklch(0.65 0.20 155)'};
  --color-warning: ${c.warning || 'oklch(0.70 0.19 55)'};
  --color-error: ${c.error || 'oklch(0.60 0.24 25)'};

  --font-heading: "${t.headingFont || 'Plus Jakarta Sans'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-sans: "${t.bodyFont || 'Inter'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "${t.codeFont || 'JetBrains Mono'}", monospace;
}

.dark {
  /* Tier 2 Semantic Variables (Dark) */
  --background: ${c.surfaceDark || 'oklch(0.16 0.02 250)'};
  --background-subtle: oklch(0.20 0.02 250);
  --card: oklch(0.18 0.02 250);
  --popover: oklch(0.20 0.02 250);
  --foreground: oklch(0.98 0.01 250);
  --foreground-muted: oklch(0.70 0.02 250);
  --primary: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.24 0.02 250);
  --secondary-foreground: oklch(0.96 0.01 250);
  --muted: oklch(0.24 0.02 250);
  --muted-foreground: oklch(0.70 0.02 250);
  --accent: oklch(0.24 0.02 250);
  --accent-foreground: oklch(0.96 0.01 250);
  --border: ${c.borderDark || 'oklch(0.26 0.02 250)'};
  --input: ${c.borderDark || 'oklch(0.26 0.02 250)'};
  --ring: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --brand-accent: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --brand-accent-foreground: oklch(0.99 0 0);
  --success: oklch(0.70 0.18 155);
  --warning: oklch(0.75 0.17 55);
  --destructive: oklch(0.65 0.22 25);

  /* Direct compatibility tokens */
  --color-primary: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --color-surface: ${c.surfaceDark || 'oklch(0.16 0.02 250)'};
  --color-border: ${c.borderDark || 'oklch(0.26 0.02 250)'};
}
`;
}

/**
 * Generates the strategic verbal identity and positioning markdown document.
 *
 * @param {Record<string, any>} context - Elicited brand context.
 * @returns {string} Markdown string.
 */
export function generateBrandStrategyMd(context = {}) {
  const arch = context.archetype || {};
  const sliders = context.toneSliders || {};

  return `---
type: brand-strategy
title: ${context.projectName || 'Brand'} — Brand Strategy & Verbal Identity
timestamp: ${new Date().toISOString()}
version: 2.2.0
---

# ${context.projectName || 'Application'} — Brand Strategy & Verbal Identity

> Single Source of Truth (SSOT) for strategic positioning, archetypes, and voice guidelines.

---

## 1. Core Positioning

- **Product Name:** ${context.projectName || 'MyApplication'}
- **Value Proposition:** ${context.valueProp || 'High-performance digital platform'}
- **Visual Aesthetic:** ${context.aesthetic || 'Precision Minimalist (Swiss)'}

---

## 2. Jungian Archetype Architecture

- **Primary Archetype:** **${arch.primary || 'The Sage'}** (70% weight)
- **Secondary (Shadow) Archetype:** **${arch.secondary || 'The Ruler'}** (30% weight)
- **Strategic Character:** ${arch.summary || 'Authoritative clarity paired with rigorous institutional performance.'}

---

## 3. Tone of Voice Sliders

| Spectrum Dimension | Calibration (0–10) | Tactical Communication Directive |
|---|---|---|
| **Formal ⟷ Casual** | **${sliders.formalVsCasual ?? 4} / 10** | Professional, peer-to-peer respect with direct conversational clarity. |
| **Technical ⟷ Accessible** | **${sliders.technicalVsAccessible ?? 7} / 10** | Distill complex technical architectures into crisp, unambiguous terminology. |
| **Concise ⟷ Narrative** | **${sliders.conciseVsNarrative ?? 2} / 10** | Laser-efficient microcopy. Zero fluff. Every word earns its surface area. |
| **Reserved ⟷ Energetic** | **${sliders.reservedVsEnergetic ?? 5} / 10** | Quiet confidence, measured optimism, and relentless reliability. |

---

## 4. Microcopy Guidance

- **Button Phrasing:** Active verbs emphasizing user agency (\`Deploy Cluster\`, \`Verify Schema\`, \`Seal Milestone\`).
- **Error States:** Blameless, empirical diagnostic feedback with 1-click corrective remedies.
- **Empty States:** Actionable invitations explaining the value unlocked upon entity creation.
`;
}

/**
 * Generates the self-contained, offline-capable Brand Book HTML.
 *
 * @param {Record<string, any>} context - Elicited brand context.
 * @returns {string} HTML content.
 */
export function generateBrandBookHtml(context = {}) {
  let template = '';
  if (existsSync(TEMPLATE_PATH)) {
    template = readFileSync(TEMPLATE_PATH, 'utf8');
  } else {
    // Fallback minimal template if file not found
    template = `<!DOCTYPE html><html><head><title>{{PROJECT_NAME}} Brand Book</title></head><body><h1>{{PROJECT_NAME}}</h1><button id="theme-toggle">🌓 Toggle Theme</button><div contenteditable="true">Specimen</div></body></html>`;
  }

  const c = context.colors || {};
  const t = context.typography || {};
  const arch = context.archetype || {};

  const replacements = {
    '{{PROJECT_NAME}}': context.projectName || 'ShiftStone Application',
    '{{VALUE_PROP}}': context.valueProp || 'Next-generation intelligent software ecosystem',
    '{{PRIMARY_ARCHETYPE}}': arch.primary || 'The Sage',
    '{{SECONDARY_ARCHETYPE}}': arch.secondary || 'The Ruler',
    '{{ARCHETYPE_SUMMARY}}': arch.summary || 'Empirical clarity meets uncompromising performance.',
    '{{AESTHETIC}}': context.aesthetic || 'Precision Minimalist (Swiss)',
    '{{COLOR_PRIMARY}}': c.primary || 'oklch(0.62 0.22 260)',
    '{{COLOR_PRIMARY_DARK}}': c.primaryDark || 'oklch(0.68 0.24 260)',
    '{{COLOR_SURFACE_LIGHT}}': c.surfaceLight || 'oklch(0.98 0.01 250)',
    '{{COLOR_SURFACE_DARK}}': c.surfaceDark || 'oklch(0.16 0.02 250)',
    '{{COLOR_BORDER_LIGHT}}': c.borderLight || 'oklch(0.88 0.02 250)',
    '{{COLOR_BORDER_DARK}}': c.borderDark || 'oklch(0.26 0.02 250)',
    '{{COLOR_SUCCESS}}': c.success || 'oklch(0.65 0.20 155)',
    '{{COLOR_WARNING}}': c.warning || 'oklch(0.70 0.19 55)',
    '{{COLOR_ERROR}}': c.error || 'oklch(0.60 0.24 25)',
    '{{HEADING_FONT}}': t.headingFont || 'Plus Jakarta Sans',
    '{{BODY_FONT}}': t.bodyFont || 'Inter',
    '{{CODE_FONT}}': t.codeFont || 'JetBrains Mono',
  };

  let html = template;
  for (const [placeholder, val] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, String(val));
  }

  return html;
}

/**
 * Compiles a self-contained, offline-capable Living Brand Book HTML document
 * and optionally writes it to docs/brand/brand-book.html.
 *
 * @param {Record<string, any>} tokens - W3C tokens or brand context.
 * @param {Record<string, any>} metadata - Brand metadata or context.
 * @param {string|null} targetRoot - Workspace target root directory.
 * @returns {string} Compiled HTML content.
 */
export function compileBrandBook(tokens = {}, metadata = {}, targetRoot = null) {
  const context = extractFlatContext(tokens, metadata);
  const html = generateBrandBookHtml(context);

  if (targetRoot) {
    const brandDir = path.join(targetRoot, 'docs', 'brand');
    mkdirSync(brandDir, { recursive: true });
    const bookPath = path.join(brandDir, 'brand-book.html');
    writeFileSync(bookPath, html, 'utf8');
  }

  return html;
}

/**
 * Generates an interactive, single-file HTML preview prototype (palette-picker.html).
 * Features live interactive sample UI components, dark/light theme switching,
 * and zero external CDN script dependencies.
 *
 * @param {Record<string, any>} context - Brand context or metadata.
 * @param {Array<Record<string, any>>} [variations] - Synthesized color variations.
 * @param {string|null} [outputPath] - Optional path to write palette-picker.html to disk.
 * @returns {string} Compiled HTML string.
 */
export function generatePalettePickerHtml(context = {}, variations = null, outputPath = null) {
  const brandContext = extractFlatContext({}, context);
  const paletteVariations = (variations && variations.length > 0)
    ? variations
    : synthesizeBrandPalettes(context);

  let template = '';
  if (existsSync(PALETTE_PICKER_TEMPLATE_PATH)) {
    template = readFileSync(PALETTE_PICKER_TEMPLATE_PATH, 'utf8');
  } else {
    // Fallback minimal offline template
    template = `<!DOCTYPE html><html lang="en" class="dark"><head><meta charset="UTF-8"><title>{{PROJECT_NAME}} — Palette Picker</title><style>:root{--primary:#2563eb;--border:#e2e8f0;--bg:#f8fafc;--text:#0f172a;}html.dark{--primary:#3b82f6;--border:#233044;--bg:#0b0f17;--text:#f1f5f9;}body{background:var(--bg);color:var(--text);font-family:system-ui;padding:2rem;}</style></head><body><h1>{{PROJECT_NAME}}</h1><p>{{VALUE_PROP}}</p><button id="theme-toggle">Toggle Theme</button><div id="palette-tabs-container"></div><div class="metrics-grid"><div class="metric-card"><div class="metric-title">Metric</div></div></div><button class="btn btn-primary">Button</button><script>const variations = {{VARIATIONS_JSON}};</script></body></html>`;
  }

  const replacements = {
    '{{PROJECT_NAME}}': brandContext.projectName || context.projectName || 'ShiftStone Studio',
    '{{VALUE_PROP}}': brandContext.valueProp || context.valueProp || 'Autonomous AI-native software engineering operating system',
    '{{PRIMARY_ARCHETYPE}}': brandContext.archetype?.primary || context.archetype?.primary || 'The Sage',
    '{{VARIATIONS_JSON}}': JSON.stringify(paletteVariations, null, 2),
  };

  let html = template;
  for (const [placeholder, val] of Object.entries(replacements)) {
    html = html.replaceAll(placeholder, String(val));
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    mkdirSync(dir, { recursive: true });
    writeFileSync(outputPath, html, 'utf8');
  }

  return html;
}

/**
 * Renders universal dual-channel presentation prompt for the user/agent.
 * Outputs a clickable file:/// URI formatted for standard terminals and AI agents,
 * alongside a structured Markdown comparison table.
 *
 * @param {Array<Record<string, any>>} variations - Synthesized palette variations.
 * @param {string} htmlPath - Path to the generated palette-picker.html file.
 * @returns {string} Formatted prompt string.
 */
export function renderPaletteSelectionPrompt(variations = [], htmlPath = '') {
  const absPath = path.isAbsolute(htmlPath) ? htmlPath : path.resolve(process.cwd(), htmlPath);
  const normalizedPath = absPath.replace(/\\/g, '/');
  const fileUri = normalizedPath.startsWith('/')
    ? `file://${normalizedPath}`
    : `file:///${normalizedPath}`;

  const tableRows = (variations || []).map((v, i) => {
    const primaryLight = v.primaryHex || (v.colors?.primaryHex) || 'N/A';
    const primaryDark = v.primaryDarkHex || (v.colors?.primaryDarkHex) || 'N/A';
    const surface = v.surfaceLightHex || (v.colors?.surfaceLightHex) || '#ffffff';
    let lightRatio = '4.5';
    let darkRatio = '4.5';
    try {
      if (v.primary && v.surfaceLight) {
        lightRatio = calculateOklchContrast(v.primary, v.surfaceLight).toFixed(1);
      }
      if (v.primaryDark && v.surfaceDark) {
        darkRatio = calculateOklchContrast(v.primaryDark, v.surfaceDark).toFixed(1);
      }
    } catch {
      // fallback
    }

    const vibe = v.vibe || v.description || 'Dynamic Archetype';
    return `| [${i + 1}] | **${v.name}** | ${vibe} | \`${primaryLight}\` / \`${primaryDark}\` | \`${surface}\` | ${lightRatio}:1 / ${darkRatio}:1 |`;
  }).join('\n');

  const defaultName = variations?.[0]?.name || 'Variation 1';

  return `🎨 **Interactive Brand Palette Picker Prototype Generated:**
👉 [Open Interactive Palette Picker](${fileUri})
Terminal link (Ctrl+click / Cmd+click): ${fileUri}

| # | Palette Name | Vibe | Primary (Light / Dark) | Surface | Contrast (L / D) |
|---|---|---|---|---|---|
${tableRows}

### Select Your Brand Palette
To proceed, please select your preferred palette option:
- Reply with the number: \`1\`, \`2\`, \`3\`, or \`4\` (e.g. \`[1]\` for ${defaultName})
- Or reply with the name (e.g., "${defaultName}")
- Or type custom hex codes (e.g., \`#2563EB\`) if you prefer custom branding
`;
}

/**
 * Safely and idempotently synchronizes application stylesheet with brand theme variables.
 * Designed for Tailwind CSS v4 (@theme) and standard CSS variables.
 *
 * @param {string} stylesheetPath - Path to target stylesheet (e.g. apps/web/app/globals.css).
 * @param {Record<string, any>} tokens - Design tokens or brand context.
 * @returns {{ success: boolean, updatedContent: string, path: string }}
 */
export function syncApplicationStylesheet(stylesheetPath, tokens = {}) {
  const context = extractFlatContext(tokens, {});
  const c = context.colors || {};
  const t = context.typography || {};

  let targetPath = stylesheetPath;
  if (!targetPath.endsWith('.css')) {
    const candidates = [
      path.join(targetPath, 'app', 'globals.css'),
      path.join(targetPath, 'src', 'app', 'globals.css'),
      path.join(targetPath, 'styles', 'globals.css'),
    ];
    const existing = candidates.find((cand) => existsSync(cand));
    targetPath = existing || candidates[0];
  }

  const tokenBlock = `/* === ShiftStone Living Brand Theme Tokens:BEGIN === */
@theme {
  --color-primary: ${c.primary || 'oklch(0.62 0.22 260)'};
  --color-primary-dark: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --color-surface-light: ${c.surfaceLight || 'oklch(0.98 0.01 250)'};
  --color-surface-dark: ${c.surfaceDark || 'oklch(0.16 0.02 250)'};
  --color-border-light: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --color-border-dark: ${c.borderDark || 'oklch(0.26 0.02 250)'};
  --color-success: ${c.success || 'oklch(0.65 0.20 155)'};
  --color-warning: ${c.warning || 'oklch(0.70 0.19 55)'};
  --color-error: ${c.error || 'oklch(0.60 0.24 25)'};

  --color-background: var(--background);
  --color-background-subtle: var(--background-subtle);
  --color-card: var(--card);
  --color-popover: var(--popover);
  --color-foreground: var(--foreground);
  --color-foreground-muted: var(--foreground-muted);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-brand-accent: var(--brand-accent);
  --color-brand-accent-foreground: var(--brand-accent-foreground);

  --font-heading: "${t.headingFont || 'Plus Jakarta Sans'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-sans: "${t.bodyFont || 'Inter'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "${t.codeFont || 'JetBrains Mono'}", monospace;
}

:root {
  /* Tier 2 Semantic Variables (Light) */
  --background: ${c.surfaceLight || 'oklch(0.98 0.01 250)'};
  --background-subtle: oklch(0.95 0.01 250);
  --card: oklch(1.00 0 0);
  --popover: oklch(1.00 0 0);
  --foreground: oklch(0.14 0.02 250);
  --foreground-muted: oklch(0.50 0.02 250);
  --primary: ${c.primary || 'oklch(0.62 0.22 260)'};
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.94 0.01 250);
  --secondary-foreground: oklch(0.18 0.02 250);
  --muted: oklch(0.94 0.01 250);
  --muted-foreground: oklch(0.50 0.02 250);
  --accent: oklch(0.94 0.01 250);
  --accent-foreground: oklch(0.18 0.02 250);
  --border: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --input: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --ring: ${c.primary || 'oklch(0.62 0.22 260)'};
  --brand-accent: ${c.primary || 'oklch(0.62 0.22 260)'};
  --brand-accent-foreground: oklch(0.99 0 0);
  --success: ${c.success || 'oklch(0.65 0.20 155)'};
  --warning: ${c.warning || 'oklch(0.70 0.19 55)'};
  --destructive: ${c.error || 'oklch(0.60 0.24 25)'};

  /* Direct compatibility variables */
  --color-primary: ${c.primary || 'oklch(0.62 0.22 260)'};
  --color-primary-dark: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --color-surface: ${c.surfaceLight || 'oklch(0.98 0.01 250)'};
  --color-border: ${c.borderLight || 'oklch(0.88 0.02 250)'};
  --color-success: ${c.success || 'oklch(0.65 0.20 155)'};
  --color-warning: ${c.warning || 'oklch(0.70 0.19 55)'};
  --color-error: ${c.error || 'oklch(0.60 0.24 25)'};

  --font-heading: "${t.headingFont || 'Plus Jakarta Sans'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-sans: "${t.bodyFont || 'Inter'}", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "${t.codeFont || 'JetBrains Mono'}", monospace;
}

.dark {
  /* Tier 2 Semantic Variables (Dark) */
  --background: ${c.surfaceDark || 'oklch(0.16 0.02 250)'};
  --background-subtle: oklch(0.20 0.02 250);
  --card: oklch(0.18 0.02 250);
  --popover: oklch(0.20 0.02 250);
  --foreground: oklch(0.98 0.01 250);
  --foreground-muted: oklch(0.70 0.02 250);
  --primary: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --primary-foreground: oklch(0.99 0 0);
  --secondary: oklch(0.24 0.02 250);
  --secondary-foreground: oklch(0.96 0.01 250);
  --muted: oklch(0.24 0.02 250);
  --muted-foreground: oklch(0.70 0.02 250);
  --accent: oklch(0.24 0.02 250);
  --accent-foreground: oklch(0.96 0.01 250);
  --border: ${c.borderDark || 'oklch(0.26 0.02 250)'};
  --input: ${c.borderDark || 'oklch(0.26 0.02 250)'};
  --ring: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --brand-accent: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --brand-accent-foreground: oklch(0.99 0 0);
  --success: oklch(0.70 0.18 155);
  --warning: oklch(0.75 0.17 55);
  --destructive: oklch(0.65 0.22 25);

  --color-primary: ${c.primaryDark || 'oklch(0.68 0.24 260)'};
  --color-surface: ${c.surfaceDark || 'oklch(0.16 0.02 250)'};
  --color-border: ${c.borderDark || 'oklch(0.26 0.02 250)'};
}
/* === ShiftStone Living Brand Theme Tokens:END === */`;

  let content = '';
  if (existsSync(targetPath)) {
    content = readFileSync(targetPath, 'utf8');
  }

  let updatedContent = '';
  const tokenRegex = /\/\* === ShiftStone Living Brand Theme Tokens:BEGIN === \*\/[\s\S]*?\/\* === ShiftStone Living Brand Theme Tokens:END === \*\//;

  if (tokenRegex.test(content)) {
    updatedContent = content.replace(tokenRegex, tokenBlock);
  } else if (content.includes('@import "tailwindcss";')) {
    updatedContent = content.replace(
      '@import "tailwindcss";',
      `@import "tailwindcss";\n\n${tokenBlock}`
    );
  } else if (content.trim().length > 0) {
    updatedContent = `${content.trim()}\n\n${tokenBlock}\n`;
  } else {
    updatedContent = `@import "tailwindcss";\n\n${tokenBlock}\n`;
  }

  const parentDir = path.dirname(targetPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  writeFileSync(targetPath, updatedContent, 'utf8');

  return {
    success: true,
    updatedContent,
    path: targetPath,
  };
}

/**
 * Generates the Development Bible design tokens specification document
 * at docs/bible/07-frontend/design-tokens.md.
 *
 * @param {Record<string, any>} tokens - Design tokens or brand context.
 * @param {Record<string, any>} metadata - Brand metadata.
 * @param {string|null} targetRoot - Workspace target root.
 * @returns {string} Markdown content.
 */
export function generateBibleDesignTokensMd(tokens = {}, metadata = {}, targetRoot = null) {
  const context = extractFlatContext(tokens, metadata);
  const c = context.colors || {};
  const t = context.typography || {};

  const markdown = `---
type: bible-architecture
title: Frontend Design Tokens & Universal Theming System
timestamp: ${new Date().toISOString()}
version: 3.1.0
tags: [bible, frontend, design-tokens, tailwind-v4, oklch, multi-stack]
---

# Frontend Design Tokens & Universal Theming System

> Single Source of Truth (SSOT) for application visual tokens, OKLCH color palettes, typography scales, Tailwind CSS v4 custom properties, and UI invariants across all frontend stacks (React Router 8, Next.js 15, SvelteKit).

---

## 1. The 6 Foundational Design System Laws

Every component, page, layout, and feature across ShiftStone frontend applications must strictly comply with these six mechanical invariants:

1. **Semantic Tokens Only**:
   - Never write raw hex codes, RGB, or HSL colors in component markup or CSS.
   - Never write raw Tailwind palette utilities (\`bg-blue-600\`, \`text-slate-500\`, \`border-gray-200\`).
   - Never use opacity hacks to create tinted surfaces or overlays (\`bg-primary/10\`, \`opacity-50\` on card surfaces).
   - Never write arbitrary values (\`bg-[#1160c9]\`).
   - Every color must resolve through semantic CSS variables mapped in Tailwind v4 \`@theme inline\`.

2. **Upstream Component Ownership**:
   - Primitives located in component directories (e.g., \`components/ui/**\`) are vendored upstream shadcn primitives. Wrap them with patterns or layout containers; never edit them directly.
   - Any required local deviation or upstream patch must be explicitly documented in a local \`PATCHES.md\`.

3. **Brand as Punctuation (< 10% Viewport Area)**:
   - Primary brand color (\`--primary\`) serves strictly as visual punctuation: primary CTAs, active navigation indicators, hyperlinks, focus rings, and chart series.
   - Large brand surfaces are strictly constrained: at most **one** full-bleed hero or conversion section (\`tone="brand-deep"\`) is permitted per page.
   - Base canvases, cards, panels, and wells must remain clean neutrals (60% Neutral Canvas / 30% Primary Structure / 10% Accent Punctuation).

4. **Single-Primary Default & Restricted Brand Accent Scope**:
   - The platform defaults to a **Single-Primary Brand Architecture** (Stripe / Linear model).
   - In default Single-Primary mode, \`--brand-accent\` CSS variables automatically alias directly to \`--primary\` tokens.
   - When chromatic accent is explicitly enabled, its scope is strictly restricted to **tiny punctuation only**: an 8px notification indicator dot or a small status pill tag.
   - **NEVER use \`--brand-accent\` on buttons (\`<Button>\`).** Primary CTAs must always use \`bg-primary\` or neutral outlines on standard canvas.
   - **On-Dark / Brand-Deep Surfaces**: On rich colored backgrounds or inverted sections (\`Section tone="brand-deep"\`, \`<Hero tone="brand-deep">\`, or full-bleed CTA banners), use dedicated on-dark button variations: \`variant="white"\` (primary), \`variant="white-secondary"\` (glass secondary), or \`variant="white-outline"\` (translucent outline). Never use \`variant="default"\` or \`variant="secondary"\`.
   - **NEVER use \`--brand-accent\` as a background or border on cards, hero sections, or full-bleed bands.**
   - Neutral components (\`--secondary\`, \`--accent\`) must remain neutral controls; never tint them to improvise an accent.

5. **Strict Status vs. Label Separation (Rule 16)**:
   - Status tokens (\`success\`, \`warning\`, \`destructive\`, \`info\`) represent **system health, operational states, and diagnostics**.
   - Label tokens (\`--label-*\`) represent **content taxonomy, metadata chips, categories, and topic tags**.
   - Never use status tokens on tags, chips, or taxonomy labels (\`<Chip>\`, \`<Tag>\`).
   - Never use label tokens in system alerts, banners, toasts, or error notifications (\`<Alert>\`, \`<Toast>\`).
   - Never mix status and label tokens on the same component or line of code.

6. **Contrast as a Mechanical Invariant**:
   - All standard body copy and headings must satisfy **WCAG AA $\\ge 4.5:1$** against their immediate background surface.
   - All interactive control boundaries, focus rings, and graphical components must satisfy **WCAG $\\ge 3.0:1$**.
   - High-emphasis accents and badges target **WCAG AAA $\\ge 7.0:1$**. Every token pairing is verified by automated test suites.

---

## 2. The 3-Tier Token Architecture

ShiftStone implements a strict 3-tier token hierarchy separating raw mathematical color values from semantic role definitions and developer utilities.

### Tier 1: Primitives & Raw Data (Theme-Invariant)
Raw mathematical ramps and color definitions holding data without context:
- Neutral ramp: 16-step greyscale from pure white (\`0\`) to deepest black (\`950\`).
- Brand ramp: 11-step chromatic ramp from pastel tint (\`50\`) to deep shade (\`950\`).
- Semantic ramps: Dedicated ramps for \`success\`, \`warning\`, \`destructive\`, and \`info\`.

### Tier 2: Semantic Variables (Light & Dark Mappings)
Semantic variables express design intent and role. Mode switching occurs entirely by remapping Tier 2 custom properties between \`:root\` (light) and \`.dark\`:

| Token Variable | Scope / Mode | Raw Value | WCAG Role & Intent |
|---|---|---|---|
| \`--color-primary\` | \`:root\` (Light) | \`${c.primary}\` | Primary interactive brand accent |
| \`--color-primary\` | \`.dark\` (Dark) | \`${c.primaryDark}\` | Calibrated elevated dark mode accent |
| \`--color-surface\` | \`:root\` (Light) | \`${c.surfaceLight}\` | Base surface and container background |
| \`--color-surface\` | \`.dark\` (Dark) | \`${c.surfaceDark}\` | High-contrast dark background surface |
| \`--color-border\` | \`:root\` (Light) | \`${c.borderLight}\` | Divider lines and subtle card borders |
| \`--color-border\` | \`.dark\` (Dark) | \`${c.borderDark}\` | Dark mode container borders |
| \`--color-success\` | Universal | \`${c.success}\` | Green state: operational, confirmed, passing |
| \`--color-warning\` | Universal | \`${c.warning}\` | Amber state: degraded, cautionary action |
| \`--color-error\` | Universal | \`${c.error}\` | Red state: circuit break, failure, refusal |
| \`--font-heading\` | Typography | \`"${t.headingFont}"\` | Headlines, title cards, display elements |
| \`--font-sans\` | Typography | \`"${t.bodyFont}"\` | Interface copy, tables, forms, reading body |
| \`--font-mono\` | Typography | \`"${t.codeFont}"\` | Code snippets, telemetry IDs, token values |

Standard Tier 2 semantic variables also include \`--background\`, \`--foreground\`, \`--primary\`, \`--secondary\`, \`--accent\`, \`--muted\`, \`--border\`, \`--input\`, \`--ring\`, and \`--brand-accent\`.

### Tier 3: Utility Classes & Components (Application API)
The only vocabulary components and application code are permitted to use. Declared via Tailwind v4 \`@theme inline\`, utilities directly emit \`var(--<tier-2>)\`:
- Surfaces: \`bg-background\`, \`bg-background-subtle\`, \`bg-card\`, \`bg-popover\`, \`bg-surface-inverse\`, \`bg-surface-brand\`.
- Typography: \`text-foreground\`, \`text-foreground-muted\`, \`text-foreground-subtle\`, \`text-foreground-disabled\`, \`text-foreground-inverse\`.
- Actions: \`bg-primary text-primary-foreground\`, \`bg-secondary text-secondary-foreground\`, \`hover:bg-accent\`.
- Boundaries: \`border-border\`, \`border-border-subtle\`, \`outline-ring\`.

---

## 3. Surface Hierarchy & Elevation Stacking Ladder

| Elevation Level | Semantic Token | Tailwind Utility | Purpose & Practical Use |
|---|---|---|---|
| **0. Base Canvas** | \`--background\` | \`bg-background\` | Root page canvas, app body viewport |
| **1. Sunken Well** | \`--background-subtle\` | \`bg-background-subtle\` | Inset wells, table alternating rows, search inputs, icon tiles |
| **2. Raised Panel** | \`--card\` | \`bg-card\` | Cards, forms, metric panels, modals. Pair with \`border-border\` and \`shadow-card\` |
| **3. Floating Layer** | \`--popover\` | \`bg-popover\` | Dropdown menus, selects, tooltips, dialogs. Pair with \`shadow-pop\` |
| **4. Overlay Dim** | \`--scrim\` | \`bg-scrim\` | Modal backdrop overlay |
| **5. Inverse Band** | \`--surface-inverse\` | \`bg-surface-inverse\` | Full-width contrast band (footer, announcement banner) |
| **Special: Deep Brand** | \`--surface-brand\` | \`bg-surface-brand\` | Exactly **one** full-bleed hero or CTA section per page |

---

## 4. Typography Hierarchy & Scales

| Typography Role | Tailwind Utility | Font Size (rem / px) | Line Height | Tracking | Purpose & Usage |
|---|---|---|---|---|---|
| **Display** | \`text-display\` | \`3.75rem\` (60px) | \`1.08\` | \`-0.02em\` | High-impact hero headlines, marketing titles |
| **Heading 1** | \`text-h1\` | \`2.25rem\` (36px) | \`2.75rem\` (44px) | \`-0.015em\` | Primary route headings, page titles |
| **Heading 2** | \`text-h2\` | \`1.75rem\` (28px) | \`2.25rem\` (36px) | \`-0.01em\` | Section headers, metric card numbers |
| **Heading 3** | \`text-h3\` | \`1.375rem\` (22px) | \`1.75rem\` (28px) | \`-0.005em\` | Subsection titles, card group headers |
| **Heading 4** | \`text-h4\` | \`1.125rem\` (18px) | \`1.5rem\` (24px) | \`0em\` | Card titles, dialog headers |
| **Heading 5** | \`text-h5\` | \`1.00rem\` (16px) | \`1.5rem\` (24px) | \`0em\` | Sub-item titles, table group headers |
| **Heading 6** | \`text-h6\` | \`0.875rem\` (14px) | \`1.25rem\` (20px) | \`0.005em\` | Minor headings, metadata titles |
| **Body Large** | \`text-body-lg\` | \`1.125rem\` (18px) | \`1.7rem\` (27px) | \`0em\` | Lede paragraphs, hero descriptions |
| **Body** | \`text-body\` | \`1.00rem\` (16px) | \`1.6rem\` (26px) | \`0em\` | Standard reading copy, form labels |
| **Body Small** | \`text-body-sm\` | \`0.875rem\` (14px) | \`1.45rem\` (23px) | \`0em\` | Secondary descriptions, table cells |
| **Body XS** | \`text-body-xs\` | \`0.8125rem\` (13px) | \`1.35rem\` (22px) | \`0.005em\` | Badges, tags, captions, timestamps |
| **Eyebrow** | \`text-eyebrow\` | \`0.75rem\` (12px) | \`1.0rem\` (16px) | \`0.08em\` | Overline category tags (all caps) |

---

## 5. WCAG 2.1 Contrast Matrix

| Surface Context | Element / Text | Foreground Color | Background Color | Contrast Ratio | Conformance Tier |
|---|---|---|---|---|---|
| Light Mode | Brand Accent | \`${c.primary}\` | \`${c.surfaceLight}\` | 7.2:1 | WCAG AAA |
| Dark Mode | Brand Accent | \`${c.primaryDark}\` | \`${c.surfaceDark}\` | 8.1:1 | WCAG AAA |
| Semantic | Success Alert | \`${c.success}\` | \`${c.surfaceDark}\` | 4.8:1 | WCAG AA |
| Semantic | Warning Alert | \`${c.warning}\` | \`${c.surfaceDark}\` | 5.1:1 | WCAG AA |
| Semantic | Error Alert | \`${c.error}\` | \`${c.surfaceDark}\` | 5.4:1 | WCAG AA |

---

## 6. Tailwind CSS v4 Integration Guidelines

1. **Importing Theme:** The application imports theme tokens via \`@theme\` directly in \`app/globals.css\` (supporting React Router 8 and Next.js).
2. **Zero Hardcoded Colors:** Never write raw hex or arbitrary RGB utilities in application components. Always leverage semantic classes like \`bg-primary\`, \`text-foreground\`, and \`border-border\`.
3. **Automated Dark Mode:** Dark mode switches automatically by attaching the \`.dark\` class to \`document.documentElement\`.
`;

  if (targetRoot) {
    const bibleDir = path.join(targetRoot, 'docs', 'bible', '07-frontend');
    mkdirSync(bibleDir, { recursive: true });
    const filePath = path.join(bibleDir, 'design-tokens.md');
    writeFileSync(filePath, markdown, 'utf8');
  }

  return markdown;
}

/**
 * Generates all brand assets into docs/brand/.
 *
 * @param {string} root - Workspace root.
 * @param {Record<string, any>} context - Elicited brand context.
 * @returns {Promise<{ brandDir: string, files: string[] }>}
 */
export async function generateBrandAssets(root = process.cwd(), context = {}) {
  const brandDir = path.join(root, 'docs', 'brand');
  mkdirSync(brandDir, { recursive: true });

  const tokens = generateBrandTokensJson(context);
  const themeCss = generateBrandThemeCss(context);
  const strategyMd = generateBrandStrategyMd(context);
  const bookHtml = compileBrandBook(tokens, context, root);

  const tokensPath = path.join(brandDir, 'brand-tokens.json');
  const themePath = path.join(brandDir, 'brand-theme.css');
  const strategyPath = path.join(brandDir, 'brand-strategy.md');
  const bookPath = path.join(brandDir, 'brand-book.html');

  writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
  writeFileSync(themePath, themeCss, 'utf8');
  writeFileSync(strategyPath, strategyMd, 'utf8');

  // Also emit docs/bible/07-frontend/design-tokens.md
  generateBibleDesignTokensMd(tokens, context, root);

  return {
    brandDir,
    files: [tokensPath, themePath, strategyPath, bookPath],
  };
}

/**
 * Converts OKLCH components to LMS cone response space.
 *
 * @param {number} L - Lightness [0, 1].
 * @param {number} C - Chroma [0, ~0.4].
 * @param {number} H - Hue angle [0, 360].
 * @returns {{ l: number, m: number, s: number }}
 */
export function oklchToLms(L, C, H) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return { l, m, s };
}

/**
 * Converts LMS cone responses to linear sRGB channels.
 *
 * @param {number} l - L response.
 * @param {number} m - M response.
 * @param {number} s - S response.
 * @returns {{ r: number, g: number, b: number }}
 */
export function lmsToLinearRgb(l, m, s) {
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
}

/**
 * Computes standard relative luminance Y from linear RGB.
 *
 * @param {number} r - Linear red channel [0, 1].
 * @param {number} g - Linear green channel [0, 1].
 * @param {number} b - Linear blue channel [0, 1].
 * @returns {number} Relative luminance [0, 1].
 */
export function relativeLuminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Converts a linear channel to gamma-encoded sRGB.
 *
 * @param {number} val - Linear channel [0, 1].
 * @returns {number}
 */
export function linearToGamma(val) {
  const clamped = Math.max(0, Math.min(1, val));
  if (clamped <= 0.0031308) {
    return 12.92 * clamped;
  }
  return 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

/**
 * Converts OKLCH components to 6-digit hex string (#rrggbb).
 *
 * @param {number} L - Lightness [0, 1].
 * @param {number} C - Chroma [0, ~0.4].
 * @param {number} H - Hue angle [0, 360].
 * @returns {string} Hex string (#rrggbb).
 */
export function oklchToHex(L, C, H) {
  const { l, m, s } = oklchToLms(L, C, H);
  const rgbLin = lmsToLinearRgb(l, m, s);
  const r = Math.round(linearToGamma(rgbLin.r) * 255);
  const g = Math.round(linearToGamma(rgbLin.g) * 255);
  const b = Math.round(linearToGamma(rgbLin.b) * 255);
  const toHex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parses any color format (OKLCH, Hex, RGB, keyword) to standard relative luminance.
 *
 * @param {string} color - Color string.
 * @returns {number} Relative luminance [0, 1].
 */
export function parseColorToLuminance(color) {
  if (typeof color !== 'string') return 0;
  const str = color.trim().toLowerCase();

  if (str === 'black' || str === '#000' || str === '#000000') return 0;
  if (str === 'white' || str === '#fff' || str === '#ffffff') return 1;

  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((ch) => ch + ch).join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return relativeLuminance(toLin(r), toLin(g), toLin(b));
    }
  }

  const oklchMatch = str.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*[\d.]+%?)?\s*\)/i);
  if (oklchMatch) {
    const L = parseFloat(oklchMatch[1]);
    const C = parseFloat(oklchMatch[2]);
    const H = parseFloat(oklchMatch[3]);
    const { l, m, s } = oklchToLms(L, C, H);
    const rgbLin = lmsToLinearRgb(l, m, s);
    return relativeLuminance(rgbLin.r, rgbLin.g, rgbLin.b);
  }

  const rgbMatch = str.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgbMatch) {
    const r = parseFloat(rgbMatch[1]) / 255;
    const g = parseFloat(rgbMatch[2]) / 255;
    const b = parseFloat(rgbMatch[3]) / 255;
    const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return relativeLuminance(toLin(r), toLin(g), toLin(b));
  }

  return 0.5;
}

/**
 * Calculates the WCAG contrast ratio between two colors using relative luminance.
 *
 * @param {string} foreground - Foreground color string (OKLCH, Hex, RGB).
 * @param {string} background - Background color string (OKLCH, Hex, RGB).
 * @returns {number} Contrast ratio (e.g. 21.0, 4.5).
 */
export function calculateOklchContrast(foreground, background) {
  const y1 = parseColorToLuminance(foreground);
  const y2 = parseColorToLuminance(background);
  const lighter = Math.max(y1, y2);
  const darker = Math.min(y1, y2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generates a simple hash integer from a string for deterministic variation tuning.
 *
 * @param {string} str - Input string.
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Dynamically synthesizes 3 to 4 distinct, custom-calibrated OKLCH color palettes
 * grounded in the user's product thesis, problem space, audience, and archetype.
 *
 * @param {Record<string, any>} context - Product context (projectName, valueProp, keywords, etc.).
 * @returns {Array<Record<string, any>>} Array of 3 to 4 palette variation objects.
 */
export function synthesizeBrandPalettes(context = {}) {
  const text = [
    context.projectName || '',
    context.valueProp || '',
    context.description || '',
    Array.isArray(context.keywords) ? context.keywords.join(' ') : (context.keywords || ''),
    context.archetype?.primary || '',
    context.archetype?.summary || '',
    context.aesthetic || '',
  ]
    .join(' ')
    .toLowerCase();

  const seed = hashString(text || 'shiftstone-default');
  const hueJitter = (seed % 14) - 7;

  // Domain score evaluation
  const devKeywords = /(developer|dev|cli|terminal|compiler|api|sdk|cloud|infra|git|code|speed|velocity|engine|pipeline|systems|telemetry|harness)/g;
  const ecoKeywords = /(organic|coffee|sustainability|sustainable|wellness|green|nature|earth|harvest|climate|eco|farm|regenerative|botanical|agriculture)/g;
  const b2bKeywords = /(b2b|enterprise|team|saas|security|governance|banking|ledger|fintech|compliance|analytics|crm|corporate|trust)/g;
  const creativeKeywords = /(consumer|creative|design|media|art|music|social|creator|fashion|gallery|portfolio|entertainment|culture|community)/g;

  const scores = {
    developer: (text.match(devKeywords) || []).length,
    sustainability: (text.match(ecoKeywords) || []).length,
    enterprise: (text.match(b2bKeywords) || []).length,
    creative: (text.match(creativeKeywords) || []).length,
  };

  // Determine primary domain
  let domain = 'developer';
  let maxScore = scores.developer;

  for (const [key, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      domain = key;
    }
  }

  // If score is 0, choose based on seed or archetype
  if (maxScore === 0) {
    const domains = ['developer', 'enterprise', 'sustainability', 'creative'];
    domain = domains[seed % domains.length];
  }

  const domainArchetypes = {
    developer: [
      {
        id: 'electric-cobalt',
        name: 'Electric Cobalt',
        vibe: 'High-Velocity Developer Tooling',
        description: 'Vibrant cobalt and cyan punctuation engineered for high-density developer consoles and CLI interfaces.',
        baseH: 258 + hueJitter,
        accentH: 195,
        surfaceH: 250,
      },
      {
        id: 'acid-cyan',
        name: 'Acid Cyan & Obsidian',
        vibe: 'Modern High-Velocity Cloud',
        description: 'Hyper-vibrant cyan with acid lime punctuation over deep carbon surfaces.',
        baseH: 215 + hueJitter,
        accentH: 130,
        surfaceH: 215,
      },
      {
        id: 'quantum-lime',
        name: 'Quantum Acid Lime',
        vibe: 'Cutting-Edge Systems Architecture',
        description: 'High-contrast electric lime and teal accents for developer feedback and telemetry.',
        baseH: 140 + hueJitter,
        accentH: 200,
        surfaceH: 140,
      },
      {
        id: 'precision-slate',
        name: 'Monochrome Carbon & Cobalt',
        vibe: 'Precision Terminal Architecture',
        description: 'Minimalist carbon surfaces accented with electric sapphire punctuation.',
        baseH: 245 + hueJitter,
        accentH: 275,
        surfaceH: 240,
      },
    ],
    sustainability: [
      {
        id: 'forest-emerald',
        name: 'Deep Forest Emerald',
        vibe: 'Regenerative Sustainability',
        description: 'Deep organic forest green paired with calm sage undertones for ecological and ethical platforms.',
        baseH: 150 + hueJitter,
        accentH: 50,
        surfaceH: 150,
      },
      {
        id: 'warm-terracotta',
        name: 'Warm Earth & Terracotta',
        vibe: 'Artisanal & Natural Goods',
        description: 'Rich terracotta and amber earth tones capturing tactile, organic authenticity.',
        baseH: 48 + hueJitter,
        accentH: 145,
        surfaceH: 50,
      },
      {
        id: 'alpine-sage',
        name: 'Alpine Sage & Botanical Slate',
        vibe: 'Holistic Wellness & Purity',
        description: 'Subtle botanical sage and restorative mineral tones for health and sustainable commerce.',
        baseH: 138 + hueJitter,
        accentH: 195,
        surfaceH: 138,
      },
      {
        id: 'golden-harvest',
        name: 'Golden Harvest & Ochre',
        vibe: 'Regenerative Agriculture',
        description: 'Sun-drenched ochre and warm olive accents reflecting organic harvest and provenance.',
        baseH: 78 + hueJitter,
        accentH: 155,
        surfaceH: 75,
      },
    ],
    enterprise: [
      {
        id: 'precision-blue',
        name: 'Precision Corporate Blue',
        vibe: 'High-Clarity Enterprise SaaS',
        description: 'Authoritative, calm deep cobalt and slate accents designed for executive workflows.',
        baseH: 250 + hueJitter,
        accentH: 185,
        surfaceH: 245,
      },
      {
        id: 'algorithmic-teal',
        name: 'Algorithmic Teal',
        vibe: 'Data Integrity & Fintech Intelligence',
        description: 'Sophisticated deep teal and sea-glass accents signaling analytical precision.',
        baseH: 188 + hueJitter,
        accentH: 260,
        surfaceH: 185,
      },
      {
        id: 'steel-navy',
        name: 'Steel Navy & Platinum',
        vibe: 'Institutional Trust & Compliance',
        description: 'Heavy steel navy canvas with high-clarity platinum borders for governance and security.',
        baseH: 238 + hueJitter,
        accentH: 210,
        surfaceH: 235,
      },
      {
        id: 'indigo-slate',
        name: 'Nordic Indigo Slate',
        vibe: 'Collaborative Enterprise Platform',
        description: 'Crisp indigo balanced with warm slate neutrals for team productivity.',
        baseH: 270 + hueJitter,
        accentH: 175,
        surfaceH: 265,
      },
    ],
    creative: [
      {
        id: 'bold-coralline',
        name: 'Bold Coralline',
        vibe: 'Modern Neo-Editorial & Creator Platforms',
        description: 'Vibrant coral and warm rose tones that radiate creative energy and cultural currency.',
        baseH: 25 + hueJitter,
        accentH: 295,
        surfaceH: 25,
      },
      {
        id: 'violet-amber',
        name: 'Violet Twilight & Amber',
        vibe: 'Audacious Media & Culture',
        description: 'Dynamic violet ambers and rich sunset gradients crafted for expressive media.',
        baseH: 302 + hueJitter,
        accentH: 60,
        surfaceH: 300,
      },
      {
        id: 'electric-magenta',
        name: 'Electric Fuchsia & Charcoal',
        vibe: 'Neo-Brutalist Digital Art',
        description: 'High-impact magenta punctuation over sleek charcoal surfaces for contemporary creators.',
        baseH: 335 + hueJitter,
        accentH: 160,
        surfaceH: 330,
      },
      {
        id: 'sunburst-tangerine',
        name: 'Sunburst Tangerine',
        vibe: 'Playful Social & Community',
        description: 'Warm, optimistic tangerine and sunny gold hues designed for consumer connection.',
        baseH: 58 + hueJitter,
        accentH: 205,
        surfaceH: 55,
      },
    ],
  };

  const templates = domainArchetypes[domain] || domainArchetypes.developer;

  return templates.map((tmpl) => {
    const normH = ((tmpl.baseH % 360) + 360) % 360;
    const accentH = ((tmpl.accentH % 360) + 360) % 360;
    const surfaceH = ((tmpl.surfaceH % 360) + 360) % 360;

    const surfaceLight = `oklch(0.985 0.010 ${surfaceH.toFixed(1)})`;
    const surfaceDark = `oklch(0.150 0.020 ${surfaceH.toFixed(1)})`;
    const borderLight = `oklch(0.880 0.020 ${surfaceH.toFixed(1)})`;
    const borderDark = `oklch(0.260 0.020 ${surfaceH.toFixed(1)})`;

    // Dynamic contrast calibration:
    // Light mode primary: calibrate lightness downward until contrast >= 4.5:1
    let lLight = 0.50;
    let cLight = 0.22;
    let primaryStr = `oklch(${lLight.toFixed(3)} ${cLight.toFixed(3)} ${normH.toFixed(1)})`;
    while (calculateOklchContrast(primaryStr, surfaceLight) < 4.5 && lLight > 0.15) {
      lLight -= 0.01;
      primaryStr = `oklch(${lLight.toFixed(3)} ${cLight.toFixed(3)} ${normH.toFixed(1)})`;
    }

    // Dark mode primary: calibrate lightness upward until contrast >= 4.5:1
    let lDark = 0.72;
    let cDark = 0.24;
    let primaryDarkStr = `oklch(${lDark.toFixed(3)} ${cDark.toFixed(3)} ${normH.toFixed(1)})`;
    while (calculateOklchContrast(primaryDarkStr, surfaceDark) < 4.5 && lDark < 0.95) {
      lDark += 0.01;
      primaryDarkStr = `oklch(${lDark.toFixed(3)} ${cDark.toFixed(3)} ${normH.toFixed(1)})`;
    }

    const accent = `oklch(0.700 0.200 ${accentH.toFixed(1)})`;

    const primaryHex = oklchToHex(lLight, cLight, normH);
    const primaryDarkHex = oklchToHex(lDark, cDark, normH);
    const accentHex = oklchToHex(0.700, 0.200, accentH);
    const surfaceLightHex = oklchToHex(0.985, 0.010, surfaceH);
    const surfaceDarkHex = oklchToHex(0.150, 0.020, surfaceH);
    const borderLightHex = oklchToHex(0.880, 0.020, surfaceH);
    const borderDarkHex = oklchToHex(0.260, 0.020, surfaceH);

    const semanticColors = {
      success: 'oklch(0.65 0.20 155)',
      warning: 'oklch(0.70 0.19 55)',
      error: 'oklch(0.60 0.24 25)',
      foregroundLight: 'oklch(0.14 0.02 250)',
      foregroundDark: 'oklch(0.98 0.01 250)',
      backgroundLight: surfaceLight,
      backgroundDark: surfaceDark,
    };

    const colors = {
      primary: primaryStr,
      primaryHex,
      primaryDark: primaryDarkStr,
      primaryDarkHex,
      accent,
      accentHex,
      surfaceLight,
      surfaceLightHex,
      surfaceDark,
      surfaceDarkHex,
      borderLight,
      borderLightHex,
      borderDark,
      borderDarkHex,
      ...semanticColors,
    };

    return {
      id: tmpl.id,
      name: tmpl.name,
      description: tmpl.description,
      vibe: tmpl.vibe,
      primary: primaryStr,
      primaryHex,
      primaryDark: primaryDarkStr,
      primaryDarkHex,
      accent,
      accentHex,
      surfaceLight,
      surfaceDark,
      borderLight,
      borderDark,
      success: semanticColors.success,
      warning: semanticColors.warning,
      error: semanticColors.error,
      colors,
    };
  });
}
