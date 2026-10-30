/**
 * ShiftStone Initializer v3 — Brand Asset Ingestion Engine (REQ-INIT3-08 / LOCK-INIT3-06)
 *
 * Ingests pre-existing brand assets from external or sibling repositories
 * (blueprints, design tokens, color specifications, typography definitions)
 * and normalizes them into ShiftStone's W3C Design Tokens standard.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Default fallback design tokens */
export const DEFAULT_DESIGN_TOKENS = {
  $schema: 'https://design-tokens.github.io/community-group/format/',
  color: {
    primary: {
      $value: 'oklch(0.62 0.22 260)',
      $type: 'color',
      $description: 'Primary brand accent for interactive elements and key surfaces.',
    },
    primaryDark: {
      $value: 'oklch(0.68 0.24 260)',
      $type: 'color',
      $description: 'Elevated brand accent calibrated for dark mode surfaces.',
    },
    accent: {
      $value: 'oklch(0.70 0.20 200)',
      $type: 'color',
      $description: 'Secondary brand accent for visual punctuation.',
    },
    surface: {
      light: {
        $value: 'oklch(0.98 0.01 250)',
        $type: 'color',
      },
      dark: {
        $value: 'oklch(0.16 0.02 250)',
        $type: 'color',
      },
    },
    border: {
      light: {
        $value: 'oklch(0.88 0.02 250)',
        $type: 'color',
      },
      dark: {
        $value: 'oklch(0.26 0.02 250)',
        $type: 'color',
      },
    },
    semantic: {
      success: {
        $value: 'oklch(0.65 0.20 155)',
        $type: 'color',
      },
      warning: {
        $value: 'oklch(0.70 0.19 55)',
        $type: 'color',
      },
      error: {
        $value: 'oklch(0.60 0.24 25)',
        $type: 'color',
      },
    },
  },
  fontFamily: {
    heading: {
      $value: 'Plus Jakarta Sans',
      $type: 'fontFamily',
    },
    body: {
      $value: 'Inter',
      $type: 'fontFamily',
    },
    mono: {
      $value: 'JetBrains Mono',
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

/**
 * Parses markdown text to extract color and typography definitions.
 *
 * @param {string} content - Markdown content.
 * @returns {Record<string, any>} Extracted brand attributes.
 */
export function parseBrandMarkdown(content = '') {
  const extracted = {
    colors: {},
    typography: {},
    archetype: {},
    aesthetic: '',
  };

  const lines = content.split('\n');

  // Regex patterns for color formats
  const colorPattern = /(oklch\([^)]+\)|#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/i;

  for (const line of lines) {
    const trimmed = line.trim();

    // Archetype & Aesthetic
    const aestheticMatch = trimmed.match(/(?:aesthetic|visual philosophy)[:\s]+["']?([^"'\r\n]+)["']?/i);
    if (aestheticMatch && !extracted.aesthetic) {
      extracted.aesthetic = aestheticMatch[1].trim();
    }

    const archPrimMatch = trimmed.match(/(?:primary archetype)[:\s]+["']?([^"'\r\n]+)["']?/i);
    if (archPrimMatch && !extracted.archetype.primary) {
      extracted.archetype.primary = archPrimMatch[1].trim();
    }

    const archSecMatch = trimmed.match(/(?:secondary archetype)[:\s]+["']?([^"'\r\n]+)["']?/i);
    if (archSecMatch && !extracted.archetype.secondary) {
      extracted.archetype.secondary = archSecMatch[1].trim();
    }

    // Typography
    const headingFontMatch = trimmed.match(/(?:heading(?:\s*font)?|display)[:\s]+["']?([^"'\r\n|,]+)["']?/i);
    if (headingFontMatch && !extracted.typography.headingFont) {
      extracted.typography.headingFont = headingFontMatch[1].trim();
    }

    const bodyFontMatch = trimmed.match(/(?:body(?:\s*font)?|interface|sans)[:\s]+["']?([^"'\r\n|,]+)["']?/i);
    if (bodyFontMatch && !extracted.typography.bodyFont) {
      extracted.typography.bodyFont = bodyFontMatch[1].trim();
    }

    const codeFontMatch = trimmed.match(/(?:code(?:\s*font)?|mono)[:\s]+["']?([^"'\r\n|,]+)["']?/i);
    if (codeFontMatch && !extracted.typography.codeFont) {
      extracted.typography.codeFont = codeFontMatch[1].trim();
    }

    // Colors — prefer OKLCH if present, otherwise hex/rgb/hsl
    const oklchMatch = trimmed.match(/oklch\([^)]+\)/i);
    const colorMatch = oklchMatch || trimmed.match(colorPattern);
    if (colorMatch) {
      const colorVal = colorMatch[0].trim();
      const lower = trimmed.toLowerCase();

      if (lower.includes('primary dark') || lower.includes('primary-dark') || lower.includes('dark accent')) {
        extracted.colors.primaryDark = colorVal;
      } else if (lower.includes('primary') || lower.includes('brand primary')) {
        if (!extracted.colors.primary) extracted.colors.primary = colorVal;
      } else if (lower.includes('surface light') || lower.includes('bg light') || lower.includes('background light')) {
        extracted.colors.surfaceLight = colorVal;
      } else if (lower.includes('surface dark') || lower.includes('bg dark') || lower.includes('background dark')) {
        extracted.colors.surfaceDark = colorVal;
      } else if (lower.includes('border light')) {
        extracted.colors.borderLight = colorVal;
      } else if (lower.includes('border dark')) {
        extracted.colors.borderDark = colorVal;
      } else if (lower.includes('success')) {
        extracted.colors.success = colorVal;
      } else if (lower.includes('warning')) {
        extracted.colors.warning = colorVal;
      } else if (lower.includes('error')) {
        extracted.colors.error = colorVal;
      }
    }
  }

  return extracted;
}

/**
 * Parses and extracts colors and typography from JSON token definitions.
 *
 * @param {Record<string, any>} json - Parsed JSON object.
 * @returns {Record<string, any>} Extracted brand attributes.
 */
export function parseTokensJson(json = {}) {
  const extracted = {
    colors: {},
    typography: {},
  };

  const findValue = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.$value !== undefined) return obj.$value;
    if (obj.value !== undefined) return obj.value;
    return obj;
  };

  // 1. Direct W3C format
  if (json.color) {
    if (json.color.primary) extracted.colors.primary = findValue(json.color.primary);
    if (json.color.primaryDark) extracted.colors.primaryDark = findValue(json.color.primaryDark);
    if (json.color.surface) {
      if (json.color.surface.light) extracted.colors.surfaceLight = findValue(json.color.surface.light);
      if (json.color.surface.dark) extracted.colors.surfaceDark = findValue(json.color.surface.dark);
    }
    if (json.color.border) {
      if (json.color.border.light) extracted.colors.borderLight = findValue(json.color.border.light);
      if (json.color.border.dark) extracted.colors.borderDark = findValue(json.color.border.dark);
    }
    if (json.color.semantic) {
      if (json.color.semantic.success) extracted.colors.success = findValue(json.color.semantic.success);
      if (json.color.semantic.warning) extracted.colors.warning = findValue(json.color.semantic.warning);
      if (json.color.semantic.error) extracted.colors.error = findValue(json.color.semantic.error);
    }
  }

  // 2. Direct flat / nested colors block
  const c = json.colors || json.color || json;
  if (typeof c === 'object') {
    if (c.primary || c.brand) extracted.colors.primary = findValue(c.primary || c.brand);
    if (c.primaryDark || c.brandDark) extracted.colors.primaryDark = findValue(c.primaryDark || c.brandDark);
    if (c.surfaceLight || c.bgLight || c.backgroundLight) {
      extracted.colors.surfaceLight = findValue(c.surfaceLight || c.bgLight || c.backgroundLight);
    }
    if (c.surfaceDark || c.bgDark || c.backgroundDark) {
      extracted.colors.surfaceDark = findValue(c.surfaceDark || c.bgDark || c.backgroundDark);
    }
    if (c.borderLight) extracted.colors.borderLight = findValue(c.borderLight);
    if (c.borderDark) extracted.colors.borderDark = findValue(c.borderDark);
    if (c.success) extracted.colors.success = findValue(c.success);
    if (c.warning) extracted.colors.warning = findValue(c.warning);
    if (c.error) extracted.colors.error = findValue(c.error);
  }

  // 3. Typography
  if (json.fontFamily) {
    if (json.fontFamily.heading) extracted.typography.headingFont = findValue(json.fontFamily.heading);
    if (json.fontFamily.body) extracted.typography.bodyFont = findValue(json.fontFamily.body);
    if (json.fontFamily.mono) extracted.typography.codeFont = findValue(json.fontFamily.mono);
  }

  const f = json.fonts || json.fontFamily || json.typography || json;
  if (typeof f === 'object') {
    if (f.heading || f.display || f.headingFont) {
      extracted.typography.headingFont = findValue(f.heading || f.display || f.headingFont);
    }
    if (f.body || f.ui || f.bodyFont || f.sans) {
      extracted.typography.bodyFont = findValue(f.body || f.ui || f.bodyFont || f.sans);
    }
    if (f.mono || f.code || f.codeFont) {
      extracted.typography.codeFont = findValue(f.mono || f.code || f.codeFont);
    }
  }

  return extracted;
}

