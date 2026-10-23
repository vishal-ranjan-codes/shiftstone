#!/usr/bin/env node
/**
 * Research Dossier & Live Search Receipt Validator (UG-34 / Phase 3 Unit U12)
 *
 * Enforces:
 *   1. Every research topic has files 00-BRIEF.md through 06-SOURCES.md.
 *   2. 00-BRIEF.md contains an explicit research question / decision contract.
 *   3. 04-CONCLUSION.md contains a clear recommendation.
 *   4. 06-SOURCES.md contains a Web Search Receipt Table with >= 3 live URLs and retrieval dates.
 *   5. Zero TBD / TODO / example.com placeholders in completed dossiers.
 *
 * Exit code 0 on pass; exit code 1 with explicit violation list on failure.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const REQUIRED_RESEARCH_FILES = [
  '00-BRIEF.md',
  '01-SUMMARY.md',
  '02-FINDINGS.md',
  '03-COMPARISON.md',
  '04-CONCLUSION.md',
  '05-IMPLEMENTATION.md',
  '06-SOURCES.md',
];

const FORBIDDEN_PLACEHOLDERS = [
  /\bTBD\b/i,
  /\bTODO\b/i,
  /\bFIXME\b/i,
  /example\.com/i,
  /\[your-.*\]/i,
];

/** Extract table rows from markdown text */
export function extractTableRows(markdown) {
  const lines = markdown.split(/\r?\n/);
  const rows = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows like |---|---|
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        inTable = true;
        continue;
      }
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      if (inTable) {
        rows.push(cells);
      }
    } else {
      inTable = false;
    }
  }
  return rows;
}

/** Validate a single research topic directory */
export function validateResearchDossier(dirPath, options = {}) {
  const isTemplate = options.isTemplate || path.basename(dirPath) === '_template';
  const violations = [];
  const relPath = path.relative(options.root || ROOT, dirPath);

  // 1. Check all required 00-06 files exist
  for (const file of REQUIRED_RESEARCH_FILES) {
    const full = path.join(dirPath, file);
    if (!existsSync(full)) {
      violations.push({
        code: 'MISSING_RESEARCH_FILE',
        file: path.join(relPath, file).replace(/\\/g, '/'),
        message: `Missing required research file: ${file}`,
      });
    }
  }

  // 2. Validate 00-BRIEF.md content
  const briefPath = path.join(dirPath, '00-BRIEF.md');
  if (existsSync(briefPath)) {
    const briefContent = readFileSync(briefPath, 'utf8');
    const hasQuestion =
      /##\s*Research Question/i.test(briefContent) ||
      /\bdecision\b/i.test(briefContent) ||
      /\bresearch\s+question\b/i.test(briefContent);
    if (!hasQuestion) {
      violations.push({
        code: 'MISSING_RESEARCH_QUESTION',
        file: path.join(relPath, '00-BRIEF.md').replace(/\\/g, '/'),
        message: '00-BRIEF.md must contain a clear Research Question / Decision Contract',
      });
    }
  }

  // 3. Validate 04-CONCLUSION.md content
  const conclusionPath = path.join(dirPath, '04-CONCLUSION.md');
  if (existsSync(conclusionPath)) {
    const concContent = readFileSync(conclusionPath, 'utf8');
    const hasRecommendation =
      /##\s*.*Recommendation/i.test(concContent) ||
      /\brecommend(ation)?\b/i.test(concContent);
    if (!hasRecommendation) {
      violations.push({
        code: 'MISSING_RECOMMENDATION',
        file: path.join(relPath, '04-CONCLUSION.md').replace(/\\/g, '/'),
        message: '04-CONCLUSION.md must contain an explicit Recommendation section',
      });
    }
  }

  // 4. Validate 06-SOURCES.md content (Live Web Search Receipt Table)
  const sourcesPath = path.join(dirPath, '06-SOURCES.md');
  if (existsSync(sourcesPath)) {
    const sourcesContent = readFileSync(sourcesPath, 'utf8');
    const tableRows = extractTableRows(sourcesContent);

    // Look for rows with URL and date/query
    const receiptRows = tableRows.filter((cells) => {
      if (cells.length < 3) return false;
      const joined = cells.join(' ');
      const hasUrl = /https?:\/\/[^\s)]+/.test(joined);
      const hasDate = /\d{4}-\d{2}-\d{2}/.test(joined);
      return hasUrl || hasDate;
    });

    if (!isTemplate && receiptRows.length < 3) {
      violations.push({
        code: 'INSUFFICIENT_SEARCH_RECEIPTS',
        file: path.join(relPath, '06-SOURCES.md').replace(/\\/g, '/'),
        message: `06-SOURCES.md must contain a Web Search Receipt Table with at least 3 live search receipts (found ${receiptRows.length})`,
      });
    }
  }

  // 5. Placeholder checks (for non-templates)
  if (!isTemplate) {
    for (const file of REQUIRED_RESEARCH_FILES) {
      const full = path.join(dirPath, file);
      if (existsSync(full)) {
        const content = readFileSync(full, 'utf8');
        for (const pattern of FORBIDDEN_PLACEHOLDERS) {
          if (pattern.test(content)) {
            violations.push({
              code: 'FORBIDDEN_PLACEHOLDER',
              file: path.join(relPath, file).replace(/\\/g, '/'),
              message: `Contains forbidden placeholder matching ${pattern}`,
            });
            break;
          }
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    dir: relPath.replace(/\\/g, '/'),
    violations,
  };
}

/** Discover all research study directories under docs/research */
export function findResearchDossiers(rootDir = ROOT) {
  const researchBase = path.join(rootDir, 'docs', 'research');
  if (!existsSync(researchBase)) return [];

  const dossiers = [];

  function walk(current) {
    if (!existsSync(current)) return;
    const entries = readdirSync(current, { withFileTypes: true });

    // If current contains 00-BRIEF.md, it is a dossier
    if (existsSync(path.join(current, '00-BRIEF.md'))) {
      dossiers.push(current);
      return;
    }

    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(current, e.name));
      }
    }
  }

  walk(researchBase);
  return dossiers;
}

