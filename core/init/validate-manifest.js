/**
 * Manifest + composition validation (tasks 4.7 and 4.12).
 *
 *   validatePack(pack)          — one pack against packs/_schema.json, plus
 *                                 referenced-file existence
 *   validateComposition(...)    — every pack + conflict resolution
 *   resolveConflicts(...)       — blueprint section 10.4 decision (D default:
 *                                 refuse conflicting packs; C escape hatch:
 *                                 --force-namespace namespaces collisions)
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { validateAgainstSchema } from './schema-validate.js';
import { loadSchema } from './pack-loader.js';

/** Files/directories a manifest may reference. */
function referencedPaths(manifest) {
  const refs = [];
  const composition = manifest.composition ?? {};
  for (const key of ['bible_overlays', 'folder_hooks', 'path_scoped_rules', 'workflows']) {
    if (typeof composition[key] === 'string') refs.push({ key, value: composition[key], kind: 'dir' });
  }
  for (const key of ['decisions_seed', 'scaffold_script']) {
    if (typeof composition[key] === 'string') refs.push({ key, value: composition[key], kind: 'file' });
  }
  const hooks = manifest.hooks ?? {};
  for (const key of ['pre_init', 'post_init']) {
    if (typeof hooks[key] === 'string') refs.push({ key: `hooks.${key}`, value: hooks[key], kind: 'file' });
  }
  return refs;
}

/**
 * Validate a single pack (loaded by pack-loader.loadPack).
 * @returns {string[]} errors (empty = valid)
 */
export function validatePack(pack, { root }) {
  const errors = [];
  const schema = loadSchema(root);
  for (const error of validateAgainstSchema(pack.manifest, schema)) errors.push(error);

  const name = pack.manifest?.metadata?.name;
  if (typeof name === 'string' && name !== pack.name) {
    errors.push(`manifest.metadata.name "${name}" must match the pack directory name "${pack.name}"`);
  }

  const variables = pack.manifest?.spec?.variables;
  if (Array.isArray(variables)) {
    for (const variable of variables) {
      if (variable?.type === 'enum' && !Array.isArray(variable.enum)) {
        errors.push(`manifest.spec.variables["${variable.name}"]: type "enum" requires an "enum" value list`);
      }
    }
  }

  const appPath = pack.manifest?.spec?.defaultAppPath;
  if (typeof appPath === 'string' && appPath.split(/[\\/]/).includes('..')) {
    errors.push(`manifest.spec.defaultAppPath: must not contain ".." segments`);
  }

  for (const ref of referencedPaths(pack.manifest)) {
    const target = path.join(pack.dir, ref.value);
    if (!existsSync(target)) {
      errors.push(`manifest ${ref.key}: referenced ${ref.kind} not found: ${ref.value}`);
    }
  }
  return errors;
}

/**
 * Conflict resolution across a set of loaded packs.
 *
 * @param {Array<{name: string, dir: string, manifest: any}>} packs
 * @param {{ forceNamespace?: boolean }} options
 * @returns {{
 *   errors: string[],
 *   warnings: string[],
 *   namespacedSkills: Set<string>,
 *   appPathRenames: Map<string, string>,
 * }}
 */
