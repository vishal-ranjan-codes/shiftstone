#!/usr/bin/env node
/**
 * Index generator CLI.
 *
 *   node .shiftstone/governance/index.js            regenerate docs index files
 *                                             + the bundle-root indexes below
 *   node .shiftstone/governance/index.js --check    CI: exit 1 on missing/stale indexes
 *
 * The docs tree is walked recursively; knowledge bundles outside `docs/`
 * (packs, skills) get a SHALLOW root index only (Phase 6.7 — every bundle
 * carries index.md + log.md). No recursion into packs/<pack>/ or the skill
 * dirs: their catalogs stay the pack registry and the skills manifest
 * (blueprint §6.6 forbids a second skill index).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAll, generateAll, generateOne } from './index-generator.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const docsRoot = path.join(ROOT, 'docs');
const BUNDLE_ROOTS = [path.join('.shiftstone', 'packs'), path.join('.agents', 'skills')];
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const result = await checkAll(docsRoot);
  for (const file of result.missing) console.error(`missing index: docs/${file}`);
  for (const file of result.stale) console.error(`stale index:   docs/${file}`);
  let bad = result.missing.length + result.stale.length;
  for (const rel of BUNDLE_ROOTS) {
    const bundle = await generateOne(path.join(ROOT, rel), { write: false });
    if (bundle.skipped) continue;
    if (bundle.missing) {
      console.error(`missing index: ${rel}/index.md`);
      bad += 1;
    } else if (bundle.stale) {
      console.error(`stale index:   ${rel}/index.md`);
      bad += 1;
    }
  }
  if (bad > 0) {
    console.error('run: node .shiftstone/governance/index.js');
    process.exit(1);
  }
  console.log('ok — every docs directory and knowledge bundle has a fresh index.md');
} else {
  const result = await generateAll(docsRoot);
  for (const file of result.generated) console.log(`wrote docs/${file}`);
  console.log(
    `done — ${result.generated.length} index file(s) written (${result.missing.length} new, ${result.stale.length} refreshed)`,
  );
  for (const rel of BUNDLE_ROOTS) {
    const bundle = await generateOne(path.join(ROOT, rel));
    if (bundle.skipped) console.log(`skip — ${rel}/ has no indexable content`);
    else if (bundle.written) console.log(`wrote ${rel}/index.md`);
    else console.log(`no changes — ${rel}/index.md already fresh`);
  }
}
