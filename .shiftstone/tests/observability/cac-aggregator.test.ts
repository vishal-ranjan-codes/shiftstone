import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  buildDashboard,
  firstPassRate,
  isoWeekKey,
  readRuns,
  renderDashboard,
  summarize,
  tokenBurn,
  type RunRow,
} from '../../observability/cac-aggregator.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function row(partial: Partial<RunRow> & { loop: string }): RunRow {
  return {
    timestamp: '2026-01-01T09:00:00.000Z',
    run_id: `${partial.loop}-run`,
    terminal_state: 'success',
    reason: 'test',
    attempts: 1,
    tokens: 1000,
    dollars_usd: 0,
    accepted_changes: 0,
    cost_per_accepted_change_usd: null,
    ...partial,
  };
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'cac-'));
  await mkdir(path.join(root, 'packs'), { recursive: true });
  await writeFile(
    path.join(root, 'packs', '_registry.yaml'),
    'apiVersion: workspace/v1\nkind: PackRegistry\nactivePacks:\n  - rr8-supabase-cf\n',
    'utf8',
  );
  await mkdir(path.join(root, 'docs', 'loops', 'diagnose-loop'), { recursive: true });
  await writeFile(
    path.join(root, 'docs', 'loops', 'diagnose-loop', 'spec.md'),
    'name: diagnose-loop\noversight: out\nverification:\n  ladder_level: 1\n',
    'utf8',
  );
  await mkdir(path.join(root, 'docs', 'loops', 'new-feature-loop'), { recursive: true });
  await writeFile(
    path.join(root, 'docs', 'loops', 'new-feature-loop', 'spec.md'),
    'name: new-feature-loop\noversight: in\nverification:\n  ladder_level: 4\n',
    'utf8',
  );

  const rows: RunRow[] = [
    row({ loop: 'diagnose-loop', timestamp: '2026-01-01T09:00:00.000Z', terminal_state: 'no_op', attempts: 0 }),
    row({ loop: 'diagnose-loop', timestamp: '2026-01-01T09:05:00.000Z', attempts: 1, tokens: 12_000, dollars_usd: 0.08, accepted_changes: 1, cost_per_accepted_change_usd: 0.08 }),
    row({ loop: 'new-feature-loop', timestamp: '2026-01-01T09:10:00.000Z', attempts: 3, tokens: 145_000, dollars_usd: 3.2, accepted_changes: 1, cost_per_accepted_change_usd: 3.2, terminal_state: 'blocked' }),
    row({ loop: 'new-feature-loop', timestamp: '2026-01-08T10:00:00.000Z', attempts: 1, tokens: 50_000, dollars_usd: 1, accepted_changes: 1, cost_per_accepted_change_usd: 1 }),
    row({ loop: 'push', timestamp: '2026-01-09T10:00:00.000Z', tokens: 5_000, dollars_usd: 0.1, archetype: 'fastapi-pg' }),
  ];
  await mkdir(path.join(root, '.loops', 'diagnose-loop'), { recursive: true });
  await writeFile(
    path.join(root, '.loops', 'diagnose-loop', 'runs.jsonl'),
    rows.filter((r) => r.loop === 'diagnose-loop').map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  );
  await mkdir(path.join(root, '.loops', 'new-feature-loop'), { recursive: true });
  await writeFile(
    path.join(root, '.loops', 'new-feature-loop', 'runs.jsonl'),
    rows.filter((r) => r.loop === 'new-feature-loop').map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  );
  await mkdir(path.join(root, '.loops', 'push'), { recursive: true });
  await writeFile(
    path.join(root, '.loops', 'push', 'runs.jsonl'),
    rows.filter((r) => r.loop === 'push').map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  );
  return root;
}

