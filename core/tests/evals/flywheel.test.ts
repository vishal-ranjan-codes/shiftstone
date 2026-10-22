import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FLYWHEEL = path.join(REPO_ROOT, 'core', 'harness', 'evals', 'flywheel.js');
const CLI = path.join(REPO_ROOT, 'core', 'harness', 'cli.js');
const LEDGER = path.join('.loops', 'quality-flywheel-loop', 'backlog-proposals.md');

function runScript(args: string[], cwd: string) {
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 120_000 });
}

async function workspaceWithFailures(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'flywheel-'));
  await mkdir(path.join(root, 'evals', 'bad-suite'), { recursive: true });
  await writeFile(
    path.join(root, 'evals', 'bad-suite', 'cases.jsonl'),
    [
      JSON.stringify({ id: 'case-a', kind: 'exact', input: 'x', expected: 'y', cluster: 'root-cause-1' }),
      JSON.stringify({ id: 'case-b', kind: 'exact', input: 'x', expected: 'z', cluster: 'root-cause-1' }),
      JSON.stringify({ id: 'case-c', kind: 'exact', input: 'x', expected: 'w', cluster: 'root-cause-2' }),
      JSON.stringify({ id: 'case-ok', kind: 'exact', input: 'ok', expected: 'ok', cluster: 'root-cause-2' }),
      '',
    ].join('\n'),
    'utf8',
  );
  return root;
}

describe('quality-flywheel-loop turn — clusters produce backlog items (task 3.6)', () => {
  it('opens one backlog item per cluster and addresses every failing case', async () => {
    const root = await workspaceWithFailures();

    const verifyBefore = runScript([FLYWHEEL, '--verify', '--root', root], root);
    expect(verifyBefore.status).toBe(1); // red-before: failures are uncovered
    expect(verifyBefore.stderr).toContain('case-a');

    const turn = runScript([FLYWHEEL, '--root', root], root);
    expect(turn.status).toBe(0);
    expect(turn.stdout).toContain('opened backlog item for cluster "root-cause-1"');
    expect(turn.stdout).toContain('opened backlog item for cluster "root-cause-2"');
    expect(turn.stdout).toContain('ADDRESSED: case-a');
    expect(turn.stdout).toContain('ADDRESSED: case-b');
    expect(turn.stdout).toContain('ADDRESSED: case-c');
    expect(turn.stdout).not.toContain('ADDRESSED: case-ok'); // green cases are not failures

    const ledger = await readFile(path.join(root, LEDGER), 'utf8');
    expect(ledger).toContain('## [ ] Cluster: root-cause-1');
    expect(ledger).toContain('- Cases: case-a, case-b');
    expect(ledger).toContain('## [ ] Cluster: root-cause-2');
    expect(ledger).toContain('- Cases: case-c');
    expect(ledger).toContain('Regression-verify');

    const verifyAfter = runScript([FLYWHEEL, '--verify', '--root', root], root);
    expect(verifyAfter.status).toBe(0); // green-after: all failures covered
    expect(verifyAfter.stdout).toContain('covered by open backlog items');
  }, 120_000);

  it('a second turn opens no duplicate items but keeps coverage', async () => {
    const root = await workspaceWithFailures();
    runScript([FLYWHEEL, '--root', root], root);
    const before = await readFile(path.join(root, LEDGER), 'utf8');

    const again = runScript([FLYWHEEL, '--root', root], root);
    expect(again.status).toBe(0);
    expect(again.stdout).not.toContain('opened backlog item');
    const after = await readFile(path.join(root, LEDGER), 'utf8');
    expect(after).toBe(before);
    expect(runScript([FLYWHEEL, '--verify', '--root', root], root).status).toBe(0);
  }, 120_000);

  it('the loop runs E2E: green repo reaches TERMINAL: no_op', () => {
    const res = runScript([CLI, 'run', 'quality-flywheel-loop'], REPO_ROOT);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('TERMINAL: no_op');
  }, 180_000);
});
