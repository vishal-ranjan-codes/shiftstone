/**
 * Loop memory curation (task 5.6) — prunes lessons.md on evidence.
 *
 * Format spec: docs/loops/_template/lessons.md. Rule set (Macedo 07/08:
 * curated playbooks pruned on evidence):
 *   1. evidence carries a `run:` entry            → kept (proof it helped)
 *   2. fewer than N runs since added_at           → kept (not enough data)
 *   3. CAC improved below the lesson's baseline   → kept (working)
 *   4. otherwise                                  → dropped
 *
 *   node .shiftstone/scripts/curate-memory.js <loop-id> [--n 5] [--dry-run]
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { RunRow } from '../../observability/cac-aggregator.ts';

export interface Lesson {
  id: string;
  title: string;
  added_at: string;
  cac_usd?: number;
  evidence: string[];
  source_run?: string;
  body: string;
}

export interface CurateDecision {
  id: string;
  title: string;
  kept: boolean;
  reason: string;
}

export interface CurateReport {
  loop: string;
  n: number;
  decisions: CurateDecision[];
  dropped: number;
  written: boolean;
}

const META_BULLET = /^-\s+(added_at|cac_usd|evidence|source_run):\s*(.*)$/;
const LESSON_HEADING = /^##\s+(L-\d+)\s+[—-]\s+(.+)$/;

/** Parse every `## L-NNN — title` block, in file order. */
export function parseLessons(markdown: string): Lesson[] {
  const lines = markdown.split(/\r?\n/);
  const lessons: Lesson[] = [];
  let current: (Lesson & { bodyLines: string[] }) | null = null;
  let inMetadata = false;

  const flush = (): void => {
    if (!current) return;
    current.body = current.bodyLines.join('\n').trimEnd();
    const { bodyLines: _drop, ...lesson } = current;
    lessons.push(lesson as Lesson);
    current = null;
  };

  for (const line of lines) {
    const heading = LESSON_HEADING.exec(line);
    if (heading) {
      flush();
      current = { id: heading[1], title: heading[2].trim(), added_at: '', evidence: [], body: '', bodyLines: [] };
      inMetadata = true;
      continue;
    }
    if (!current) continue;
    const meta = META_BULLET.exec(line.trim());
    if (meta && inMetadata) {
      const [, key, value] = meta;
      if (key === 'added_at') current.added_at = value.trim();
      else if (key === 'cac_usd') {
        const parsed = Number(value.trim());
        if (Number.isFinite(parsed)) current.cac_usd = parsed;
      } else if (key === 'evidence') {
        current.evidence = value
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0 && entry !== 'none');
      } else if (key === 'source_run') current.source_run = value.trim();
      continue;
    }
    if (line.trim() === '' && inMetadata) continue; // blank between heading/meta/body
    inMetadata = false;
    current.bodyLines.push(line);
  }
  flush();
  return lessons;
}

/** Remove the given lesson ids (whole heading blocks) from the document. */
export function stripLessons(markdown: string, ids: string[]): string {
  if (ids.length === 0) return markdown;
  const lines = markdown.split(/\r?\n/);
  const drop = new Set(ids);
  const out: string[] = [];
  let removing = false;
  for (const line of lines) {
    const heading = LESSON_HEADING.exec(line);
    if (heading) removing = drop.has(heading[1]);
    if (!removing) out.push(line);
  }
  // collapse the triple blank left behind by a removed block
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

export interface CurateOpts {
  root?: string;
  loop: string;
  /** Observation window in runs (default 5). */
  n?: number;
  dryRun?: boolean;
  lessonsPath?: string;
}

async function loadRuns(loopsDir: string, loop: string): Promise<RunRow[]> {
  try {
    const raw = await readFile(path.join(loopsDir, loop, 'runs.jsonl'), 'utf8');
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as RunRow);
  } catch {
    return [];
  }
}

export async function curateLessons(opts: CurateOpts): Promise<CurateReport> {
  const root = opts.root ?? process.cwd();
  const loopsDir = path.join(root, '.loops');
  const lessonsFile = opts.lessonsPath ?? path.join(loopsDir, opts.loop, 'lessons.md');
  const n = opts.n ?? 5;

  let markdown: string;
  try {
    markdown = await readFile(lessonsFile, 'utf8');
  } catch {
    return { loop: opts.loop, n, decisions: [], dropped: 0, written: false };
  }

  const lessons = parseLessons(markdown);
  const runs = await loadRuns(loopsDir, opts.loop);
  const decisions: CurateDecision[] = [];

  for (const lesson of lessons) {
    const since = lesson.added_at
      ? runs.filter((r) => Date.parse(r.timestamp) >= Date.parse(lesson.added_at))
      : [];

    if (lesson.evidence.length > 0) {
      decisions.push({ id: lesson.id, title: lesson.title, kept: true, reason: `has evidence (${lesson.evidence.join(', ')})` });
      continue;
    }
    if (since.length < n) {
      decisions.push({
        id: lesson.id,
        title: lesson.title,
        kept: true,
        reason: `only ${since.length}/${n} runs since added_at — not enough data`,
      });
      continue;
    }
    const dollars = since.reduce((sum, r) => sum + (r.dollars_usd ?? 0), 0);
    const accepted = since.reduce((sum, r) => sum + (r.accepted_changes ?? 0), 0);
    const cacNow = accepted > 0 ? dollars / accepted : null;
    if (lesson.cac_usd !== undefined && cacNow !== null && cacNow < lesson.cac_usd) {
      decisions.push({
        id: lesson.id,
        title: lesson.title,
        kept: true,
        reason: `CAC improved $${lesson.cac_usd.toFixed(4)} → $${cacNow.toFixed(4)}`,
      });
      continue;
    }
    const baseline = lesson.cac_usd !== undefined ? `$${lesson.cac_usd.toFixed(4)}` : 'none';
    const now = cacNow !== null ? `$${cacNow.toFixed(4)}` : 'null';
    decisions.push({
      id: lesson.id,
      title: lesson.title,
      kept: false,
      reason: `no evidence; CAC did not improve after ${since.length} runs (baseline ${baseline} → ${now})`,
    });
  }

  const droppedIds = decisions.filter((d) => !d.kept).map((d) => d.id);
  let written = false;
  if (droppedIds.length > 0 && !opts.dryRun) {
    await writeFile(lessonsFile, stripLessons(markdown, droppedIds), 'utf8');
    written = true;
  }

  return { loop: opts.loop, n, decisions, dropped: droppedIds.length, written };
}
