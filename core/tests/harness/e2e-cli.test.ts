import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'core', 'harness', 'cli.js');

function runCli(args: string[], cwd = REPO_ROOT): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
    env: process.env,
  });
}

describe('CLI E2E — the 3 reference loops reach correct terminal states (task 1.10)', () => {
  it('diagnose-loop exits 0 with TERMINAL: no_op on a clean tree', () => {
    const res = runCli(['run', 'diagnose-loop']);
    expect(res.stdout).toContain('TERMINAL: no_op');
    expect(res.stdout).toContain('typecheck already passes');
    expect(res.status).toBe(0);
  }, 180_000);

  it('schema-sync-loop exits 1 with TERMINAL: blocked when Supabase is not configured', () => {
    const res = runCli(['run', 'schema-sync-loop']);
    expect(res.stdout).toContain('TERMINAL: blocked');
    expect(res.stdout).toContain('not configured');
    expect(res.status).toBe(1);
  }, 180_000);

  it('new-feature-loop exits 1 with TERMINAL: blocked without an approved spec', () => {
    const res = runCli(['run', 'new-feature-loop']);
    expect(res.stdout).toContain('TERMINAL: blocked');
    expect(res.status).toBe(1);
  }, 180_000);
});

describe('CLI — validate / status gates', () => {
  it('validate accepts a reference loop (exit 0)', () => {
    const res = runCli(['validate', 'diagnose-loop']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('RESULT: accepted');
    expect(res.stdout).toContain('Well-formed-loop checklist');
  });

  it('validate refuses a bad spec (exit 2) with the A11 checklist', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cli-validate-'));
    await mkdir(path.join(root, 'docs', 'loops', 'refused-loop'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'loops', 'refused-loop', 'spec.md'),
      'name: refused-loop\nskills: []\n',
      'utf8',
    );
    const res = runCli(['validate', 'refused-loop'], root);
    expect(res.status).toBe(2);
    expect(res.stdout).toContain('RESULT: REFUSED');
    expect(res.stdout).toContain('Refusals:');
  });

  it('status surfaces the oversight mode (A8), ladder and state', () => {
    const res = runCli(['status', 'new-feature-loop']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('oversight:   in');
    expect(res.stdout).toContain('ladder:      L4');
    expect(res.stdout).toContain(
      'human_gates: approve spec, mark the backlog task as [x], git push, gh pr create, /deploy',
    );
  });

  it('exits 1 on an unknown loop id', () => {
    const res = runCli(['run', 'no-such-loop']);
    expect(res.status).toBe(1);
    expect(res.stderr + res.stdout).toMatch(/not found/);
  });
});
