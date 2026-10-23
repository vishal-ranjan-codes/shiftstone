/**
 * Phase 4 — tasks 4.1 / 4.3 / 4.9:
 * packs/_schema.json validates every pack manifest; invalid structures and
 * broken references are refused.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runValidate } from '../../init.js';
import { listPackNames, loadPack, loadSchema } from '../../init/pack-loader.js';
import { validateAgainstSchema } from '../../init/schema-validate.js';
import {
  matchPattern,
  skillSources,
  unmatchedSkillIncludes,
  validatePack,
} from '../../init/validate-manifest.js';
import { REPO_ROOT } from './workspace-fixture.js';

describe('4.1 — packs/_schema.json', () => {
  it('schema validates manifests from all packs', () => {
    const names = listPackNames(REPO_ROOT);
    expect(names).toEqual(
      expect.arrayContaining(['rr8-supabase-cf', 'fastapi-pg', 'nextjs-prisma-pg']),
    );
    for (const name of names) {
      const pack = loadPack(REPO_ROOT, name);
      expect(validatePack(pack, { root: REPO_ROOT }), `pack ${name}`).toEqual([]);
    }
  });

  it('rejects an empty manifest with every required property named', () => {
    const errors = validateAgainstSchema({}, loadSchema(REPO_ROOT));
    for (const key of ['apiVersion', 'kind', 'metadata', 'spec', 'composition']) {
      expect(errors.join('\n')).toContain(`missing required property "${key}"`);
    }
  });

  it('rejects wrong enum values, unknown properties and bad names', () => {
    const schema = loadSchema(REPO_ROOT);
    const manifest = {
      apiVersion: 'workspace/v2',
      kind: 'StackArchetype',
      metadata: { name: 'Bad Name!', displayName: 'x', version: 'not-a-version', tier: 'hobby' },
      spec: { languages: [], folderLayout: 'grid', defaultAppPath: 'apps/web', packaging: 'make' },
      composition: { skills: { include: [] } },
      surprise: true,
    };
    const errors = validateAgainstSchema(manifest, schema);
    const text = errors.join('\n');
    expect(text).toContain('must be "workspace/v1"');
    expect(text).toContain('metadata.name');
    expect(text).toContain('metadata.tier');
    expect(text).toContain('metadata.version');
    expect(text).toContain('spec.folderLayout');
    expect(text).toContain('spec.packaging');
    expect(text).toContain('unknown property "surprise"');
    expect(text).toContain('spec.languages: must have at least 1 item(s)');
    expect(text).toContain('composition.skills.include: must have at least 1 item(s)');
  });

  it('refuses a pack directory name that differs from metadata.name', () => {
    const pack = loadPack(REPO_ROOT, 'fastapi-pg');
    const broken = { ...pack, manifest: { ...pack.manifest, metadata: { ...pack.manifest.metadata, name: 'other-name' } } };
    const errors = validatePack(broken, { root: REPO_ROOT });
    expect(errors.join('\n')).toContain('must match the pack directory name');
  });

  it('refuses defaultAppPath traversal and missing referenced files', () => {
    const pack = loadPack(REPO_ROOT, 'fastapi-pg');
    const broken = {
      ...pack,
      manifest: {
        ...pack.manifest,
        spec: { ...pack.manifest.spec, defaultAppPath: '../outside' },
        composition: { ...pack.manifest.composition, decisions_seed: './missing-seed.yaml' },
      },
    };
    const text = validatePack(broken, { root: REPO_ROOT }).join('\n');
    expect(text).toContain('".." segments');
    expect(text).toContain('referenced file not found: ./missing-seed.yaml');
  });
});

describe('4.3 — flagship pack composition contract', () => {
  it('rr8 include patterns cover all 37 pack skills', () => {
    const pack = loadPack(REPO_ROOT, 'rr8-supabase-cf');
    expect(Object.keys(skillSources(pack)).length).toBe(37);
    expect(unmatchedSkillIncludes(pack)).toEqual([]);
  });

  it('rr8 declares hooks, overlays, decisions seed and workspace scripts', () => {
    const { manifest } = loadPack(REPO_ROOT, 'rr8-supabase-cf');
    expect(manifest.hooks.pre_init).toBe('./scaffold-script.js');
    expect(manifest.hooks.post_init).toBe('./post-init.js');
    expect(manifest.composition.bible_overlays).toBe('./bible-overlays/');
    expect(manifest.composition.decisions_seed).toBe('./decisions-seed.yaml');
    expect(manifest.spec.workspace.rootScripts['supabase:types']).toContain('{{APP_PATH}}');
    expect(manifest.spec.workspace.onlyBuiltDependencies).toEqual(['esbuild', 'workerd']);
  });

  it('rr8 declares the surface-overlay composition keys (path rules, workflows, settings fragment)', () => {
    const { manifest } = loadPack(REPO_ROOT, 'rr8-supabase-cf');
    expect(manifest.composition.path_scoped_rules).toBe('./path-rules/');
    expect(manifest.composition.workflows).toBe('./workflows/');
    expect(manifest.composition.commandcode.permissions.ask).toEqual(['Shell(wrangler deploy:*)']);
    expect(unmatchedSkillIncludes(loadPack(REPO_ROOT, 'rr8-supabase-cf'))).toEqual([]);
  });

  it('matchPattern supports single-segment wildcards', () => {
    expect(matchPattern('react-router-*', 'react-router-routing')).toBe(true);
    expect(matchPattern('react-router-*', 'supabase-auth')).toBe(false);
    expect(matchPattern('ui', 'ui')).toBe(true);
    expect(matchPattern('*', 'anything')).toBe(true);
  });
});

describe('pack include hygiene — unmatched include patterns warn (never fail)', () => {
  it('warns per declared include pattern that matches no physical skill', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pack-unmatched-'));
    mkdirSync(path.join(dir, 'skills', 'alpha-skill'), { recursive: true });
    const pack = {
      name: 'starter-x',
      dir,
      manifest: { composition: { skills: { include: ['alpha-skill', 'beta-skill', 'find-skills'] } } },
    };
    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toHaveLength(2);
    expect(warnings.join('\n')).toContain('"beta-skill" matches no skill');
    expect(warnings.join('\n')).toContain('"find-skills" matches no skill');
    expect(warnings.join('\n')).not.toContain('"alpha-skill"');
  });

  it('stays silent without a declared include list', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'pack-noinclude-'));
    expect(unmatchedSkillIncludes({ name: 'bare', dir, manifest: { composition: {} } })).toEqual([]);
  });
});

describe('task 4.7 — --validate flag', () => {
  it('runValidate returns 0 for the shipped pack set', () => {
    expect(runValidate({}, REPO_ROOT)).toBe(0);
  });

  it('runValidate returns 1 when a referenced file is missing', () => {
    const code = runValidate({ archetype: 'broken-ref-fixture' }, path.join(REPO_ROOT, 'does-not-exist'));
    expect(code).toBe(1);
  });
});
