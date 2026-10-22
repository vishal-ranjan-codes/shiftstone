/**
 * Bible README ToC generator (task 6.2) — regenerates the `## Table of
 * Contents` table of `docs/bible/README.md` from chapter frontmatter, so the
 * ToC can never drift from the chapters on disk (pairs with the bible-sync
 * 3-way diff, which checks the same table).
 *
 *   node core/governance/bible/index.js            regenerate the ToC
 *   node core/governance/bible/index.js --check    CI: exit 1 when stale
 *
 * Row sources:
 *   - root rows      fixed orientation entries (README/MODE/DECISIONS/
 *                    CHANGELOG/log), emitted only when the file exists
 *   - chapter rows   one per `NN-*` chapter directory; the primary file is
 *                    the first `.md` (not index.md) whose frontmatter carries
 *                    a `description`. Section = the file's title (frontmatter
 *                    `title` or its `# heading`), Description = the
 *                    frontmatter `description`.
 *
 * Regeneration is idempotent: only the table body under the ToC heading is
 * replaced, everything else (including the README frontmatter timestamp) is
 * preserved byte-for-byte.
 */

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface TocRow {
  section: string;
  description: string;
  file: string;
}

interface RootRow {
  section: string;
  description: string;
  file: string;
}

/** Orientation rows for files living directly under docs/bible/. */
const ROOT_ROWS: RootRow[] = [
  { section: 'Start Here', description: 'This index and system orientation', file: 'README.md' },
  {
    section: 'MODE',
    description: 'Engagement-mode declaration: vibe / structured / agentic per environment',
    file: 'MODE.md',
  },
  { section: 'ADRs', description: 'All Architecture Decision Records (DEC-XXX)', file: 'DECISIONS.md' },
  { section: 'Changelog', description: 'Complete history of all shipped modifications', file: 'CHANGELOG.md' },
  { section: 'Log', description: 'Append-only change record; compiled into the changelog by /sync-bible', file: 'log.md' },
];

export const TOC_HEADING = '## Table of Contents';

function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return {};
  try {
    return (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function titleOf(raw: string, fallback: string): string {
  const data = parseFrontmatter(raw);
  if (typeof data['title'] === 'string' && data['title'].trim().length > 0) return data['title'].trim();
  const heading = /^#\s+(.+)$/m.exec(raw);
  if (heading) return heading[1].trim();
  return fallback;
}

function descriptionOf(raw: string): string {
  const data = parseFrontmatter(raw);
  if (typeof data['description'] === 'string') return data['description'].trim();
  return '';
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

/** Rows for one chapter directory: primary file = first described `.md`. */
async function chapterRow(bibleDir: string, dirName: string): Promise<TocRow> {
  const chapterDir = path.join(bibleDir, dirName);
  const names = (await readdir(chapterDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .sort();
  const contentFiles = names.filter((name) => name !== 'index.md');

  let primary = contentFiles[0] ?? 'index.md';
  for (const name of contentFiles) {
    const raw = await readFile(path.join(chapterDir, name), 'utf8');
    if (descriptionOf(raw).length > 0) {
      primary = name;
      break;
    }
  }

  const raw = await readFile(path.join(chapterDir, primary), 'utf8');
  return {
    section: titleOf(raw, dirName),
    description: descriptionOf(raw),
    file: `${dirName}/${primary}`,
  };
}

/** Every ToC row: existing root rows first, then chapters in `NN-` order. */
export async function collectTocRows(bibleDir: string): Promise<TocRow[]> {
  const rows: TocRow[] = [];
  for (const row of ROOT_ROWS) {
    const exists = await readFile(path.join(bibleDir, row.file)).then(() => true, () => false);
    if (exists) rows.push({ ...row });
  }
  const dirs = (await readdir(bibleDir, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && /^\d\d-/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const dirName of dirs) rows.push(await chapterRow(bibleDir, dirName));
  return rows;
}

export function renderToc(rows: TocRow[]): string {
  const lines = [
    TOC_HEADING,
    '',
    '| Section | Description | File |',
    '|---|---|---|',
    ...rows.map((row) => `| **${cell(row.section)}** | ${cell(row.description)} | \`${row.file}\` |`),
  ];
  return lines.join('\n');
}

/**
 * Splice the rendered ToC into the README: from the `## Table of Contents`
 * heading through the last contiguous table row. Frontmatter, prose above
 * the heading and anything after the table (blank lines, footers, further
 * headings) are preserved byte-for-byte. Appends the section when the
 * heading is missing.
 */
export function applyToc(existing: string, toc: string): string {
  const text = existing.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const headingIdx = lines.findIndex((line) => line.trim() === TOC_HEADING);
  if (headingIdx === -1) {
    const sep = text.endsWith('\n') ? '' : '\n';
    return `${text}${sep}\n${toc}\n`;
  }
  let i = headingIdx + 1;
  if (i < lines.length && lines[i].trim() === '') i += 1;
  while (i < lines.length && lines[i].trim().startsWith('|')) i += 1;
  const tocLines = toc.replace(/\r\n/g, '\n').split('\n');
  return [...lines.slice(0, headingIdx), ...tocLines, ...lines.slice(i)].join('\n');
}

export interface BibleIndexResult {
  stale: boolean;
  rows: number;
  written: boolean;
}

/** Regenerate the ToC. `write: false` (check mode) never touches the disk. */
export async function generate(bibleDir: string, opts?: { write?: boolean }): Promise<BibleIndexResult> {
  const write = opts?.write ?? true;
  const readmePath = path.join(bibleDir, 'README.md');
  const existing = await readFile(readmePath, 'utf8');
  const rows = await collectTocRows(bibleDir);
  const next = applyToc(existing, renderToc(rows));
  const stale = next.replace(/\r\n/g, '\n') !== existing.replace(/\r\n/g, '\n');
  if (stale && write) await writeFile(readmePath, next, 'utf8');
  return { stale, rows: rows.length, written: stale && write };
}

export async function check(bibleDir: string): Promise<BibleIndexResult> {
  return generate(bibleDir, { write: false });
}