/**
 * Normalizes hex, rgb, or oklch color string into valid OKLCH representation.
 *
 * @param {string} colorStr - Color string in hex (#rgb, #rrggbb), rgb(...), or oklch(...).
 * @param {string} [fallback] - Fallback OKLCH string.
 * @returns {string} Normalized oklch(...) string.
 */
export function normalizeColorToOklch(colorStr, fallback = 'oklch(0.62 0.22 260)') {
  if (!colorStr || typeof colorStr !== 'string') return fallback;
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('oklch(')) {
    return trimmed;
  }

  let r = 0;
  let g = 0;
  let b = 0;

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
    } else {
      return fallback;
    }
  } else if (trimmed.startsWith('rgb')) {
    const match = trimmed.match(/\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(/[\s,/]+/).filter(Boolean);
      if (parts.length >= 3) {
        r = parseFloat(parts[0]) / (parts[0].includes('%') ? 100 : 255);
        g = parseFloat(parts[1]) / (parts[1].includes('%') ? 100 : 255);
        b = parseFloat(parts[2]) / (parts[2].includes('%') ? 100 : 255);
      } else {
        return fallback;
      }
    } else {
      return fallback;
    }
  } else {
    return fallback;
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;

  // sRGB to Linear sRGB
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rL = toLinear(Math.max(0, Math.min(1, r)));
  const gL = toLinear(Math.max(0, Math.min(1, g)));
  const bL = toLinear(Math.max(0, Math.min(1, b)));

  // Linear sRGB to LMS
  const l = 0.4122214708 * rL + 0.5363325363 * gL + 0.0514459929 * bL;
  const m = 0.2119034982 * rL + 0.6806995451 * gL + 0.1073969566 * bL;
  const s = 0.0883024619 * rL + 0.2817188376 * gL + 0.6299787005 * bL;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS to OKLab
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  const C = Math.sqrt(a * a + bLab * bLab);
  let h = (Math.atan2(bLab, a) * 180) / Math.PI;
  if (h < 0) h += 360;

  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)})`;
}

/**
 * Normalizes extracted attributes into standard W3C Design Tokens format.
 *
 * @param {Record<string, any>} context - Brand context.
 * @param {Record<string, any>} [options] - Normalization options.
 * @returns {Record<string, any>} W3C Design Tokens JSON.
 */
export function normalizeToDesignTokens(context = {}, options = {}) {
  const c = context.colors || {};
  const t = context.typography || {};

  const primaryVal = options.convertToOklch
    ? normalizeColorToOklch(c.primary, DEFAULT_DESIGN_TOKENS.color.primary.$value)
    : (c.primary || DEFAULT_DESIGN_TOKENS.color.primary.$value);

  const primaryDarkVal = options.convertToOklch
    ? normalizeColorToOklch(c.primaryDark || c.primary, DEFAULT_DESIGN_TOKENS.color.primaryDark.$value)
    : (c.primaryDark || c.primary || DEFAULT_DESIGN_TOKENS.color.primaryDark.$value);

  const accentVal = options.convertToOklch
    ? normalizeColorToOklch(c.accent || c.primary, 'oklch(0.70 0.20 200)')
    : (c.accent || c.primary || 'oklch(0.70 0.20 200)');

  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    color: {
      primary: {
        $value: primaryVal,
        $type: 'color',
        $description: 'Primary brand accent for interactive elements and key surfaces.',
      },
      primaryDark: {
        $value: primaryDarkVal,
        $type: 'color',
        $description: 'Elevated brand accent calibrated for dark mode surfaces.',
      },
      accent: {
        $value: accentVal,
        $type: 'color',
        $description: 'Secondary brand accent for visual punctuation.',
      },
      surface: {
        light: {
          $value: options.convertToOklch && c.surfaceLight
            ? normalizeColorToOklch(c.surfaceLight)
            : (c.surfaceLight || DEFAULT_DESIGN_TOKENS.color.surface.light.$value),
          $type: 'color',
        },
        dark: {
          $value: options.convertToOklch && c.surfaceDark
            ? normalizeColorToOklch(c.surfaceDark)
            : (c.surfaceDark || DEFAULT_DESIGN_TOKENS.color.surface.dark.$value),
          $type: 'color',
        },
      },
      border: {
        light: {
          $value: options.convertToOklch && c.borderLight
            ? normalizeColorToOklch(c.borderLight)
            : (c.borderLight || DEFAULT_DESIGN_TOKENS.color.border.light.$value),
          $type: 'color',
        },
        dark: {
          $value: options.convertToOklch && c.borderDark
            ? normalizeColorToOklch(c.borderDark)
            : (c.borderDark || DEFAULT_DESIGN_TOKENS.color.border.dark.$value),
          $type: 'color',
        },
      },
      semantic: {
        success: {
          $value: options.convertToOklch && c.success
            ? normalizeColorToOklch(c.success)
            : (c.success || DEFAULT_DESIGN_TOKENS.color.semantic.success.$value),
          $type: 'color',
        },
        warning: {
          $value: options.convertToOklch && c.warning
            ? normalizeColorToOklch(c.warning)
            : (c.warning || DEFAULT_DESIGN_TOKENS.color.semantic.warning.$value),
          $type: 'color',
        },
        error: {
          $value: options.convertToOklch && c.error
            ? normalizeColorToOklch(c.error)
            : (c.error || DEFAULT_DESIGN_TOKENS.color.semantic.error.$value),
          $type: 'color',
        },
      },
    },
    fontFamily: {
      heading: {
        $value: t.headingFont || DEFAULT_DESIGN_TOKENS.fontFamily.heading.$value,
        $type: 'fontFamily',
      },
      body: {
        $value: t.bodyFont || DEFAULT_DESIGN_TOKENS.fontFamily.body.$value,
        $type: 'fontFamily',
      },
      mono: {
        $value: t.codeFont || DEFAULT_DESIGN_TOKENS.fontFamily.mono.$value,
        $type: 'fontFamily',
      },
    },
    fontSize: { ...DEFAULT_DESIGN_TOKENS.fontSize },
  };
}

/**
 * Imports brand assets from an external directory or file into docs/brand/.
 *
 * @param {string} sourcePath - Absolute or relative path to brand assets directory or file.
 * @param {string} targetRoot - Workspace target root directory.
 * @returns {{ success: boolean, blueprintPath?: string, tokensPath?: string, tokens?: Record<string, any>, context?: Record<string, any>, error?: string }}
 */
export function importExternalBrand(sourcePath, targetRoot = process.cwd()) {
  if (!existsSync(sourcePath)) {
    return {
      success: false,
      error: `Source path does not exist: ${sourcePath}`,
    };
  }

  const stat = statSync(sourcePath);
  let blueprintContent = '';
  const mergedColors = {};
  const mergedTypography = {};
  const mergedArchetype = {};
  let mergedAesthetic = '';

  const processFile = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    if (ext === '.json') {
      try {
        const rawJson = JSON.parse(readFileSync(filePath, 'utf8'));
        const parsed = parseTokensJson(rawJson);
        Object.assign(mergedColors, parsed.colors);
        Object.assign(mergedTypography, parsed.typography);
      } catch {
        // Ignore unparseable json
      }
    } else if (ext === '.md' || ext === '.markdown') {
      const content = readFileSync(filePath, 'utf8');
      if (basename.includes('blueprint') || !blueprintContent) {
        blueprintContent = content;
      }
      const parsed = parseBrandMarkdown(content);
      Object.assign(mergedColors, parsed.colors);
      Object.assign(mergedTypography, parsed.typography);
      Object.assign(mergedArchetype, parsed.archetype);
      if (parsed.aesthetic) mergedAesthetic = parsed.aesthetic;
    }
  };

  if (stat.isDirectory()) {
    const files = readdirSync(sourcePath);
    for (const f of files) {
      processFile(path.join(sourcePath, f));
    }
  } else {
    processFile(sourcePath);
  }

  // Fallback blueprint if none provided
  if (!blueprintContent) {
    blueprintContent = `# External Brand Identity Blueprint

