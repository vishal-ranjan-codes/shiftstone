#!/usr/bin/env node
/**
 * Conditional Checker Lens Validator (UG-15, UG-16 / Phase 4 Unit U16)
 *
 * Enforces:
 *   1. All lens JSON files adhere strictly to checker-lens.schema.json (checker-lens/v1).
 *   2. Globally unique lensId identifiers across core and pack lenses.
 *   3. Globally unique ruleId identifiers across all lens invariants.
 *   4. Valid mappedDimensions adhering to the 5 Universal Dimensions.
 *   5. Valid supportedModes and defaultMode inclusion.
 *
 * Exit code 0 on clean pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const LENS_ID_PATTERN = /^[a-z0-9-]+$/;
export const RULE_ID_PATTERN = /^[A-Z0-9_-]+$/;

export const VALID_MODES = new Set(['lite', 'focused', 'full']);
export const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low']);
export const VALID_AUTOFIX_CLASSES = new Set(['safe_auto', 'gated_auto', 'manual', 'advisory']);
export const UNIVERSAL_DIMENSIONS = new Set([
  'task_success',
  'tool_use_quality',
  'trajectory_compliance',
  'hallucination',
  'response_quality',
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'lensId',
  'name',
  'pack',
  'defaultMode',
  'supportedModes',
  'triggerGlobs',
  'mappedDimensions',
  'invariants',
]);

const ALLOWED_INVARIANT_KEYS = new Set([
  'ruleId',
  'severity',
  'description',
  'autofixClass',
]);

/**
 * Validates a single checker lens object.
 */
