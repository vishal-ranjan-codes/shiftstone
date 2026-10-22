#!/usr/bin/env node
/**
 * Skills manifest budget validator (blueprint §8.2, task 2.2/2.8).
 *
 *   node core/scripts/validate-manifest-budgets.js           warn mode
 *   node core/scripts/validate-manifest-budgets.js --strict  CI mode (exit 1)
 *
 * Checks:
 *   1. manifest validates against the context/v1 schema
 *   2. manifest spec.budget matches core/context/token-budget.json (no drift)
 *   3. always-load tokenCost fits the dynamic per-turn budget
 *   4. every skill on disk is 3-tier complete (SKILL.md + instructions.md)
 *   5. the generated Skill INDEX block in AGENTS.md lists every skill
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { validateManifest } from '../context/skills-loader.ts';
import { resolveSkillDir } from '../context/skill-paths.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function run({ strict = false } = {}) {
  const problems = [];
  const warnings = [];

  const budgetPath = path.join(ROOT, 'core', 'context', 'token-budget.json');
  const manifestPath = path.join(ROOT, 'core', 'context', 'skills-manifest.yaml');
  const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));

  let manifest;
  try {
    manifest = validateManifest(parseYaml(readFileSync(manifestPath, 'utf8')));
  } catch (error) {
    problems.push(`skills-manifest.yaml invalid: ${error instanceof Error ? error.message : String(error)}`);
    return { problems, warnings, strict, skills: 0 };
  }

  // 2. budget drift
  if (manifest.spec.budget.dynamic_max_tokens !== budget.dynamic_max_tokens) {
    problems.push(
      `manifest budget drift: spec.budget.dynamic_max_tokens=${manifest.spec.budget.dynamic_max_tokens} but token-budget.json says ${budget.dynamic_max_tokens} (rerun generate-skills-manifest.js)`,
    );
  }
  if (manifest.spec.budget.static_max_lines !== budget.static_max_lines) {
    problems.push(
      `manifest budget drift: spec.budget.static_max_lines=${manifest.spec.budget.static_max_lines} but token-budget.json says ${budget.static_max_lines}`,
    );
  }

  // 3. always-load fits per-turn budget
  const alwaysCost = manifest.spec.skills
    .filter((s) => s.tier === 'always-load')
    .reduce((sum, s) => sum + s.tokenCost, 0);
  if (alwaysCost > budget.dynamic_max_tokens) {
    problems.push(
      `always-load skills cost ${alwaysCost} tokens > dynamic budget ${budget.dynamic_max_tokens}`,
    );
  }

  // 4. 3-tier completeness on disk (task 2.3 verification: loader resolves all)
  for (const skill of manifest.spec.skills) {
    const dir = resolveSkillDir(ROOT, skill.name);
    if (dir === null) {
      problems.push(`${skill.name}: no skill directory found (.agents/skills or active packs)`);
      continue;
    }
    if (!existsSync(path.join(dir, 'SKILL.md'))) {
      problems.push(`${skill.name}: SKILL.md missing`);
    }
    if (!existsSync(path.join(dir, 'instructions.md'))) {
      problems.push(`${skill.name}: instructions.md missing (run convert-skills-3tier.js)`);
    }
    if (skill.tokenCost < 1) problems.push(`${skill.name}: tokenCost must be >= 1`);
    if (skill.tokenCost > budget.dynamic_max_tokens / 2) {
      warnings.push(`${skill.name}: tokenCost ${skill.tokenCost} exceeds half the per-turn budget`);
    }
  }

  // 5. generated INDEX in AGENTS.md lists every skill
  const agents = readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');
  const indexMatch = /<!-- SKILL-INDEX:BEGIN -->([\s\S]*?)<!-- SKILL-INDEX:END -->/.exec(agents);
  if (!indexMatch) {
    problems.push('AGENTS.md missing SKILL-INDEX markers');
  } else {
    const index = indexMatch[1];
    for (const skill of manifest.spec.skills) {
      if (!index.includes(skill.name)) {
        problems.push(`AGENTS.md Skill INDEX does not list "${skill.name}" (rerun generate-skills-manifest.js)`);
      }
    }
  }

  return { problems, warnings, strict, skills: manifest.spec.skills.length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const result = run({ strict });
  for (const warning of result.warnings) console.log(`warn: ${warning}`);
  for (const problem of result.problems) console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  console.log(`checked ${result.skills} skill(s): ${result.problems.length} problem(s)`);
  if (strict && result.problems.length > 0) process.exit(1);
}
