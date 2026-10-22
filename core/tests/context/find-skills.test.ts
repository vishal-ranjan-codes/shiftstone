import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import yaml from 'yaml';

import { checkFrontmatter } from '../../scripts/validate-okf-frontmatter.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SKILL_DIR = path.join(REPO_ROOT, '.agents', 'skills', 'find-skills');

describe('WS-A / WS-G — find-skills universal core skill registration', () => {
  it('ships valid OKF frontmatter with pack: core', async () => {
    const skillContent = await readFile(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');
    const instructionsContent = await readFile(path.join(SKILL_DIR, 'instructions.md'), 'utf8');

    expect(checkFrontmatter('.agents/skills/find-skills/SKILL.md', skillContent)).toEqual([]);
    expect(skillContent).toContain('name: find-skills');
    expect(skillContent).toContain('pack: core');
    expect(instructionsContent.length).toBeGreaterThan(50);
  });

  it('is registered in core/context/skills-manifest.yaml with positive tokenCost and pack: core', async () => {
    const manifestRaw = await readFile(path.join(REPO_ROOT, 'core', 'context', 'skills-manifest.yaml'), 'utf8');
    const parsed = yaml.parse(manifestRaw) as { spec: { skills: Array<{ name: string; pack: string; tokenCost: number; tier?: string }> } };

    const entry = parsed.spec.skills.find((s) => s.name === 'find-skills');
    expect(entry).toBeDefined();
    expect(entry?.pack).toBe('core');
    expect(entry?.tier).toBe('manual-load');
    expect(entry?.tokenCost).toBeGreaterThan(0);
  });

  it('is indexed in AGENTS.md SKILL-INDEX block', async () => {
    const agentsContent = await readFile(path.join(REPO_ROOT, 'AGENTS.md'), 'utf8');
    const indexMatch = agentsContent.match(/<!-- SKILL-INDEX:BEGIN -->([\s\S]*?)<!-- SKILL-INDEX:END -->/);
    expect(indexMatch).toBeTruthy();
    expect(indexMatch?.[1]).toContain('find-skills');
  });

  it('is NOT gitignored (git check-ignore returns exit code 1 due to .gitignore negation)', () => {
    const res = spawnSync('git', ['check-ignore', '.agents/skills/find-skills/SKILL.md'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    // git check-ignore exits with 1 when the file is NOT ignored
    expect(res.status).toBe(1);
    expect(res.stdout.trim()).toBe('');
  });
});
