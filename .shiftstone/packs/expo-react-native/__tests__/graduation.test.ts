import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../../init/pack-loader.js';
import { unmatchedSkillIncludes, validatePack } from '../../../init/validate-manifest.js';
import { parseFrontmatter } from '../../../scripts/validate-okf-frontmatter.js';
import { makeWorkspace, REPO_ROOT } from '../../../tests/init/workspace-fixture.js';
import { main } from '../../../init.js';

const PACK_NAME = 'expo-react-native';
const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('expo-react-native graduation (LOCK-B4 bar / U9)', () => {
  it('AC-U9-01: manifest declares pnpm-idiom workspace.rootScripts', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scripts = pack.manifest?.spec?.workspace?.rootScripts;
    expect(scripts).toBeDefined();
    expect(scripts.dev).toBe('pnpm -C {{APP_PATH}} dev');
    expect(scripts.build).toBe('pnpm -C {{APP_PATH}} build');
    expect(scripts.test).toBe('pnpm -C {{APP_PATH}} test');
    expect(scripts.lint).toBe('pnpm -C {{APP_PATH}} lint');
    expect(scripts.typecheck).toBe('pnpm -C {{APP_PATH}} typecheck');
  });

  it('AC-U9-02: all 4 declared skills exist physically with valid frontmatter and instructions', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const expectedSkills = [
      'expo-router',
      'expo-notifications',
      'expo-secure-store',
      'react-native-testing',
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

  it('AC-U9-03: scaffold generates Expo skeleton with health test', async () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scriptPath = path.join(PACK_DIR, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
    const mod = (await import(pathToFileURL(scriptPath).href)) as {
      run: (ctx: unknown) => { created: string[] };
    };

    const root = mkdtempSync(path.join(tmpdir(), 'scaffold-expo-'));
    try {
      const composed = { name: PACK_NAME, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'TestExpoApp' },
      };

      const res = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(res.created).toContain(appPath);

      const pkgJson = path.join(root, appPath, 'package.json');
      const appJson = path.join(root, appPath, 'app.json');
      const layout = path.join(root, appPath, 'app', '_layout.tsx');
      const index = path.join(root, appPath, 'app', 'index.tsx');
      const health = path.join(root, appPath, 'app', 'health.ts');
      const test = path.join(root, appPath, 'app', '__tests__', 'health.test.tsx');
      const readme = path.join(root, appPath, 'README.md');

      expect(existsSync(pkgJson)).toBe(true);
      expect(existsSync(appJson)).toBe(true);
      expect(existsSync(layout)).toBe(true);
      expect(existsSync(index)).toBe(true);
      expect(existsSync(health)).toBe(true);
      expect(existsSync(test)).toBe(true);
      expect(existsSync(readme)).toBe(true);

      const testContent = readFileSync(test, 'utf8');
      expect(testContent).toContain("describe('health check'");
      expect(testContent).toContain("expect(health.status).toBe('ok')");

      // Re-run creates 0 new files
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-U9-04: validatePack and unmatchedSkillIncludes report zero errors and zero warnings', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const errors = validatePack(pack, { root: REPO_ROOT });
    expect(errors).toEqual([]);

    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toEqual([]);
  });

  it('TS-U9-02: fixture init materializes 4 skill junctions and generic backlog', async () => {
    const root = await makeWorkspace();
    try {
      const code = await main([
        `--root=${root}`,
        `--archetype=${PACK_NAME}`,
        '--name=ExpoFixture',
        '-y',
      ]);
      expect(code).toBe(0);

      const skillsDir = path.join(root, '.agents', 'skills');
      expect(existsSync(path.join(skillsDir, 'expo-router'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'expo-notifications'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'expo-secure-store'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'react-native-testing'))).toBe(true);

      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.scripts.dev).toBe('pnpm -C apps/mobile dev');
      expect(pkg.scripts.test).toBe('pnpm -C apps/mobile test');

      // Generic backlog check
      const backlogIndex = readFileSync(path.join(root, 'docs', 'backlog', 'index.md'), 'utf8');
      expect(backlogIndex.toLowerCase()).not.toContain('cloudflare');
      expect(backlogIndex.toLowerCase()).not.toContain('supabase');
      expect(backlogIndex.toLowerCase()).not.toContain('react router');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
