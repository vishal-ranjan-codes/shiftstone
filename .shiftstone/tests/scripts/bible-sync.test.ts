import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'bible-sync.js');

function bibleSync(root: string, mode = '--check'): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [SCRIPT, mode], { cwd: root, encoding: 'utf8', timeout: 60_000 });
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'bible-sync-'));
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
    path.join(root, 'docs', 'bible', '01-architecture', 'index.md'),
    '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 01-architecture — Index\n',
    'utf8',
  );
  await writeFile(
    path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
    '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Architecture\n\nDocumentation lives in `docs/bible/`.\n',
    'utf8',
  );
  await writeFile(
    path.join(root, 'docs', 'bible', 'DECISIONS.md'),
    '---\ntype: decisions\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# ADRs\n\n## DEC-001 — Adopt the harness\n',
    'utf8',
  );
  return root;
}

describe('bible-sync.js — 3-way diff: code vs bible vs decisions (task 5.9)', () => {
  it('exits 0 when all 3 sources agree', async () => {
    const root = await fixture();
    const res = bibleSync(root);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('agree');
  });

  it('detects a bible reference to a code path that no longer exists', async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Architecture\n\nDeleted module: `.shiftstone/harness/removed-thing.ts`\n',
      'utf8',
    );
    const res = bibleSync(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('bible-references-missing-path');
    expect(res.stderr).toContain('.shiftstone/harness/removed-thing.ts');
  });

  it('detects a ToC row for a missing file and a chapter absent from the ToC', async () => {
    const root = await fixture();
    // a new chapter on disk with no ToC row…
    await mkdir(path.join(root, 'docs', 'bible', '09-new-chapter'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'bible', '09-new-chapter', 'index.md'),
      '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 09\n',
      'utf8',
    );
    // …and a ToC row pointing at a file that does not exist
    await writeFile(
      path.join(root, 'docs', 'bible', 'README.md'),
      [
        '# Bible',
        '',
        '| Section | Description | File |',
        '|---|---|---|',
        '| **01 Architecture** | topology | `01-architecture/architecture-overview.md` |',
        '| **Ghost** | gone | `01-architecture/gone.md` |',
        '| **ADRs** | decisions | `DECISIONS.md` |',
        '',
      ].join('\n'),
      'utf8',
    );
    const res = bibleSync(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('bible-toc-missing-chapter');
    expect(res.stderr).toContain('bible-toc-broken-file');
    expect(res.stderr).toContain('01-architecture/gone.md');
  });

  it('detects an ADR cited in a chapter but defined nowhere', async () => {
    const root = await fixture();
    await writeFile(
      path.join(root, 'docs', 'bible', '01-architecture', 'architecture-overview.md'),
      '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Architecture\n\nSee DEC-099 for the missing decision.\n',
      'utf8',
    );
    const res = bibleSync(root);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('adr-cited-but-missing');
    expect(res.stderr).toContain('DEC-099');
  });

  it('--report emits the update plan as JSON', async () => {
    const root = await fixture();
    await mkdir(path.join(root, 'docs', 'bible', '09-new-chapter'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'bible', '09-new-chapter', 'index.md'),
      '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 09\n',
      'utf8',
    );
    const res = bibleSync(root, '--report');
    expect(res.status).toBe(1);
    const report = JSON.parse(res.stdout) as { drift: { kind: string }[]; sources: { code: { chapters: string[] } } };
    expect(report.sources.code.chapters).toContain('09-new-chapter');
    expect(report.drift.some((d) => d.kind === 'bible-toc-missing-chapter')).toBe(true);
  });

  it('--apply escalates (exit 78) when the bible core files are missing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'bible-sync-empty-'));
    const res = bibleSync(root, '--apply');
    expect(res.status).toBe(78);
    expect(res.stderr).toContain('escalate');
  });
});
