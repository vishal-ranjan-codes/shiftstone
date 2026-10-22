import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  discoverSuites,
  latestOutcomes,
  loadSuite,
  runEvals,
} from '../../harness/evals/runner.ts';
import { Verifier } from '../../harness/verifier-ladder/verifier.ts';
import { mapRunner, turn } from '../helpers.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'evals-'));
  await mkdir(path.join(root, 'evals', 'green-suite'), { recursive: true });
  await writeFile(
    path.join(root, 'evals', 'green-suite', 'cases.jsonl'),
    [
      JSON.stringify({ id: 'exact-pass', kind: 'exact', input: 'ok', expected: 'ok', cluster: 'c1' }),
      JSON.stringify({ id: 'contains-pass', kind: 'contains', input: 'TERMINAL: no_op', expected: 'TERMINAL:', cluster: 'c1' }),
      JSON.stringify({ id: 'regex-pass', kind: 'regex', input: 'v1.2.3', expected: '^v\\d+\\.\\d+\\.\\d+$', cluster: 'c2' }),
      JSON.stringify({ id: 'command-pass', kind: 'command', command: 'ignored-by-stub', exit_code: 0, cluster: 'c2' }),
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(root, 'evals', 'green-suite', 'suite.json'),
    JSON.stringify({ min_pass_rate: 1.0 }),
    'utf8',
  );
  await mkdir(path.join(root, 'evals', 'flaky-suite'), { recursive: true });
  await writeFile(
    path.join(root, 'evals', 'flaky-suite', 'cases.jsonl'),
    [
      JSON.stringify({ id: 'flaky-fails', kind: 'exact', input: 'nope', expected: 'yes', cluster: 'root-cause-x' }),
      JSON.stringify({ id: 'flaky-passes', kind: 'exact', input: 'yes', expected: 'yes', cluster: 'root-cause-y' }),
      '',
    ].join('\n'),
    'utf8',
  );
  await mkdir(path.join(root, 'evals', '_template'), { recursive: true });
  await writeFile(
    path.join(root, 'evals', '_template', 'cases.jsonl'),
    `${JSON.stringify({ id: 'template', kind: 'exact', input: 'x', expected: 'x' })}\n`,
    'utf8',
  );
  return root;
}

const stubExec = (command: string) =>
  command.includes('ignored-by-stub')
    ? { exitCode: 0, stdout: 'ok', stderr: '' }
    : { exitCode: 1, stdout: '', stderr: 'unexpected' };

describe('evals discovery + loading (B1)', () => {
  it('discovers suites but skips `_`-prefixed templates', async () => {
    const root = await fixtureRoot();
    expect(await discoverSuites(root)).toEqual(['flaky-suite', 'green-suite']);
  });

  it('rejects cases without id/kind with a line number', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'evals-bad-'));
    await mkdir(path.join(root, 'evals', 'broken'), { recursive: true });
    await writeFile(path.join(root, 'evals', 'broken', 'cases.jsonl'), '{"kind":"exact"}\n', 'utf8');
    await expect(loadSuite(root, 'broken')).rejects.toThrow(/cases\.jsonl:1: every case needs/);
  });
});

describe('eval runner (B1)', () => {
  it('passes a green suite and appends results to evals/runs.jsonl', async () => {
    const root = await fixtureRoot();
    const report = await runEvals({ root, suites: ['green-suite'], exec: stubExec });

    expect(report.ok).toBe(true);
    expect(report.suites[0]).toMatchObject({ name: 'green-suite', passed: 4, failed: 0, pass_rate: 1, ok: true });

    const results = await readFile(path.join(root, 'evals', 'runs.jsonl'), 'utf8');
    const rows = results.trim().split('\n').map((line) => JSON.parse(line));
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ suite: 'green-suite', case_id: 'exact-pass', passed: true, cluster: 'c1' });
    expect(typeof rows[0].timestamp).toBe('string');
  });

  it('regresses when a case fails its min_pass_rate', async () => {
    const root = await fixtureRoot();
    const report = await runEvals({ root, suites: ['flaky-suite'], exec: stubExec });
    expect(report.ok).toBe(false);
    expect(report.suites[0]).toMatchObject({ passed: 1, failed: 1, pass_rate: 0.5, ok: false });
    expect(report.suites[0].cases.find((c) => c.case_id === 'flaky-fails')?.passed).toBe(false);
  });

  it('keeps only the latest outcome per case for flywheel clustering (B5)', async () => {
    const root = await fixtureRoot();
    await runEvals({ root, suites: ['green-suite'], exec: stubExec });
    await runEvals({ root, suites: ['flaky-suite'], exec: stubExec });

    const latest = await latestOutcomes(path.join(root, 'evals', 'runs.jsonl'));
    expect(latest.size).toBe(6);
    expect(latest.get('flaky-suite::flaky-fails')).toMatchObject({ passed: false, cluster: 'root-cause-x' });
  });
});

describe('verification.eval_suite gates the turn (B1 per-loop registration)', () => {
  const evalCommand = 'node core/harness/evals/run.js --suite green --strict';

  it('fails verification and pre-check when the registered suite regresses', async () => {
    const runner = mapRunner({
      check: { exitCode: 0 },
      [evalCommand]: { exitCode: 1, stdout: 'FAIL  flaky-fails: expected "yes"' },
    });
    const verifier = new Verifier(
      {
        ladder_level: 1,
        command: 'check',
        expected_exit: 0,
        critics: 1,
        success_streak: 1,
        maker_checker: false,
        judge_score_threshold: 0.8,
        eval_suite: 'green',
      },
      { commandRunner: runner, loopName: 'test-loop' },
    );

    const pre = await verifier.preCheck();
    expect(pre.passed).toBe(false);

    const res = await verifier.verify(turn(), { disjointContext: false });
    expect(res.passed).toBe(false);
    expect(res.evidence.eval_suite).toMatchObject({ name: 'green', exit_code: 1 });
    expect(res.reason).toContain('regressed');
    expect(runner.calls).toEqual(['check', evalCommand, 'check', evalCommand]);
  });
});

describe('sample suite executes end-to-end (task 3.1 verification)', () => {
  it('runs evals/harness-smoke via the CLI and writes results', () => {
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'harness', 'evals', 'run.js'), '--suite', 'harness-smoke', '--strict'],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('PASS  harness-smoke');
    expect(res.stdout).toContain('results appended to evals/runs.jsonl');
  }, 120_000);

  it('exits 1 when an eval regresses — the CI merge gate (task 3.2)', async () => {
    const root = await fixtureRoot();
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'harness', 'evals', 'run.js'), '--suite', 'flaky-suite', '--strict', '--root', root],
      { cwd: REPO_ROOT, encoding: 'utf8', timeout: 120_000 },
    );
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('REGRESSED  flaky-suite');
    expect(res.stdout).toContain('FAIL  flaky-fails');
    expect(res.stdout).toContain('FAIL: eval regression detected');
  }, 120_000);
});
