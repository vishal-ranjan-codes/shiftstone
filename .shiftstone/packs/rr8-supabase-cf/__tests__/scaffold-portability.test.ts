import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { resolveStarter } from '../scaffold-script.js';

const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAFFOLD_SCRIPT = path.join(PACK_DIR, 'scaffold-script.js');
const MONOREPO_TEMPLATE_REL = 'frameworks/template-react-router8-supabase';

/**
 * Windows drive-letter absolute path: one letter, a colon, then a separator.
 * The lookbehind keeps URL schemes (`https://`) out of the match.
 */
const DRIVE_LETTER_PATH = /(?<![A-Za-z0-9])[A-Za-z]:[\\/]/g;

const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function withTemplate(root: string): Promise<string> {
  const template = path.join(root, ...MONOREPO_TEMPLATE_REL.split('/'));
  await mkdir(template, { recursive: true });
  await writeFile(path.join(template, 'package.json'), '{"name":"starter"}\n', 'utf8');
  return template;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('REQ-04 / LOCK-A5 — flagship scaffold portability', () => {
  it('AC-U4-01: contains no machine-specific drive-letter path', async () => {
    const source = await readFile(SCAFFOLD_SCRIPT, 'utf8');
    expect(source.match(DRIVE_LETTER_PATH) ?? []).toEqual([]);
    expect(source).not.toContain('DEFAULT_LOCAL_STARTER_PATH');
  });

  it('the drive-letter guard actually detects the pattern it replaced (red-first proof)', async () => {
    const offending = `const P = 'D:\\\\Website\\\\react-router-supabase-framework';`;
    expect(offending.match(DRIVE_LETTER_PATH)).not.toBeNull();
    // URL schemes must not trip the same guard.
    expect(`const U = 'https://github.com/example/starter.git';`.match(DRIVE_LETTER_PATH)).toBeNull();
  });

  it('AC-U4-02 tier 3: falls back to git clone when no local starter exists', async () => {
    const root = await tempDir('scaffold-clone-');
    expect(resolveStarter({ root, env: {} })).toEqual({ source: 'clone', path: null });
  });

  it('AC-U4-02 tier 2: selects the monorepo template when present', async () => {
    const root = await tempDir('scaffold-mono-');
    const template = await withTemplate(root);
    expect(resolveStarter({ root, env: {} })).toEqual({ source: 'monorepo', path: template });
  });

  it('AC-U4-02 tier 1: SS_LOCAL_STARTER wins over the monorepo template', async () => {
    const root = await tempDir('scaffold-env-');
    await withTemplate(root);
    const fromEnv = await tempDir('scaffold-env-target-');
    expect(resolveStarter({ root, env: { SS_LOCAL_STARTER: fromEnv } })).toEqual({
      source: 'env',
      path: fromEnv,
    });
  });

  it('a non-existent SS_LOCAL_STARTER is skipped, not trusted', async () => {
    const root = await tempDir('scaffold-env-missing-');
    const template = await withTemplate(root);
    const missing = path.join(root, 'does-not-exist');
    expect(resolveStarter({ root, env: { SS_LOCAL_STARTER: missing } })).toEqual({
      source: 'monorepo',
      path: template,
    });
  });

  it('an explicit --starter-path outranks the environment override', async () => {
    const root = await tempDir('scaffold-explicit-');
    await withTemplate(root);
    const fromEnv = await tempDir('scaffold-explicit-env-');
    const explicit = await tempDir('scaffold-explicit-path-');
    expect(
      resolveStarter({ root, env: { SS_LOCAL_STARTER: fromEnv }, explicitPath: explicit }),
    ).toEqual({ source: 'starter-path', path: explicit });
  });

  it('the monorepo template is resolved relative to the scaffold root, never a hardcoded drive', async () => {
    const root = await tempDir('scaffold-relative-');
    const template = await withTemplate(root);
    const resolved = resolveStarter({ root, env: {} });
    expect(resolved.path).toBe(template);
    expect(path.isAbsolute(resolved.path as string)).toBe(true);
    expect(resolved.path?.replace(/\\/g, '/').endsWith(MONOREPO_TEMPLATE_REL)).toBe(true);
  });
});
