#!/usr/bin/env node
/**
 * Harness-as-code ownership gate (task 6.6, amendment B11) — CI check that
 * CODEOWNERS exists, covers every harness path, and that the governance rule
 * it points at exists.
 *
 *   node .shiftstone/scripts/check-harness-ownership.js           report
 *   node .shiftstone/scripts/check-harness-ownership.js --strict  CI: exit 1
 *
 * The review itself is enforced by GitHub from CODEOWNERS on every PR; this
 * gate stops the ownership contract from silently eroding (file deleted, a
 * harness path dropped from the patterns, an owner removed).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchGlob } from '../context/skills-loader.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODEOWNERS_CANDIDATES = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'];
const GOVERNANCE_RULE = '.shiftstone/static-rules/governance.md';

/** Harness paths that MUST have an owner (B11: prompts, rules, workflows, evals, skills). */
export const HARNESS_PATHS = [
  'AGENTS.md',
  'ANTIGRAVITY.md',
  'CLAUDE.md',
  'COMMANDCODE.md',
  '.shiftstone/static-rules/global.md',
  '.agents/skills/ss-verify/SKILL.md',
  'evals/README.md',
  '.agents/skills/ss-loop-author/SKILL.md',
  'packs/rr8-supabase-cf/skills/stack/SKILL.md',
];

/** CODEOWNERS pattern -> glob usable by matchGlob ('dir/' covers everything below). */
export function toGlob(pattern) {
  let p = pattern.replace(/^\//, '');
  if (p.endsWith('/')) p += '**';
  return p;
}

export function parseCodeowners(raw) {
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const [pattern, ...owners] = trimmed.split(/\s+/).filter(Boolean);
    entries.push({ pattern, owners: owners.filter((o) => o.startsWith('@') || o.includes('@')) });
  }
  return entries;
}

/**
 * @returns {{problems: string[], file: string|null, covered: number}}
 */
export function checkOwnership(root = ROOT) {
  const problems = [];

  const file = CODEOWNERS_CANDIDATES.map((rel) => path.join(root, rel)).find((abs) => existsSync(abs));
  if (!file) {
    return { problems: ['CODEOWNERS missing — harness paths have no named owner (B11)'], file: null, covered: 0 };
  }
  const relFile = path.relative(root, file).split(path.sep).join('/');
  const entries = parseCodeowners(readFileSync(file, 'utf8'));

  for (const entry of entries) {
    if (entry.owners.length === 0) problems.push(`${relFile}: pattern "${entry.pattern}" has no owner`);
  }

  let covered = 0;
  for (const harnessPath of HARNESS_PATHS) {
    const owner = entries.find((entry) => matchGlob(toGlob(entry.pattern), harnessPath));
    if (!owner) problems.push(`${relFile}: harness path "${harnessPath}" is not covered by any pattern`);
    else if (owner.owners.length > 0) covered += 1;
  }

  if (!existsSync(path.join(root, GOVERNANCE_RULE))) {
    problems.push(`governance rule missing: ${GOVERNANCE_RULE} (PR checklist the ownership rule points at)`);
  }
  return { problems, file: relFile, covered };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const result = checkOwnership();
  for (const problem of result.problems) console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  console.log(
    result.file
      ? `checked ${result.file} — ${result.covered}/${HARNESS_PATHS.length} harness paths owned, ${result.problems.length} problem(s)`
      : 'no CODEOWNERS file found',
  );
  if (strict && result.problems.length > 0) process.exit(1);
}
