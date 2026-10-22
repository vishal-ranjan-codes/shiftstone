#!/usr/bin/env node
/**
 * Zero-Duplication OS Directory Junction Setup & Health Validator (UG-04, UG-05 / Phase 1 Unit U3)
 *
 * Establishes and verifies OS directory junctions from IDE skills folders to canonical .agents/skills:
 *   - .claude/skills -> .agents/skills
 *   - .commandcode/skills -> .agents/skills
 *
 * Removes and blocks deprecated legacy workflow junctions:
 *   - .agent/workflows, .claude/commands, .commandcode/commands, .opencode/commands
 *
 * Usage:
 *   node core/scripts/setup-ide-junctions.js           # create junctions & remove legacy dirs
 *   node core/scripts/setup-ide-junctions.js --verify  # verify health, exit 1 on defect
 */

import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SKILL_JUNCTIONS = [
  { link: '.claude/skills', target: '.agents/skills' },
  { link: '.commandcode/skills', target: '.agents/skills' },
];

export const DEPRECATED_SLOTS = [
  '.agent/workflows',
  '.claude/commands',
  '.commandcode/commands',
  '.opencode/commands',
];

export function isJunctionOrSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

export function setupIdeJunctions(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const targetType = process.platform === 'win32' ? 'junction' : 'dir';
  const actions = [];

  // 1. Clean up deprecated legacy workflow slots
  for (const slot of DEPRECATED_SLOTS) {
    const slotPath = path.join(root, slot);
    if (existsSync(slotPath) || isJunctionOrSymlink(slotPath)) {
      rmSync(slotPath, { recursive: true, force: true });
      actions.push({ action: 'removed_deprecated', path: slot });
    }
  }

  // 2. Ensure canonical target exists
  const canonicalSkillsAbs = path.join(root, '.agents', 'skills');
  if (!existsSync(canonicalSkillsAbs)) {
    mkdirSync(canonicalSkillsAbs, { recursive: true });
    actions.push({ action: 'created_canonical_target', path: '.agents/skills' });
  }

  // 3. Create or fix skill junctions
  for (const { link, target } of SKILL_JUNCTIONS) {
    const linkAbs = path.join(root, link);
    const targetAbs = path.join(root, target);
    const parentDir = path.dirname(linkAbs);

    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true });
    }

    if (existsSync(linkAbs) || isJunctionOrSymlink(linkAbs)) {
      if (isJunctionOrSymlink(linkAbs)) {
        try {
          const resolved = realpathSync(linkAbs);
          const targetResolved = realpathSync(targetAbs);
          if (resolved.toLowerCase() === targetResolved.toLowerCase()) {
            actions.push({ action: 'already_healthy', path: link });
            continue;
          }
        } catch {
          // Broken symlink/junction, will recreate below
        }
      }
      rmSync(linkAbs, { recursive: true, force: true });
    }

    symlinkSync(targetAbs, linkAbs, targetType);
    actions.push({ action: 'created_junction', path: link, target });
  }

  return { ok: true, actions };
}

export function verifyIdeJunctions(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const problems = [];
  const status = [];

  // 1. Verify deprecated workflow slots do NOT exist
  for (const slot of DEPRECATED_SLOTS) {
    const slotPath = path.join(root, slot);
    if (existsSync(slotPath) || isJunctionOrSymlink(slotPath)) {
      problems.push({
        code: 'DEPRECATED_LEGACY_DIRECTORY_EXISTS',
        path: slot,
        message: `Deprecated legacy workflow directory '${slot}' exists on disk; all workflows migrate to .agents/skills/ (UG-04, UG-31)`,
      });
    }
  }

  // 2. Verify skills junctions
  const canonicalSkillsAbs = path.join(root, '.agents', 'skills');
  if (!existsSync(canonicalSkillsAbs)) {
    problems.push({
      code: 'MISSING_CANONICAL_SKILLS',
      path: '.agents/skills',
      message: 'Canonical .agents/skills directory does not exist on disk',
    });
  } else {
    const canonicalResolved = realpathSync(canonicalSkillsAbs);

    for (const { link } of SKILL_JUNCTIONS) {
      const linkAbs = path.join(root, link);
      if (!existsSync(linkAbs) && !isJunctionOrSymlink(linkAbs)) {
        problems.push({
          code: 'MISSING_JUNCTION',
          path: link,
          message: `Required IDE junction '${link}' is missing`,
        });
        continue;
      }

      if (!isJunctionOrSymlink(linkAbs)) {
        problems.push({
          code: 'NOT_A_JUNCTION_DUPLICATION_RISK',
          path: link,
          message: `'${link}' is a real folder of duplicated files instead of an OS directory junction`,
        });
        continue;
      }

      try {
        const resolved = realpathSync(linkAbs);
        if (resolved.toLowerCase() !== canonicalResolved.toLowerCase()) {
          problems.push({
            code: 'JUNCTION_TARGET_MISMATCH',
            path: link,
            expected: canonicalResolved,
            actual: resolved,
            message: `'${link}' resolves to '${resolved}' instead of '${canonicalResolved}'`,
          });
        } else {
          status.push({ link, ok: true, target: canonicalResolved });
        }
      } catch (err) {
        problems.push({
          code: 'BROKEN_JUNCTION',
          path: link,
          message: `'${link}' is a broken junction: ${err.message}`,
        });
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    status,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const verifyMode = process.argv.includes('--verify');
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  if (verifyMode) {
    const check = verifyIdeJunctions({ root: rootArg });
    console.log('=== IDE Junction Health Verification Report (UG-04, UG-05) ===');
    for (const s of check.status) {
      console.log(`  ✓ ${s.link} -> .agents/skills`);
    }
    if (!check.ok) {
      console.error('\nFAIL — IDE Junction defects detected:');
      for (const p of check.problems) {
        console.error(`  [${p.code}] ${p.message}`);
      }
      process.exit(1);
    }
    console.log('\nok — All IDE junctions are healthy OS links and zero legacy workflow directories exist.');
    process.exit(0);
  } else {
    const result = setupIdeJunctions({ root: rootArg });
    console.log('=== IDE Junction Setup (UG-04) ===');
    for (const a of result.actions) {
      console.log(`  ${a.action}: ${a.path}`);
    }
    console.log('\nok — OS directory junctions created.');
    process.exit(0);
  }
}
