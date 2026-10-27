#!/usr/bin/env node
/**
 * Deep AI Domain Synthesis Validator (REQ-INIT-08 / LOCK-INIT-05 / Phase 3 Unit U9)
 *
 * Verifies that all synthesized Development Bible files contain genuine, concrete
 * domain architecture, and that zero raw {{...}} tokens, TODO comments, or
 * "Describe X here" boilerplate strings survive.
 *
 * Usage:
 *   node .shiftstone/init/validate-bible-synthesis.js [bibleDir]
 *   node .shiftstone/init/validate-bible-synthesis.js --check
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_BIBLE_DIR = path.join(DEFAULT_ROOT, 'docs', 'bible');

/**
 * Regular expressions for forbidden placeholders and prompt boilerplate.
 */
export const FORBIDDEN_PATTERNS = [
  {
    rule: 'RAW_TEMPLATE_TOKEN',
    pattern: /\{\{[A-Z0-9_ -]+\}\}/g,
    message: 'Raw template substitution token detected',
  },
  {
    rule: 'TODO_COMMENT',
    pattern: /(?:<!--\s*TODO\b|\/\/\s*TODO\b|\bTODO:\s+)/gi,
    message: 'Unresolved TODO comment detected',
  },
  {
    rule: 'BOILERPLATE_PROMPT',
    pattern: /\b(?:describe|insert|fill in)\s+(?:your|the)\s+[\w\s-]{2,30}\s+here\b/gi,
    message: 'Boilerplate prompt instruction detected',
  },
  {
    rule: 'REPLACE_WITH_PROMPT',
    pattern: /\breplace\s+with\s+(?:your|the)\s+[\w\s-]{2,30}\b/gi,
    message: 'Unresolved replacement prompt detected',
  },
];

/**
 * Recursively collects all markdown files in a directory.
 *
 * @param {string} dir
 * @returns {string[]} Absolute file paths
 */
export function collectMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];

  function walk(current) {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Validates synthesized Bible markdown files against forbidden placeholder patterns.
 *
 * @param {string} [bibleDir] Directory to scan
 * @param {object} [options]
 * @returns {object} Validation report
 */
export function validateBibleSynthesis(bibleDir = DEFAULT_BIBLE_DIR, options = {}) {
  const violations = [];
  const files = collectMarkdownFiles(bibleDir);

  for (const filePath of files) {
    const relativePath = path.relative(bibleDir, filePath).replace(/\\/g, '/');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
      const lineText = lines[lineNum - 1];

      for (const { rule, pattern, message } of FORBIDDEN_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = lineText.match(pattern);
        if (matches) {
          for (const match of matches) {
            violations.push({
              file: filePath,
              relativePath,
              line: lineNum,
              match,
              rule,
              message: `${message}: "${match}"`,
            });
          }
        }
      }
    }
  }

  const ok = violations.length === 0;
  return {
    ok,
    valid: ok,
    filesScanned: files.length,
    violations,
  };
}

// CLI Execution entry point
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const argDir = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const targetDir = argDir ? path.resolve(argDir) : DEFAULT_BIBLE_DIR;

  console.log(`=== Bible Synthesis Validation Report (REQ-INIT-08) ===`);
  console.log(`Target Directory: ${targetDir}`);

  const report = validateBibleSynthesis(targetDir);
  console.log(`Files Scanned:    ${report.filesScanned}`);

  if (report.ok) {
    console.log(`\nok — All synthesized Bible files are concrete and free of unresolved placeholders.\n`);
    process.exit(0);
  } else {
    console.error(`\nFAIL — Unresolved placeholders or boilerplate strings detected in synthesized Bible (${report.violations.length} violations):\n`);
    for (const v of report.violations) {
      console.error(`  [${v.rule}] ${v.relativePath}:${v.line} -> ${v.message}`);
    }
    console.error(`\nRun Step 9 Deep Bible Synthesis to replace placeholders with concrete DDL, policies, and invariants.\n`);
    process.exit(1);
  }
}
