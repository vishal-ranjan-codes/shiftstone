#!/usr/bin/env node
/**
 * ShiftStone Engine Bi-Directional Synchronization Tool (DEC-014)
 *
 * Synchronizes universal engine code between the Parent Lab Hub
 * (`shiftstone-workspace/.shiftstone/`) and the Public Child Framework
 * (`frameworks/shiftstone/.shiftstone/`).
 *
 * Features:
 *   - Bi-directional: --direction=outward (Lab -> Framework) or --direction=inward (Framework -> Lab)
 *   - Safe preview: --dry-run (computes diffs and statistics without writing)
 *   - CI gate: --check (exits 0 on zero drift, 1 on detected drift)
 *   - Targeted sync: --path=<subpath> (sync specific file or directory)
 *   - Boundary protection: Prevents accidental overwriting of environment-specific files
 *     (workspace manifests, product identity rules, package.json, bible records)
 *
 * Usage:
 *   node .shiftstone/scripts/sync-engine.js --dry-run
 *   node .shiftstone/scripts/sync-engine.js --direction=outward
 *   node .shiftstone/scripts/sync-engine.js --direction=inward
 *   node .shiftstone/scripts/sync-engine.js --check
 *   node .shiftstone/scripts/sync-engine.js --path=scripts/validate-workspace.js
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PARENT_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
export const DEFAULT_CHILD_ROOT = path.join(DEFAULT_PARENT_ROOT, 'frameworks', 'shiftstone');

/**
 * Directories within .shiftstone/ that represent 100% shared universal engine logic.
 */
export const UNIVERSAL_SYNC_AREAS = [
  'scripts',
  'harness',
  'context',
  'init',
  'observability',
  'tests',
  'governance/schemas',
  'governance/checker-lenses',
  'vitest.config.ts',
  'tsconfig.json',
];

/**
 * Patterns and files that MUST NOT be blindly copied across the lab-framework boundary.
 * These files contain role-specific configurations, template placeholders, or unique state.
 */
export const PROTECTED_BOUNDARY_PATTERNS = [
  /\.shiftstone[\\/]governance[\\/]workspace-manifest\.json$/,
  /\.shiftstone[\\/]governance[\\/]implementation-status\.json$/,
  /\.shiftstone[\\/]static-rules[\\/]product\.md$/,
  /\.shiftstone[\\/]static-rules[\\/]global\.md$/,
  /\.shiftstone[\\/]path-scoped-rules[\\/]bible-rules\.md$/,
  /package\.json$/,
  /pnpm-lock\.yaml$/,
  /AGENTS\.md$/,
  /ANTIGRAVITY\.md$/,
  /CLAUDE\.md$/,
  /COMMANDCODE\.md$/,
  /opencode\.json$/,
  /docs[\\/]bible/,
  /docs[\\/]decisions/,
];

export function isProtected(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  return PROTECTED_BOUNDARY_PATTERNS.some((pattern) => pattern.test(norm) || pattern.test(relPath));
}

function walkFiles(dir, baseDir = dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...walkFiles(full, baseDir));
      }
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      files.push(rel);
    }
  }
  return files;
}

export function computeEngineDiff(options = {}) {
  const parentRoot = options.parentRoot ? path.resolve(options.parentRoot) : DEFAULT_PARENT_ROOT;
  const childRoot = options.childRoot ? path.resolve(options.childRoot) : DEFAULT_CHILD_ROOT;
  const direction = options.direction || 'outward'; // 'outward' (parent -> child) or 'inward' (child -> parent)
  const pathFilter = options.pathFilter ? options.pathFilter.replace(/\\/g, '/').replace(/^\.shiftstone\/?/, '') : null;

  const srcBase = direction === 'outward'
    ? path.join(parentRoot, '.shiftstone')
    : path.join(childRoot, '.shiftstone');
  const dstBase = direction === 'outward'
    ? path.join(childRoot, '.shiftstone')
    : path.join(parentRoot, '.shiftstone');

  const result = {
    direction,
    srcBase,
    dstBase,
    identical: [],
    created: [],
    updated: [],
    protectedSkipped: [],
    errors: [],
  };

  if (!existsSync(srcBase)) {
    result.errors.push(`Source engine directory does not exist: ${srcBase}`);
    return result;
  }
  if (!existsSync(dstBase)) {
    result.errors.push(`Target engine directory does not exist: ${dstBase}`);
    return result;
  }

  // Determine areas to scan
  const areasToScan = pathFilter
    ? [pathFilter]
    : UNIVERSAL_SYNC_AREAS;

  const relativeFiles = new Set();
  for (const area of areasToScan) {
    const srcArea = path.join(srcBase, area);
    if (!existsSync(srcArea)) continue;

    const stat = statSync(srcArea);
    if (stat.isDirectory()) {
      for (const rel of walkFiles(srcArea, srcBase)) {
        relativeFiles.add(rel);
      }
    } else {
      relativeFiles.add(area);
    }
  }

  for (const rel of relativeFiles) {
    const fullRel = path.join('.shiftstone', rel);
    if (isProtected(fullRel)) {
      result.protectedSkipped.push(rel);
      continue;
    }

    const srcFile = path.join(srcBase, rel);
    const dstFile = path.join(dstBase, rel);

    if (!existsSync(dstFile)) {
      result.created.push({
        rel,
        src: srcFile,
        dst: dstFile,
      });
      continue;
    }

    try {
      const srcBuf = readFileSync(srcFile);
      const dstBuf = readFileSync(dstFile);
      if (srcBuf.equals(dstBuf)) {
        result.identical.push(rel);
      } else {
        result.updated.push({
          rel,
          src: srcFile,
          dst: dstFile,
          bytesDiff: srcBuf.length - dstBuf.length,
        });
      }
    } catch (err) {
      result.errors.push(`Error reading file ${rel}: ${err.message}`);
    }
  }

  return result;
}

