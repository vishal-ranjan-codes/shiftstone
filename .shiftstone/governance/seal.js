#!/usr/bin/env node
/**
 * Stage seal CLI.
 *
 *   node .shiftstone/governance/seal.js <stage-dir>          validate + seal
 *   node .shiftstone/governance/seal.js <stage-dir> --check  validate only
 */

import { validateStage, sealStage } from './stage-seal.ts';

const [stageDir, flag] = process.argv.slice(2);
if (!stageDir) {
  console.error('usage: node .shiftstone/governance/seal.js <stage-dir> [--check]');
  process.exit(2);
}

const report = flag === '--check' ? await validateStage(stageDir) : await sealStage(stageDir);

if (report.sealed) {
  console.log(`sealed:  ${report.stageDir}`);
  for (const output of report.outputs) console.log(`  ✓ ${output}`);
  process.exit(0);
}
console.error(`NOT sealed: ${report.stageDir}`);
for (const problem of report.problems) console.error(`  ✗ ${problem.file}: ${problem.problem}`);
process.exit(1);
