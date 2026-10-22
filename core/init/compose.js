/**
 * Composition resolver (blueprint section 5.4, key change 2).
 *
 * Turns `--archetype=` / `--archetypes=` / interview answers into a
 * composition: the selected packs, their effective app paths (after any
 * --force-namespace relocation), and the flat skill set to materialize.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listPackNames, loadPack } from './pack-loader.js';
import { resolveConflicts, skillSources } from './validate-manifest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The flagship pack is the default when no archetype flag is given. */
export const DEFAULT_ARCHETYPE = 'rr8-supabase-cf';

export function parseArchetypeList(flags = {}) {
  const raw = flags.archetypes ?? flags.archetype;
  if (raw === undefined || raw === null || raw === '') return [DEFAULT_ARCHETYPE];
  const names = String(raw)
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 ? names : [DEFAULT_ARCHETYPE];
}

/**
 * @param {{ archetype?: string, archetypes?: string, forceNamespace?: boolean }} flags
 * @param {{ root?: string }} [options]
 * @returns {{
 *   root: string,
 *   forceNamespace: boolean,
 *   warnings: string[],
 *   archetypes: Array<{ name: string, dir: string, manifest: any, effectiveAppPath: string }>,
 *   skills: Array<{ name: string, pack: string, dir: string, as: string }>,
 * }}
 */
export function composeArchetypes(flags = {}, options = {}) {
  const root = options.root ?? ROOT;
  const forceNamespace = Boolean(flags.forceNamespace);
  const names = parseArchetypeList(flags);
  const available = listPackNames(root);

  const unknown = names.filter((name) => !available.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `unknown archetype(s): ${unknown.join(', ')} — available packs: ${available.join(', ')}`,
    );
  }

  const packs = names.map((name) => loadPack(root, name));
  const conflicts = resolveConflicts(packs, { forceNamespace });

  const archetypes = packs.map((pack) => ({
    name: pack.name,
    dir: pack.dir,
    manifest: pack.manifest,
    effectiveAppPath: conflicts.appPathRenames.get(pack.name) ?? pack.manifest.spec.defaultAppPath,
  }));

  const skills = [];
  for (const pack of packs) {
    for (const [name, source] of Object.entries(skillSources(pack))) {
      skills.push({
        name,
        pack: pack.name,
        dir: source.dir,
        as: conflicts.namespacedSkills.has(name) ? `${pack.name}--${name}` : name,
      });
    }
  }

  return {
    root,
    forceNamespace,
    warnings: conflicts.warnings,
    archetypes,
    skills,
  };
}
