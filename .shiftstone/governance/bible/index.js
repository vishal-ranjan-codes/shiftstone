#!/usr/bin/env node
/**
 * Bible README ToC CLI (task 6.2).
 *
 *   node .shiftstone/governance/bible/index.js            regenerate docs/bible/README.md ToC
 *   node .shiftstone/governance/bible/index.js --check    CI: exit 1 when the ToC is stale
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, generate } from './index-generator.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const bibleDir = path.join(ROOT, 'docs', 'bible');
const checkOnly = process.argv.includes('--check');

if (checkOnly) {
  const result = await check(bibleDir);
  if (result.stale) {
    console.error('stale ToC: docs/bible/README.md does not match chapter frontmatter');
    console.error('run: node .shiftstone/governance/bible/index.js');
    process.exit(1);
  }
  console.log(`ok — bible README ToC is fresh (${result.rows} rows)`);
} else {
  const result = await generate(bibleDir);
  if (result.written) console.log(`wrote docs/bible/README.md ToC (${result.rows} rows)`);
  else console.log(`no changes — bible README ToC already fresh (${result.rows} rows)`);
}
