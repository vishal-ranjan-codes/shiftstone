#!/usr/bin/env node
/**
 * Evals CLI (B1) — the CI gate entry point.
 *
 *   node core/harness/evals/run.js                 all suites, warn mode
 *   node core/harness/evals/run.js --suite <name>   one suite
 *   node core/harness/evals/run.js --strict         CI mode (exit 1 on regression)
 *   node core/harness/evals/run.js --json           machine-readable report
 *   node core/harness/evals/run.js --root <dir>     workspace root (tests)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runEvals } from './runner.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..', '..', '..');

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export async function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict');
  const json = argv.includes('--json');
  const suiteIndex = argv.indexOf('--suite');
  const suite = suiteIndex >= 0 ? argv[suiteIndex + 1] : undefined;
  const rootIndex = argv.indexOf('--root');
  const root = path.resolve(rootIndex >= 0 ? argv[rootIndex + 1] : DEFAULT_ROOT);

  const report = await runEvals({ root, suites: suite ? [suite] : undefined });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const suiteOutcome of report.suites) {
      const status = suiteOutcome.ok ? 'PASS' : 'REGRESSED';
      console.log(
        `${status}  ${suiteOutcome.name}: ${suiteOutcome.passed}/${suiteOutcome.total - suiteOutcome.skipped} scorable` +
          `${suiteOutcome.skipped ? `, ${suiteOutcome.skipped} skipped` : ''} ` +
          `(pass rate ${(suiteOutcome.pass_rate * 100).toFixed(0)}%, min ${Math.round(suiteOutcome.min_pass_rate * 100)}%)`,
      );
      for (const c of suiteOutcome.cases) {
        if (c.skipped) console.log(`  skip  ${c.case_id}: ${c.detail}`);
        else if (!c.passed) console.log(`  FAIL  ${c.case_id}: ${c.detail}`);
      }
    }
    console.log(
      `evals: ${report.suites.length} suite(s), results appended to ${path.relative(root, report.results_file).replace(/\\/g, '/')}`,
    );
    if (!report.ok) console.log(strict ? 'FAIL: eval regression detected' : 'warn: eval regression detected (run with --strict to gate)');
  }

  if (strict && !report.ok) return 1;
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = await main();
}