export function resolveConflicts(packs, { forceNamespace = false } = {}) {
  const errors = [];
  const warnings = [];
  const namespacedSkills = new Set();
  const appPathRenames = new Map();

  // (D) declared conflicts.with — refuse with an explanation
  for (let i = 0; i < packs.length; i++) {
    for (let j = i + 1; j < packs.length; j++) {
      const a = packs[i];
      const b = packs[j];
      const aConflicts = (a.manifest.conflicts?.with ?? []).includes(b.name);
      const bConflicts = (b.manifest.conflicts?.with ?? []).includes(a.name);
      if (!aConflicts && !bConflicts) continue;
      const declarant = aConflicts ? a.name : b.name;
      const other = aConflicts ? b.name : a.name;
      const because = `"${declarant}" declares conflicts.with: ["${other}"]`;
      if (forceNamespace) {
        warnings.push(
          `conflict between "${a.name}" and "${b.name}" (${because}) overridden by --force-namespace`,
        );
      } else {
        errors.push(
          `packs "${a.name}" and "${b.name}" cannot coexist — ${because}. ` +
            `Refusing to install both. Drop one pack, or rerun with --force-namespace to namespace colliding skills as "<pack>--<skill>" (blueprint section 10.4 escape hatch).`,
        );
      }
    }
  }

  // Skill name collisions across packs (the section 10.4 question itself)
  const providers = new Map();
  for (const pack of packs) {
    const composition = pack.manifest.composition ?? {};
    if (!Array.isArray(composition.skills?.include)) continue;
    for (const skillName of Object.keys(skillSources(pack))) {
      const list = providers.get(skillName) ?? [];
      list.push(pack.name);
      providers.set(skillName, list);
    }
  }
  for (const [skillName, packNames] of providers) {
    if (packNames.length < 2) continue;
    if (forceNamespace) {
      namespacedSkills.add(skillName);
      warnings.push(`skill "${skillName}" provided by ${packNames.join(' and ')} — namespaced per pack`);
    } else {
      errors.push(
        `skill "${skillName}" is provided by more than one pack (${packNames.join(', ')}) — ` +
          `exclude it via composition.skills.exclude or rerun with --force-namespace.`,
      );
    }
  }

  // Duplicate defaultAppPath — both archetypes would own the same folder
  const byAppPath = new Map();
  for (const pack of packs) {
    const appPath = pack.manifest?.spec?.defaultAppPath;
    if (typeof appPath !== 'string') continue;
    const list = byAppPath.get(appPath) ?? [];
    list.push(pack);
    byAppPath.set(appPath, list);
  }
  for (const [appPath, group] of byAppPath) {
    if (group.length < 2) continue;
    if (forceNamespace) {
      for (const pack of group.slice(1)) {
        const renamed = path.posix.join('apps', pack.name);
        appPathRenames.set(pack.name, renamed);
        warnings.push(`app path "${appPath}" claimed by ${group.map((p) => p.name).join(' and ')} — "${pack.name}" relocated to ${renamed}`);
      }
    } else {
      errors.push(
        `app path "${appPath}" is claimed by ${group.map((p) => p.name).join(' and ')} — ` +
          `give one pack a different spec.defaultAppPath, drop one pack, or rerun with --force-namespace.`,
      );
    }
  }

  return { errors, warnings, namespacedSkills, appPathRenames };
}

/**
 * Physical skill sources of one pack, filtered by its include/exclude
 * patterns (blueprint section 5.2). Patterns support `*` wildcards.
 */
export function skillSources(pack) {
  const composition = pack.manifest.composition ?? {};
  const include = composition.skills?.include ?? ['*'];
  const exclude = composition.skills?.exclude ?? [];
  /** @type {Record<string, {dir: string, pack: string}>} */
  const sources = {};
  const skillsRoot = path.join(pack.dir, 'skills');
  for (const entry of listSkillDirs(skillsRoot)) {
    const included = include.some((pattern) => matchPattern(pattern, entry));
    const excluded = exclude.some((pattern) => matchPattern(pattern, entry));
    if (included && !excluded) {
      sources[entry] = { dir: path.join(skillsRoot, entry), pack: pack.name };
    }
  }
  return sources;
}

function listSkillDirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Single-segment wildcard match (`*`), used for skill include/exclude. */
export function matchPattern(pattern, name) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(name);
}

/**
 * Warn when a declared composition.skills.include pattern matches no physical
 * skill directory (skills authored later, or a stale name copied from the
 * blueprint). Never an error — starter packs legitimately declare future
 * skills — but a phantom name in a shipped pack should be visible.
 *
 * @param {{name: string, dir: string, manifest: any}} pack
 * @returns {string[]} warnings (empty = every declared pattern resolves)
 */
export function unmatchedSkillIncludes(pack) {
  const include = pack.manifest?.composition?.skills?.include;
  if (!Array.isArray(include) || include.length === 0) return [];
  const skillsRoot = path.join(pack.dir, 'skills');
  const dirs = listSkillDirs(skillsRoot);
  const warnings = [];
  for (const pattern of include) {
    if (!dirs.some((dir) => matchPattern(pattern, dir))) {
      warnings.push(
        `composition.skills.include pattern "${pattern}" matches no skill under ${pack.name}/skills/ — authored later, or a stale name?`,
      );
    }
  }
  return warnings;
}

/**
 * Full composition validation: schema + references + conflicts.
 * @param {{archetypes: Array<{name: string, dir: string, manifest: any}>}} composition
 * @param {{root: string, forceNamespace?: boolean}} options
 */
export function validateComposition(composition, { root, forceNamespace = false }) {
  const errors = [];
  const warnings = [];
  for (const pack of composition.archetypes) {
    for (const error of validatePack(pack, { root })) {
      errors.push(`pack "${pack.name}": ${error}`);
    }
    for (const warning of unmatchedSkillIncludes(pack)) {
      warnings.push(`pack "${pack.name}": ${warning}`);
    }
  }
  const conflicts = resolveConflicts(composition.archetypes, { forceNamespace });
  errors.push(...conflicts.errors);
  warnings.push(...conflicts.warnings);
  return { ok: errors.length === 0, errors, warnings, conflicts };
}
