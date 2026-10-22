#!/usr/bin/env node
/**
 * Anti-duplication checker (blueprint §6.6) — the content-level half of the
 * parity gate.
 *
 *   node core/scripts/check-md-duplication.js --strict
 *
 * Checks:
 *   1. Root shims stay within their line caps (core/context/token-budget.json).
 *   2. Always-loaded static context per IDE (AGENTS.md + IDE shim +
 *      core/static-rules/*) stays within static_max_lines (200).
 *   3. IDE content folders are junctions, not real folders of copied .md files.
 *   4. No pair of steering/canonical files shares a suspicious number of
 *      substantial lines (copied content drift).
 */

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const budget = JSON.parse(readFileSync(path.join(ROOT, 'core', 'context', 'token-budget.json'), 'utf8'));

const SHIMS = ['AGENTS.md', 'ANTIGRAVITY.md', 'CLAUDE.md', 'COMMANDCODE.md'];

/** Folders that must be junctions (real copies = duplication). */
const JUNCTION_SLOTS = [
  '.agent/rules',
  '.claude/rules',
  '.commandcode/rules',
  '.claude/skills',
  '.commandcode/skills',
];

const MIN_LINE_LENGTH = 40;
const MAX_SHARED_LINES = 8;

/** POSIX line count: a trailing newline does not add a line. */
export function lineCount(content) {
  if (content.length === 0) return 0;
  return content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
}

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function substantialLines(file) {
  const raw = readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const inFence = { active: false };
  return lines
    .filter((line) => {
      if (line.trimStart().startsWith('```')) inFence.active = !inFence.active;
      if (inFence.active) return false;
      const trimmed = line.trim();
      if (trimmed.length <= MIN_LINE_LENGTH) return false;
      if (trimmed.startsWith('#') || trimmed.startsWith('---')) return false;
      return true;
    })
    .map((line) => line.trim());
}

function steeringFiles() {
  const files = [];
  for (const shim of SHIMS) {
    const abs = path.join(ROOT, shim);
    if (existsSync(abs)) files.push(abs);
  }
  for (const dir of ['core/static-rules', 'core/path-scoped-rules']) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (name.endsWith('.md')) files.push(path.join(abs, name));
    }
  }
  const workflowsReadme = path.join(ROOT, 'core', 'workflows', 'README.md');
  if (existsSync(workflowsReadme)) files.push(workflowsReadme);
  return files;
}

export function run({ strict = true } = {}) {
  const problems = [];

  // 1. shim line caps
  for (const [shim, cap] of Object.entries(budget.shim_max_lines ?? {})) {
    const abs = path.join(ROOT, shim);
    if (!existsSync(abs)) continue;
    const count = lineCount(readFileSync(abs, 'utf8'));
    if (count > cap) problems.push(`${shim}: ${count} lines exceeds the ${cap}-line static budget`);
  }

  // 2. always-loaded static budget per IDE: AGENTS + shim + Layer 0 rules
  // (only files flagged `activation: always` count — reference files such as
  // checklists live in the folder but load on demand)
  const staticRulesDir = path.join(ROOT, 'core', 'static-rules');
  const staticRuleLines = existsSync(staticRulesDir)
    ? readdirSync(staticRulesDir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => readFileSync(path.join(staticRulesDir, name), 'utf8'))
        .filter((content) => /^---[\s\S]*?activation:\s*always[\s\S]*?---/.test(content))
        .reduce((sum, content) => sum + lineCount(content), 0)
    : 0;
  const agentsAbs = path.join(ROOT, 'AGENTS.md');
  if (existsSync(agentsAbs) && staticRuleLines > 0) {
    const agentsLines = lineCount(readFileSync(agentsAbs, 'utf8'));
    for (const [shim, cap] of Object.entries(budget.shim_max_lines ?? {})) {
      if (shim === 'AGENTS.md') continue; // counted once above, paired only with IDE shims
      const abs = path.join(ROOT, shim);
      if (!existsSync(abs)) continue;
      const shimLines = lineCount(readFileSync(abs, 'utf8'));
      const total = agentsLines + shimLines + staticRuleLines;
      if (total > budget.static_max_lines) {
        problems.push(
          `static budget: AGENTS.md + ${shim} + core/static-rules = ${total} lines exceeds static_max_lines (${budget.static_max_lines}) — trim a rule or shim`,
        );
      }
    }
  }

  // 3. junction slots must not be real folders with .md copies
  for (const slot of JUNCTION_SLOTS) {
    const abs = path.join(ROOT, slot);
    if (!existsSync(abs)) continue;
    if (!isLink(abs)) {
      problems.push(`${slot}/ is a real folder — expected a junction to core/ (duplicated content)`);
    }
  }

  // 3. pairwise substantial-line duplication among steering files
  const files = steeringFiles();
  const perFile = files.map((file) => ({ file, lines: new Set(substantialLines(file)) }));
  for (let i = 0; i < perFile.length; i += 1) {
    for (let j = i + 1; j < perFile.length; j += 1) {
      const a = perFile[i];
      const b = perFile[j];
      const shared = [...a.lines].filter((line) => b.lines.has(line));
      const smaller = Math.min(a.lines.size, b.lines.size);
      if (shared.length >= MAX_SHARED_LINES || (smaller >= 10 && shared.length / smaller >= 0.3)) {
        const relA = path.relative(ROOT, a.file);
        const relB = path.relative(ROOT, b.file);
        problems.push(
          `duplicated content: ${relA} ↔ ${relB} share ${shared.length} substantial line(s) — e.g. "${shared[0].slice(0, 70)}…"`,
        );
      }
    }
  }

  return { problems, strict, checked: files.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = !process.argv.includes('--warn');
  const result = run({ strict });
  for (const problem of result.problems) console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  console.log(`checked ${result.checked} steering file(s), ${result.problems.length} problem(s)`);
  if (strict && result.problems.length > 0) process.exit(1);
}
