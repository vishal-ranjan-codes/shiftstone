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

const PACK_NAME = 'go-chi-postgres';
const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('go-chi-postgres graduation (LOCK-B4 bar / U6)', () => {
  it('AC-U6-01: manifest declares Go-idiom workspace.rootScripts', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scripts = pack.manifest?.spec?.workspace?.rootScripts;
    expect(scripts).toBeDefined();
    expect(scripts.dev).toBe('cd {{APP_PATH}} && go run ./cmd/api');
    expect(scripts.test).toBe('cd {{APP_PATH}} && go test ./...');
    expect(scripts.lint).toBe('cd {{APP_PATH}} && golangci-lint run');
    expect(scripts.build).toBe('cd {{APP_PATH}} && go build -o bin/api ./cmd/api');
  });

  it('AC-U6-02: all 4 declared skills exist physically with valid frontmatter and instructions', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const expectedSkills = ['chi-routing', 'go-postgres', 'go-migrations', 'go-testing'];
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

  it('AC-U6-03: scaffold generates go.mod, cmd/api/main.go, internal/health/health_test.go', async () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scriptPath = path.join(PACK_DIR, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
    const mod = (await import(pathToFileURL(scriptPath).href)) as {
      run: (ctx: unknown) => { created: string[] };
    };

    const root = mkdtempSync(path.join(tmpdir(), 'scaffold-go-'));
    try {
      const composed = { name: PACK_NAME, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'TestGoApp' },
      };

      const res = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(res.created).toContain(appPath);

      const goMod = path.join(root, appPath, 'go.mod');
      const mainGo = path.join(root, appPath, 'cmd', 'api', 'main.go');
      const healthTest = path.join(root, appPath, 'internal', 'health', 'health_test.go');
      const readme = path.join(root, appPath, 'README.md');

      expect(existsSync(goMod)).toBe(true);
      expect(existsSync(mainGo)).toBe(true);
      expect(existsSync(healthTest)).toBe(true);
      expect(existsSync(readme)).toBe(true);

      const testContent = readFileSync(healthTest, 'utf8');
      expect(testContent).toContain('TestHealthEndpoint');
      expect(testContent).toContain('httptest.NewRecorder()');

      // Re-run creates 0 new files
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-U6-04: validatePack and unmatchedSkillIncludes report zero errors and zero warnings', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const errors = validatePack(pack, { root: REPO_ROOT });
    expect(errors).toEqual([]);

    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toEqual([]);
  });

  it('TS-U6-02: fixture init with --archetype=go-chi-postgres materializes 4 skill junctions and generic backlog', async () => {
    const root = await makeWorkspace();
    try {
      const code = await main([
        `--root=${root}`,
        `--archetype=${PACK_NAME}`,
        '--name=GoFixture',
        '-y',
      ]);
      expect(code).toBe(0);

      const skillsDir = path.join(root, '.agents', 'skills');
      expect(existsSync(path.join(skillsDir, 'chi-routing'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'go-postgres'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'go-migrations'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'go-testing'))).toBe(true);

      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.scripts.dev).toBe('cd apps/api-go && go run ./cmd/api');
      expect(pkg.scripts.test).toBe('cd apps/api-go && go test ./...');

      // Generic backlog check (zero cloudflare / supabase / rr8 tokens)
      const backlogIndex = readFileSync(path.join(root, 'docs', 'backlog', 'index.md'), 'utf8');
      expect(backlogIndex.toLowerCase()).not.toContain('cloudflare');
      expect(backlogIndex.toLowerCase()).not.toContain('supabase');
      expect(backlogIndex.toLowerCase()).not.toContain('react router');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
