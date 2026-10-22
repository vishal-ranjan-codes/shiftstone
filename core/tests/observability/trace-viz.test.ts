import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadTrace, renderMermaid } from '../../observability/trace-viz.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'core', 'scripts', 'trace-viz.js');

function state(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    loop: 'demo-loop',
    run_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    attempt: 2,
    success_streak: 1,
    tokens_used: 1500,
    dollars_used: 1.5,
    started_at: '2026-10-14T00:00:00.000Z',
    updated_at: '2026-10-14T00:10:00.000Z',
    yardstick: 1,
    last_yardstick_delta: 1,
    barren_turns: 0,
    addressed: [],
    waived: [],
    accepted_changes: 1,
    red_green: { required: true, proven: true, baseline: 'red', current: 'green' },
    notes: [],
    scratch: {},
    terminal: 'success',
    trajectory: [
      { turn: 1, claimed_checks: ['typecheck'], executed_checks: ['pnpm -C core typecheck'], passed: true },
      { turn: 2, claimed_checks: ['test'], executed_checks: ['pnpm -C core test'], passed: false },
    ],
    ...overrides,
  };
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'trace-'));
  const dir = path.join(root, '.loops', 'demo-loop');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'state.json'), JSON.stringify(state(), null, 2), 'utf8');
  await writeFile(
    path.join(dir, 'runs.jsonl'),
    JSON.stringify({
      timestamp: '2026-10-14T00:10:00.000Z',
      loop: 'demo-loop',
      run_id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      terminal_state: 'success',
      reason: 'verification passed 1/1 consecutive time(s)',
      attempts: 2,
      tokens: 1500,
      dollars_usd: 1.5,
      accepted_changes: 1,
      cost_per_accepted_change_usd: 1.5,
    }) + '\n',
    'utf8',
  );
  return root;
}

describe('trace-viz — Mermaid DAG of loop turns (task 5.7)', () => {
  it('loads the latest run trace from state.json + runs.jsonl', async () => {
    const root = await fixture();
    const trace = await loadTrace(root, 'demo-loop');
    expect(trace).not.toBeNull();
    expect(trace!.loop).toBe('demo-loop');
    expect(trace!.terminal).toBe('success');
    expect(trace!.reason).toContain('verification passed');
    expect(trace!.turns).toHaveLength(2);
    expect(trace!.turns[0]).toMatchObject({ turn: 1, passed: true });
    expect(trace!.turns[0].checks).toEqual(['pnpm -C core typecheck']);
    expect(trace!.turns[1].passed).toBe(false);
  });

  it('renders a Mermaid graph with verdicts and the terminal state', async () => {
    const root = await fixture();
    const trace = await loadTrace(root, 'demo-loop');
    const mermaid = renderMermaid(trace!);
    expect(mermaid).toContain('```mermaid');
    expect(mermaid).toContain('graph TD');
    expect(mermaid).toContain('turn 1 ✔');
    expect(mermaid).toContain('turn 2 ✗');
    expect(mermaid).toContain('pnpm -C core typecheck');
    expect(mermaid).toContain('success');
    expect(mermaid).toContain('$1.5 · 1500 tok');
  });

  it('falls back to runs.jsonl rows and rotated trajectory traces', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'trace-fb-'));
    const dir = path.join(root, '.loops', 'fallback-loop');
    await mkdir(dir, { recursive: true });
    await mkdir(path.join(dir, 'runs'), { recursive: true });
    // no state.json — history only in runs.jsonl + a rotated trace file
    await writeFile(
      path.join(dir, 'runs.jsonl'),
      JSON.stringify({
        timestamp: '2026-10-14T00:00:00.000Z',
        loop: 'fallback-loop',
        run_id: 'run-zz',
        terminal_state: 'blocked',
        reason: 'gate denied: git push',
        attempts: 3,
        tokens: 0,
        dollars_usd: 0,
        accepted_changes: 0,
        cost_per_accepted_change_usd: null,
      }) + '\n',
      'utf8',
    );
    await writeFile(
      path.join(dir, 'runs', 'trajectory-run-zz.jsonl'),
      JSON.stringify({ timestamp: '2026-10-14T00:00:00.000Z', run_id: 'run-zz', turn: 1, trace: [{ tool: 'shell', command: 'pnpm test', ok: true }] }) + '\n' +
        JSON.stringify({ timestamp: '2026-10-14T00:01:00.000Z', run_id: 'run-zz', turn: 2, trace: [{ tool: 'shell', command: 'gh pr create', ok: false }] }) + '\n',
      'utf8',
    );

    const trace = await loadTrace(root, 'fallback-loop');
    expect(trace!.terminal).toBe('blocked');
    expect(trace!.turns).toHaveLength(3);
    expect(trace!.turns[0].passed).toBe(true);
    expect(trace!.turns[0].checks).toEqual(['pnpm test']);
    expect(trace!.turns[1].passed).toBe(false);
    expect(trace!.turns[2].passed).toBeUndefined(); // no evidence for turn 3

    const mermaid = renderMermaid(trace!);
    expect(mermaid).toContain('blocked');
    expect(mermaid).toContain('gh pr create');
  });

  it('returns null when the loop has no run history', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'trace-none-'));
    expect(await loadTrace(root, 'never-ran')).toBeNull();
  });

  it('CLI prints a renderable trace for a loop with history', async () => {
    const root = await fixture();
    const res = spawnSync(process.execPath, [CLI, 'demo-loop', '--root', root], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('graph TD');
    expect(res.stdout).toContain('turn 1 ✔');
  });
});
