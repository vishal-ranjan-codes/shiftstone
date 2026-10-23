/**
 * Archetype manifest loader (blueprint section 5.4, key change 1).
 *
 * Reads packs/<name>/manifest.yaml and exposes resolved paths for every
 * pack-owned asset the composer needs.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

/** Every directory under .shiftstone/packs/ that carries a manifest.yaml. */
export function listPackNames(root) {
  const packsDir = path.join(root, '.shiftstone', 'packs');
  if (!existsSync(packsDir)) return [];
  return readdirSync(packsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(path.join(packsDir, name, 'manifest.yaml')))
    .sort();
}

/**
 * @param {string} root workspace root
 * @param {string} name pack directory name
 * @returns {{ name: string, dir: string, manifestPath: string, manifest: any, resolve: (rel: string) => string }}
 */
export function loadPack(root, name) {
  const dir = path.join(root, '.shiftstone', 'packs', name);
  const manifestPath = path.join(dir, 'manifest.yaml');
  if (!existsSync(manifestPath)) {
    throw new Error(`pack "${name}" not found (expected ${path.join('.shiftstone', 'packs', name, 'manifest.yaml')})`);
  }
  let manifest;
  try {
    manifest = parseYaml(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`pack "${name}": manifest.yaml is not valid YAML — ${error instanceof Error ? error.message : String(error)}`);
  }
  if (manifest === null || typeof manifest !== 'object') {
    throw new Error(`pack "${name}": manifest.yaml must be a mapping`);
  }
  return { name, dir, manifestPath, manifest, resolve: (rel) => path.join(dir, rel) };
}

export function loadPacks(root, names) {
  return names.map((name) => loadPack(root, name));
}

/** Read the manifest JSON Schema (.shiftstone/packs/_schema.json). */
export function loadSchema(root) {
  const schemaPath = path.join(root, '.shiftstone', 'packs', '_schema.json');
  if (!existsSync(schemaPath)) throw new Error('.shiftstone/packs/_schema.json missing');
  return JSON.parse(readFileSync(schemaPath, 'utf8'));
}
