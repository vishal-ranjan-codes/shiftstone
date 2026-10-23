import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkBacklogSignoff } from '../../scripts/check-backlog-signoff.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'check-backlog-signoff.js');

const ACTIVE = `---
title: "Phase 9: Test Phase"
status: active
type: backlog
---

# Phase 9

## Tasks

- [ ] **[P1]** Open task
- [/] **[P1]** In-progress task
`;

async function plantFile(root: string, name: string, body: string): Promise<void> {
  await mkdir(path.join(root, 'docs', 'backlog', 'Phase 9 - Test'), { recursive: true });
  await writeFile(path.join(root, 'docs', 'backlog', 'Phase 9 - Test', name), body, 'utf8');
}

describe('6.4 — backlog sign-off gate', () => {
  it('fails an unsigned [x] in an active backlog file and passes it with a /verify signature', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'signoff-'));
    await plantFile(root, '9.1-a.md', `${ACTIVE}- [x] **[P1]** Closed without sign-off\n`);
    expect(checkBacklogSignoff(root).problems).toHaveLength(1);
    expect(checkBacklogSignoff(root).problems[0]).toContain('without a /verify signature');

    await plantFile(
      root,
      '9.1-a.md',
      `${ACTIVE}- [x] **[P1]** Closed properly — verified by claude @ 0.92 (2026-10-16)\n`,
    );
    const clean = checkBacklogSignoff(root);
    expect(clean.problems).toEqual([]);
    expect(clean.signed).toBe(1);
  });

  it('grandfathers legacy files whose frontmatter declares status: completed', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'signoff-legacy-'));
    await plantFile(root, '9.2-legacy.md', ACTIVE.replace('status: active', 'status: completed') + '- [x] **[P1]** Legacy closure\n');
    const result = checkBacklogSignoff(root);
    expect(result.problems).toEqual([]);
    expect(result.grandfathered).toEqual(['docs/backlog/Phase 9 - Test/9.2-legacy.md']);
    expect(result.checked).toBe(1);
  });

  it('ignores open and in-progress tasks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'signoff-open-'));
    await plantFile(root, '9.3-open.md', ACTIVE);
    const result = checkBacklogSignoff(root);
    expect(result.problems).toEqual([]);
    expect(result.checked).toBe(0);
  });

  it('CLI --strict exits 1 on a planted unsigned closure without touching the file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'signoff-cli-'));
    const body = `${ACTIVE}- [x] **[P1]** Planted closure\n`;
    await plantFile(root, '9.4-cli.md', body);
    const file = path.join(root, 'docs', 'backlog', 'Phase 9 - Test', '9.4-cli.md');
    const res = spawnSync(process.execPath, [CLI, '--strict', '--root', root], { encoding: 'utf8', timeout: 60_000 });
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('FAIL');
    expect(res.stdout).toContain('without a /verify signature');
    expect(await readFile(file, 'utf8')).toBe(body); // reports only, never edits
  });

  it('the live workspace backlog passes the strict gate (parity/CI)', () => {
    const result = checkBacklogSignoff(REPO_ROOT);
    expect(result.problems).toEqual([]);
    expect(result.grandfathered.length).toBeGreaterThan(0); // Phase 1 legacy is exempt
  });
});
