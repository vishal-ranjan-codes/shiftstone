import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { applyToc, check, collectTocRows, generate } from '../../governance/bible/index-generator.ts';
import { checkFile } from '../../scripts/check-link-integrity.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function makeBible(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'bible-toc-'));
  const bible = path.join(root, 'docs', 'bible');
  await mkdir(path.join(bible, '01-architecture'), { recursive: true });
  await writeFile(
    path.join(bible, 'README.md'),
    [
      '---',
      'type: readme',
      'timestamp: 2026-10-14T00:00:00.000Z',
      '---',
      '# Bible',
      '',
      'Prose above the ToC stays untouched.',
      '',
      '## Table of Contents',
      '',
      '| Section | Description | File |',
      '|---|---|---|',
      '| **Ghost** | hand-written row that drifted | `01-architecture/gone.md` |',
      '',
      '## Footer',
      '',
      'Footer prose survives regeneration.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(bible, 'DECISIONS.md'),
    '---\ntype: decisions\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# ADRs\n',
    'utf8',
  );
  await writeFile(
    path.join(bible, 'index.md'),
    '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# bible — Index\n',
    'utf8',
  );
  await writeFile(
    path.join(bible, '01-architecture', 'architecture-overview.md'),
    [
      '---',
      'type: chapter',
      'timestamp: 2026-10-14T00:00:00.000Z',
      'description: Runtime topology and stack reference',
      '---',
      '# 01 — Architecture Overview',
      '',
      'Body.',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(
    path.join(bible, '01-architecture', 'extra-notes.md'),
    '---\ntype: chapter\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# Extra Notes\n\nNot primary.\n',
    'utf8',
  );
  await writeFile(
    path.join(bible, '01-architecture', 'index.md'),
    '---\ntype: index\ntimestamp: 2026-10-14T00:00:00.000Z\n---\n# 01-architecture — Index\n',
    'utf8',
  );
  return bible;
}

describe('6.2 — bible README ToC generator', () => {
  it('builds rows from chapter frontmatter and existing root files', async () => {
    const bible = await makeBible();
    const rows = await collectTocRows(bible);
    expect(rows.map((r) => r.file)).toEqual(['README.md', 'DECISIONS.md', '01-architecture/architecture-overview.md']);
    const chapter = rows.find((r) => r.file.startsWith('01-'));
    expect(chapter?.section).toBe('01 — Architecture Overview');
    expect(chapter?.description).toBe('Runtime topology and stack reference');
  });

  it('regenerates the ToC in place: prose and footer survive, stale rows are replaced', async () => {
    const bible = await makeBible();
    const result = await generate(bible);
    expect(result.written).toBe(true);
    const readme = await readFile(path.join(bible, 'README.md'), 'utf8');
    expect(readme).toContain('Prose above the ToC stays untouched.');
    expect(readme).toContain('Footer prose survives regeneration.');
    expect(readme).toContain('| **01 — Architecture Overview** | Runtime topology and stack reference | `01-architecture/architecture-overview.md` |');
    expect(readme).toContain('| **ADRs** | All Architecture Decision Records (DEC-XXX) | `DECISIONS.md` |');
    expect(readme).not.toContain('gone.md');
    expect(readme).toContain('timestamp: 2026-10-14T00:00:00.000Z');
  });

  it('is idempotent: a second run writes nothing and check stays clean', async () => {
    const bible = await makeBible();
    await generate(bible);
    const first = await readFile(path.join(bible, 'README.md'), 'utf8');
    const second = await generate(bible);
    expect(second.written).toBe(false);
    expect(second.stale).toBe(false);
    expect(await readFile(path.join(bible, 'README.md'), 'utf8')).toBe(first);
    expect((await check(bible)).stale).toBe(false);
  });

  it('check mode reports chapter drift without writing', async () => {
    const bible = await makeBible();
    await generate(bible);
    const chapter = path.join(bible, '01-architecture', 'architecture-overview.md');
    const raw = await readFile(chapter, 'utf8');
    await writeFile(chapter, raw.replace('Runtime topology and stack reference', 'Changed blurb'), 'utf8');

    const result = await check(bible);
    expect(result.stale).toBe(true);
    // check mode must not repair the file itself
    const readme = await readFile(path.join(bible, 'README.md'), 'utf8');
    expect(readme).not.toContain('Changed blurb');

    const written = await generate(bible);
    expect(written.written).toBe(true);
    expect((await readFile(path.join(bible, 'README.md'), 'utf8'))).toContain('Changed blurb');
    expect((await check(bible)).stale).toBe(false);
  });

  it('replaces only the ToC section when other headings follow it', () => {
    const existing = ['## Table of Contents', '', '| a | b | c |', '|---|---|---|', '| **Old** | row | `x.md` |', '', '## After', '', 'text', ''].join('\n');
    const next = applyToc(existing, ['## Table of Contents', '', '| a | b | c |', '|---|---|---|', '| **New** | row | `y.md` |', ''].join('\n'));
    expect(next).toContain('**New**');
    expect(next).not.toContain('**Old**');
    expect(next).toContain('## After');
    expect(next.endsWith('text\n')).toBe(true);
  });

  it('regenerated README passes the bible-sync 3-way diff (integration)', async () => {
    const bible = await makeBible();
    await generate(bible);
    const { spawnSync } = await import('node:child_process');
    const workspaceRoot = path.dirname(path.dirname(bible));
    const res = spawnSync(process.execPath, [path.join(REPO_ROOT, 'core', 'scripts', 'bible-sync.js'), '--check'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('agree');
  });

  it('regenerated README passes the link-integrity check (6.2 verification)', async () => {
    const bible = await makeBible();
    await generate(bible);
    expect(await checkFile(path.join(bible, 'README.md'), 'docs/bible/README.md')).toEqual([]);
    // and the live workspace README stays in the strict link scope
    expect(await checkFile(path.join(REPO_ROOT, 'docs', 'bible', 'README.md'), 'docs/bible/README.md')).toEqual([]);
  });
});
