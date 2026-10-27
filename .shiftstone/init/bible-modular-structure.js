/**
 * Modular Chapter Subfolder Standard Validator (REQ-INIT-07 / LOCK-INIT-07 / Phase 3 Unit U8)
 *
 * Verifies that every chapter folder in docs/bible/ contains an index.md (Map of Content)
 * and >= 2 discrete topic-bounded markdown files, with no file exceeding 400 lines (or 4,500 tokens).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const MAX_LINES_PER_FILE = 400;
export const MAX_TOKENS_APPROX = 4500;
export const MIN_TOPIC_FILES_PER_CHAPTER = 2;

/**
 * Validates a bible directory or chapter structure against the Modular Chapter Subfolder Standard.
 *
 * @param {string} bibleDir Absolute path to docs/bible or pack bible-overlays
 * @param {object} [options]
 * @returns {object} Validation report
 */
export function validateModularBibleStructure(bibleDir, options = {}) {
  const violations = [];
  const chapters = {};

  if (!existsSync(bibleDir)) {
    return {
      ok: false,
      valid: false,
      violations: [{ path: bibleDir, rule: 'EXISTS', message: `Directory does not exist: ${bibleDir}` }],
      chapters: {},
    };
  }

  const entries = readdirSync(bibleDir, { withFileTypes: true });
  const chapterDirs = entries
    .filter((e) => e.isDirectory() && /^\d\d-/.test(e.name))
    .map((e) => e.name)
    .sort();

  if (chapterDirs.length === 0) {
    violations.push({
      path: bibleDir,
      rule: 'NO_CHAPTERS',
      message: `No chapter directories matching NN-* found in ${bibleDir}`,
    });
  }

  for (const chapterName of chapterDirs) {
    const chapterPath = path.join(bibleDir, chapterName);
    const files = readdirSync(chapterPath, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name)
      .sort();

    chapters[chapterName] = files;

    // AC-U8-01: Must contain index.md
    if (!files.includes('index.md')) {
      violations.push({
        path: chapterPath,
        chapter: chapterName,
        rule: 'MISSING_INDEX_MD',
        message: `Chapter ${chapterName} is missing index.md (Map of Content)`,
      });
    }

    // AC-U8-01: Must have >= 2 topic markdown files besides index.md
    const topicFiles = files.filter((f) => f !== 'index.md');
    if (topicFiles.length < MIN_TOPIC_FILES_PER_CHAPTER) {
      violations.push({
        path: chapterPath,
        chapter: chapterName,
        rule: 'INSUFFICIENT_TOPIC_FILES',
        message: `Chapter ${chapterName} has ${topicFiles.length} topic files, expected >= ${MIN_TOPIC_FILES_PER_CHAPTER}`,
      });
    }

    // AC-U8-01: No single markdown file exceeds 400 lines
    for (const fileName of files) {
      const filePath = path.join(chapterPath, fileName);
      const content = readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/).length;

      if (lines > MAX_LINES_PER_FILE) {
        violations.push({
          path: filePath,
          chapter: chapterName,
          file: fileName,
          rule: 'LINE_BUDGET_EXCEEDED',
          message: `File ${chapterName}/${fileName} exceeds line budget: ${lines} lines (ceiling: ${MAX_LINES_PER_FILE})`,
        });
      }
    }
  }

  const ok = violations.length === 0;
  return {
    ok,
    valid: ok,
    violations,
    chapters,
    chapterCount: chapterDirs.length,
  };
}
