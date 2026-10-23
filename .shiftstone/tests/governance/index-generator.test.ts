import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkAll, generateAll, generateOne, normalizeIndex } from '../../governance/index-generator.ts';

async function makeDocsTree(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'idx-'));
  await writeFile(path.join(root, 'README.md'), '# Docs\n\nRoot docs.\n', 'utf8');
  await mkdir(path.join(root, 'bible'), { recursive: true });
  await writeFile(path.join(root, 'bible', '01-architecture.md'), '# 01 — Architecture\n\nBody.\n', 'utf8');
  await mkdir(path.join(root, 'bible', '02-db'), { recursive: true });
  await writeFile(path.join(root, 'bible', '02-db', 'schema.md'), '# Schema\n', 'utf8');
  return root;
}

describe('C5 — index generator', () => {
  it('creates index.md at the root and every subdirectory with .md files', async () => {
    const root = await makeDocsTree();
    const result = await generateAll(root);
    expect(result.missing.length).toBe(3); // root, bible, bible/02-db

    const rootIndex = await readFile(path.join(root, 'index.md'), 'utf8');
    expect(rootIndex).toContain('type: index');
    expect(rootIndex).toMatch(/timestamp: \d{4}-\d{2}-\d{2}T/);
    expect(rootIndex).toContain('[Docs](./README.md)');
    expect(rootIndex).toContain('[bible/](./bible/index.md)');

    const bibleIndex = await readFile(path.join(root, 'bible', 'index.md'), 'utf8');
    expect(bibleIndex).toContain('[01 — Architecture](./01-architecture.md)');
    expect(bibleIndex).toContain('[02-db/](./02-db/index.md)');
  });

  it('is idempotent: a second run writes nothing and check stays clean', async () => {
    const root = await makeDocsTree();
    await generateAll(root);
    const second = await generateAll(root);
    expect(second.generated).toEqual([]);
    const check = await checkAll(root);
    expect(check.missing).toEqual([]);
    expect(check.stale).toEqual([]);
  });

  it('check mode reports missing and stale indexes without writing', async () => {
    const root = await makeDocsTree();
    const missing = await checkAll(root);
    expect(missing.missing).toHaveLength(3);
    expect(missing.stale).toEqual([]);

    await generateAll(root);
    await writeFile(path.join(root, 'new-doc.md'), '# Brand new document\n', 'utf8');
    const stale = await checkAll(root);
    expect(stale.stale).toContain('index.md');
    // check mode must not write
    const content = await readFile(path.join(root, 'index.md'), 'utf8');
    expect(content).not.toContain('new-doc.md');
  });

  it('preserves the index timestamp on regeneration (deterministic CI)', async () => {
    const root = await makeDocsTree();
    await generateAll(root);
    const first = await readFile(path.join(root, 'index.md'), 'utf8');
    const firstTimestamp = /timestamp: (\S+)/.exec(first)?.[1];
    await generateAll(root);
    const second = await readFile(path.join(root, 'index.md'), 'utf8');
    expect(/timestamp: (\S+)/.exec(second)?.[1]).toBe(firstTimestamp);
    expect(normalizeIndex(first)).toBe(normalizeIndex(second));
  });

  it('uses frontmatter title when present', async () => {
    const root = await makeDocsTree();
    await writeFile(
      path.join(root, 'titled.md'),
      '---\ntype: note\ntimestamp: 2026-01-01T00:00:00Z\ntitle: Custom Title\n---\n# Ignored heading\n',
      'utf8',
    );
    await generateAll(root);
    const index = await readFile(path.join(root, 'index.md'), 'utf8');
    expect(index).toContain('[Custom Title](./titled.md)');
  });
});

describe('bundle-root shallow indexes (Phase 6.7 exit criterion)', () => {
  async function makeBundle(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), 'bundle-idx-'));
    await mkdir(path.join(root, 'skills', 'alpha'), { recursive: true });
    await writeFile(
      path.join(root, 'skills', 'log.md'),
      '---\ntype: log\ntimestamp: 2026-01-01T00:00:00Z\n---\n# skills — Log\n\n| Date | rows |\n',
      'utf8',
    );
    await writeFile(
      path.join(root, 'skills', 'alpha', 'SKILL.md'),
      '---\ntype: skill\ntimestamp: 2026-01-01T00:00:00Z\nname: alpha\ndescription: d\n---\n# alpha\n',
      'utf8',
    );
    return root;
  }

  it('indexes the bundle root only — never the skill/pack subdirectories', async () => {
    const root = await makeBundle();
    const first = await generateOne(path.join(root, 'skills'));
    expect(first.missing).toBe(true);
    expect(first.written).toBe(true);

    const index = await readFile(path.join(root, 'skills', 'index.md'), 'utf8');
    expect(index).toContain('type: index');
    expect(index).toContain('[skills — Log](./log.md)');
    // shallow: no index inside the skill dir (its catalog is the manifest — §6.6)
    expect(existsSync(path.join(root, 'skills', 'alpha', 'index.md'))).toBe(false);
  });

  it('is idempotent, and check mode reports missing/stale without writing', async () => {
    const root = await makeBundle();
    await generateOne(path.join(root, 'skills'));
    const second = await generateOne(path.join(root, 'skills'));
    expect(second.missing).toBe(false);
    expect(second.stale).toBe(false);
    expect(second.written).toBe(false);

    // drift: log.md gains a title the index does not know about
    const logPath = path.join(root, 'skills', 'log.md');
    const log = await readFile(logPath, 'utf8');
    await writeFile(logPath, log.replace('# skills — Log', '# skills — Record'), 'utf8');
    const checked = await generateOne(path.join(root, 'skills'), { write: false });
    expect(checked.stale).toBe(true);
    expect(await readFile(path.join(root, 'skills', 'index.md'), 'utf8')).not.toContain('Record');
    const written = await generateOne(path.join(root, 'skills'));
    expect(written.written).toBe(true);
    expect(await readFile(path.join(root, 'skills', 'index.md'), 'utf8')).toContain('Record');
  });

  it('skips a bundle with no indexable markdown', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'bundle-empty-'));
    await mkdir(path.join(root, 'empty'), { recursive: true });
    expect((await generateOne(path.join(root, 'empty'))).skipped).toBe(true);
  });
});