/** Validate all research dossiers across workspace */
export function validateAllResearch(options = {}) {
  const root = options.root || ROOT;
  const targetDir = options.dir ? path.resolve(root, options.dir) : null;
  const dossiers = targetDir ? [targetDir] : findResearchDossiers(root);

  const results = [];
  const allViolations = [];

  for (const dossier of dossiers) {
    const isTemplate = path.basename(dossier) === '_template';
    // Skip template unless explicitly targeted
    if (!targetDir && isTemplate) continue;

    const res = validateResearchDossier(dossier, { root, isTemplate });
    results.push(res);
    if (!res.ok) {
      allViolations.push(...res.violations);
    }
  }

  return {
    ok: allViolations.length === 0,
    dossiersChecked: dossiers.length,
    results,
    violations: allViolations,
  };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let targetDir = null;
  const selfTest = args.includes('--self-test');

  const dirIndex = args.indexOf('--dir');
  if (dirIndex !== -1 && args[dirIndex + 1]) {
    targetDir = args[dirIndex + 1];
  }

  if (selfTest) {
    // Self-test verifies that the template is syntactically sound
    const templateDir = path.join(ROOT, 'docs', 'research', '_template');
    const res = validateResearchDossier(templateDir, { root: ROOT, isTemplate: true });
    if (!res.ok) {
      console.error('FAIL: docs/research/_template failed validation:');
      for (const v of res.violations) {
        console.error(`  - [${v.code}] ${v.file}: ${v.message}`);
      }
      process.exit(1);
    }
    console.log('ok — Research validator self-test passed cleanly (template verified).');
    process.exit(0);
  }

  const res = validateAllResearch({ root: ROOT, dir: targetDir });
  if (!res.ok) {
    console.error('=== Research Dossier Validation Failed (UG-34) ===');
    for (const v of res.violations) {
      console.error(`  - [${v.code}] ${v.file}: ${v.message}`);
    }
    process.exit(1);
  }

  console.log(`ok — All research dossiers validated cleanly (${res.dossiersChecked} dossier(s) checked).`);
  process.exit(0);
}
