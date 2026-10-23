#!/usr/bin/env node
/**
 * /status loop-health dashboard (task 5.4) — prints the CAC + first-pass +
 * token-burn + terminal-histogram + oversight report from runs.jsonl.
 *
 *   node .shiftstone/scripts/status-dashboard.js [root]
 *
 * The rendering lives in .shiftstone/observability/cac-aggregator.ts; this launcher
 * exists so markdown workflows can invoke it directly.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDashboard } from '../observability/cac-aggregator.ts';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const root = process.argv[2] ? path.resolve(process.argv[2]) : defaultRoot;
console.log(await buildDashboard(root));
