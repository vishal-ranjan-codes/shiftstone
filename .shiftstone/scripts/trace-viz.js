#!/usr/bin/env node
/**
 * Run-trace visualizer CLI (task 5.7).
 *
 *   node .shiftstone/scripts/trace-viz.js <loop-id> [--root <path>]
 *
 * Prints the latest run of <loop-id> as a Mermaid DAG of turns.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTrace, renderMermaid } from '../observability/trace-viz.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const loop = positional[0];
if (!loop) {
  console.error('usage: node .shiftstone/scripts/trace-viz.js <loop-id> [--root <path>]');
  process.exit(2);
}
const rootFlag = args.indexOf('--root');
const root = rootFlag >= 0 ? path.resolve(args[rootFlag + 1]) : defaultRoot;

const trace = await loadTrace(root, loop);
if (!trace) {
  console.error(`no run state found for ${loop} under ${path.join(root, '.loops')}`);
  process.exit(1);
}
console.log(renderMermaid(trace));
