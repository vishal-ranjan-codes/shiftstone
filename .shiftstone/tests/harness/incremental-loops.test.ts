import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'harness', 'cli.js');

function runCli(args: string[], cwd: string): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 180_000,
    env: process.env,
  });
}

/** Fixture workspace whose 3 schema sources exist and agree. */
async function schemaFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'inc-schema-'));

  // versioned spec + standalone check script, copied from this workspace
  await mkdir(path.join(root, 'docs', 'loops', 'schema-sync-loop'), { recursive: true });
  const spec = await readFile(path.join(REPO_ROOT, 'docs', 'loops', 'schema-sync-loop', 'spec.md'), 'utf8');
  await writeFile(path.join(root, 'docs', 'loops', 'schema-sync-loop', 'spec.md'), spec, 'utf8');
  await mkdir(path.join(root, '.shiftstone', 'scripts'), { recursive: true });
  const script = await readFile(path.join(REPO_ROOT, '.shiftstone', 'scripts', 'schema-sync.js'), 'utf8');
  await writeFile(path.join(root, '.shiftstone', 'scripts', 'schema-sync.js'), script, 'utf8');

  // three matching sources
  await mkdir(path.join(root, 'docs', 'bible', '03-database'), { recursive: true });
  await writeFile(
    path.join(root, 'docs', 'bible', '03-database', 'schema-reference.md'),
    '# Schema Reference\n\n### `profiles`\n',
    'utf8',
  );
  await mkdir(path.join(root, 'supabase', 'migrations'), { recursive: true });
  await writeFile(
    path.join(root, 'supabase', 'migrations', '0001_init.sql'),
    'create table profiles (id uuid primary key);\n',
    'utf8',
  );
  await mkdir(path.join(root, 'apps', 'web', 'app', 'types'), { recursive: true });
  await writeFile(
    path.join(root, 'apps', 'web', 'app', 'types', 'database.types.ts'),
    'export type Database = {\n  profiles: {\n    Row: { id: string }\n  }\n}\n',
    'utf8',
  );
  return root;
}

describe('C9 — schema-sync-loop on the incremental engine (task 5.9)', () => {
  it('second run with no changes exits no-op from the fingerprint gate', async () => {
    const root = await schemaFixture();

    const first = runCli(['run', 'schema-sync-loop'], root);
    expect(first.stdout).toContain('TERMINAL: no_op');
    expect(first.stdout).toContain('All 3 sources already match'); // spec no_op text = pre-check path
    expect(first.stdout).not.toContain('stage(s)'); // NOT the fingerprint-gate reason
    expect(first.status).toBe(0);
    expect(existsSync(path.join(root, '.loops', 'schema-sync-loop', 'stage-deps.json'))).toBe(true);

    const second = runCli(['run', 'schema-sync-loop'], root);
    expect(second.stdout).toContain('TERMINAL: no_op');
    expect(second.stdout).toContain('incremental: all 3 stage(s) unchanged since last clean run'); // C9 gate
    expect(second.status).toBe(0);
  }, 180_000);

  it('changed inputs break the skip: drift reaches the loop instead of no-op', async () => {
    const root = await schemaFixture();
    runCli(['run', 'schema-sync-loop'], root); // clean → no_op + fingerprints
    runCli(['run', 'schema-sync-loop'], root); // incremental no-op

    // plant drift: a bible table the other two sources do not describe
    await writeFile(
      path.join(root, 'docs', 'bible', '03-database', 'schema-reference.md'),
      '# Schema Reference\n\n### `profiles`\n\n### `orders`\n',
      'utf8',
    );
    const drifted = runCli(['run', 'schema-sync-loop'], root);
    expect(drifted.stdout).not.toContain('stage(s)'); // gate did NOT skip
    expect(drifted.stdout).toContain('TERMINAL: stalled'); // 2 barren turns on unresolved drift
    expect(drifted.status).toBe(1);
  }, 180_000);
});

