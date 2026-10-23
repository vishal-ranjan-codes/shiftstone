import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkOwnership, HARNESS_PATHS, parseCodeowners, toGlob } from '../../scripts/check-harness-ownership.js';
import { matchGlob } from '../../context/skills-loader.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'check-harness-ownership.js');

const FULL_CODEOWNERS = [
  '# harness',
  '/AGENTS.md                 @maintainer',
  '/ANTIGRAVITY.md            @maintainer',
  '/CLAUDE.md                 @maintainer',
  '/COMMANDCODE.md            @maintainer',
  '/.shiftstone/static-rules/        @maintainer',
  '/evals/                    @maintainer',
  '/.agents/skills/           @maintainer',
  '/packs/*/skills/           @maintainer',
  '',
].join('\n');

async function fixture(codeowners: string | null): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'ownership-'));
  await mkdir(path.join(root, '.shiftstone', 'static-rules'), { recursive: true });
  await writeFile(path.join(root, '.shiftstone', 'static-rules', 'governance.md'), '---\nactivation: on-demand\n---\n# rule\n', 'utf8');
  if (codeowners !== null) await writeFile(path.join(root, 'CODEOWNERS'), codeowners, 'utf8');
  return root;
}

describe('6.6 — harness-as-code ownership gate (B11)', () => {
  it('CODEOWNERS dir patterns cover every harness probe path', () => {
    for (const harnessPath of HARNESS_PATHS) {
      const matching = parseCodeowners(FULL_CODEOWNERS).filter((e) => matchGlob(toGlob(e.pattern), harnessPath));
      expect(matching.length, `no owner for ${harnessPath}`).toBeGreaterThan(0);
      expect(matching[0].owners).toContain('@maintainer');
    }
  });

  it('passes a complete CODEOWNERS and fails one missing a harness path', async () => {
    const good = await fixture(FULL_CODEOWNERS);
    expect(checkOwnership(good).problems).toEqual([]);

    const missing = await fixture(FULL_CODEOWNERS.replace('/.agents/skills/           @maintainer\n', ''));
    const result = checkOwnership(missing);
    expect(result.problems.some((p) => p.includes('.agents/skills/ss-verify/SKILL.md'))).toBe(true);
  });

  it('fails when CODEOWNERS is absent or the governance rule is missing', async () => {
    const noOwners = await fixture(null);
    const absent = checkOwnership(noOwners);
    expect(absent.file).toBeNull();
    expect(absent.problems[0]).toContain('CODEOWNERS missing');

    const noRule = await fixture(FULL_CODEOWNERS);
    const { rm } = await import('node:fs/promises');
    await rm(path.join(noRule, '.shiftstone', 'static-rules', 'governance.md'));
    expect(checkOwnership(noRule).problems.some((p) => p.includes('governance rule missing'))).toBe(true);
  });

  it('fails a pattern without any owner', async () => {
    const root = await fixture(FULL_CODEOWNERS.replace('@maintainer', ''));
    expect(checkOwnership(root).problems.some((p) => p.includes('no owner'))).toBe(true);
  });

  it('the live workspace passes the strict gate (parity/CI)', () => {
    const result = checkOwnership(REPO_ROOT);
    expect(result.problems).toEqual([]);
    expect(result.covered).toBe(HARNESS_PATHS.length);

    const cli = spawnSync(process.execPath, [CLI, '--strict'], { encoding: 'utf8', timeout: 60_000 });
    expect(cli.status).toBe(0);
  });
});
