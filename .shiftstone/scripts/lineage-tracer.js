#!/usr/bin/env node
/**
 * Lineage / semantic-debug tracer CLI (task 5.10, amendment C10).
 *
 *   node .shiftstone/scripts/lineage-tracer.js <deliverable.md> [--root <path>] [--base <ref>]
 *
 * Walks relative links backward from the deliverable through stage outputs to
 * sources, git-diffs the per-stage files, and prints the first divergent stage
 * plus the suspect CONTEXT.md line.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderLineage, traceLineage } from '../observability/lineage-tracer.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const deliverable = positional[0];
if (!deliverable) {
  console.error('usage: node .shiftstone/scripts/lineage-tracer.js <deliverable.md> [--root <path>] [--base <ref>]');
  process.exit(2);
}
const rootFlag = args.indexOf('--root');
const baseFlag = args.indexOf('--base');
const root = rootFlag >= 0 ? path.resolve(args[rootFlag + 1]) : defaultRoot;
const baseRef = baseFlag >= 0 ? args[baseFlag + 1] : undefined;

try {
  const report = await traceLineage(deliverable, { root, baseRef });
  console.log(renderLineage(report));
  process.exit(report.clean ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
