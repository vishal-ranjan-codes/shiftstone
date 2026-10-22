/**
 * Run-trace visualizer (task 5.7) — renders one loop run as a Mermaid DAG of
 * turns (Macedo 03: structured run results logged to versioned disk files).
 *
 * Sources (all under .loops/<loop>/):
 *   state.json               turn summaries (trajectory, attempt, terminal)
 *   runs.jsonl               final row (terminal state + reason)
 *   runs/trajectory-*.jsonl  per-turn tool-call traces (B3, rotated)
 *
 *   node core/scripts/trace-viz.js <loop-id>
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import type { AnyTerminalState, LoopState, TurnTrajectorySummary } from '../harness/loop-runner/types.ts';

export interface TurnNode {
  turn: number;
  /** true = verification passed, false = failed, undefined = no evidence. */
  passed?: boolean;
  checks: string[];
  blocked?: boolean;
}

export interface RunTrace {
  loop: string;
  run_id: string;
  terminal: AnyTerminalState | 'running';
  reason: string | null;
  dollars_usd: number | null;
  tokens: number | null;
  turns: TurnNode[];
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

interface TrajectoryTraceRow {
  run_id: string;
  turn: number;
  trace: { tool: string; command?: string; ok?: boolean }[];
}

/** Latest trajectory trace rows for a run: turn → tool-call verdicts. */
async function loadToolTraces(loopsDir: string, loop: string, runId: string): Promise<Map<number, { ok: boolean; checks: string[] }>> {
  const out = new Map<number, { ok: boolean; checks: string[] }>();
  const dir = path.join(loopsDir, loop, 'runs');
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.startsWith('trajectory-') && f.endsWith('.jsonl'));
  } catch {
    return out;
  }
  for (const file of files) {
    let raw: string;
    try {
      raw = await readFile(path.join(dir, file), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as TrajectoryTraceRow;
        if (row.run_id !== runId) continue;
        out.set(row.turn, {
          ok: (row.trace ?? []).every((t) => t.ok !== false),
          checks: (row.trace ?? []).map((t) => t.command ?? t.tool).filter(Boolean),
        });
      } catch {
        // tolerate truncated lines
      }
    }
  }
  return out;
}

export async function loadTrace(root: string, loop: string, opts?: { loopsDir?: string }): Promise<RunTrace | null> {
  const loopsDir = opts?.loopsDir ?? path.join(root, '.loops');
  const state = await readJson<LoopState>(path.join(loopsDir, loop, 'state.json'));

  let lastRow: { run_id?: string; terminal_state?: AnyTerminalState; reason?: string; attempts?: number; tokens?: number; dollars_usd?: number } | null = null;
  try {
    const raw = await readFile(path.join(loopsDir, loop, 'runs.jsonl'), 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 0) lastRow = JSON.parse(lines[lines.length - 1]);
  } catch {
    // no run history
  }

  if (!state && !lastRow) return null;

  const runId = state?.run_id ?? lastRow?.run_id ?? 'unknown-run';
  const turnCount = Math.max(state?.attempt ?? 0, lastRow?.attempts ?? 0);
  const summaries = new Map<number, TurnTrajectorySummary>(
    (state?.trajectory ?? []).map((t) => [t.turn, t]),
  );
  const toolTraces = await loadToolTraces(loopsDir, loop, runId);

  const turns: TurnNode[] = [];
  for (let turn = 1; turn <= turnCount; turn += 1) {
    const summary = summaries.get(turn);
    const trace = toolTraces.get(turn);
    const checks = summary?.executed_checks?.length
      ? summary.executed_checks
      : (trace?.checks ?? []);
    turns.push({
      turn,
      passed: summary?.passed ?? trace?.ok,
      checks,
      blocked: summary ? undefined : trace ? !trace.ok && checks.length === 0 : undefined,
    });
  }

  return {
    loop,
    run_id: runId,
    terminal: state?.terminal ?? lastRow?.terminal_state ?? 'running',
    reason: lastRow?.reason ?? state?.notes?.slice(-1)[0] ?? null,
    dollars_usd: lastRow?.dollars_usd ?? state?.dollars_used ?? null,
    tokens: lastRow?.tokens ?? state?.tokens_used ?? null,
    turns,
  };
}

function escapeLabel(text: string): string {
  return text.replace(/"/g, "'").replace(/\r?\n/g, ' ').trim();
}

export function renderMermaid(trace: RunTrace): string {
  const lines: string[] = ['```mermaid', 'graph TD'];
  const startId = 'start';
  const endId = 'endnode';
  lines.push(`${startId}(["${escapeLabel(`${trace.loop} · run ${trace.run_id.slice(0, 8)}`)}"])`);

  let previous = startId;
  if (trace.turns.length > 0) lines.push(`${startId} --> t1`);
  for (const node of trace.turns) {
    const verdict = node.passed === true ? ' ✔' : node.passed === false ? ' ✗' : '';
    const checks = node.checks.length > 0 ? ` — ${escapeLabel(node.checks.join(', '))}` : '';
    const id = `t${node.turn}`;
    lines.push(`${id}["turn ${node.turn}${verdict}${checks}"]`);
    if (previous !== startId) lines.push(`${previous} --> ${id}`);
    previous = id;
  }

  const cost =
    trace.dollars_usd !== null || trace.tokens !== null
      ? `\\n$${trace.dollars_usd ?? 0} · ${trace.tokens ?? 0} tok`
      : '';
  const reason = trace.reason ? `\\n${escapeLabel(trace.reason)}` : '';
  lines.push(`${previous} --> ${endId}(["${trace.terminal}${cost}${reason}"])`);
  lines.push('```');
  return lines.join('\n');
}
