/**
 * rr8-supabase-cf folder hooks — pre-creates the folders this archetype's
 * code and skills assume (blueprint section 5.1: folder-hooks/ → apps/web/,
 * workers/). Runs before governance seeding.
 */

import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export function run(context) {
  const { root, composition, archetype } = context;
  const composed = composition.archetypes.find((a) => a.name === archetype.name) ?? archetype;
  const appPath = composed.effectiveAppPath ?? composed.manifest.spec.defaultAppPath;
  const created = [];
  for (const rel of [appPath, 'workers']) {
    if (rel === '.') continue;
    const full = path.join(root, rel);
    if (!existsSync(full)) {
      mkdirSync(full, { recursive: true });
      created.push(rel);
    }
  }
  if (created.length > 0) console.log(`   📁 folder hooks created: ${created.join(', ')}/`);
  return { created };
}
