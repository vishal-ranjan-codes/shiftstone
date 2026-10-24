import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { compile, compileInto, parseLog, pendingEntries } from '../../scripts/compile-changelog.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'compile-changelog.js');

const CHANGELOG = `---
type: changelog
timestamp: 2026-09-05T14:49:35.878Z
---
# Changelog

---

## [2026-10-16] — Phase 5: Observability

### Added
- Manual phase entry written by hand.

---

## [2026-09-05] — Workspace Initialized

### Added
- First entry.
`;

function log(frontmatterType: string, rows: string[]): string {
  return [
    '---',
    `type: ${frontmatterType}`,
    'timestamp: 2026-10-16T00:00:00.000Z',
    '---',
    '',
    `# ${frontmatterType} — Log`,
    '',
    '| Date | Scope | Change | Kind | Compiled |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'compile-changelog-'));
  await mkdir(path.join(root, 'docs', 'bible'), { recursive: true });
  await mkdir(path.join(root, '.shiftstone', 'packs'), { recursive: true });
  await mkdir(path.join(root, '.agents', 'skills'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), CHANGELOG, 'utf8');
  await writeFile(
    path.join(root, 'docs', 'bible', 'log.md'),
    log('log', [
      '| 2026-10-16 | bible | Chapter frontmatter carries ToC descriptions | Changed | |',
      '| 2026-10-16 | bible | log.md bootstrap for the bible bundle | Added | |',
      '| 2026-10-20 | bible | Future-dated sync entry | Fixed | |',
      '| 2026-10-16 | bible | Already compiled entry | Added | 2026-10-16 |',
    ]),
    'utf8',
  );
  await writeFile(
    path.join(root, '.shiftstone', 'packs', 'log.md'),
    log('log', ['| 2026-10-16 | packs/rr8-supabase-cf | Pack skill relocation note | Changed | |']),
    'utf8',
  );
  return root;
}

describe('6.9 — compile-changelog (log.md → CHANGELOG.md)', () => {
  it('parses rows and reports pending entries across bundle logs, skipping stamped ones', async () => {
    const root = await fixture();
    const rows = parseLog(await readFile(path.join(root, 'docs', 'bible', 'log.md'), 'utf8'));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.kind.length > 0)).toBe(true);

    const pending = pendingEntries(root);
    expect(pending).toHaveLength(4); // 3 from bible + 1 from packs; the stamped row is excluded
    expect(pending.some((p) => p.log === '.shiftstone/packs/log.md')).toBe(true);
    expect(pending.some((p) => p.change === 'Already compiled entry')).toBe(false);
  });

  it('compiles pending entries under a per-date heading, grouped by kind, and stamps the logs', async () => {
    const root = await fixture();
    const result = compile(root, { today: '2026-10-21' });
    expect(result.compiled).toBe(4);
    expect(result.written).toBe(true);

    const changelog = await readFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), 'utf8');
    // newest-first: the 2026-10-20 compiled heading sits above the manual 2026-10-16 one
    const future = changelog.indexOf('## [2026-10-20] — Synced from log.md');
    const manual = changelog.indexOf('## [2026-10-16] — Phase 5');
    const sameDay = changelog.indexOf('## [2026-10-16] — Synced from log.md');
    const oldest = changelog.indexOf('## [2026-09-05] — Workspace Initialized');
    expect(future).toBeGreaterThan(-1);
    expect(manual).toBeGreaterThan(-1);
    expect(sameDay).toBeGreaterThan(manual); // equal dates: manual first, compiled after
    expect(oldest).toBeGreaterThan(sameDay);

    // entries grouped by kind, scopes prefixed for non-bible bundles
    expect(changelog).toContain('### Changed');
    expect(changelog).toContain('- Chapter frontmatter carries ToC descriptions');
    expect(changelog).toContain('- [packs/rr8-supabase-cf] Pack skill relocation note');
    expect(changelog).toContain('- Manual phase entry written by hand.'); // untouched history

    // logs stamped
    const bibleLog = await readFile(path.join(root, 'docs', 'bible', 'log.md'), 'utf8');
    expect(bibleLog).toContain('| 2026-10-16 | bible | log.md bootstrap for the bible bundle | Added | 2026-10-21 |');
    expect(bibleLog).toContain('| 2026-10-16 | bible | Already compiled entry | Added | 2026-10-16 |');
    expect(pendingEntries(root)).toHaveLength(0);
  });

  it('is idempotent: a second run writes nothing and --check passes', async () => {
    const root = await fixture();
    compile(root, { today: '2026-10-21' });
    const changelog = await readFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), 'utf8');
    const second = compile(root, { today: '2026-10-22' });
    expect(second.written).toBe(false);
    expect(await readFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), 'utf8')).toBe(changelog);

    const check = spawnSync(process.execPath, [CLI, '--check', '--root', root], { encoding: 'utf8', timeout: 60_000 });
    expect(check.status).toBe(0);
    expect(check.stdout).toContain('ok');
  });

  it('CLI --check fails (exit 1) on pending entries without writing', async () => {
    const root = await fixture();
    const before = await readFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), 'utf8');
    const check = spawnSync(process.execPath, [CLI, '--check', '--root', root], { encoding: 'utf8', timeout: 60_000 });
    expect(check.status).toBe(1);
    expect(check.stderr).toContain('pending:');
    expect(check.stderr).toContain('compile-changelog.js');
    expect(await readFile(path.join(root, 'docs', 'bible', 'CHANGELOG.md'), 'utf8')).toBe(before);
  });

  it('merges a same-date second sync into the existing compiled section (no duplicate heading)', async () => {
    const changelog = compileInto(CHANGELOG, [
      { date: '2026-10-16', scope: 'bible', kind: 'Fixed', change: 'First sync fix' },
    ]);
    const merged = compileInto(changelog, [
      { date: '2026-10-16', scope: 'bible', kind: 'Added', change: 'Second sync addition' },
    ]);
    expect(merged.match(/## \[2026-10-16\] — Synced from log\.md/g)).toHaveLength(1);
    expect(merged).toContain('- First sync fix');
    expect(merged).toContain('- Second sync addition');
  });
});
