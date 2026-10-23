#!/usr/bin/env node
/**
 * Batch loop-spec refusal gate (blueprint §8.2, amendment A11).
 *
 *   node .shiftstone/scripts/validate-loop-specs.js           warn mode
 *   node .shiftstone/scripts/validate-loop-specs.js --strict  CI mode (exit 1)
 *
 * Validates every spec.md found in docs/loops/<name>/ and .loops/<name>/
 * against the Phase 1 validator (anti-patterns, A-checks, 5 terminal states,
 * A11 checklist).
 */

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSpecFile } from '../harness/loop-runner/loader.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function discoverSpecs() {
  const specs = [];
  for (const base of [path.join(ROOT, 'docs', 'loops'), path.join(ROOT, '.loops')]) {
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const spec = path.join(base, entry.name, 'spec.md');
      if (existsSync(spec)) specs.push(path.relative(ROOT, spec).replace(/\\/g, '/'));
    }
  }
  return specs;
}

export async function run({ strict = false } = {}) {
  const problems = [];
  const warnings = [];
  const specs = discoverSpecs();
  if (specs.length === 0) {
    problems.push('no loop specs found under docs/loops/ or .loops/');
    return { problems, warnings, specs: [], strict };
  }
  for (const rel of specs) {
    try {
      const result = await validateSpecFile(rel, { root: ROOT });
      for (const refusal of result.refusals) problems.push(`${rel}: ${refusal}`);
      for (const warning of result.warnings) warnings.push(`${rel}: ${warning}`);
      const failed = result.checklist.filter((item) => !item.pass);
      if (failed.length > 0) {
        warnings.push(`${rel}: A11 checklist FAIL — ${failed.map((f) => f.question).join('; ')}`);
      }
    } catch (error) {
      problems.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { problems, warnings, specs, strict };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const result = await run({ strict });
  for (const warning of result.warnings) console.log(`warn: ${warning}`);
  for (const problem of result.problems) console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  console.log(`validated ${result.specs.length} loop spec(s): ${result.problems.length} refusal(s)`);
  if (strict && result.problems.length > 0) process.exit(1);
}
