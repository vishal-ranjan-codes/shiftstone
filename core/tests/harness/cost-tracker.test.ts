import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CostTracker } from '../../observability/cost-tracker.ts';
import { baseState } from '../helpers.ts';

describe('CostTracker — .loops/<id>/runs.jsonl (task 1.8)', () => {
  it('appends one JSONL row per run with the headline CAC metric', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cost-'));
    const tracker = new CostTracker('cac-loop', { loopsDir: dir });

    const state = baseState('cac-loop');
    state.dollars_used = 4;
    state.accepted_changes = 2;
    state.attempt = 5;
    await tracker.record({ terminal_state: 'success', reason: 'verified', state });

    const raw = await readFile(tracker.file, 'utf8');
    const rows = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      loop: 'cac-loop',
      terminal_state: 'success',
      reason: 'verified',
      attempts: 5,
      dollars_usd: 4,
      accepted_changes: 2,
      cost_per_accepted_change_usd: 2, // $4 / 2 accepted changes
    });
    expect(rows[0].run_id).toBe(state.run_id);
    expect(typeof rows[0].timestamp).toBe('string');
  });

  it('reports null CAC when nothing was accepted (burn without output)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cost-'));
    const tracker = new CostTracker('burn-loop', { loopsDir: dir });
    const state = baseState('burn-loop');
    state.dollars_used = 9.5;
    const row = await tracker.record({ terminal_state: 'exhausted', reason: 'budget', state });
    expect(row.cost_per_accepted_change_usd).toBeNull();
    expect(row.terminal_state).toBe('exhausted');
  });

  it('appends across runs', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cost-'));
    const tracker = new CostTracker('multi-loop', { loopsDir: dir });
    const state = baseState('multi-loop');
    await tracker.record({ terminal_state: 'no_op', reason: 'n', state });
    await tracker.record({ terminal_state: 'blocked', reason: 'b', state });
    const raw = await readFile(tracker.file, 'utf8');
    expect(raw.trim().split(/\r?\n/)).toHaveLength(2);
  });
});
