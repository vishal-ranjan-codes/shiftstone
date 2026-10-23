/**
 * Phase 4 — task 4.10: generalized dual-repo setup (blueprint §8.3).
 * N archetypes → N independent git repositories with their own remotes,
 * plus the version-2 workspace descriptor.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { setupDualRepo } from '../../init/dual-repo.js';

function makeRepoRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'init-dual-'));
  for (const appPath of ['apps/web', 'apps/api']) {
    mkdirSync(path.join(root, appPath), { recursive: true });
    writeFileSync(path.join(root, appPath, 'file.txt'), `${appPath}\n`, 'utf8');
  }
  return root;
}

const composition = {
  archetypes: [
    {
      name: 'rr8-supabase-cf',
      effectiveAppPath: 'apps/web',
      manifest: { metadata: { displayName: 'React Router 8 + Supabase + Cloudflare Workers' }, spec: {} },
    },
    {
      name: 'fastapi-pg',
      effectiveAppPath: 'apps/api',
      manifest: { metadata: { displayName: 'FastAPI + PostgreSQL' }, spec: {} },
    },
  ],
};

describe('4.10 — dual-repo for N archetypes', () => {
  it('creates an independent repo + remote per archetype', () => {
    const root = makeRepoRoot();
    const repos = setupDualRepo({
      root,
      composition,
      answers: { projectName: 'Polyglot', ghUser: 'octocat' },
    });

    expect(repos.map((r) => r.path)).toEqual(['apps/web', 'apps/api']);
    expect(existsSync(path.join(root, 'apps', 'web', '.git'))).toBe(true);
    expect(existsSync(path.join(root, 'apps', 'api', '.git'))).toBe(true);

    const webRemote = readFileSync(path.join(root, 'apps', 'web', '.git', 'config'), 'utf8');
    const apiRemote = readFileSync(path.join(root, 'apps', 'api', '.git', 'config'), 'utf8');
    expect(webRemote).toContain('https://github.com/octocat/polyglot-app.git');
    expect(apiRemote).toContain('https://github.com/octocat/polyglot-fastapi-pg-app.git');
    expect(webRemote).not.toContain('polyglot-fastapi-pg-app');

    // Root .gitignore excludes every app dir + loop state
    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toContain('/apps/web/');
    expect(gitignore).toContain('/apps/api/');
    expect(gitignore).toContain('.loops/*/state.json');

    // Version-2 descriptor lists both archetypes
    const metadata = JSON.parse(readFileSync(path.join(root, '.workspace-git.json'), 'utf8'));
    expect(metadata.version).toBe(2);
    expect(metadata.projectName).toBe('Polyglot');
    expect(metadata.archetypes).toHaveLength(2);
    expect(metadata.archetypes[0]).toMatchObject({
      name: 'rr8-supabase-cf',
      appPath: 'apps/web',
      remote: 'https://github.com/octocat/polyglot-app.git',
    });
    expect(metadata.archetypes[1].remote).toBe(
      'https://github.com/octocat/polyglot-fastapi-pg-app.git',
    );
    expect(metadata.workspace.remote).toBe('https://github.com/octocat/polyglot-workspace.git');
    expect(metadata.pushed).toBe(false);
  });

  it('is idempotent and never duplicates .gitignore entries', () => {
    const root = makeRepoRoot();
    const answers = { projectName: 'Polyglot', ghUser: null };
    setupDualRepo({ root, composition, answers });
    setupDualRepo({ root, composition, answers });

    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore.split('/apps/web/').length - 1).toBe(1);
    expect(gitignore.split('/apps/api/').length - 1).toBe(1);

    // Without a ghUser, remotes fall back to the manifest or stay unset
    const metadata = JSON.parse(readFileSync(path.join(root, '.workspace-git.json'), 'utf8'));
    expect(metadata.archetypes.every((a: { remote: string | null }) => a.remote === null)).toBe(true);
    expect(metadata.workspace.remote).toBeNull();
  });

  it('adds workspace-level ignores only when the root .gitignore is missing', () => {
    const root = makeRepoRoot();
    writeFileSync(path.join(root, '.gitignore'), 'custom-entry\n', 'utf8');
    setupDualRepo({ root, composition, answers: { projectName: 'X', ghUser: null } });
    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore.startsWith('custom-entry\n')).toBe(true);
    expect(gitignore).toContain('/apps/web/');
  });
});
