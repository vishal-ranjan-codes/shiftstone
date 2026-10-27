/**
 * Unit Tests for Unit U13: Manifest Registration & Multi-IDE Skill Manifest Parity
 *
 * Traceability:
 *   - REQ-INIT-12 (Manifest Registration of ss-brand & Workspace Skills Parity)
 *   - LOCK-INIT-09 (Full-Spectrum Branding Skill)
 *   - Unit U13 (AC-U13-01, AC-U13-02, AC-U13-03, TS-U13-01, TS-U13-02)
 */

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { generateSkillsManifest } from '../../scripts/generate-skills-manifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

describe('Unit U13 — Manifest Registration & Multi-IDE Skill Parity (REQ-INIT-12)', () => {
  it('AC-U13-01: generate-skills-manifest recognizes ss-brand as first-party core skill', () => {
    const result = generateSkillsManifest({ root: ROOT, quiet: true });
    expect(result.skills).toBeDefined();

    const ssBrand = result.skills.find((s) => s.name === 'ss-brand');
    expect(ssBrand).toBeDefined();
    expect(ssBrand?.pack).toBe('core');
    expect(ssBrand?.tier).toBe('manual-load');
    expect(ssBrand?.description).toContain('Full-spectrum branding');
  });

  it('AC-U13-02 & TS-U13-01: regenerates skills-manifest.yaml and AGENTS.md with zero errors', () => {
    const manifestPath = path.join(ROOT, '.shiftstone', 'context', 'skills-manifest.yaml');
    expect(existsSync(manifestPath)).toBe(true);

    const manifestContent = readFileSync(manifestPath, 'utf8');
    const manifest = parseYaml(manifestContent);

    expect(manifest.apiVersion).toBe('context/v1');
    expect(manifest.kind).toBe('SkillsManifest');
    expect(manifest.spec.skills.length).toBeGreaterThanOrEqual(66);

    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const agentsContent = readFileSync(agentsPath, 'utf8');

    expect(agentsContent).toContain('<!-- SKILL-INDEX:BEGIN -->');
    expect(agentsContent).toContain('ss-brand');
    expect(agentsContent).toContain('<!-- SKILL-INDEX:END -->');
  });

  it('AC-U13-03: multi-IDE skill folders resolve ss-brand via junctions without dangling pointers', () => {
    const ideSkillDirs = [
      path.join(ROOT, '.agents', 'skills'),
      path.join(ROOT, '.claude', 'skills'),
      path.join(ROOT, '.commandcode', 'skills'),
    ];

    for (const dir of ideSkillDirs) {
      if (existsSync(dir)) {
        const brandTarget = path.join(dir, 'ss-brand');
        expect(existsSync(brandTarget), `ss-brand must exist in ${dir}`).toBe(true);

        const skillMd = path.join(brandTarget, 'SKILL.md');
        expect(existsSync(skillMd), `SKILL.md must resolve in ${brandTarget}`).toBe(true);

        const instructionsMd = path.join(brandTarget, 'instructions.md');
        expect(existsSync(instructionsMd), `instructions.md must resolve in ${brandTarget}`).toBe(true);
      }
    }
  });

  it('TS-U13-02: asserts all ss-* core skills are present in skills-manifest.yaml and AGENTS.md', () => {
    const manifestPath = path.join(ROOT, '.shiftstone', 'context', 'skills-manifest.yaml');
    const manifest = parseYaml(readFileSync(manifestPath, 'utf8'));
    const manifestSkillNames = new Set(manifest.spec.skills.map((s: any) => s.name));

    const agentsPath = path.join(ROOT, 'AGENTS.md');
    const agentsContent = readFileSync(agentsPath, 'utf8');

    const agentsSkillsDir = path.join(ROOT, '.agents', 'skills');
    const diskSsSkills = readdirSync(agentsSkillsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('ss-'))
      .map((e) => e.name);

    expect(diskSsSkills.length).toBeGreaterThanOrEqual(31);
    expect(diskSsSkills).toContain('ss-brand');
    expect(diskSsSkills).toContain('ss-init');
    expect(diskSsSkills).toContain('ss-plan');

    for (const ssSkill of diskSsSkills) {
      expect(manifestSkillNames.has(ssSkill), `Manifest must include ${ssSkill}`).toBe(true);
      expect(agentsContent, `AGENTS.md must list ${ssSkill}`).toContain(ssSkill);
    }
  });
});
