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

const PACK_NAME = 'nextjs-prisma-pg';
const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('nextjs-prisma-pg graduation (LOCK-B4 bar / U7)', () => {
  it('AC-U7-01: manifest declares pnpm-idiom workspace.rootScripts', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scripts = pack.manifest?.spec?.workspace?.rootScripts;
    expect(scripts).toBeDefined();
    expect(scripts.dev).toBe('pnpm -C {{APP_PATH}} dev');
    expect(scripts.build).toBe('pnpm -C {{APP_PATH}} build');
    expect(scripts.start).toBe('pnpm -C {{APP_PATH}} start');
    expect(scripts.test).toBe('pnpm -C {{APP_PATH}} test');
    expect(scripts.lint).toBe('pnpm -C {{APP_PATH}} lint');
    expect(scripts.typecheck).toBe('pnpm -C {{APP_PATH}} typecheck');
    expect(scripts['db:migrate']).toBe('pnpm -C {{APP_PATH}} db:migrate');
    expect(scripts['db:generate']).toBe('pnpm -C {{APP_PATH}} db:generate');
  });

  it('AC-U7-02: all 6 declared skills exist physically with valid frontmatter and instructions', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const expectedSkills = [
      'nextjs-app-router',
      'nextjs-data-fetching',
      'prisma-schema',
      'prisma-migrations',
      'server-actions',
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

  it('AC-U7-03: scaffold generates App Router skeleton with Prisma schema and Vitest health test', async () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scriptPath = path.join(PACK_DIR, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
    const mod = (await import(pathToFileURL(scriptPath).href)) as {
      run: (ctx: unknown) => { created: string[] };
    };

    const root = mkdtempSync(path.join(tmpdir(), 'scaffold-nextjs-'));
    try {
      const composed = { name: PACK_NAME, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'TestNextApp' },
      };

      const res = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(res.created).toContain(appPath);

      const pkgJson = path.join(root, appPath, 'package.json');
      const tsconfig = path.join(root, appPath, 'tsconfig.json');
      const layout = path.join(root, appPath, 'app', 'layout.tsx');
      const page = path.join(root, appPath, 'app', 'page.tsx');
      const route = path.join(root, appPath, 'app', 'api', 'health', 'route.ts');
      const test = path.join(root, appPath, 'app', 'api', 'health', 'route.test.ts');
      const schema = path.join(root, appPath, 'prisma', 'schema.prisma');
      const readme = path.join(root, appPath, 'README.md');

      expect(existsSync(pkgJson)).toBe(true);
      expect(existsSync(tsconfig)).toBe(true);
      expect(existsSync(layout)).toBe(true);
      expect(existsSync(page)).toBe(true);
      expect(existsSync(route)).toBe(true);
      expect(existsSync(test)).toBe(true);
      expect(existsSync(schema)).toBe(true);
      expect(existsSync(readme)).toBe(true);

      const testContent = readFileSync(test, 'utf8');
      expect(testContent).toContain("describe('GET /api/health'");
      expect(testContent).toContain('expect(response.status).toBe(200)');

      // Re-run creates 0 new files
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-U7-04: validatePack and unmatchedSkillIncludes report zero errors and zero warnings', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const errors = validatePack(pack, { root: REPO_ROOT });
    expect(errors).toEqual([]);

    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toEqual([]);
  });

  it('TS-U7-02: fixture init materializes 6 skill junctions and detects declared conflict with rr8', async () => {
    // 1. Conflict enforcement
    const nextPack = loadPack(REPO_ROOT, PACK_NAME);
    const rr8Pack = loadPack(REPO_ROOT, 'rr8-supabase-cf');
    const conflictResult = resolveConflicts([nextPack, rr8Pack], { forceNamespace: false });
    expect(conflictResult.errors.length).toBeGreaterThan(0);
    expect(conflictResult.errors[0]).toContain('cannot coexist');

    // 2. Standalone init materialization
    const root = await makeWorkspace();
    try {
      const code = await main([
        `--root=${root}`,
        `--archetype=${PACK_NAME}`,
        '--name=NextFixture',
        '-y',
      ]);
      expect(code).toBe(0);

      const skillsDir = path.join(root, '.agents', 'skills');
      expect(existsSync(path.join(skillsDir, 'nextjs-app-router'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'nextjs-data-fetching'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'prisma-schema'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'prisma-migrations'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'server-actions'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'vitest-testing'))).toBe(true);

      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.scripts.dev).toBe('pnpm -C apps/web dev');
      expect(pkg.scripts.test).toBe('pnpm -C apps/web test');
      expect(pkg.scripts['db:migrate']).toBe('pnpm -C apps/web db:migrate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