> Ingested by ShiftStone Brand Ingestion Engine on ${new Date().toISOString()}

## 1. Visual Identity & Aesthetic
- **Aesthetic:** ${mergedAesthetic || 'Precision Minimalist'}
- **Primary Archetype:** ${mergedArchetype.primary || 'The Sage'}
- **Secondary Archetype:** ${mergedArchetype.secondary || 'The Ruler'}

## 2. Typography
- **Heading Font:** ${mergedTypography.headingFont || 'Plus Jakarta Sans'}
- **Body Font:** ${mergedTypography.bodyFont || 'Inter'}
- **Code Font:** ${mergedTypography.codeFont || 'JetBrains Mono'}

## 3. Color System
- **Primary:** ${mergedColors.primary || 'oklch(0.62 0.22 260)'}
- **Primary Dark:** ${mergedColors.primaryDark || 'oklch(0.68 0.24 260)'}
`;
  }

  const context = {
    colors: mergedColors,
    typography: mergedTypography,
    archetype: mergedArchetype,
    aesthetic: mergedAesthetic,
  };

  const tokens = normalizeToDesignTokens(context);

  const brandDir = path.join(targetRoot, 'docs', 'brand');
  mkdirSync(brandDir, { recursive: true });

  const blueprintPath = path.join(brandDir, 'BRAND-BLUEPRINT.md');
  const tokensPath = path.join(brandDir, 'brand-tokens.json');

  writeFileSync(blueprintPath, blueprintContent, 'utf8');
  writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');

  return {
    success: true,
    blueprintPath,
    tokensPath,
    tokens,
    context,
  };
}
