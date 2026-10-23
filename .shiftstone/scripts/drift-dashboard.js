#!/usr/bin/env node
/**
 * Drift dashboard CLI (task 5.11, amendment C10).
 *
 *   node .shiftstone/scripts/drift-dashboard.js [deliverable.md ...] [--root <path>] [--max-age <days>]
 *
 * Shows the drift ENTRY POINT (lineage tracer) for every deliverable plus the
 * staleness table for every bible chapter. Exits 1 when any deliverable
 * carries content/structural drift.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDriftDashboard, renderDriftDashboard } from '../observability/drift-dashboard.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const positional = [];
let root = defaultRoot;
let maxAge;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--root') {
    root = path.resolve(args[i + 1]);
    i += 1;
  } else if (args[i] === '--max-age') {
    maxAge = Number(args[i + 1]);
    i += 1;
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i]);
  }
}
if (maxAge !== undefined && (!Number.isFinite(maxAge) || maxAge < 0)) {
  console.error('--max-age must be a non-negative number of days');
  process.exit(2);
}

const input = await buildDriftDashboard(root, {
  deliverables: positional.length > 0 ? positional : undefined,
  maxAgeDays: maxAge,
});
console.log(renderDriftDashboard(input));
process.exit(input.lineage.some((report) => !report.clean) ? 1 : 0);
