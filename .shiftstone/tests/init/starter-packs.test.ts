import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { listPackNames, loadPack } from '../../init/pack-loader.js';
import { validatePack } from '../../init/validate-manifest.js';
import { REPO_ROOT } from './workspace-fixture.js';

const STARTERS = ['sveltekit-supabase', 'expo-react-native', 'go-chi-postgres'];

function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

describe('7.5 — starter packs', () => {
  it('all three starters ship, validate, and the gallery keeps ≥5 packs', () => {
    const names = listPackNames(REPO_ROOT);
    expect(names.length).toBeGreaterThanOrEqual(5);
    for (const name of STARTERS) {
      expect(names, `pack ${name}`).toContain(name);
      expect(validatePack(loadPack(REPO_ROOT, name), { root: REPO_ROOT }), `pack ${name}`).toEqual([]);
    }
  });

  it('no two packs claim the same app folder without a declared conflict (§10.4 D)', () => {
    const packs = listPackNames(REPO_ROOT).map((name) => loadPack(REPO_ROOT, name));
    for (const a of packs) {
      for (const b of packs) {
        if (a.name === b.name) continue;
        if (a.manifest.spec.defaultAppPath !== b.manifest.spec.defaultAppPath) continue;
        const declared =
          (a.manifest.conflicts?.with ?? []).includes(b.name) ||
          (b.manifest.conflicts?.with ?? []).includes(a.name);
        expect(
          declared,
          `${a.name} and ${b.name} both own ${a.manifest.spec.defaultAppPath} without a declared conflict`,
        ).toBe(true);
      }
    }
  });

  it('the flagship and mobile/go legs own distinct folders (polyglot composition)', () => {
    const paths = Object.fromEntries(
      ['rr8-supabase-cf', 'expo-react-native', 'go-chi-postgres', 'fastapi-pg'].map((name) => [
        name,
        loadPack(REPO_ROOT, name).manifest.spec.defaultAppPath,
      ]),
    );
    expect(new Set(Object.values(paths)).size).toBe(Object.keys(paths).length);
  });

  it('each starter scaffold creates its skeleton and never clobbers existing files', async () => {
    for (const name of STARTERS) {
      const pack = loadPack(REPO_ROOT, name);
      const script = path.join(pack.dir, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
      expect(existsSync(script), `${name} scaffold script`).toBe(true);
      const mod = (await import(pathToFileURL(script).href)) as {
        run: (ctx: unknown) => { created: string[] };
      };

      const root = mkdtempSync(path.join(tmpdir(), `scaffold-${name}-`));
      const composed = { name, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'AuditApp' },
      };

      const first = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(first.created).toContain(appPath);
      const files = walk(path.join(root, appPath));
      expect(files.length).toBeGreaterThanOrEqual(3);

      // Plant a sentinel: a re-run must never overwrite the user's file.
      const readme = path.join(root, appPath, 'README.md');
      expect(existsSync(readme)).toBe(true);
      writeFileSync(readme, 'KEEP-ME-SENTINEL\n', 'utf8');
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
      expect(readFileSync(readme, 'utf8')).toBe('KEEP-ME-SENTINEL\n');
    }
  });
});
