#!/usr/bin/env node
/**
 * Backlog sign-off gate (task 6.4) — a backlog task may only be marked `[x]`
 * after `/verify <task-id>` returned a Checker verdict ≥ 0.8, and the verdict
 * is recorded on the task line:
 *
 *   - [x] <task> — verified by <model-family> @ <score> (<date>)
 *
 *   node .shiftstone/scripts/check-backlog-signoff.js           report violations
 *   node .shiftstone/scripts/check-backlog-signoff.js --strict  CI: exit 1 (parity gate)
 *
 * Grandfathering: backlog files whose frontmatter declares `status: completed`
 * are pre-gate batch completions (the Phase 1 legacy) — exempt. Every file
 * still in play must carry signatures on its closed tasks. `/sync-bible` and
 * `/backlog-sync` never mark `[x]` themselves; only `/verify` does.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TASK_CLOSED = /^\s*[-*]\s\[x\]\s(.*)$/;
const SIGNATURE = /[—-]\s*verified by\s+[^@]+@\s*\d/;

function frontmatterStatus(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((l) => /^status:/i.test(l.trim()));
  if (!line) return null;
  return line.slice(line.indexOf(':') + 1).trim().replace(/^["']|["']$/g, '');
}

function listBacklogFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listBacklogFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

/**
 * @returns {{problems: string[], checked: number, signed: number, grandfathered: string[]}}
 */
export function checkBacklogSignoff(root = ROOT) {
  const problems = [];
  const grandfathered = [];
  let checked = 0;
  let signed = 0;

  for (const abs of listBacklogFiles(path.join(root, 'docs', 'backlog'))) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const raw = readFileSync(abs, 'utf8');
    const exempt = frontmatterStatus(raw) === 'completed';
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    let closedInFile = 0;
    let signedInFile = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const task = TASK_CLOSED.exec(lines[i]);
      if (!task) continue;
      closedInFile += 1;
      if (SIGNATURE.test(task[1])) {
        signedInFile += 1;
      } else if (!exempt) {
        problems.push(`${rel}:${i + 1}: closed task without a /verify signature — ${task[1].slice(0, 60)}`);
      }
    }
    checked += closedInFile;
    signed += signedInFile;
    if (exempt && closedInFile > 0) grandfathered.push(rel);
  }
  return { problems, checked, signed, grandfathered };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? path.resolve(process.argv[rootFlag + 1]) : ROOT;
  const result = checkBacklogSignoff(root);
  for (const problem of result.problems) console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  if (result.grandfathered.length > 0) {
    console.log(`grandfathered (status: completed): ${result.grandfathered.join(', ')}`);
  }
  console.log(
    `checked ${result.checked} closed task(s), ${result.signed} signed, ${result.problems.length} violation(s)`,
  );
  if (strict && result.problems.length > 0) process.exit(1);
}
