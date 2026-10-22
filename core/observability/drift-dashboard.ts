/**
 * Bible-to-code drift dashboard (tasks 5.11 / old 5.5, amendment C10) —
 * combines the lineage tracer's entry-point results ("WHERE drift entered")
 * with per-chapter staleness ("WHICH bible chapters lag the code").
 *
 *   node core/scripts/drift-dashboard.js [deliverable.md ...] [--root <path>] [--max-age <days>]
 */

import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { check as checkBibleToc } from '../governance/bible/index-generator.ts';
import { renderLineage, traceLineage, type LineageReport } from './lineage-tracer.ts';

export interface StalenessItem {
  /** Workspace-relative bible chapter folder. */
  chapter: string;
  /** ISO date of the chapter's last commit (null when not committed / not a git worktree). */
  last_commit: string | null;
  age_days: number | null;
  stale: boolean;
}

export interface DriftDashboardInput {
  generated_at: string;
  lineage: LineageReport[];
  staleness: StalenessItem[];
  /** Reference: last commit touching core/ (the code side). */
  code_last_commit: string | null;
  notes: string[];
}

const DEFAULT_MAX_AGE_DAYS = 30;

function gitDate(root: string, args: string[]): string | null {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30_000 });
  if (res.status !== 0 || res.error) return null;
  const value = res.stdout.trim().split(/\r?\n/)[0]?.trim();
  return value ? value : null;
}

/** Last-commit date per bible chapter folder; stale when older than maxAgeDays. */
export async function chapterStaleness(root: string, opts?: { maxAgeDays?: number }): Promise<StalenessItem[]> {
  const maxAge = opts?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const bibleDir = path.join(root, 'docs', 'bible');
  let entries;
  try {
    entries = await readdir(bibleDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const now = Date.now();
  const items: StalenessItem[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d\d-/.test(entry.name)) continue;
    const rel = `docs/bible/${entry.name}`;
    const info = await stat(path.join(bibleDir, entry.name)).catch(() => null);
    if (!info?.isDirectory()) continue;
    const lastCommit = gitDate(root, ['log', '-1', '--format=%cI', '--', rel]);
    const ageDays =
      lastCommit === null ? null : Number(((now - Date.parse(lastCommit)) / 86_400_000).toFixed(1));
    items.push({
      chapter: rel,
      last_commit: lastCommit,
      age_days: ageDays,
      stale: ageDays !== null && ageDays > maxAge,
    });
  }
  return items.sort((a, b) => a.chapter.localeCompare(b.chapter));
}

export function renderDriftDashboard(input: DriftDashboardInput): string {
  const lines: string[] = [
    '# Drift Dashboard',
    '',
    `> Generated ${input.generated_at} — entry points from the lineage tracer (C10), staleness from git history.`,
    '',
    '## Lineage — where drift entered',
    '',
  ];
  if (input.lineage.length === 0) {
    lines.push('- no deliverables traced (pass deliverable.md paths to the CLI)');
  } else {
    for (const report of input.lineage) {
      lines.push(`- ${renderLineage(report).replace(/\n/g, '\n  ')}`);
    }
  }
  lines.push(
    '',
    '## Bible chapter staleness',
    '',
    `- code (\`core/\`) last committed: ${input.code_last_commit ?? 'none yet — no commits touch core/ (or not a git worktree)'}`,
    '',
    '| Chapter | Last commit | Age (days) | Status |',
    '|---|---|---:|---|',
  );
  if (input.staleness.length === 0) {
    lines.push('| — | — | — | no bible chapters found |');
  } else {
    for (const item of input.staleness) {
      lines.push(
        `| ${item.chapter} | ${item.last_commit ?? 'uncommitted'} | ${item.age_days ?? '—'} | ${item.stale ? '**STALE**' : 'fresh'} |`,
      );
    }
  }
  if (input.notes.length > 0) {
    lines.push('', '## Notes', '');
    for (const note of input.notes) lines.push(`- ${note}`);
  }
  lines.push('');
  return lines.join('\n');
}

/** Discover deliverables: `deliverable.md` under docs/plans (walk). */
export async function findDeliverables(root: string): Promise<string[]> {
  const plansDir = path.join(root, 'docs', 'plans');
  const out: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (entry.name === 'deliverable.md') {
        out.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  await walk(plansDir, 0);
  return out.sort();
}

export interface BuildOpts {
  deliverables?: string[];
  maxAgeDays?: number;
}

export async function buildDriftDashboard(root: string, opts?: BuildOpts): Promise<DriftDashboardInput> {
  const notes: string[] = [];
  const targets = opts?.deliverables ?? (await findDeliverables(root));
  const lineage: LineageReport[] = [];
  for (const deliverable of targets) {
    try {
      lineage.push(await traceLineage(deliverable, { root }));
    } catch (error) {
      notes.push(`lineage failed for ${deliverable}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const staleness = await chapterStaleness(root, { maxAgeDays: opts?.maxAgeDays });
  // 6.2 hook: the README ToC is generated from chapter frontmatter — flag it
  // here so the dashboard is a single place to see bible drift.
  try {
    const toc = await checkBibleToc(path.join(root, 'docs', 'bible'));
    if (toc.stale) {
      notes.push('bible README ToC is stale — run `node core/governance/bible/index.js` to regenerate it from chapter frontmatter');
    }
  } catch {
    // no docs/bible/README.md in this root — nothing to check
  }
  const codeLastCommit = gitDate(root, ['log', '-1', '--format=%cI', '--', 'core']);
  return {
    generated_at: new Date().toISOString(),
    lineage,
    staleness,
    code_last_commit: codeLastCommit,
    notes,
  };
}
