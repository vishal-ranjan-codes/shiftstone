import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPack } from '../../../init/pack-loader.js';
import { unmatchedSkillIncludes, validatePack } from '../../../init/validate-manifest.js';
import { parseFrontmatter } from '../../../scripts/validate-okf-frontmatter.js';
import { makeWorkspace, REPO_ROOT } from '../../../tests/init/workspace-fixture.js';
import { main } from '../../../init.js';

const PACK_NAME = 'fastapi-pg';
const PACK_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('fastapi-pg graduation (LOCK-B4 bar / U5)', () => {
  it('AC-U5-01: manifest declares workspace.rootScripts in uv idiom', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scripts = pack.manifest?.spec?.workspace?.rootScripts;
    expect(scripts).toBeDefined();
    expect(scripts.dev).toBe('uv run --directory {{APP_PATH}} uvicorn main:app --reload');
    expect(scripts.test).toBe('uv run --directory {{APP_PATH}} pytest');
    expect(scripts.lint).toBe('uv run --directory {{APP_PATH}} ruff check .');
    expect(scripts.typecheck).toBe('uv run --directory {{APP_PATH}} mypy .');
    expect(scripts.build).toBe('uv build --directory {{APP_PATH}}');
  });

  it('AC-U5-02: all 8 declared skills exist physically with valid frontmatter and instructions', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const expectedSkills = [
      'python-patterns',
      'sqlalchemy',
      'alembic',
      'pydantic',
      'fastapi-routing',
      'pytest',
      'httpx',
      'uvicorn-deployment',
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

  it('AC-U5-03: scaffold generates pyproject.toml, main.py, and health test', async () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const scriptPath = path.join(PACK_DIR, pack.manifest.hooks?.pre_init ?? './scaffold-script.js');
    const mod = (await import(pathToFileURL(scriptPath).href)) as {
      run: (ctx: unknown) => { created: string[] };
    };

    const root = mkdtempSync(path.join(tmpdir(), 'scaffold-fastapi-'));
    try {
      const composed = { name: PACK_NAME, manifest: pack.manifest, effectiveAppPath: undefined };
      const ctx = {
        root,
        composition: { archetypes: [composed] },
        archetype: composed,
        answers: { projectName: 'TestFastAPI' },
      };

      const res = mod.run(ctx);
      const appPath = pack.manifest.spec.defaultAppPath;
      expect(res.created).toContain(appPath);

      const pyproject = path.join(root, appPath, 'pyproject.toml');
      const mainPy = path.join(root, appPath, 'main.py');
      const testHealth = path.join(root, appPath, 'tests', 'test_health.py');
      const readme = path.join(root, appPath, 'README.md');

      expect(existsSync(pyproject)).toBe(true);
      expect(existsSync(mainPy)).toBe(true);
      expect(existsSync(testHealth)).toBe(true);
      expect(existsSync(readme)).toBe(true);

      const testContent = readFileSync(testHealth, 'utf8');
      expect(testContent).toContain('def test_health');
      expect(testContent).toContain('client.get("/health")');

      // Re-run creates 0 new files
      const second = mod.run(ctx);
      expect(second.created).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('AC-U5-04: validatePack and unmatchedSkillIncludes report zero errors and zero warnings', () => {
    const pack = loadPack(REPO_ROOT, PACK_NAME);
    const errors = validatePack(pack, { root: REPO_ROOT });
    expect(errors).toEqual([]);

    const warnings = unmatchedSkillIncludes(pack);
    expect(warnings).toEqual([]);
  });

  it('TS-U5-02: fixture init with --archetype=fastapi-pg materializes 8 skill junctions and root scripts', async () => {
    const root = await makeWorkspace();
    try {
      const code = await main([
        `--root=${root}`,
        `--archetype=${PACK_NAME}`,
        '--name=FastApiFixture',
        '-y',
      ]);
      expect(code).toBe(0);

      const skillsDir = path.join(root, '.agents', 'skills');
      expect(existsSync(path.join(skillsDir, 'fastapi-routing'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'sqlalchemy'))).toBe(true);
      expect(existsSync(path.join(skillsDir, 'uvicorn-deployment'))).toBe(true);

      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      expect(pkg.scripts.dev).toBe('uv run --directory apps/api uvicorn main:app --reload');
      expect(pkg.scripts.test).toBe('uv run --directory apps/api pytest');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
