import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'record-run.js');

function record(root: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 });
}

describe('record-run.js — workflow-end runs.jsonl wiring (task 5.1)', () => {
  it('appends one CAC row for a workflow run', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'record-run-'));
    const res = record(root, [
      'deploy', '--state', 'success', '--reason', 'deployed to prod',
      '--tokens', '12000', '--dollars', '0.4', '--accepted', '1',
      '--archetype', 'rr8-supabase-cf',
    ]);
    expect(res.status).toBe(0);

    const raw = await readFile(path.join(root, '.loops', 'deploy', 'runs.jsonl'), 'utf8');
    const rows = raw.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      loop: 'deploy',
      terminal_state: 'success',
      reason: 'deployed to prod',
      tokens: 12000,
      dollars_usd: 0.4,
      accepted_changes: 1,
      cost_per_accepted_change_usd: 0.4,
      archetype: 'rr8-supabase-cf',
    });
  });

  it('refuses an unknown terminal state (exit 2)', () => {
    const root = path.join(REPO_ROOT); // state validation happens before any write
    const res = record(root, ['demo', '--state', 'meh', '--reason', 'x']);
    expect(res.status).toBe(2);
    expect(res.stderr).toContain('--state must be one of');
  });

  it('honors the cost-tracker.enabled=false opt-out', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'record-run-off-'));
    await mkdir(path.join(root, '.shiftstone', 'context'), { recursive: true });
    await writeFile(
      path.join(root, '.shiftstone', 'context', 'cost-tracker.json'),
      JSON.stringify({ 'cost-tracker': { enabled: false } }),
      'utf8',
    );
    const res = record(root, ['demo', '--state', 'success', '--reason', 'x']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('cost tracking disabled');
    await expect(readFile(path.join(root, '.loops', 'demo', 'runs.jsonl'), 'utf8')).rejects.toThrow();
  });
});

describe('workflow wiring — every slash-command workflow logs a run (task 5.1)', () => {
  it('every core/workflows command declares cost_tracking and the record-run footer', async () => {
    const archiveDir = path.join(REPO_ROOT, '.shiftstone', 'workflows', '_archive');
    const dir = (await import('node:fs')).existsSync(archiveDir) ? archiveDir : path.join(REPO_ROOT, '.shiftstone', 'workflows');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'README.md');
    expect(files.length).toBeGreaterThanOrEqual(17); // blueprint: all 17+ workflows
    const unwired: string[] = [];
    for (const file of files) {
      const text = await readFile(path.join(dir, file), 'utf8');
      const hasFlag = /^---\r?\ncost_tracking: workflow-end/m.test(text) || /^cost_tracking: workflow-end/m.test(text);
      const hasFooter = text.includes(`record-run.js ${path.basename(file, '.md')} --state`);
      if (!hasFlag || !hasFooter) unwired.push(`${file} (flag: ${hasFlag}, footer: ${hasFooter})`);
    }
    expect(unwired).toEqual([]);
  });
});
