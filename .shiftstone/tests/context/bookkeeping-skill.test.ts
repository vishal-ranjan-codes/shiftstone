import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { checkAll, generateAll } from '../../governance/index-generator.ts';
import { checkFile } from '../../scripts/check-link-integrity.js';
import { checkFrontmatter } from '../../scripts/validate-okf-frontmatter.js';
import { matchGlob } from '../../context/skills-loader.ts';
import { generateSkillsManifest } from '../../scripts/generate-skills-manifest.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, '.agents', 'skills', 'ss-bookkeeping');

describe('6.8 — bookkeeping skill (LLM-Wiki catalog maintenance)', () => {
  it('ships the 3-tier bundle with valid OKF frontmatter', async () => {
    const skill = await readFile(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const instructions = await readFile(path.join(SKILL_DIR, 'instructions.md'), 'utf8');
    expect(checkFrontmatter('.agents/skills/ss-bookkeeping/SKILL.md', skill)).toEqual([]);
    expect(skill).toContain('name: ss-bookkeeping');
    expect(skill).toContain('pack: core');
    expect(instructions).toContain('One-Pass Catalog Repair');
  });

  it('is registered in the generated skills manifest and the AGENTS.md index', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'bookkeeping-manifest-'));
    // mirror the workspace layout just enough for manifest generation
    await mkdir(path.join(root, '.agents', 'skills', 'ss-bookkeeping'), { recursive: true });
    await writeFile(path.join(root, '.agents', 'skills', 'ss-bookkeeping', 'SKILL.md'), await readFile(path.join(SKILL_DIR, 'SKILL.md'), 'utf8'), 'utf8');
    await writeFile(path.join(root, '.agents', 'skills', 'ss-bookkeeping', 'instructions.md'), await readFile(path.join(SKILL_DIR, 'instructions.md'), 'utf8'), 'utf8');
    await mkdir(path.join(root, 'packs'), { recursive: true });
    await writeFile(path.join(root, 'packs', '_registry.yaml'), 'activePacks: []\nnamespacedSkills: []\n', 'utf8');
    await mkdir(path.join(root, '.shiftstone', 'context'), { recursive: true });
    await writeFile(
      path.join(root, '.shiftstone', 'context', 'token-budget.json'),
      await readFile(path.join(REPO_ROOT, '.shiftstone', 'context', 'token-budget.json'), 'utf8'),
      'utf8',
    );
    await writeFile(path.join(root, 'AGENTS.md'), '<!-- SKILL-INDEX:BEGIN -->\n<!-- SKILL-INDEX:END -->\n', 'utf8');

    const { skills } = generateSkillsManifest({ root, quiet: true });
    const entry = skills.find((s) => s.name === 'ss-bookkeeping');
    expect(entry).toBeTruthy();
    expect(entry?.tokenCost).toBeGreaterThan(0);
    expect(entry?.pack).toBe('core');
    expect(entry?.paths.some((p: string) => matchGlob(p, 'docs/bible/log.md'))).toBe(true);
    expect(entry?.tags).toContain('docs');

    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).toContain('ss-bookkeeping');
  });

  it('its one-pass procedure repairs planted stale indexes and broken links', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'bookkeeping-drill-'));
    await mkdir(path.join(root, 'notes'), { recursive: true });
    await writeFile(path.join(root, 'README.md'), '# Docs\n\nRoot document.\n', 'utf8');
    await writeFile(path.join(root, 'index.md'), '# notes — Index\n\nstale, knows nothing about the new file\n', 'utf8');
    await writeFile(path.join(root, 'notes', 'guide.md'), '# Guide\n\nSee [missing](./gone.md).\n', 'utf8');

    // detectors (procedure step 1-3)
    const staleIndex = await checkAll(root);
    expect(staleIndex.stale).toContain('index.md');
    const brokenLinks = await checkFile(path.join(root, 'notes', 'guide.md'), 'notes/guide.md');
    expect(brokenLinks).toHaveLength(1);

    // one repair pass, exactly as instructions.md prescribes:
    await generateAll(root); // indexes are regenerated, never hand-edited
    await writeFile(path.join(root, 'notes', 'guide.md'), '# Guide\n\nSee [self](./guide.md).\n', 'utf8'); // retarget to the file that owns the content

    expect((await checkAll(root)).stale).toEqual([]);
    expect(await checkFile(path.join(root, 'notes', 'guide.md'), 'notes/guide.md')).toEqual([]);
  });

  it('documents every detector command the procedure runs', async () => {
    const instructions = await readFile(path.join(SKILL_DIR, 'instructions.md'), 'utf8');
    for (const command of [
      'node .shiftstone/governance/index.js --check',
      'node .shiftstone/governance/bible/index.js --check',
      'node .shiftstone/scripts/check-link-integrity.js',
      'node .shiftstone/scripts/validate-okf-frontmatter.js --fix',
      'node .shiftstone/scripts/generate-skills-manifest.js',
      'node .shiftstone/scripts/compile-changelog.js',
    ]) {
      expect(instructions, `missing command: ${command}`).toContain(command);
    }
    expect(instructions).toContain('inner gear');
    expect(instructions).toContain('chief editor');
  });
});
