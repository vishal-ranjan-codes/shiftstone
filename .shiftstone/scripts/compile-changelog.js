#!/usr/bin/env node
/**
 * Changelog compiler (task 6.9, amendment C6) — compiles pending `log.md`
 * entries from the knowledge bundles into `docs/bible/CHANGELOG.md` and
 * stamps them as compiled.
 *
 *   node .shiftstone/scripts/compile-changelog.js           compile pending entries
 *   node .shiftstone/scripts/compile-changelog.js --check   CI: exit 1 when any entry is pending
 *
 * Log format (append-only): `| Date | Scope | Change | Kind | Compiled |`
 * with `Kind` ∈ Added/Changed/Fixed/Removed. An empty `Compiled` cell is
 * pending. Compiled entries land under a per-date `## [YYYY-MM-DD] — Synced
 * from log.md` heading (newest-first), grouped by Kind. Idempotent: once
 * every row is stamped, a run writes nothing.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUNDLE_LOGS = ['docs/bible/log.md', 'packs/log.md', '.agents/skills/log.md'];
const CHANGELOG_REL = 'docs/bible/CHANGELOG.md';
const KIND_ORDER = ['Added', 'Changed', 'Fixed', 'Removed'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Split one markdown table row into trimmed cells (supports `\|` escapes). */
export function splitRow(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

/**
 * Parse a log.md into table rows.
 * @returns {{date: string, scope: string, change: string, kind: string, compiled: string, line: number}[]}
 */
export function parseLog(raw) {
  const rows = [];
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trimStart().startsWith('|')) continue;
    const cells = splitRow(lines[i].trim());
    if (cells.length < 5) continue;
    if (!DATE_RE.test(cells[0])) continue; // header / separator rows
    rows.push({ date: cells[0], scope: cells[1], change: cells[2], kind: cells[3], compiled: cells[4], line: i });
  }
  return rows;
}

export function isPending(row) {
  return row.compiled === '' || row.compiled === '-';
}

function bulletFor(entry) {
  return entry.scope === 'bible' ? `- ${entry.change}` : `- [${entry.scope}] ${entry.change}`;
}

function nextSectionStart(lines, from) {
  for (let i = from; i < lines.length; i += 1) {
    if (/^## (?!#)/.test(lines[i])) return i;
  }
  return lines.length;
}

/**
 * Compile pending entries into the changelog text. Each date lands under its
 * own `## [YYYY-MM-DD] — Synced from log.md` heading (newest-first), entries
 * grouped into `### Kind` subsections. Existing compiled sections are merged,
 * never rewritten.
 * @param {string} changelogRaw
 * @param {{date: string, scope: string, kind: string, change: string}[]} entries order preserved
 * @returns {string} new changelog text
 */
export function compileInto(changelogRaw, entries) {
  let lines = changelogRaw.replace(/\r\n/g, '\n').split('\n');
  const byDate = new Map();
  for (const entry of entries) {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }
  const dates = [...byDate.keys()].sort().reverse();

  for (const date of dates) {
    const ownHeading = `## [${date}] — Synced from log.md`;
    let idx = lines.findIndex((line) => line.trim() === ownHeading);
    if (idx === -1) {
      // newest-first: insert before the first strictly older date heading
      let insertAt = lines.length;
      for (let i = 0; i < lines.length; i += 1) {
        const match = /^## \[(\d{4}-\d{2}-\d{2})\]/.exec(lines[i]);
        if (match && match[1] < date) {
          insertAt = i;
          break;
        }
      }
      const lead = insertAt > 0 && lines[insertAt - 1].trim() !== '' ? [''] : [];
      lines.splice(insertAt, 0, ...lead, ownHeading);
      idx = insertAt + lead.length;
    }

    // parse the section's existing `### Kind` -> bullets groups
    const end = nextSectionStart(lines, idx + 1);
    const order = [];
    const kinds = new Map();
    let current = null;
    for (let i = idx + 1; i < end; i += 1) {
      const heading = /^### (.+)$/.exec(lines[i]);
      if (heading) {
        current = heading[1].trim();
        if (!kinds.has(current)) {
          kinds.set(current, []);
          order.push(current);
        }
        continue;
      }
      if (current !== null && lines[i].trim().startsWith('- ')) kinds.get(current).push(lines[i]);
    }

    const dayEntries = byDate.get(date);
    const missingKinds = [...new Set(dayEntries.map((entry) => entry.kind))].filter((kind) => !kinds.has(kind));
    for (const kind of KIND_ORDER.filter((k) => missingKinds.includes(k))) {
      kinds.set(kind, []);
      order.push(kind);
    }
    for (const kind of missingKinds.filter((k) => !KIND_ORDER.includes(k))) {
      kinds.set(kind, []);
      order.push(kind);
    }
    for (const entry of dayEntries) kinds.get(entry.kind).push(bulletFor(entry));

    // render to match the manual house style: bullets directly under their
    // `### Kind`, one blank line between subsections, `---` before the next
    // date heading (mirrors the hand-written sections).
    const content = [
      '',
      ...order.flatMap((kind) => [`### ${kind}`, ...kinds.get(kind), '']),
      ...(end < lines.length ? ['---', ''] : []),
    ];
    lines = [...lines.slice(0, idx + 1), ...content, ...lines.slice(end)];
  }

  // tidy: collapse 3+ consecutive blank lines to a single blank
  const out = [];
  for (const line of lines) {
    if (line.trim() === '' && out[out.length - 1]?.trim() === '' && out[out.length - 2]?.trim() === '') continue;
    out.push(line);
  }
  return out.join('\n');
}

/** Rewrite a log's compiled cells for the given pending line numbers. */
export function stampLog(raw, lineNumbers, today) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  for (const lineNo of lineNumbers) {
    const cells = splitRow(lines[lineNo].trim());
    cells[4] = today;
    lines[lineNo] = `| ${cells.map((cell) => cell.replace(/\|/g, '\\|')).join(' | ')} |`;
  }
  return lines.join('\n');
}

