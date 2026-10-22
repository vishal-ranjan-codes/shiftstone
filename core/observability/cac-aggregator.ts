/**
 * CAC aggregator (tasks 5.2/5.3) — Cost per Accepted Change per
 * loop / archetype / week, plus the secondary economic signals from Osmani 05:
 * first-pass success rate and token burn rate. Reads every
 * .loops/<id>/runs.jsonl written by CostTracker (loops) and record-run.js
 * (workflows), then renders the /status health dashboard (task 5.4).
 *
 *   node core/scripts/status-dashboard.js [root]
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import type { AnyTerminalState } from '../harness/loop-runner/types.ts';

export interface RunRow {
  timestamp: string;
  loop: string;
  run_id: string;
  terminal_state: AnyTerminalState;
  reason: string;
  attempts: number;
  tokens: number;
  dollars_usd: number;
  accepted_changes: number;
  cost_per_accepted_change_usd: number | null;
  archetype?: string;
}

export interface FirstPass {
  /** Runs that reached `success` with at most one executed turn. */
  first_pass_successes: number;
  /** Runs that executed at least one turn (no_op runs are not attempts). */
  attempted: number;
  /** first_pass_successes / attempted, null when nothing was attempted. */
  rate: number | null;
}

export interface TokenBurn {
  tokens_total: number;
  runs: number;
  tokens_per_run: number;
  tokens_per_day: number;
  window_days: number;
}

export interface Metrics {
  key: string;
  runs: number;
  dollars: number;
  tokens: number;
  accepted: number;
  /** dollars / accepted changes; null when nothing was accepted (visibly broken loop). */
  cac_usd: number | null;
  first_pass: FirstPass;
  terminal: Record<string, number>;
}

export interface DashboardSummary {
  totals: Metrics;
  byLoop: Metrics[];
  byArchetype: Metrics[];
  byWeek: Metrics[];
  burn: TokenBurn;
}

export const TERMINAL_ORDER: AnyTerminalState[] = [
  'success',
  'no_op',
  'blocked',
  'stalled',
  'exhausted',
  'error',
];

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Active pack from packs/_registry.yaml — archetype attribution for rows without one. */
export async function activeArchetype(root: string): Promise<string> {
  try {
    const raw = (await parseYaml(await readFile(path.join(root, 'packs', '_registry.yaml'), 'utf8'))) as {
      activePacks?: unknown;
    };
    const packs = Array.isArray(raw?.activePacks) ? raw.activePacks : [];
    const first = packs[0];
    return typeof first === 'string' ? first : 'unspecified';
  } catch {
    return 'unspecified';
  }
}

