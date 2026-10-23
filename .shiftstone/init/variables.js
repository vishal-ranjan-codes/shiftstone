/**
 * Variable subsystem for init (blueprint section 5.4, key change 3):
 * core placeholders plus archetype-declared placeholders with type
 * validation (string | enum | path), and the precision substitution
 * walker that applies the final map to the workspace.
 */

import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.ts', '.tsx', '.jsonc']);
const PLACEHOLDER = /\{\{([A-Z0-9_]+)\}\}/g;

/** Directories never substituted (runtime, build output, pack library, apps). */
export const DEFAULT_SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.wrangler',
  '.react-router',
  'build',
  'dist',
  'coverage',
  '.turbo',
  '.loops',
  'packs',
]);

/**
 * Core placeholder map (stack-agnostic). Pack variables are layered on top
 * by buildVariables().
 *
 * @param {{ projectName: string, layout: string, packageManager?: string,
 *           appPath: string, packaging: string }} params
 */
export function coreVariables({ projectName, layout, packageManager, appPath, packaging }) {
  const lower = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const monorepo = layout === 'monorepo';
  const npmPackageName = monorepo ? `@${lower}/${path.posix.basename(appPath.replace(/\\/g, '/'))}` : lower;
  return {
    '{{PROJECT_NAME}}': projectName,
    '{{PROJECT_NAME_LOWER}}': lower,
    '{{APP_PATH}}': appPath,
    '{{MONOREPO_OR_SINGLE}}': monorepo
      ? `${packaging} monorepo (${appPath})`
      : 'Standard single application',
    '{{PACKAGE_MANAGER}}': packageManager ?? packaging,
    '{{NPM_PACKAGE_NAME}}': npmPackageName,
    '{{APP_NAME_NPM}}': npmPackageName,
    '{{BIBLE_PATH}}': 'docs/bible',
    // Generic defaults for the project-skill template; packs layer their
    // stack-specific values on top (layerPackVariables).
    '{{LOCAL_SECRETS_FILE}}': '.env',
    '{{SECRET_PUT_CMD}}': 'set the secret via your platform secret manager',
    '{{PAYLOAD_VALIDATOR}}': 'a schema validator',
    '{{TYPED_RESPONSE}}': "your framework's typed response contract",
  };
}

/**
 * Validate declared pack variables against provided values (task 4.7
 * verification: variable substitution covered by Vitest).
 *
 * @param {Record<string, string>} values candidate values keyed `{{NAME}}`
 * @param {Array<{name: string, type: string, enum?: string[], default?: string}>} declarations
 * @returns {string[]} errors
 */
export function validateVariables(values, declarations) {
  const errors = [];
  for (const declaration of declarations ?? []) {
    const value = values[declaration.name];
    if (value === undefined) {
      if (declaration.default === undefined) {
        errors.push(`variable ${declaration.name} has no value and no default`);
      }
      continue;
    }
    if (declaration.type === 'enum') {
      if (!(declaration.enum ?? []).includes(value)) {
        errors.push(
          `variable ${declaration.name}=${JSON.stringify(value)} must be one of ${(declaration.enum ?? []).map((o) => JSON.stringify(o)).join(', ')}`,
        );
      }
    } else if (declaration.type === 'path') {
      if (value.includes(':') || value.startsWith('/') || value.split(/[\\/]/).includes('..')) {
        errors.push(`variable ${declaration.name}=${JSON.stringify(value)} must be a relative path without ".."`);
      }
    } else if (declaration.type === 'string') {
      if (value.trim().length === 0) errors.push(`variable ${declaration.name} must be a non-empty string`);
    }
  }
  return errors;
}

/**
 * Layer pack-declared variables over the core map. Defaults may reference
 * other placeholders (`{{PACKAGE_MANAGER}}` etc.) and are resolved
 * recursively.
 *
 * @param {Record<string, string>} core
 * @param {Array<{name: string, type: string, enum?: string[], default?: string}>} declarations
 * @param {Record<string, string>} [provided]
 * @param {string[]} [errorsOut]
 * @returns {Record<string, string>}
 */
export function layerPackVariables(core, declarations, provided = {}, errorsOut = []) {
  const map = { ...core };
  for (const declaration of declarations ?? []) {
    const supplied = provided[declaration.name];
    if (supplied !== undefined) map[declaration.name] = supplied;
    else if (declaration.default !== undefined) map[declaration.name] = declaration.default;
  }
  errorsOut.push(...validateVariables(map, declarations));
  return resolvePlaceholders(map);
}

/** Resolve `{{KEY}}` references inside values until stable (depth-capped).
 * @param {Record<string, string>} map
 * @returns {Record<string, string>}
 */
export function resolvePlaceholders(map) {
  const resolved = { ...map };
  for (let round = 0; round < 10; round++) {
    let changed = false;
    for (const [key, value] of Object.entries(resolved)) {
      const next = value.replace(PLACEHOLDER, (token) => resolved[token] ?? token);
      if (next !== value) {
        resolved[key] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return resolved;
}

/**
 * Build the final placeholder map for a composition.
 *
 * @param {{ answers: Record<string, any>, composition: any, provided?: Record<string, string> }} params
 * @returns {{ map: Record<string, string>, errors: string[] }}
 */
export function buildVariables({ answers, composition, provided = {} }) {
  const errors = [];
  const primary = composition.archetypes[0];
  const spec = primary.manifest.spec;
  const layout = answers.layout ?? spec.folderLayout;
  const core = coreVariables({
    projectName: answers.projectName,
    layout,
    packageManager: answers.packageManager,
    appPath: primary.effectiveAppPath ?? spec.defaultAppPath,
    packaging: spec.packaging,
  });

  // First (primary) archetype wins on duplicate placeholder names.
  const seen = new Set();
  const declarations = [];
  for (const archetype of composition.archetypes) {
    for (const declaration of archetype.manifest.spec.variables ?? []) {
      if (seen.has(declaration.name)) continue;
      seen.add(declaration.name);
      declarations.push(declaration);
    }
  }
  const map = layerPackVariables(core, declarations, provided, errors);
  return { map, errors };
}

/**
 * Precision substitution: only files containing declared placeholders, only
 * known keys, never symlinks (pack skill junctions) or skipped directories.
 *
 * @param {string} root
 * @param {Record<string, string>} placeholders
 * @param {{ skipDirs?: Set<string> }} [options]
 * @returns {{ changed: string[], scanned: number }}
 */
export function substituteInTree(root, placeholders, options = {}) {
  const skipDirs = options.skipDirs ?? DEFAULT_SKIP_DIRS;
  const changed = [];
  let scanned = 0;

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) continue;
      scanned += 1;
      const raw = readFileSync(full, 'utf8');
      let content = raw;
      for (const [key, value] of Object.entries(placeholders)) {
        if (content.includes(key)) content = content.split(key).join(value);
      }
      if (content !== raw) {
        writeFileSync(full, content, 'utf8');
        changed.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  };

  if (existsSync(root)) walk(root);
  return { changed, scanned };
}

/** Guard against substituting into a symlinked tree (defensive). */
export function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}
