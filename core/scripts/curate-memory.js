#!/usr/bin/env node
/**
 * Loop memory curation CLI (task 5.6).
 *
 *   node core/scripts/curate-memory.js <loop-id> [--n <runs>] [--dry-run] [--root <path>]
 *
 * Prunes evidence-free lessons from .loops/<loop>/lessons.md when CAC did not
 * improve over the observation window. See docs/loops/_template/lessons.md.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { curateLessons } from '../harness/memory/curate.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const loop = positional[0];
if (!loop) {
  console.error('usage: node core/scripts/curate-memory.js <loop-id> [--n <runs>] [--dry-run] [--root <path>]');
  process.exit(2);
}
const nFlag = args.indexOf('--n');
const n = nFlag >= 0 ? Number(args[nFlag + 1]) : undefined;
const rootFlag = args.indexOf('--root');
const root = rootFlag >= 0 ? path.resolve(args[rootFlag + 1]) : defaultRoot;
const dryRun = args.includes('--dry-run');

if (n !== undefined && (!Number.isInteger(n) || n < 1)) {
  console.error('--n must be a positive integer');
  process.exit(2);
}

const report = await curateLessons({ root, loop, n, dryRun });
if (report.decisions.length === 0) {
  console.log(`curate ${loop}: no lessons found (nothing to prune)`);
  process.exit(0);
}
for (const decision of report.decisions) {
  console.log(`  [${decision.kept ? 'keep' : 'DROP'}] ${decision.id} — ${decision.title}: ${decision.reason}`);
}
console.log(
  `curate ${loop}: ${report.decisions.length - report.dropped} kept, ${report.dropped} dropped` +
    `${dryRun ? ' (dry run — not written)' : report.written ? ' — lessons.md rewritten' : ''}`,
);
