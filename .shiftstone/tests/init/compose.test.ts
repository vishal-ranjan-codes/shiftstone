/**
 * Phase 4 — tasks 4.7 / 4.12:
 * archetype composition and pack conflict resolution (blueprint §10.4:
 * D refuse by default, C --force-namespace escape hatch).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { composeArchetypes, parseArchetypeList } from '../../init/compose.js';
import { validateComposition } from '../../init/validate-manifest.js';
import { REPO_ROOT } from './workspace-fixture.js';

describe('4.7 — archetype selection', () => {
  it('defaults to the flagship pack when no flag is given', () => {
    expect(parseArchetypeList({})).toEqual(['rr8-supabase-cf']);
    expect(parseArchetypeList({ archetype: 'fastapi-pg' })).toEqual(['fastapi-pg']);
    expect(parseArchetypeList({ archetypes: 'rr8-supabase-cf, fastapi-pg' })).toEqual([
      'rr8-supabase-cf',
      'fastapi-pg',
    ]);
  });

  it('composes the default flagship workspace', () => {
    const composition = composeArchetypes({}, { root: REPO_ROOT });
    expect(composition.archetypes.map((a) => a.name)).toEqual(['rr8-supabase-cf']);
    expect(composition.archetypes[0].effectiveAppPath).toBe('apps/web');
    expect(composition.skills.length).toBe(37);
    expect(composition.skills.every((s) => s.as === s.name)).toBe(true);
  });

  it('composes a polyglot monorepo with one app path per archetype', () => {
    const composition = composeArchetypes(
      { archetypes: 'rr8-supabase-cf,fastapi-pg' },
      { root: REPO_ROOT },
    );
    expect(composition.archetypes.map((a) => a.effectiveAppPath)).toEqual([
      'apps/web',
      'apps/api',
    ]);
    expect(composition.skills.map((s) => s.pack)).toContain('rr8-supabase-cf');
  });

  it('refuses unknown archetypes and lists the available packs', () => {
    expect(() => composeArchetypes({ archetype: 'cobol-mainframe' }, { root: REPO_ROOT })).toThrow(
      /unknown archetype\(s\): cobol-mainframe — available packs: .*rr8-supabase-cf/,
    );
  });
});

/** Two throwaway packs that both provide a `routing` skill and both claim apps/web. */
function makeConflictingFixturePacks(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'init-conflict-'));
  const packsDir = path.join(root, '.shiftstone', 'packs');
  mkdirSync(packsDir, { recursive: true });
  const schema = existsSync(path.join(REPO_ROOT, '.shiftstone', 'packs', '_schema.json'))
    ? path.join(REPO_ROOT, '.shiftstone', 'packs', '_schema.json')
    : path.join(REPO_ROOT, 'packs', '_schema.json');
  writeFileSync(path.join(packsDir, '_schema.json'), readFileSync(schema, 'utf8'));

  for (const name of ['pack-a', 'pack-b']) {
    const dir = path.join(packsDir, name);
    mkdirSync(path.join(dir, 'skills', 'routing'), { recursive: true });
    writeFileSync(
      path.join(dir, 'skills', 'routing', 'SKILL.md'),
      `---\nname: routing\ndescription: fixture skill\ntype: skill\ntimestamp: 2026-10-13T00:00:00.000Z\n---\n# routing\n`,
      'utf8',
    );
    writeFileSync(
      path.join(dir, 'manifest.yaml'),
      [
        'apiVersion: workspace/v1',
        'kind: StackArchetype',
        'metadata:',
        `  name: ${name}`,
        '  displayName: Fixture Pack',
        '  version: 1.0.0',
        '  tier: community',
        'spec:',
        '  languages: [typescript]',
        '  folderLayout: monorepo',
        '  defaultAppPath: apps/web',
        '  packaging: pnpm',
        'composition:',
        '  skills:',
        '    include: ["*"]',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  return root;
}

describe('4.12 — pack conflict resolution', () => {
  it('refuses the declared rr8/nextjs conflict with an explanation', () => {
    const composition = composeArchetypes(
      { archetypes: 'rr8-supabase-cf,nextjs-prisma-pg' },
      { root: REPO_ROOT },
    );
    const validation = validateComposition(composition, { root: REPO_ROOT });
    expect(validation.ok).toBe(false);
    const text = validation.errors.join('\n');
    expect(text).toContain('cannot coexist');
    expect(text).toContain('conflicts.with');
    expect(text).toContain('--force-namespace');
    expect(text).toContain('app path "apps/web" is claimed by');
  });

  it('--force-namespace installs both packs, relocating the second app path', () => {
    const composition = composeArchetypes(
      { archetypes: 'rr8-supabase-cf,nextjs-prisma-pg', forceNamespace: true },
      { root: REPO_ROOT },
    );
    const validation = validateComposition(composition, {
      root: REPO_ROOT,
      forceNamespace: true,
    });
    expect(validation.ok).toBe(true);
    expect(validation.warnings.join('\n')).toContain('overridden by --force-namespace');
    const nextjs = composition.archetypes.find((a) => a.name === 'nextjs-prisma-pg');
    expect(nextjs?.effectiveAppPath).toBe('apps/nextjs-prisma-pg');
  });

  it('refuses colliding skill names across packs, then namespaces them under force', () => {
    const root = makeConflictingFixturePacks();

    const refused = composeArchetypes({ archetypes: 'pack-a,pack-b' }, { root });
    const validation = validateComposition(refused, { root });
    expect(validation.ok).toBe(false);
    expect(validation.errors.join('\n')).toContain('skill "routing" is provided by more than one pack');

    const namespaced = composeArchetypes(
      { archetypes: 'pack-a,pack-b', forceNamespace: true },
      { root },
    );
    const forced = validateComposition(namespaced, { root, forceNamespace: true });
    expect(forced.ok).toBe(true);
    expect(namespaced.skills.map((s) => s.as).sort()).toEqual(['pack-a--routing', 'pack-b--routing']);
  });
});
