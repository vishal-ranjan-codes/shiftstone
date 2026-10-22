/**
 * rr8-supabase-cf post-init — final touches after governance seeding and
 * variable substitution (blueprint section 5.2: hooks.post_init —
 * "Generates database.types.ts, sets Wrangler defaults").
 *
 * Deliberately network-free: it prepares paths and reports the commands to
 * run rather than executing tooling that may not be installed yet.
 */

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function run(context) {
  const { root, composition, archetype } = context;
  const composed = composition.archetypes.find((a) => a.name === archetype.name) ?? archetype;
  const appPath = composed.effectiveAppPath ?? composed.manifest.spec.defaultAppPath;

  const typesDir = path.join(root, appPath, 'app', 'types');
  if (!existsSync(typesDir)) mkdirSync(typesDir, { recursive: true });

  const wranglerConfig = path.join(root, appPath, 'wrangler.jsonc');
  if (!existsSync(wranglerConfig)) {
    console.log(`   ℹ️  no wrangler.jsonc in ${appPath}/ yet — Wrangler defaults are set when the starter lands`);
  }

  const typesCmd = context.variables?.['{{SUPABASE_TYPES_CMD}}'];
  if (typesCmd) {
    console.log(`   🔌 run the pack's type generation when dependencies are installed: ${typesCmd}`);
  }
  return { typesDir: path.join(appPath, 'app', 'types') };
}
