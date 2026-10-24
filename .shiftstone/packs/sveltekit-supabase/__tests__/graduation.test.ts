import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../../init/pack-loader.js';
import { resolveConflicts, unmatchedSkillIncludes, validatePack } from '../../../init/validate-manifest.js';
import { parseFrontmatter } from '../../../scripts/validate-okf-frontmatter.js';
import { makeWorkspace, REPO_ROOT } from '../../../tests/init/workspace-fixture.js';
import { main } from '../../../init.js';

const PACK_NAME = 'sveltekit-supabase';
const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('sveltekit-supabase graduation (LOCK-B4 bar / U8)', () => {
  it('AC-U8-01: manifest declares pnpm-idiom workspace.rootScripts', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scripts = pack.manifest?.spec?.workspace?.rootScripts;
    expect(scripts).toBeDefined();
    expect(scripts.dev).toBe('pnpm -C {{APP_PATH}} dev');
    expect(scripts.build).toBe('pnpm -C {{APP_PATH}} build');
    expect(scripts.start).toBe('pnpm -C {{APP_PATH}} preview');
    expect(scripts.test).toBe('pnpm -C {{APP_PATH}} test');
    expect(scripts['test:ui']).toBe('pnpm -C {{APP_PATH}} test:ui');
    expect(scripts.lint).toBe('pnpm -C {{APP_PATH}} lint');
    expect(scripts.typecheck).toBe('pnpm -C {{APP_PATH}} typecheck');
  });

  it('AC-U8-02: all 4 declared skills exist physically with valid frontmatter and instructions', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const expectedSkills = [
      'sveltekit-routing',
      'sveltekit-forms',
      'sveltekit-supabase',
      'vitest-testing',
    ];
    expect(pack.manifest.composition.skills.include).toEqual(expectedSkills);

    for (const skill of expectedSkills) {
      const skillDir = path.join(PACK_DIR, 'skills', skill);
      const skillMd = path.join(skillDir, 'SKILL.md');
      const instrMd = path.join(skillDir, 'instructions.md');

      expect(existsSync(skillMd), `missing SKILL.md in ${skill}`).toBe(true);
      expect(existsSync(instrMd), `missing instructions.md in ${skill}`).toBe(true);

      const content = readFileSync(skillMd, 'utf8');
      const { present, data } = parseFrontmatter(content);
      expect(present, `${skill} SKILL.md frontmatter present`).toBe(true);
      expect((data as Record<string, unknown>)?.name).toBe(skill);
      expect((data as Record<string, unknown>)?.type).toBe('skill');
      expect((data as Record<string, unknown>)?.pack).toBe(PACK_NAME);

      const instrContent = readFileSync(instrMd, 'utf8');
      expect(instrContent.trim().length).toBeGreaterThan(100);
    }
  });

  it('AC-U8-03: scaffold generates SvelteKit skeleton with Vitest health test', async () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scriptPath = path.join(PACK_DIR, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
    const mod = (await import(pathToFileURL(scriptPath).href)) as {
      run: (ctx: unknown) => { created: string[] };
    };

    const root = mkdtempSync(path.join(tmpdir(), 'scaffold-sveltekit-'));
    try {
      const composed = { name: PACK_NAME, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'TestSvelteApp' },
      };

      const res = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(res.created).toContain(appPath);

      const pkgJson = path.join(root, appPath, 'package.json');
      const svelteConfig = path.join(root, appPath, 'svelte.config.js');
      const layout = path.join(root, appPath, 'src', 'routes', '+layout.svelte');
      const page = path.join(root, appPath, 'src', 'routes', '+page.svelte');
      const route = path.join(root, appPath, 'src', 'routes', 'health', '+server.ts');
      const test = path.join(root, appPath, 'src', 'routes', 'health', '+server.test.ts');
      const readme = path.join(root, appPath, 'README.md');

      expect(existsSync(pkgJson)).toBe(true);
      expect(existsSync(svelteConfig)).toBe(true);
      expect(existsSync(layout)).toBe(true);
      expect(existsSync(page)).toBe(true);
      expect(existsSync(route)).toBe(true);
      expect(existsSync(test)).toBe(true);
      expect(existsSync(readme)).toBe(true);

      const testContent = readFileSync(test, 'utf8');
      expect(testContent).toContain("describe('GET /health endpoint'");
      expect(testContent).toContain('expect(res.status).toBe(200)');

      // Re-run creates 0 new files
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-U8-04: validatePack and unmatchedSkillIncludes report zero errors and zero warnings', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const errors = validatePack(pack, { root: REPO_ROOT });
    expect(errors).toEqual([]);

    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toEqual([]);
  });

  it('TS-U8-02: fixture init materializes 4 skill junctions and surfaces declared conflicts', async () => {
    // 1. Conflict checks
    const sveltePack = loadPack(REPO_ROOT, PACK_NAME);
    const rr8Pack = loadPack(REPO_ROOT, 'rr8-supabase-cf');
    const nextPack = loadPack(REPO_ROOT, 'nextjs-prisma-pg');

    const conflict1 = resolveConflicts([sveltePack, rr8Pack], { forceNamespace: false });
    expect(conflict1.errors.length).toBeGreaterThan(0);
    expect(conflict1.errors[0]).toContain('cannot coexist');

    const conflict2 = resolveConflicts([sveltePack, nextPack], { forceNamespace: false });
    expect(conflict2.errors.length).toBeGreaterThan(0);
    expect(conflict2.errors[0]).toContain('cannot coexist');

    // 2. Standalone fixture init
    const root = await makeWorkspace();
    try {
      const code = await main([
        `--root=${root}`,
        `--archetype=${PACK_NAME}`,
        '--name=SvelteFixture',
        '-y',
      ]);
      expect(code).toBe(0);

      const skillsDir = path.join(root, '.agents', 'skills');
      expect(existsSync(path.join(skillsDir, 'sveltekit-routing'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'sveltekit-forms'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'sveltekit-supabase'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'vitest-testing'))).toBe(true);

      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.scripts.dev).toBe('pnpm -C apps/web dev');
      expect(pkg.scripts.test).toBe('pnpm -C apps/web test');
      expect(pkg.scripts['test:ui']).toBe('pnpm -C apps/web test:ui');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