/** Pending entries across all bundle logs (missing logs are skipped). */
export function pendingEntries(root = ROOT) {
  const pending = [];
  for (const rel of BUNDLE_LOGS) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    for (const row of parseLog(readFileSync(abs, 'utf8'))) {
      if (isPending(row)) pending.push({ ...row, log: rel });
    }
  }
  return pending;
}

/**
 * Compile every pending bundle-log entry into the changelog and stamp it.
 * @returns {{compiled: number, logs: string[], written: boolean}}
 */
export function compile(root = ROOT, opts = {}) {
  const write = opts.write ?? true;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const changelogPath = path.join(root, CHANGELOG_REL);
  const pending = pendingEntries(root);
  if (pending.length === 0) return { compiled: 0, logs: [], written: false };
  if (!existsSync(changelogPath)) throw new Error(`changelog missing: ${CHANGELOG_REL}`);

  const changelog = readFileSync(changelogPath, 'utf8');
  const next = compileInto(changelog, pending);

  if (write) {
    writeFileSync(changelogPath, next, 'utf8');
    const touched = new Map();
    for (const row of pending) {
      if (!touched.has(row.log)) touched.set(row.log, []);
      touched.get(row.log).push(row.line);
    }
    for (const [rel, lineNumbers] of touched) {
      const abs = path.join(root, rel);
      writeFileSync(abs, stampLog(readFileSync(abs, 'utf8'), lineNumbers, today), 'utf8');
    }
  }
  return { compiled: pending.length, logs: [...new Set(pending.map((row) => row.log))], written: write };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag !== -1 ? path.resolve(process.argv[rootFlag + 1]) : ROOT;
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    const pending = pendingEntries(root);
    if (pending.length > 0) {
      for (const row of pending) console.error(`pending: ${row.log} ${row.date} ${row.scope} — ${row.change}`);
      console.error('run: node .shiftstone/scripts/compile-changelog.js');
      process.exit(1);
    }
    console.log('ok — every bundle log entry is compiled into docs/bible/CHANGELOG.md');
  } else {
    const result = compile(root);
    if (!result.written) console.log('no changes — nothing pending compilation');
    else console.log(`compiled ${result.compiled} entr(ies) from ${result.logs.join(', ')} into ${CHANGELOG_REL}`);
  }
}
