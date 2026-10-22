import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkFrontmatter } from '../../scripts/validate-okf-frontmatter.js';
import { extractRelativeLinks } from '../../scripts/check-link-integrity.js';
import { run as runDuplication } from '../../scripts/check-md-duplication.js';
import { run as runFrontmatter, STRICT_SCOPE as FM_SCOPE } from '../../scripts/validate-okf-frontmatter.js';
import { run as runLinks, STRICT_SCOPE as LINK_SCOPE } from '../../scripts/check-link-integrity.js';
import { run as runManifestBudgets } from '../../scripts/validate-manifest-budgets.js';
import { run as runLoopSpecs } from '../../scripts/validate-loop-specs.js';
import { checkAll } from '../../governance/index-generator.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('C7 — OKF frontmatter validator', () => {
  it('accepts a compliant file', () => {
    const ok = '---\ntype: note\ntimestamp: 2026-10-12T10:00:00Z\n---\n# x\n';
    expect(checkFrontmatter('x.md', ok)).toEqual([]);
  });

  it('rejects missing frontmatter, missing type and non-ISO timestamps', () => {
    expect(checkFrontmatter('x.md', '# just a heading\n')[0]).toContain('missing OKF frontmatter');
    expect(checkFrontmatter('x.md', '---\ntimestamp: 2026-10-12T10:00:00Z\n---\n')[0]).toContain('"type"');
    expect(checkFrontmatter('x.md', '---\ntype: note\ntimestamp: 2026-10-12\n---\n')[0]).toContain('ISO-8601');
    expect(checkFrontmatter('x.md', '---\ntype: note\n---\n')[0]).toContain('ISO-8601');
  });

  it('strict scope covers bible, loops docs, indexes, _config and skills', () => {
    expect(FM_SCOPE.some((s) => s.includes('bible'))).toBe(true);
    expect(FM_SCOPE.some((s) => s.includes('_config'))).toBe(true);
    expect(FM_SCOPE.some((s) => s.includes('SKILL.md'))).toBe(true);
  });

  it('repo passes strict OKF validation (CI gate)', async () => {
    const result = await runFrontmatter({ strict: true });
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(60);
  });
});

describe('C7 — relative link integrity', () => {
  it('extracts relative links only (skips http, mailto, anchors, code, template paths)', () => {
    const raw = [
      'See [good](./other.md) and [anchor](./other.md#part).',
      'Skip [web](https://example.com), [mail](mailto:a@b.c), [top](#section).',
      'Inline code `[ignored.md](./ignored.md)` and fenced:',
      '```md',
      '[fenced](./also-ignored.md)',
      '```',
      'Template [app]({{APP_PATH}}/readme.md) skipped.',
      'Directory [dir](./sub/) kept.',
      'Duplicate [good](./other.md) deduped.',
    ].join('\n');
    expect(extractRelativeLinks(raw)).toEqual(['./other.md', './sub/']);
  });

  it('repo strict link scope has no broken links (CI gate)', async () => {
    const result = await runLinks({ strict: true });
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(100);
    expect(LINK_SCOPE.length).toBeGreaterThan(0);
  });
});

describe('2.7 — parity gates pass against the live workspace', () => {
  it('no duplicated content across shims and canonical rule files', () => {
    const result = runDuplication({ strict: true });
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThanOrEqual(10);
  });

  it('every docs directory has a fresh index.md', async () => {
    const result = await checkAll(path.join(REPO_ROOT, 'docs'));
    expect(result.missing).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it('IDE content folders are junctions (link-ide-folders --check exits 0)', () => {
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'scripts', 'link-ide-folders.js'), '--check'],
      { encoding: 'utf8', cwd: REPO_ROOT },
    );
    expect(res.stdout + res.stderr).not.toContain('FAIL');
    expect(res.status).toBe(0);
  });

  it('root shims stay within the 50-line static budget', async () => {
    const { run } = await import('../../scripts/check-md-duplication.js');
    const result = run({ strict: true });
    expect(result.problems.filter((p) => p.includes('static budget'))).toEqual([]);
  });
});

describe('8.2 — manifest budgets and loop-spec refusal gates (CI)', () => {
  it('manifest matches token-budget, all skills 3-tier complete, INDEX fresh', () => {
    const result = runManifestBudgets({ strict: true });
    expect(result.problems).toEqual([]);
    expect(result.skills).toBeGreaterThanOrEqual(40);
  });

  it('every reference loop spec passes the Phase 1 refusal gate', async () => {
    const result = await runLoopSpecs({ strict: true });
    expect(result.problems).toEqual([]);
    expect(result.specs.length).toBeGreaterThanOrEqual(3);
  });
});

describe('WS-F / WS-G — static budget CI gate and junction tracked-files gate', () => {
  it('check-rule-budget --ci exits 0 and reports static context within 200-line budget', () => {
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'scripts', 'check-rule-budget.js'), '--ci'],
      { encoding: 'utf8', cwd: REPO_ROOT },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('ok — always-on static context is within 200-line budget');
  });

  it('check-rule-budget --ci exits 1 when static budget is exceeded', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'budget-over-'));
    await mkdir(path.join(root, 'core', 'context'), { recursive: true });
    await writeFile(
      path.join(root, 'core', 'context', 'token-budget.json'),
      JSON.stringify({ static_max_lines: 10, shim_max_lines: {} }),
      'utf8',
    );
    await writeFile(
      path.join(root, 'AGENTS.md'),
      Array(25).fill('# rule line').join('\n') + '\n',
      'utf8',
    );
    const { report } = await import('../../scripts/check-rule-budget.js');
    const result = report(root);
    expect(result.level).toBe('over');
    expect(result.total).toBe(25);
    expect(result.cap).toBe(10);
  });

  it('link-ide-folders --check confirms no tracked files exist at junction slots in repo', () => {
    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'scripts', 'link-ide-folders.js'), '--check'],
      { encoding: 'utf8', cwd: REPO_ROOT },
    );
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain('is tracked in git');
    expect(res.stderr).not.toContain('is tracked in git');
  });

  it('link-ide-folders --check fails if any junction slot contains tracked files in git', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'junction-tracked-'));
    spawnSync('git', ['init'], { cwd: root });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    spawnSync('git', ['config', 'user.name', 'test'], { cwd: root });

    await mkdir(path.join(root, '.claude', 'rules'), { recursive: true });
    await mkdir(path.join(root, 'core', 'path-scoped-rules'), { recursive: true });
    await writeFile(path.join(root, '.claude', 'rules', 'leaked.md'), '# leaked rule\n', 'utf8');
    spawnSync('git', ['add', '.claude/rules/leaked.md'], { cwd: root });
    spawnSync('git', ['commit', '-m', 'leak tracked file'], { cwd: root });

    const res = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, 'core', 'scripts', 'link-ide-folders.js'), '--check', `--root=${root}`],
      { encoding: 'utf8', cwd: root },
    );
    expect(res.status).toBe(1);
    expect(res.stderr + res.stdout).toContain('is tracked in git');
  });
});

