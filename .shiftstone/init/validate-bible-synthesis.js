#!/usr/bin/env node
/**
 * Substantive AI Domain Synthesis Validator (REQ-INIT3-11 / LOCK-INIT3-05 / Phase 4 Unit U11)
 *
 * Verifies that all synthesized Development Bible files contain genuine, concrete
 * domain architecture:
 *   1. No raw {{...}} tokens, TODO comments, or boilerplate prompt instructions.
 *   2. Diff check against archetype starter packs: 0% untouched boilerplate topic files.
 *   3. Substantive content depth: minimum 30 non-blank lines and 300 words per topic file.
 *   4. Domain vocabulary density: active presence of domain entities/project nouns.
 *
 * Usage:
 *   node .shiftstone/init/validate-bible-synthesis.js [bibleDir] [--starter-template <dir>] [--domain-entities <list>]
 *   node .shiftstone/init/validate-bible-synthesis.js --check
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
 * Meta and index filenames exempt from substantive 30-line floor.
 */
export const EXEMPT_FILENAMES = new Set([
  'index.md',
  'README.md',
  'CHANGELOG.md',
  'DECISIONS.md',
  'MODE.md',
  'log.md',
]);

/**
 * Check if a file is an authored topic chapter rather than an index or root log.
 */
export function isTopicFile(relativePath, fileName) {
  if (EXEMPT_FILENAMES.has(fileName)) return false;
  // If it's a root markdown file (not in a subfolder), check if it's exempt
  const dir = path.dirname(relativePath);
  if (dir === '.' && EXEMPT_FILENAMES.has(fileName)) return false;
  return true;
}

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
 * Validates synthesized Bible markdown files against forbidden placeholder patterns,
 * starter boilerplate diffs, substantive depth floors, and domain vocabulary density.
 *
 * @param {string} [bibleDir] Directory to scan
 * @param {object} [options]
 * @returns {object} Validation report
 */
export function validateBibleSynthesis(bibleDir = DEFAULT_BIBLE_DIR, options = {}) {
  const violations = [];
  const files = collectMarkdownFiles(bibleDir);

  const starterTemplateDir = options.starterTemplateDir || options.baselineDir || null;
  const baselineFiles = options.baselineFiles || null;
  const minLines = options.minLines !== undefined ? options.minLines : 30;
  const minWords = options.minWords !== undefined ? options.minWords : 300;
  const isPackOverlay =
    bibleDir.includes('bible-overlays') ||
    bibleDir.includes(path.join('.shiftstone', 'packs')) ||
    options.isOverlay === true;
  const substantiveCheck =
    !isPackOverlay &&
    (options.substantive === true ||
      options.minLines !== undefined ||
      options.minWords !== undefined ||
      Boolean(starterTemplateDir) ||
      Boolean(baselineFiles) ||
      (options.domainEntities && options.domainEntities.length > 0));
  const domainEntities = (options.domainEntities || options.projectNouns || options.domainVocabulary || [])
    .map((e) => String(e).trim())
    .filter(Boolean);

  let topicFilesScanned = 0;

  for (const filePath of files) {
    const relativePath = path.relative(bibleDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const isTopic = isTopicFile(relativePath, fileName);

    if (isTopic) {
      topicFilesScanned++;
    }

    // 1. Forbidden Placeholder & Prompt Checks
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
              code: rule,
              message: `${message}: "${match}"`,
            });
          }
        }
      }
    }

    // 2. Starter Template Boilerplate Diff Check (AC-U11-01)
    if (isTopic) {
      let baselineContent = null;
      if (starterTemplateDir) {
        const tplPath = path.join(starterTemplateDir, relativePath);
        if (existsSync(tplPath)) {
          baselineContent = readFileSync(tplPath, 'utf8');
        }
      } else if (baselineFiles && baselineFiles[relativePath]) {
        baselineContent = baselineFiles[relativePath];
      }

      if (baselineContent !== null && content.trim() === baselineContent.trim()) {
        violations.push({
          file: filePath,
          relativePath,
          line: 1,
          rule: 'BOILERPLATE_UNTOUCHED',
          code: 'BOILERPLATE_UNTOUCHED',
          message: `Topic file is 100% identical to boilerplate template: "${relativePath}"`,
        });
      }
    }

    // 3. Substantive Line & Word Floors (AC-U11-02)
    if (isTopic && substantiveCheck) {
      const nonBlankLines = lines.filter((l) => {
        const t = l.trim();
        return t.length > 0 && !/^[-*_]{3,}$/.test(t);
      }).length;
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

      if (nonBlankLines < minLines || wordCount < minWords) {
        violations.push({
          file: filePath,
          relativePath,
          line: 1,
          rule: 'INSUFFICIENT_SUBSTANTIVE_DEPTH',
          code: 'INSUFFICIENT_SUBSTANTIVE_DEPTH',
          message: `${relativePath} has only ${nonBlankLines} non-blank lines (${wordCount} words); minimum floor is ${minLines} lines / ${minWords} words`,
        });
      }
    }

    // 4. Domain Vocabulary Density (AC-U11-02)
    if (isTopic && domainEntities.length > 0) {
      const hasDomainEntity = domainEntities.some((entity) => {
        const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i').test(content);
      });

      if (!hasDomainEntity) {
        violations.push({
          file: filePath,
          relativePath,
          line: 1,
          rule: 'MISSING_DOMAIN_VOCABULARY',
          code: 'MISSING_DOMAIN_VOCABULARY',
          message: `Topic file contains zero mentions of project domain entities (${domainEntities.join(', ')}) in ${relativePath}`,
        });
      }
    }
  }

  const ok = violations.length === 0;
  return {
    ok,
    valid: ok,
    filesScanned: files.length,
    topicFilesScanned,
    violations,
  };
}

// CLI Execution entry point
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);
  const argDir = args.find((a) => !a.startsWith('--'));
  const targetDir = argDir ? path.resolve(argDir) : DEFAULT_BIBLE_DIR;

  const tplIdx = args.indexOf('--starter-template');
  const starterTemplateDir = tplIdx !== -1 && args[tplIdx + 1] ? path.resolve(args[tplIdx + 1]) : null;

  const vocabIdx = args.indexOf('--domain-entities');
  const domainEntities = vocabIdx !== -1 && args[vocabIdx + 1] ? args[vocabIdx + 1].split(',').map((s) => s.trim()) : [];

  console.log(`=== Bible Synthesis Substantive Validation Report (REQ-INIT3-11) ===`);
  console.log(`Target Directory: ${targetDir}`);
  if (starterTemplateDir) console.log(`Starter Template: ${starterTemplateDir}`);
  if (domainEntities.length) console.log(`Domain Entities:  ${domainEntities.join(', ')}`);

  const report = validateBibleSynthesis(targetDir, { starterTemplateDir, domainEntities });
  console.log(`Files Scanned:    ${report.filesScanned} (${report.topicFilesScanned} topic chapters)`);

  if (report.ok) {
    console.log(`\nok — All synthesized Bible files are concrete, substantive, and free of boilerplate.\n`);
    process.exit(0);
  } else {
    console.error(`\nFAIL — Unresolved placeholders, boilerplate strings, or shallow content detected in synthesized Bible (${report.violations.length} violations):\n`);
    for (const v of report.violations) {
      console.error(`  [${v.rule}] ${v.relativePath}:${v.line} -> ${v.message}`);
    }
    console.error(`\nRun Step 9 Deep Bible Synthesis to author substantive domain chapters.\n`);
    process.exit(1);
  }
}
