/**
 * ShiftStone Initializer v2.2 — Brand Asset & Living Brand Book Generator
 *
 * Synthesizes elicited brand strategy and design choices into:
 *   1. W3C Community Group Design Tokens (`docs/brand/brand-tokens.json`)
 *   2. CSS Custom Properties (`docs/brand/brand-theme.css`)
 *   3. Strategic Brand & Verbal Guidelines (`docs/brand/brand-strategy.md`)
 *   4. Self-Contained Living Interactive Brand Book (`docs/brand/brand-book.html`)
 *
 * Traceability:
 *   - REQ-INIT-04 (Full-Spectrum Branding Skill)
 *   - REQ-INIT-05 (Interactive Living Brand Book)
 *   - LOCK-INIT-09, LOCK-INIT-10 (Brand Book Location & Single-File HTML Standard)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../.agents/skills/ss-brand/resources/brand-book-template.html'
);

/**
 * Generates W3C Community Group compliant design tokens.
 *
 * @param {Record<string, any>} context - Elicited brand context.
 * @returns {Record<string, any>} Design token object.
 */
export function generateBrandTokensJson(context = {}) {
  const c = context.colors || {};
  const t = context.typography || {};

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
 * @returns {string} CSS stylesheet string.
 */
export function generateBrandThemeCss(context = {}) {
  const c = context.colors || {};
  const t = context.typography || {};

  return `/* ShiftStone Living Brand Theme Tokens — Auto-Generated */

:root {
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
  const bookHtml = generateBrandBookHtml(context);

  const tokensPath = path.join(brandDir, 'brand-tokens.json');
  const themePath = path.join(brandDir, 'brand-theme.css');
  const strategyPath = path.join(brandDir, 'brand-strategy.md');
  const bookPath = path.join(brandDir, 'brand-book.html');

  writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
  writeFileSync(themePath, themeCss, 'utf8');
  writeFileSync(strategyPath, strategyMd, 'utf8');
  writeFileSync(bookPath, bookHtml, 'utf8');

  return {
    brandDir,
    files: [tokensPath, themePath, strategyPath, bookPath],
  };
}
