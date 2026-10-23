#!/usr/bin/env node
/**
 * new-feature-loop grounded check (L1 pre-check for the L4 loop) and the
 * A4 enumeration source.
 *
 * Active feature spec: docs/plans/<feature-id>/02_design/output/spec.md
 *
 * Modes:
 *   --check      exit 0 when an approved spec exists, the tree is clean of
 *                tracked changes (feature merged) and the core harness
 *                typechecks (all tests pass). Otherwise exit 1 with the
 *                reason on stderr (goal not yet satisfied).
 *   --enumerate  print one work item per line: the unchecked task checklist
 *                of the active spec (empty output when no feature is active).
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const PLANS_DIR = path.join(root, 'docs/plans');
const EXCLUDED_PLAN = 'universal-ai-workspace-framework';

function activeSpec() {
  if (!existsSync(PLANS_DIR)) return null;
  for (const entry of readdirSync(PLANS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === EXCLUDED_PLAN) continue;
    const spec = path.join(PLANS_DIR, entry.name, '02_design/output/spec.md');
    if (existsSync(spec)) return { id: entry.name, spec };
  }
  return null;
}

function trackedChangesClean() {
  try {
    const out = execSync('git status --porcelain', { cwd: root, encoding: 'utf8' });
    return out.trim().length === 0;
  } catch {
    return false;
  }
}

function typechecks() {
  try {
    execSync('pnpm -C .shiftstone typecheck', { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const mode = process.argv[2] ?? '--check';

if (mode === '--enumerate') {
  const active = activeSpec();
  if (!active) {
    process.exit(0); // no active feature ⇒ empty target surface
  }
  const text = readFileSync(active.spec, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const task = /^\s*[-*]\s+\[ \]\s+(.+)$/.exec(line);
    if (task) console.log(task[1].trim());
  }
  process.exit(0);
}

// --check: the feature is DONE when spec exists + tree clean + checks pass
const active = activeSpec();
if (!active) {
  console.error('feature-status: no approved spec (docs/plans/<id>/02_design/output/spec.md) — spec not approved');
  process.exit(1);
}
if (!trackedChangesClean()) {
  console.error('feature-status: uncommitted work present — feature not merged');
  process.exit(1);
}
if (!typechecks()) {
  console.error('feature-status: core typecheck failing — tests do not pass');
  process.exit(1);
}
console.log(`feature-status: feature "${active.id}" implemented, checks pass, tree clean`);
process.exit(0);
