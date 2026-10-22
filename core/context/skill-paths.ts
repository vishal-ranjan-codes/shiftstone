/**
 * Pack-aware skill path resolution (phase 4, tasks 4.2/4.7).
 *
 * Skill content lives in one of two places:
 *   - core skills:      .agents/skills/<name>/            (tracked)
 *   - pack skills:      packs/<pack>/skills/<name>/       (tracked)
 *                       surfaced in .agents/skills/<name> as a locally
 *                       created junction (gitignored, made by
 *                       core/scripts/link-ide-folders.js)
 *
 * Every consumer (loader, manifest generator, budget validator, link
 * manager) resolves through these helpers so a fresh clone without
 * junctions still resolves every skill.
 */

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface PackSkill {
  name: string;
  pack: string;
  dir: string;
}

export function readPackRegistry(root: string): { activePacks: string[]; namespacedSkills: Set<string> } {
  const registryPath = path.join(root, 'packs', '_registry.yaml');
  if (!existsSync(registryPath)) return { activePacks: [], namespacedSkills: new Set() };
  const doc = parseYaml(readFileSync(registryPath, 'utf8')) as Record<string, unknown> | null;
  const activePacks = Array.isArray(doc?.activePacks) ? doc.activePacks : [];
  const namespaced = Array.isArray(doc?.namespacedSkills) ? doc.namespacedSkills : [];
  return {
    activePacks: activePacks.filter((p): p is string => typeof p === 'string'),
    namespacedSkills: new Set(namespaced.filter((p): p is string => typeof p === 'string')),
  };
}

function listSkillDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

/** All skills contributed by the active packs (tracked source of truth). */
export function listActivePackSkills(root: string): PackSkill[] {
  const out: PackSkill[] = [];
  const seen = new Set<string>();
  for (const pack of readPackRegistry(root).activePacks) {
    const skillsRoot = path.join(root, 'packs', pack, 'skills');
    for (const name of listSkillDirs(skillsRoot)) {
      if (seen.has(name)) {
        throw new Error(
          `skill name collision: "${name}" is provided by more than one active pack (use --force-namespace at init to namespace colliding skills)`,
        );
      }
      seen.add(name);
      out.push({ name, pack, dir: path.join(skillsRoot, name) });
    }
  }
  return out;
}

/** Core skills = real directories directly under .agents/skills (never links). */
export function listCoreSkills(root: string): string[] {
  const skillsRoot = path.join(root, '.agents', 'skills');
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.isSymbolicLink())
    .map((e) => e.name)
    .sort();
}

/**
 * Resolve the directory holding a skill's content.
 * Order: .agents/skills (junction or real dir) -> active pack skills.
 */
export function resolveSkillDir(root: string, name: string): string | null {
  const agentsDir = path.join(root, '.agents', 'skills', name);
  if (existsSync(agentsDir)) return agentsDir;
  const packSkill = listActivePackSkills(root).find((s) => s.name === name);
  return packSkill ? packSkill.dir : null;
}

/** True when the path is a symlink/junction (i.e. a materialized view, not content). */
export function isLink(p: string): boolean {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
