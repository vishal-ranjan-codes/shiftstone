import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { curateLessons, parseLessons, stripLessons } from '../../harness/memory/curate.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, 'core', 'scripts', 'curate-memory.js');

const LESSONS = `# Lessons — curate-loop

## L-001 — Expensive lesson that never paid off

- added_at: 2026-01-01T00:00:00.000Z
- cac_usd: 2
- evidence: none
- source_run: run-old

Always rerun the whole ladder after every micro-edit.

## L-002 — Lesson with proof

- added_at: 2026-01-01T00:00:00.000Z
- cac_usd: 9
- evidence: run:proof-run
- source_run: run-old

Refuse the turn when the command is missing.

## L-003 — Lesson that improved CAC

- added_at: 2026-01-01T00:00:00.000Z
- cac_usd: 5
- evidence: none
- source_run: run-old

Fix one compile error per turn, worst first.

## L-004 — Too new to judge

- added_at: 2026-01-06T00:00:00.000Z
- evidence: none
- source_run: run-new

Fresh rule awaiting its observation window.
`;

function runRow(i: number, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    timestamp: `2026-01-0${i}T00:00:00.000Z`,
    loop: 'curate-loop',
    run_id: `run-${i}`,
    terminal_state: 'success',
    reason: 'x',
    attempts: 1,
    tokens: 100,
    dollars_usd: 2.4,
    accepted_changes: 1,
    cost_per_accepted_change_usd: 2.4,
    ...extra,
  });
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'curate-'));
  const loopDir = path.join(root, '.loops', 'curate-loop');
  await mkdir(loopDir, { recursive: true });
  await writeFile(path.join(loopDir, 'lessons.md'), LESSONS, 'utf8');
  // 6 runs in the window → window CAC = $14.40 / 6 accepted = $2.40
  await writeFile(
    path.join(loopDir, 'runs.jsonl'),
    [1, 2, 3, 4, 5, 6].map((i) => runRow(i)).join('\n') + '\n',
    'utf8',
  );
  return root;
}

describe('lessons parsing (task 5.5 format, task 5.6 consumer)', () => {
  it('parses ids, metadata and bodies from lesson blocks', () => {
    const lessons = parseLessons(LESSONS);
    expect(lessons.map((l) => l.id)).toEqual(['L-001', 'L-002', 'L-003', 'L-004']);
    expect(lessons[0]).toMatchObject({ added_at: '2026-01-01T00:00:00.000Z', cac_usd: 2, evidence: [] });
    expect(lessons[1].evidence).toEqual(['run:proof-run']);
    expect(lessons[0].body).toContain('Always rerun the whole ladder');
    expect(lessons[3].cac_usd).toBeUndefined();
  });

  it('stripLessons removes only the dropped blocks', () => {
    const stripped = stripLessons(LESSONS, ['L-001', 'L-004']);
    expect(stripped).not.toContain('L-001');
    expect(stripped).not.toContain('L-004');
    expect(stripped).toContain('L-002');
    expect(stripped).toContain('L-003');
    expect(stripped).toContain('# Lessons — curate-loop');
  });
});

describe('curateLessons — evidence-based pruning (task 5.6)', () => {
  it('drops no-evidence lessons that did not improve CAC; keeps the rest', async () => {
    const root = await fixture();
    const report = await curateLessons({ root, loop: 'curate-loop', n: 5 });

    const byId = new Map(report.decisions.map((d) => [d.id, d]));
    expect(byId.get('L-001')?.kept).toBe(false); // no evidence, no improvement
    expect(byId.get('L-001')?.reason).toContain('did not improve');
    expect(byId.get('L-002')?.kept).toBe(true); // evidence
    expect(byId.get('L-002')?.reason).toContain('has evidence');
    expect(byId.get('L-003')?.kept).toBe(true); // CAC $2.40 < baseline $5.00
    expect(byId.get('L-003')?.reason).toContain('CAC improved');
    expect(byId.get('L-004')?.kept).toBe(true); // 1 run < n=5
    expect(byId.get('L-004')?.reason).toContain('not enough data');
    expect(report.dropped).toBe(1);
    expect(report.written).toBe(true);

    const after = await readFile(path.join(root, '.loops', 'curate-loop', 'lessons.md'), 'utf8');
    expect(after).not.toContain('L-001');
    expect(after).toContain('L-002');
    expect(after).toContain('L-003');
    expect(after).toContain('L-004');
  });

  it('dry-run reports verdicts without rewriting', async () => {
    const root = await fixture();
    const report = await curateLessons({ root, loop: 'curate-loop', n: 5, dryRun: true });
    expect(report.dropped).toBe(1);
    expect(report.written).toBe(false);
    const after = await readFile(path.join(root, '.loops', 'curate-loop', 'lessons.md'), 'utf8');
    expect(after).toContain('L-001');
  });

  it('keeps everything when there is no run history yet', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'curate-empty-'));
    const loopDir = path.join(root, '.loops', 'curate-loop');
    await mkdir(loopDir, { recursive: true });
    await writeFile(path.join(loopDir, 'lessons.md'), LESSONS, 'utf8');
    const report = await curateLessons({ root, loop: 'curate-loop', n: 5 });
    expect(report.dropped).toBe(0);
    expect(report.decisions.every((d) => d.kept)).toBe(true);
  });

  it('CLI runs end-to-end and rewrites lessons.md', async () => {
    const root = await fixture();
    const res = spawnSync(process.execPath, [CLI, 'curate-loop', '--n', '5', '--root', root], {
      cwd: root,
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('DROP] L-001');
    expect(res.stdout).toContain('3 kept, 1 dropped');
    const after = await readFile(path.join(root, '.loops', 'curate-loop', 'lessons.md'), 'utf8');
    expect(after).not.toContain('L-001');
  });
});