export function validateSingleCheckerLens(lens, options = {}) {
  const violations = [];
  const lensLabel = options.filePath || lens?.lensId || '<unnamed-lens>';

  if (typeof lens !== 'object' || lens === null || Array.isArray(lens)) {
    violations.push({
      code: 'INVALID_LENS_OBJECT',
      file: lensLabel,
      message: 'Lens file must contain a valid JSON object',
    });
    return { ok: false, violations };
  }

  // Check unknown top-level keys
  for (const key of Object.keys(lens)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      violations.push({
        code: 'UNKNOWN_FIELD',
        file: lensLabel,
        field: key,
        message: `Unknown top-level property "${key}" in lens`,
      });
    }
  }

  // 1. schemaVersion
  if (lens.schemaVersion !== 'checker-lens/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      file: lensLabel,
      field: 'schemaVersion',
      message: `schemaVersion must be "checker-lens/v1", got ${JSON.stringify(lens.schemaVersion)}`,
    });
  }

  // 2. lensId
  if (typeof lens.lensId !== 'string' || !LENS_ID_PATTERN.test(lens.lensId)) {
    violations.push({
      code: 'INVALID_LENS_ID',
      file: lensLabel,
      field: 'lensId',
      message: `lensId "${lens.lensId}" must match pattern ^[a-z0-9-]+$`,
    });
  }

  // 3. name
  if (typeof lens.name !== 'string' || lens.name.trim().length < 3) {
    violations.push({
      code: 'INVALID_NAME',
      file: lensLabel,
      field: 'name',
      message: 'name must be a string of at least 3 characters',
    });
  }

  // 4. pack
  if (typeof lens.pack !== 'string' || lens.pack.trim().length < 2) {
    violations.push({
      code: 'INVALID_PACK',
      file: lensLabel,
      field: 'pack',
      message: 'pack must be a string of at least 2 characters',
    });
  }

  // 5. defaultMode
  if (typeof lens.defaultMode !== 'string' || !VALID_MODES.has(lens.defaultMode)) {
    violations.push({
      code: 'INVALID_DEFAULT_MODE',
      file: lensLabel,
      field: 'defaultMode',
      message: `defaultMode must be one of lite|focused|full (got ${JSON.stringify(lens.defaultMode)})`,
    });
  }

  // 6. supportedModes
  if (!Array.isArray(lens.supportedModes) || lens.supportedModes.length === 0) {
    violations.push({
      code: 'INVALID_SUPPORTED_MODES',
      file: lensLabel,
      field: 'supportedModes',
      message: 'supportedModes must be a non-empty array',
    });
  } else {
    for (const m of lens.supportedModes) {
      if (!VALID_MODES.has(m)) {
        violations.push({
          code: 'INVALID_SUPPORTED_MODE_ITEM',
          file: lensLabel,
          field: 'supportedModes',
          message: `supportedModes contains invalid mode "${m}"`,
        });
      }
    }
    if (lens.defaultMode && !lens.supportedModes.includes(lens.defaultMode)) {
      violations.push({
        code: 'DEFAULT_MODE_NOT_SUPPORTED',
        file: lensLabel,
        field: 'defaultMode',
        message: `defaultMode "${lens.defaultMode}" must be included in supportedModes [${lens.supportedModes.join(', ')}]`,
      });
    }
  }

  // 7. triggerGlobs
  if (!Array.isArray(lens.triggerGlobs) || lens.triggerGlobs.length === 0) {
    violations.push({
      code: 'INVALID_TRIGGER_GLOBS',
      file: lensLabel,
      field: 'triggerGlobs',
      message: 'triggerGlobs must be a non-empty array of glob patterns',
    });
  } else {
    for (const glob of lens.triggerGlobs) {
      if (typeof glob !== 'string' || glob.trim().length === 0) {
        violations.push({
          code: 'EMPTY_TRIGGER_GLOB',
          file: lensLabel,
          field: 'triggerGlobs',
          message: 'triggerGlobs contains an empty or non-string glob pattern',
        });
      }
    }
  }

  // 8. mappedDimensions
  if (!Array.isArray(lens.mappedDimensions) || lens.mappedDimensions.length === 0) {
    violations.push({
      code: 'INVALID_MAPPED_DIMENSIONS',
      file: lensLabel,
      field: 'mappedDimensions',
      message: 'mappedDimensions must be a non-empty array of universal dimensions',
    });
  } else {
    for (const dim of lens.mappedDimensions) {
      if (!UNIVERSAL_DIMENSIONS.has(dim)) {
        violations.push({
          code: 'UNMAPPED_DIMENSION',
          file: lensLabel,
          field: 'mappedDimensions',
          message: `mappedDimensions contains invalid dimension "${dim}" (allowed: ${[...UNIVERSAL_DIMENSIONS].join(', ')})`,
        });
      }
    }
  }

  // 9. invariants
  if (!Array.isArray(lens.invariants) || lens.invariants.length === 0) {
    violations.push({
      code: 'INVALID_INVARIANTS',
      file: lensLabel,
      field: 'invariants',
      message: 'invariants must be a non-empty array of invariant rule objects',
    });
  } else {
    const localRuleIds = new Set();
    lens.invariants.forEach((inv, index) => {
      const invLabel = `${lensLabel} invariants[${index}]`;
      if (typeof inv !== 'object' || inv === null || Array.isArray(inv)) {
        violations.push({
          code: 'INVALID_INVARIANT_OBJECT',
          file: invLabel,
          message: 'Invariant entry must be an object',
        });
        return;
      }

      for (const k of Object.keys(inv)) {
        if (!ALLOWED_INVARIANT_KEYS.has(k)) {
          violations.push({
            code: 'UNKNOWN_INVARIANT_FIELD',
            file: invLabel,
            field: k,
            message: `Unknown property "${k}" in invariant`,
          });
        }
      }

      // ruleId
      if (typeof inv.ruleId !== 'string' || !RULE_ID_PATTERN.test(inv.ruleId)) {
        violations.push({
          code: 'INVALID_RULE_ID',
          file: invLabel,
          field: 'ruleId',
          message: `ruleId "${inv.ruleId}" must match pattern ^[A-Z0-9_-]+$`,
        });
      } else {
        if (localRuleIds.has(inv.ruleId)) {
          violations.push({
            code: 'DUPLICATE_RULE_ID',
            file: invLabel,
            field: 'ruleId',
            message: `Duplicate ruleId "${inv.ruleId}" within the same lens`,
          });
        }
        localRuleIds.add(inv.ruleId);
      }

      // severity
      if (typeof inv.severity !== 'string' || !VALID_SEVERITIES.has(inv.severity)) {
        violations.push({
          code: 'INVALID_SEVERITY',
          file: invLabel,
          field: 'severity',
          message: `severity must be one of critical|high|medium|low (got ${JSON.stringify(inv.severity)})`,
        });
      }

      // description
      if (typeof inv.description !== 'string' || inv.description.trim().length < 10) {
        violations.push({
          code: 'INVALID_DESCRIPTION',
          file: invLabel,
          field: 'description',
          message: 'description must be a string of at least 10 characters',
        });
      }

      // autofixClass
      if (typeof inv.autofixClass !== 'string' || !VALID_AUTOFIX_CLASSES.has(inv.autofixClass)) {
        violations.push({
          code: 'INVALID_AUTOFIX_CLASS',
          file: invLabel,
          field: 'autofixClass',
          message: `autofixClass must be one of safe_auto|gated_auto|manual|advisory (got ${JSON.stringify(inv.autofixClass)})`,
        });
      }
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Discovers all .lens.json files in .shiftstone/governance/checker-lenses and packs/* /checker-lenses.
 */
export function discoverLensFiles(root = ROOT) {
  const lensFiles = [];

  // 1. Core checker lenses
  const coreLensesDir = path.join(root, '.shiftstone', 'governance', 'checker-lenses');
  if (existsSync(coreLensesDir)) {
    for (const f of readdirSync(coreLensesDir)) {
      if (f.endsWith('.lens.json')) {
        lensFiles.push(path.join(coreLensesDir, f));
      }
    }
  }

  // 2. Pack checker lenses
  const packsDir = path.join(root, '.shiftstone', 'packs');
  if (existsSync(packsDir)) {
    for (const packEntry of readdirSync(packsDir)) {
      const packLensesDir = path.join(packsDir, packEntry, 'checker-lenses');
      if (existsSync(packLensesDir) && statSync(packLensesDir).isDirectory()) {
        for (const f of readdirSync(packLensesDir)) {
          if (f.endsWith('.lens.json')) {
            lensFiles.push(path.join(packLensesDir, f));
          }
        }
      }
    }
  }

  return lensFiles;
}

/**
 * Validates all discovered or passed checker lenses.
 */
export function validateCheckerLenses(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const lensFiles = options.files || discoverLensFiles(root);
  const violations = [];
  const seenLensIds = new Map(); // lensId -> filePath
  const seenRuleIds = new Map(); // ruleId -> filePath
  const parsedLenses = [];
  let totalRules = 0;

  for (const filePath of lensFiles) {
    const relPath = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
    let content;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch (err) {
      violations.push({
        code: 'FILE_READ_ERROR',
        file: relPath,
        message: `Failed to read lens file: ${err.message}`,
      });
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      violations.push({
        code: 'INVALID_JSON',
        file: relPath,
        message: `JSON syntax error: ${err.message}`,
      });
      continue;
    }

    const singleRes = validateSingleCheckerLens(parsed, { filePath: relPath });
    if (!singleRes.ok) {
      violations.push(...singleRes.violations);
    }

    parsedLenses.push({ parsed, relPath });

    // Global uniqueness check
    if (parsed && typeof parsed.lensId === 'string') {
      if (seenLensIds.has(parsed.lensId)) {
        violations.push({
          code: 'DUPLICATE_LENS_ID',
          file: relPath,
          message: `lensId "${parsed.lensId}" duplicates lensId defined in ${seenLensIds.get(parsed.lensId)}`,
        });
      } else {
        seenLensIds.set(parsed.lensId, relPath);
      }
    }

    if (parsed && Array.isArray(parsed.invariants)) {
      for (const inv of parsed.invariants) {
        if (inv && typeof inv.ruleId === 'string') {
          totalRules++;
          if (seenRuleIds.has(inv.ruleId)) {
            violations.push({
              code: 'DUPLICATE_RULE_ID',
              file: relPath,
              message: `ruleId "${inv.ruleId}" duplicates ruleId defined in ${seenRuleIds.get(inv.ruleId)}`,
            });
          } else {
            seenRuleIds.set(inv.ruleId, relPath);
          }
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    lensesCount: parsedLenses.length,
    rulesCount: totalRules,
    lenses: parsedLenses.map((p) => p.parsed),
  };
}

/**
 * Matches a relative file path against a glob string.
 * Supports basic globbing: `** /*`, `*.ext`, directory prefixes.
 */
function globMatch(pattern, filePath) {
  const normPattern = pattern.replace(/\\/g, '/');
  const normPath = filePath.replace(/\\/g, '/');

  if (normPattern === '**/*' || normPattern === '*') return true;

  // Convert pattern to regex
  const regexStr = '^' + normPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(.+/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    + '$';

  try {
    const rx = new RegExp(regexStr);
    return rx.test(normPath);
  } catch {
    return normPath.includes(normPattern.replace(/\*/g, ''));
  }
}

/**
 * Resolves active checker lenses based on target file paths.
 */
export function resolveLensesForFiles(filePaths, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const result = validateCheckerLenses({ root, files: options.files });
  const matchedLenses = [];

  for (const lens of result.lenses) {
    const matched = filePaths.some((file) =>
      lens.triggerGlobs.some((glob) => globMatch(glob, file))
    );
    if (matched) {
      matchedLenses.push(lens);
    }
  }

  return matchedLenses;
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('=== Conditional Checker Lens Validation Report (UG-15, UG-16) ===');
  const result = validateCheckerLenses();

  console.log(`  Lenses Checked: ${result.lensesCount}`);
  console.log(`  Rules Checked:  ${result.rulesCount}`);
  console.log(`  Status:         ${result.ok ? 'valid' : 'invalid'}`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} violation(s) found:\n`);
    for (const v of result.violations) {
      console.error(`  - [${v.code}] ${v.file}${v.field ? ` (${v.field})` : ''}: ${v.message}`);
    }
    process.exit(1);
  } else {
    console.log('\nok — All conditional checker lenses satisfy checker-lens/v1 and uniqueness invariants.');
    process.exit(0);
  }
}