describe('cac-aggregator — Cost per Accepted Change (task 5.2)', () => {
  it('computes CAC per loop, per archetype and per ISO week', async () => {
    const root = await fixture();
    const rows = await readRuns(root);
    expect(rows).toHaveLength(5);
    // rows without an explicit archetype fall back to the active pack
    expect(rows.find((r) => r.loop === 'diagnose-loop')?.archetype).toBe('rr8-supabase-cf');

    const summary = summarize(rows);

    const diagnose = summary.byLoop.find((m) => m.key === 'diagnose-loop');
    expect(diagnose).toBeDefined();
    expect(diagnose!.accepted).toBe(1);
    expect(diagnose!.cac_usd).toBe(0.08); // $0.08 / 1 accepted

    const feature = summary.byLoop.find((m) => m.key === 'new-feature-loop');
    expect(feature!.cac_usd).toBe(2.1); // ($3.20 + $1.00) / 2 accepted

    const byArch = summary.byArchetype.map((m) => m.key).sort();
    expect(byArch).toEqual(['fastapi-pg', 'rr8-supabase-cf']);

    expect(summary.byWeek.map((m) => m.key)).toEqual(['2026-W01', '2026-W02']);
    expect(isoWeekKey('2026-01-01T09:00:00.000Z')).toBe('2026-W01');
    expect(isoWeekKey('2026-01-08T09:00:00.000Z')).toBe('2026-W02');
  });

  it('reports null CAC on totals when nothing was accepted', async () => {
    const rows = [row({ loop: 'burn-loop', dollars_usd: 5, attempts: 4 })];
    const summary = summarize(rows);
    expect(summary.totals.cac_usd).toBeNull();
    expect(summary.totals.terminal.success).toBe(1);
  });
});

describe('cac-aggregator — secondary metrics (task 5.3)', () => {
  it('first-pass success rate counts success on the first executed turn', () => {
    const rows = [
      row({ loop: 'a', attempts: 1, terminal_state: 'success' }),
      row({ loop: 'a', attempts: 0, terminal_state: 'no_op' }), // not an attempt
      row({ loop: 'a', attempts: 3, terminal_state: 'success' }), // reworked
      row({ loop: 'a', attempts: 2, terminal_state: 'blocked' }),
      row({ loop: 'a', attempts: 1, terminal_state: 'stalled' }),
    ];
    const rate = firstPassRate(rows);
    expect(rate.attempted).toBe(4); // no_op excluded
    expect(rate.first_pass_successes).toBe(1);
    expect(rate.rate).toBe(0.25);
    expect(firstPassRate([row({ loop: 'a', attempts: 0, terminal_state: 'no_op' })]).rate).toBeNull();
  });

  it('token burn rate reports tokens per run and per day', () => {
    const rows = [
      row({ loop: 'a', timestamp: '2026-01-01T00:00:00.000Z', tokens: 1000 }),
      row({ loop: 'a', timestamp: '2026-01-03T00:00:00.000Z', tokens: 3000 }),
    ];
    const burn = tokenBurn(rows);
    expect(burn.tokens_total).toBe(4000);
    expect(burn.tokens_per_run).toBe(2000);
    expect(burn.window_days).toBe(2);
    expect(burn.tokens_per_day).toBe(2000);
  });
});

describe('/status dashboard rendering (task 5.4)', () => {
  it('renders CAC, first-pass, terminal histogram and oversight modes with sample data', async () => {
    const root = await fixture();
    const rows = await readRuns(root);
    const summary = summarize(rows);
    const specs = [
      { loop: 'diagnose-loop', oversight: 'out', ladder: 1 },
      { loop: 'new-feature-loop', oversight: 'in', ladder: 4 },
    ];
    const dash = renderDashboard(summary, { specs, generatedAt: '2026-01-10T00:00:00.000Z' });

    expect(dash).toContain('# Loop Health Dashboard');
    expect(dash).toContain('## CAC — by loop');
    expect(dash).toContain('## CAC — by archetype');
    expect(dash).toContain('## CAC — by ISO week');
    expect(dash).toContain('## Terminal-state histogram');
    expect(dash).toContain('| success |');
    expect(dash).toContain('## Token burn rate');
    expect(dash).toContain('first-pass success rate');
    expect(dash).toContain('## Oversight modes (A8)');
    expect(dash).toContain('| diagnose-loop | out | L1 |');
    expect(dash).toContain('| new-feature-loop | in | L4 |');
    expect(dash).toContain('| push (workflow) | — | — |'); // workflow rows surface too
    expect(dash).toContain('$2.1000'); // CAC of new-feature-loop: $4.20 / 2 accepted
  });

  it('builds the dashboard end-to-end for a fixture root and for this repo', async () => {
    const root = await fixture();
    const dash = await buildDashboard(root);
    expect(dash).toContain('# Loop Health Dashboard');

    const repo = await buildDashboard(REPO_ROOT);
    expect(repo).toContain('# Loop Health Dashboard');
    expect(repo).toContain('## Oversight modes (A8)');
  });
});
