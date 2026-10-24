#!/usr/bin/env node
/**
 * ADR & Open-Question Auto-Compiler (UG-21 / LOCK-02 / Phase 5 Unit U22)
 *
 * Compiles individual OKF concept files in docs/decisions/DEC-*.md and
 * docs/decisions/OQ-*.md into a compact summary table in docs/bible/DECISIONS.md.
 *
 * Flags:
 *   --check: Verifies docs/bible/DECISIONS.md is in sync with docs/decisions/.
 *            Exits 0 if clean, exits 1 if drift detected.
 *   (default): Overwrites docs/bible/DECISIONS.md with compiled ledger.
 *
 * Exit code 0 on pass; exit code 1 on drift or failure.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFrontmatter } from './validate-decisions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Format ISO timestamp into YYYY-MM-DD
 */
export function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
    return timestamp.slice(0, 10);
  }
  return timestamp;
}

/**
 * Compile decisions and open questions into markdown text for docs/bible/DECISIONS.md.
 */
export function generateDecisionsLedger(root = ROOT) {
  const decisionsDir = path.join(root, 'docs', 'decisions');
  const questionsDir = decisionsDir;

  const decisions = [];
  if (existsSync(decisionsDir)) {
    const files = readdirSync(decisionsDir)
      .filter((f) => f.startsWith('DEC-') && f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const fullPath = path.join(decisionsDir, file);
      const content = readFileSync(fullPath, 'utf8');
      const { hasFrontmatter, data } = extractFrontmatter(content);
      if (hasFrontmatter && data?.decisionId) {
        decisions.push({
          id: data.decisionId,
          title: data.title ?? 'Untitled',
          status: data.status ?? 'unknown',
          pack: data.pack ?? 'core',
          date: formatDate(data.timestamp),
          supersededBy: data.supersededBy,
          file,
        });
      }
    }
  }

  // Sort decisions by ID: DEC-001, DEC-002, etc.
  decisions.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const questions = [];
  if (existsSync(questionsDir)) {
    const files = readdirSync(questionsDir)
      .filter((f) => f.startsWith('OQ-') && f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const fullPath = path.join(questionsDir, file);
      const content = readFileSync(fullPath, 'utf8');
      const { hasFrontmatter, data } = extractFrontmatter(content);
      if (hasFrontmatter && data?.questionId) {
        questions.push({
          id: data.questionId,
          title: data.title ?? 'Untitled',
          status: data.status ?? 'open',
          date: formatDate(data.timestamp),
          resolvedBy: data.resolvedBy,
          file,
        });
      }
    }
  }

  questions.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  let workspaceName = 'this workspace';
  const manifestPath = path.join(root, '.shiftstone', 'governance', 'workspace-manifest.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.workspaceName && !manifest.workspaceName.includes('{{')) {
        workspaceName = manifest.workspaceName;
      }
    } catch {}
  }

  let md = `---
type: decisions
timestamp: 2026-10-21T00:00:00.000Z
---
# Architecture Decision Records (ADRs)

All foundational engineering and architectural decisions for ${workspaceName} are documented here in chronological order.
This ledger is auto-compiled from individual OKF decision files in \`docs/decisions/\` by \`.shiftstone/scripts/compile-decisions.js\` (\`LOCK-02\` / \`UG-21\`).

---

<!-- Pack-seeded ADRs are inserted here at init (.shiftstone/packs/<archetype>/decisions-seed.yaml). New ADRs append below the seeded block. -->

## Architecture Decisions Ledger

| ID | Title | Status | Pack | Date | Details |
|---|---|---|---|---|---|
`;

  if (decisions.length === 0) {
    md += '| - | *No architecture decisions recorded yet.* | - | - | - | - |\n';
  } else {
    for (const d of decisions) {
      const link = `[${d.id}](../decisions/${d.file})`;
      let statusDisplay = d.status;
      if (d.status === 'superseded' && d.supersededBy) {
        statusDisplay = `superseded by ${d.supersededBy}`;
      }
      md += `| ${d.id} | ${d.title} | ${statusDisplay} | ${d.pack} | ${d.date} | ${link} |\n`;
    }
  }

  md += `\n## Open Questions Ledger\n\n`;

  if (questions.length === 0) {
    md += `*No open questions at this time.*\n`;
  } else {
    md += `| ID | Title | Status | Date | Details |\n|---|---|---|---|---|\n`;
    for (const q of questions) {
      const link = `[${q.id}](../decisions/${q.file})`;
      let statusDisplay = q.status;
      if (q.status === 'decided' && q.resolvedBy) {
        statusDisplay = `decided (${q.resolvedBy})`;
      }
      md += `| ${q.id} | ${q.title} | ${statusDisplay} | ${q.date} | ${link} |\n`;
    }
  }

  return {
    content: md,
    decisionCount: decisions.length,
    questionCount: questions.length,
  };
}

/**
 * Checks if docs/bible/DECISIONS.md is in sync with docs/decisions/.
 */
export function checkDecisionsSync(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const targetFile = path.join(root, 'docs', 'bible', 'DECISIONS.md');

  if (!existsSync(targetFile)) {
    return {
      inSync: false,
      message: 'docs/bible/DECISIONS.md does not exist on disk',
    };
  }

  const existing = readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n').trim();
  const { content } = generateDecisionsLedger(root);
  const compiled = content.replace(/\r\n/g, '\n').trim();

  const inSync = existing === compiled;
  return {
    inSync,
    existing,
    compiled,
    message: inSync
      ? 'docs/bible/DECISIONS.md is in sync with docs/decisions/.'
      : 'docs/bible/DECISIONS.md is out of sync with docs/decisions/. Run node .shiftstone/scripts/compile-decisions.js to recompile.',
  };
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const targetFile = path.join(ROOT, 'docs', 'bible', 'DECISIONS.md');

  if (args.includes('--check')) {
    const syncRes = checkDecisionsSync({ root: ROOT });
    if (!syncRes.inSync) {
      console.error(`FAIL: ${syncRes.message}`);
      process.exit(1);
    }
    console.log(`PASS: ${syncRes.message}`);
    process.exit(0);
  }

  const { content, decisionCount, questionCount } = generateDecisionsLedger(ROOT);
  writeFileSync(targetFile, content, 'utf8');
  console.log(`PASS: Compiled ${decisionCount} decision(s) and ${questionCount} open question(s) into docs/bible/DECISIONS.md.`);
  process.exit(0);
}