describe('C9 — bible-sync-loop (task 5.9)', () => {
  it('validates against the refusal gate', () => {
    const res = runCli(['validate', 'bible-sync-loop'], REPO_ROOT);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('RESULT: accepted');
  });

  /** Minimal bible workspace: the loop runs green when the 3 sources agree. */
  async function bibleFixture(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'inc-bible-'));

    await mkdir(path.join(root, 'docs', 'loops', 'bible-sync-loop'), { recursive: true });
    const spec = await readFile(path.join(REPO_ROOT, 'docs', 'loops', 'bible-sync-loop', 'spec.md'), 'utf8');
    await writeFile(path.join(root, 'docs', 'loops', 'bible-sync-loop', 'spec.md'), spec, 'utf8');
    await mkdir(path.join(root, '.shiftstone', 'scripts'), { recursive: true });
    const script = await readFile(path.join(REPO_ROOT, '.shiftstone', 'scripts', 'bible-sync.js'), 'utf8');
    await writeFile(path.join(root, '.shiftstone', 'scripts', 'bible-sync.js'), script, 'utf8');

    // the pack decisions seed the spec fingerprints (stage input)
    await mkdir(path.join(root, 'packs', 'rr8-supabase-cf'), { recursive: true });
    const seed = await readFile(path.join(REPO_ROOT, 'packs', 'rr8-supabase-cf', 'decisions-seed.yaml'), 'utf8');
    await writeFile(path.join(root, 'packs', 'rr8-supabase-cf', 'decisions-seed.yaml'), seed, 'utf8');

    // clean bible: README ToC + chapter + index + DECISIONS
    await mkdir(path.join(root, 'docs', 'bible', '01-architecture'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'bible', 'README.md'),
      [
        '---',
        'type: readme',
        'timestamp: 2026-10-14T00:00:00.000Z',
        '---',
        '# Bible',
        '',
        '| Section | Description | File |',
        '|---|---|---|',
        '| **01 Architecture** | topology | `01-architecture/architecture-overview.md` |',
        '| **ADRs** | decisions | `DECISIONS.md` |',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(root, 'docs', 'bible', 'index.md'),
      '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# bible — Index\n',
      'utf8',
    );
    await writeFile(
      path.join(root, 'docs', 'bible', 'DECISIONS.md'),
      '---\ntype: decisions\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# ADRs\n',
      'utf8',
    );
    await writeFile(
      path.join(root, 'docs', 'bible', '01-architecture', 'index.md'),
      '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 01-architecture — Index\n',
      'utf8',
    );
    await writeFile(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Architecture\n\nDocumentation lives in `docs/bible/`.\n',
      'utf8',
    );
    return root;
  }

  it('clean workspace: run 1 no-op via pre-check, run 2 no-op via the incremental gate', async () => {
    const root = await bibleFixture();

    const check = spawnSync(process.execPath, [path.join(REPO_ROOT, '.shiftstone', 'scripts', 'bible-sync.js'), '--check'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(check.status).toBe(0); // pre-condition: the fixture is in sync

    const first = runCli(['run', 'bible-sync-loop'], root);
    expect(first.stdout).toContain('TERMINAL: no_op');
    expect(first.stdout).toContain('already agree before any turn'); // spec no_op text = pre-check path
    expect(first.stdout).not.toContain('stage(s)');
    expect(first.status).toBe(0);

    const second = runCli(['run', 'bible-sync-loop'], root);
    expect(second.stdout).toContain('TERMINAL: no_op');
    expect(second.stdout).toContain('incremental: all 2 stage(s) unchanged since last clean run'); // C9 gate
    expect(second.status).toBe(0);
  }, 180_000);

  it('drifted workspace: the loop detects drift instead of no-op (red pre-check → stalled)', async () => {
    const root = await bibleFixture();
    // plant drift: a chapter reference to a code path that no longer exists
    await writeFile(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Architecture\n\nGone module: `.shiftstone/moved-away.ts`\n',
      'utf8',
    );

    const drifted = runCli(['run', 'bible-sync-loop'], root);
    expect(drifted.stdout).not.toContain('TERMINAL: no_op'); // gate must NOT skip; pre-check is red
    expect(drifted.stdout).toContain('TERMINAL: stalled'); // 2 barren turns on unresolved drift
    expect(drifted.status).toBe(1);
  }, 180_000);
});