export function syncEngine(options = {}) {
  const diff = computeEngineDiff(options);
  const dryRun = Boolean(options.dryRun);
  const checkOnly = Boolean(options.check);

  const stats = {
    direction: diff.direction,
    dryRun,
    checkOnly,
    identical: diff.identical.length,
    created: diff.created.length,
    updated: diff.updated.length,
    protectedSkipped: diff.protectedSkipped.length,
    errors: diff.errors,
    actionsApplied: 0,
  };

  if (diff.errors.length > 0) {
    return { ok: false, stats, diff };
  }

  if (checkOnly) {
    const inSync = diff.created.length === 0 && diff.updated.length === 0;
    return { ok: inSync, stats, diff };
  }

  if (!dryRun) {
    // Apply additions and updates
    for (const item of [...diff.created, ...diff.updated]) {
      const targetDir = path.dirname(item.dst);
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      copyFileSync(item.src, item.dst);
      stats.actionsApplied++;
    }
  }

  return { ok: true, stats, diff };
}

// CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const check = args.includes('--check');

  let direction = 'outward';
  for (const arg of args) {
    if (arg.startsWith('--direction=')) {
      direction = arg.split('=')[1].trim();
    }
  }

  let pathFilter = null;
  for (const arg of args) {
    if (arg.startsWith('--path=')) {
      pathFilter = arg.split('=')[1].trim();
    }
  }

  if (direction !== 'outward' && direction !== 'inward') {
    console.error(`error: invalid direction "${direction}". Use "outward" (Lab -> Framework) or "inward" (Framework -> Lab).`);
    process.exit(1);
  }

  const label = direction === 'outward'
    ? 'Parent Lab (shiftstone-workspace) → Child Framework (frameworks/shiftstone)'
    : 'Child Framework (frameworks/shiftstone) → Parent Lab (shiftstone-workspace)';

  console.log('========================================================================');
  console.log(' ShiftStone Bi-Directional Engine Synchronization (DEC-014)');
  console.log('========================================================================');
  console.log(` Direction: ${label}`);
  console.log(` Mode:      ${check ? 'CHECK (CI)' : dryRun ? 'DRY RUN (Preview)' : 'APPLY'}`);
  if (pathFilter) {
    console.log(` Filter:    ${pathFilter}`);
  }
  console.log('');

  const result = syncEngine({ direction, dryRun, check, pathFilter });

  if (result.stats.errors.length > 0) {
    for (const err of result.stats.errors) {
      console.error(`ERROR: ${err}`);
    }
    process.exit(1);
  }

  console.log('--- Summary ---');
  console.log(`  Identical files:     ${result.stats.identical}`);
  console.log(`  Files to create:     ${result.stats.created}`);
  console.log(`  Files to update:     ${result.stats.updated}`);
  console.log(`  Protected (skipped): ${result.stats.protectedSkipped}`);
  console.log('');

  if (result.diff.created.length > 0) {
    console.log('➕ Created files:');
    for (const f of result.diff.created) {
      console.log(`  + .shiftstone/${f.rel}`);
    }
    console.log('');
  }

  if (result.diff.updated.length > 0) {
    console.log('🔄 Updated files:');
    for (const f of result.diff.updated) {
      console.log(`  ~ .shiftstone/${f.rel} (${f.bytesDiff >= 0 ? '+' : ''}${f.bytesDiff} bytes)`);
    }
    console.log('');
  }

  if (check) {
    if (!result.ok) {
      console.error(`FAIL: Drift detected between engines (${result.stats.created} creates, ${result.stats.updated} updates). Run with --dry-run or apply.`);
      process.exit(1);
    } else {
      console.log('PASS: Engine directories are 100% in sync.');
      process.exit(0);
    }
  }

  if (dryRun) {
    console.log('Dry run complete. No files written.');
  } else {
    console.log(`Successfully synchronized ${result.stats.actionsApplied} file(s).`);
  }
}
