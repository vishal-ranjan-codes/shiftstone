#!/usr/bin/env node
/**
 * Static-context budget reporter (amendment B9) — the /lesson pre-append
 * check. Counts the always-loaded static context (AGENTS.md + one IDE shim +
 * core/static-rules activation:always files) against static_max_lines from
 * core/context/token-budget.json (200).
 *
 *   node core/scripts/check-rule-budget.js           report + near-budget warning
 *   node core/scripts/check-rule-budget.js --strict  exit 1 when over budget
 *
 * Warning band: >= 90% of the cap. Lessons must merge/trim before appending
 * when the report is not "ok".
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lineCount } from './check-md-duplication.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WARN_RATIO = 0.9;

/** @returns {{files: Record<string, number>, per_ide: Record<string, number>, total: number, cap: number, ratio: number, level: 'ok'|'warn'|'over'}} */
export function report(root = ROOT) {
  const budget = JSON.parse(readFileSync(path.join(root, 'core', 'context', 'token-budget.json'), 'utf8'));
  const files = {};
  const shims = {};

  const agents = path.join(root, 'AGENTS.md');
  const agentsLines = existsSync(agents) ? lineCount(readFileSync(agents, 'utf8')) : 0;
  if (existsSync(agents)) files['AGENTS.md'] = agentsLines;

  for (const shim of Object.keys(budget.shim_max_lines ?? {})) {
    if (shim === 'AGENTS.md') continue;
    const abs = path.join(root, shim);
    if (existsSync(abs)) {
      files[shim] = lineCount(readFileSync(abs, 'utf8'));
      shims[shim] = files[shim];
    }
  }

  let ruleLines = 0;
  const rulesDir = path.join(root, 'core', 'static-rules');
  if (existsSync(rulesDir)) {
    for (const name of readdirSync(rulesDir).sort()) {
      if (!name.endsWith('.md')) continue;
      const content = readFileSync(path.join(rulesDir, name), 'utf8');
      if (/^---[\s\S]*?activation:\s*always[\s\S]*?---/.test(content)) {
        files[`core/static-rules/${name}`] = lineCount(content);
        ruleLines += files[`core/static-rules/${name}`];
      }
    }
  }

  // The cap is PER IDE: AGENTS.md + that IDE's shim + the always-on rules
  // (same math as check-md-duplication.js). The governing total is the worst IDE.
  const perIde = Object.fromEntries(
    Object.entries(shims).map(([shim, lines]) => [shim, agentsLines + lines + ruleLines]),
  );
  const total = Math.max(agentsLines + ruleLines, ...Object.values(perIde));
  const cap = budget.static_max_lines;
  const ratio = cap > 0 ? total / cap : 1;
  const level = total > cap ? 'over' : ratio >= WARN_RATIO ? 'warn' : 'ok';
  return { files, per_ide: perIde, total, cap, ratio, level };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const ci = process.argv.includes('--ci');
  const result = report();
  for (const [file, count] of Object.entries(result.files)) {
    console.log(`  ${String(count).padStart(4)} lines  ${file}`);
  }
  const percent = Math.round(result.ratio * 100);
  console.log(`static budget: ${result.total}/${result.cap} lines (${percent}%)`);
  if (result.level === 'over') {
    console.warn(`WARN: static context is OVER budget — trim or merge a rule before appending (/lesson refuses to append)`);
  } else if (result.level === 'warn') {
    console.warn(
      `WARN: static context is at ${percent}% of the ${result.cap}-line budget — ` +
        'a new /lesson rule requires merging or compressing an existing one first',
    );
  }
  if (ci) {
    if (result.level === 'over') {
      console.error(`FAIL: static context (${result.total} lines) exceeds ${result.cap}-line budget`);
      process.exit(1);
    }
    console.log(`ok — always-on static context is within ${result.cap}-line budget (${result.total}/${result.cap})`);
    process.exit(0);
  }
  if (strict && result.level === 'over') process.exit(1);
}