export async function readRuns(root: string): Promise<RunRow[]> {
  const loopsDir = path.join(root, '.loops');
  const fallbackArchetype = await activeArchetype(root);
  let entries;
  try {
    entries = await readdir(loopsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const rows: RunRow[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let raw: string;
    try {
      raw = await readFile(path.join(loopsDir, entry.name, 'runs.jsonl'), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as RunRow;
        rows.push({ ...row, archetype: row.archetype ?? fallbackArchetype });
      } catch {
        // tolerate truncated lines — history is append-only
      }
    }
  }
  rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return rows;
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export function firstPassRate(rows: RunRow[]): FirstPass {
  const attempted = rows.filter((r) => r.attempts >= 1);
  const firstPass = attempted.filter((r) => r.terminal_state === 'success' && r.attempts <= 1);
  return {
    first_pass_successes: firstPass.length,
    attempted: attempted.length,
    rate: attempted.length > 0 ? Number((firstPass.length / attempted.length).toFixed(4)) : null,
  };
}

export function tokenBurn(rows: RunRow[]): TokenBurn {
  const tokens = rows.reduce((sum, r) => sum + (r.tokens ?? 0), 0);
  const stamps = rows.map((r) => Date.parse(r.timestamp)).filter((t) => !Number.isNaN(t));
  const spanDays =
    stamps.length > 1 ? (Math.max(...stamps) - Math.min(...stamps)) / 86_400_000 : 1;
  const windowDays = Math.max(spanDays, 1);
  return {
    tokens_total: tokens,
    runs: rows.length,
    tokens_per_run: rows.length > 0 ? Math.round(tokens / rows.length) : 0,
    tokens_per_day: Math.round(tokens / windowDays),
    window_days: Number(windowDays.toFixed(2)),
  };
}

function metricsFor(key: string, rows: RunRow[]): Metrics {
  const dollars = rows.reduce((sum, r) => sum + (r.dollars_usd ?? 0), 0);
  const accepted = rows.reduce((sum, r) => sum + (r.accepted_changes ?? 0), 0);
  const terminal: Record<string, number> = {};
  for (const state of TERMINAL_ORDER) terminal[state] = 0;
  for (const row of rows) terminal[row.terminal_state] = (terminal[row.terminal_state] ?? 0) + 1;
  return {
    key,
    runs: rows.length,
    dollars: Number(dollars.toFixed(4)),
    tokens: rows.reduce((sum, r) => sum + (r.tokens ?? 0), 0),
    accepted,
    cac_usd: accepted > 0 ? Number((dollars / accepted).toFixed(4)) : null,
    first_pass: firstPassRate(rows),
    terminal,
  };
}

/** ISO week key (YYYY-Www) for the per-week CAC breakdown. */
export function isoWeekKey(timestamp: string): string {
  const date = new Date(timestamp);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function group(rows: RunRow[], keyOf: (row: RunRow) => string): Metrics[] {
  const buckets = new Map<string, RunRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }
  return [...buckets.entries()]
    .map(([key, bucketRows]) => metricsFor(key, bucketRows))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function summarize(rows: RunRow[]): DashboardSummary {
  return {
    totals: metricsFor('all', rows),
    byLoop: group(rows, (r) => r.loop),
    byArchetype: group(rows, (r) => r.archetype ?? 'unspecified'),
    byWeek: group(rows, (r) => isoWeekKey(r.timestamp)),
    burn: tokenBurn(rows),
  };
}

/* ------------------------------------------------------------------ */
/* Oversight modes (A8) — parsed from versioned loop specs             */
/* ------------------------------------------------------------------ */

export interface LoopSpecInfo {
  loop: string;
  oversight: string;
  ladder: number;
}

export async function loadLoopSpecs(root: string): Promise<LoopSpecInfo[]> {
  const base = path.join(root, 'docs', 'loops');
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: LoopSpecInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = parseYaml(
        await readFile(path.join(base, entry.name, 'spec.md'), 'utf8'),
      ) as Record<string, unknown>;
      out.push({
        loop: (raw['name'] as string) ?? entry.name,
        oversight: String(raw['oversight'] ?? 'unspecified'),
        ladder: Number((raw['verification'] as { ladder_level?: number } | undefined)?.['ladder_level'] ?? 0),
      });
    } catch {
      // missing/unreadable spec — surfaced by validate-loop-specs.js instead
    }
  }
  return out.sort((a, b) => a.loop.localeCompare(b.loop));
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function cac(value: number | null): string {
  return value === null ? 'null (burn without output)' : `$${value.toFixed(4)}`;
}

function pct(rate: number | null): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(1)}%`;
}

function metricsTable(rows: Metrics[]): string[] {
  const lines = [
    '| Scope | Runs | $ | Tokens | Accepted | CAC | First-pass | Tokens/run |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const m of rows) {
    lines.push(
      `| ${m.key} | ${m.runs} | ${m.dollars.toFixed(2)} | ${m.tokens} | ${m.accepted} | ${cac(m.cac_usd)} | ${pct(m.first_pass.rate)} | ${m.runs > 0 ? Math.round(m.tokens / m.runs) : 0} |`,
    );
  }
  return lines;
}

export function renderDashboard(summary: DashboardSummary, opts?: {
  specs?: LoopSpecInfo[];
  generatedAt?: string;
}): string {
  const lines: string[] = [
    '# Loop Health Dashboard',
    '',
    `> Generated ${opts?.generatedAt ?? new Date().toISOString()} — headline metric: Cost per Accepted Change (Macedo 07/08).`,
    '',
    '## CAC — totals',
    '',
    ...metricsTable([summary.totals]),
    '',
    '## CAC — by loop',
    '',
    ...metricsTable(summary.byLoop),
    '',
    '## CAC — by archetype',
    '',
    ...metricsTable(summary.byArchetype),
    '',
    '## CAC — by ISO week',
    '',
    ...metricsTable(summary.byWeek),
    '',
    '## Terminal-state histogram',
    '',
    '| State | Runs | Share |',
    '|---|---:|---:|',
  ];
  const total = summary.totals.runs || 1;
  for (const state of TERMINAL_ORDER) {
    const count = summary.totals.terminal[state] ?? 0;
    lines.push(`| ${state} | ${count} | ${((count / total) * 100).toFixed(1)}% |`);
  }
  lines.push(
    '',
    '## Token burn rate (Osmani 05)',
    '',
    `- total: ${summary.burn.tokens_total} tokens over ${summary.burn.window_days} day(s)`,
    `- per run: ${summary.burn.tokens_per_run} · per day: ${summary.burn.tokens_per_day}`,
    `- first-pass success rate: ${pct(summary.totals.first_pass.rate)} (${summary.totals.first_pass.first_pass_successes}/${summary.totals.first_pass.attempted} attempted runs)`,
    '',
    '## Oversight modes (A8)',
    '',
    '| Loop | Oversight | Ladder | States seen |',
    '|---|---|---:|---|',
  );
  const specs = opts?.specs ?? [];
  const lastByLoop = new Map<string, string>();
  for (const m of summary.byLoop) {
    lastByLoop.set(m.key, TERMINAL_ORDER.filter((s) => (m.terminal[s] ?? 0) > 0).join(', ') || '—');
  }
  if (specs.length === 0 && summary.byLoop.length === 0) {
    lines.push('| — | — | — | — |');
  } else {
    const seen = new Set<string>();
    for (const spec of specs) {
      seen.add(spec.loop);
      lines.push(`| ${spec.loop} | ${spec.oversight} | L${spec.ladder} | ${lastByLoop.get(spec.loop) ?? '—'} |`);
    }
    for (const m of summary.byLoop) {
      if (!seen.has(m.key)) lines.push(`| ${m.key} (workflow) | — | — | ${lastByLoop.get(m.key) ?? '—'} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export async function buildDashboard(root: string): Promise<string> {
  const rows = await readRuns(root);
  const specs = await loadLoopSpecs(root);
  return renderDashboard(summarize(rows), { specs });
}
