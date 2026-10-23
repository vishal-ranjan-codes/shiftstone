#!/usr/bin/env node
/**
 * schema-sync-loop grounded check (L1).
 *
 * Three schema sources:
 *   bible      docs/bible/03-database/schema-reference.md  (### `table` headings)
 *   migrations supabase/migrations/*.sql                   (CREATE TABLE)
 *   types      apps/web/app/types/database.types.ts        (generated row types)
 *
 * Modes:
 *   --check      exit 0 only when all 3 sources exist and describe the same
 *                table set; exit 1 otherwise (drift or missing source).
 *   --apply      exit 78 (EX_CONFIG) when a source is missing — "Supabase not
 *                configured → escalate" (the loop's blocked terminal state);
 *                exit 0 when everything already matches; exit 1 when drift
 *                still needs agent work.
 *   --enumerate  print one line per target work item (missing source or drift);
 *                prints nothing and exits 0 when sources match.
 *   --report     print the 3-way diff as JSON (used by tests/debugging).
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const BLOCKED_EXIT = 78;

const SOURCES = [
  { id: 'bible', file: path.join(root, 'docs/bible/03-database/schema-reference.md'), kind: 'md' },
  { id: 'migrations', file: path.join(root, 'supabase/migrations'), kind: 'sql-dir' },
  { id: 'types', file: path.join(root, 'apps/web/app/types/database.types.ts'), kind: 'ts' },
];

function tablesFromMarkdown(file) {
  const text = readFileSync(file, 'utf8');
  const tables = new Set();
  for (const line of text.split(/\r?\n/)) {
    if (!/^###\s+/.test(line)) continue;
    const backtick = /`([a-z_][a-z0-9_]*)`/.exec(line);
    if (backtick) {
      tables.add(backtick[1]);
      continue;
    }
    const tableWord = /^###\s+([a-z_][a-z0-9_]*)\s+Table/i.exec(line);
    if (tableWord) tables.add(tableWord[1]);
  }
  return tables;
}

function tablesFromMigrations(dir) {
  const tables = new Set();
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), 'utf8');
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?/gi)) {
      tables.add(match[1]);
    }
  }
  return tables;
}

function tablesFromTypes(file) {
  const text = readFileSync(file, 'utf8');
  const tables = new Set();
  const block = /^\s{2}([a-z_][a-z0-9_]*): \{$/gm;
  for (const match of text.matchAll(block)) {
    const name = match[1];
    if (['Row', 'Insert', 'Update', 'Relationships', 'Functions'].includes(name)) continue;
    tables.add(name);
  }
  return tables;
}

function loadSources() {
  const loaded = [];
  for (const source of SOURCES) {
    if (source.kind === 'md') {
      if (!existsSync(source.file)) continue;
      loaded.push({ ...source, tables: tablesFromMarkdown(source.file) });
    } else if (source.kind === 'sql-dir') {
      if (!existsSync(source.file)) continue;
      loaded.push({ ...source, tables: tablesFromMigrations(source.file) });
    } else {
      if (!existsSync(source.file)) continue;
      loaded.push({ ...source, tables: tablesFromTypes(source.file) });
    }
  }
  return loaded;
}

function compare(loaded) {
  const [first, ...rest] = loaded;
  const drift = [];
  for (const other of rest) {
    const onlyFirst = [...first.tables].filter((t) => !other.tables.has(t));
    const onlyOther = [...other.tables].filter((t) => !first.tables.has(t));
    if (onlyFirst.length > 0 || onlyOther.length > 0) {
      drift.push({
        between: [first.id, other.id],
        only_in_first: onlyFirst,
        only_in_other: onlyOther,
      });
    }
  }
  return drift;
}

const mode = process.argv[2] ?? '--check';
const loaded = loadSources();
const missing = SOURCES.filter((s) => !loaded.some((l) => l.id === s.id)).map((s) => s.id);

if (mode === '--enumerate') {
  for (const m of missing) {
    console.log(`missing: ${m}`);
  }
  for (const d of compare(loaded)) {
    console.log(`drift: ${d.between.join('<->')} diff: ${[...d.only_in_first, ...d.only_in_other].join(',')}`);
  }
  process.exit(0);
}

if (mode === '--report') {
  console.log(
    JSON.stringify(
      {
        present: loaded.map((l) => ({ id: l.id, tables: [...l.tables].sort() })),
        missing,
        drift: compare(loaded),
      },
      null,
      2,
    ),
  );
  process.exit(missing.length > 0 || compare(loaded).length > 0 ? 1 : 0);
}

if (mode === '--apply') {
  if (missing.length > 0) {
    console.error(`schema-sync: sources not configured (${missing.join(', ')} missing) — escalate`);
    process.exit(BLOCKED_EXIT);
  }
  if (compare(loaded).length === 0) {
    console.log('schema-sync: all 3 sources already match');
    process.exit(0);
  }
  console.error('schema-sync: drift detected — resolving it requires agent actuation');
  process.exit(1);
}

// --check
if (missing.length > 0) {
  console.error(`schema-sync: drift — sources missing: ${missing.join(', ')}`);
  process.exit(1);
}
const drift = compare(loaded);
if (drift.length > 0) {
  console.error(`schema-sync: drift — ${JSON.stringify(drift)}`);
  process.exit(1);
}
console.log('schema-sync: all 3 sources match');
process.exit(0);
