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
 *   - Templated rule areas: static-rules/ and path-scoped-rules/ are compared and
 *     written through an identity-token template, so governance content diffs on
 *     substance instead of on the lab's product name (REQ-08 / audit W5)
 *
 * Usage:
 *   node .shiftstone/scripts/sync-engine.js --dry-run
 *   node .shiftstone/scripts/sync-engine.js --direction=outward
 *   node .shiftstone/scripts/sync-engine.js --direction=inward
 *   node .shiftstone/scripts/sync-engine.js --check
 *   node .shiftstone/scripts/sync-engine.js --path=scripts/validate-workspace.js
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  'governance',
  'ide-shims',
  'packs',
  'static-rules',
  'path-scoped-rules',
  'schemas',
  'migrate-v1-to-v2.js',
  'vitest.config.ts',
  'tsconfig.json',
];

/**
 * Sync areas whose files carry a product-identity token. Compared and written
 * through the template below so that a rule edited in the lab propagates on the
 * strength of its governance content, not because the child's heading differs.
 */
export const TEMPLATED_SYNC_AREAS = ['static-rules', 'path-scoped-rules'];

export const CHILD_PROJECT_PLACEHOLDER = '{{PROJECT_NAME}}';
export const LAB_IDENTITY = 'ShiftStone Engineering Hub';

/** Longest token first — the hub name must not degrade to the bare-name rule. */
const LAB_IDENTITY_TOKENS = ['ShiftStone Engineering Hub', 'shiftstone-workspace', 'ShiftStone'];

export function isTemplatedArea(relPath) {
  const norm = String(relPath).replace(/\\/g, '/').replace(/^\.shiftstone\//, '');
  return TEMPLATED_SYNC_AREAS.some((area) => norm === area || norm.startsWith(`${area}/`));
}

/** Lab identity → the child's placeholder form. Idempotent on placeholder text. */
export function toPlaceholderForm(content) {
  let out = String(content);
  for (const token of LAB_IDENTITY_TOKENS) out = out.split(token).join(CHILD_PROJECT_PLACEHOLDER);
  return out;
}

/** Child placeholder → lab identity, for inward propagation of a child-side fix. */
export function toLabIdentity(content) {
  return String(content).split(CHILD_PROJECT_PLACEHOLDER).join(LAB_IDENTITY);
}

export function renderForDirection(content, direction) {
  return direction === 'inward' ? toLabIdentity(content) : toPlaceholderForm(content);
}

/** Identity- and EOL-insensitive key: what two rule files are compared on. */
function compareKey(content) {
  return toPlaceholderForm(content).replace(/\r\n/g, '\n');
}

/**
 * Minimal LCS unified diff (context lines default to 3). Returns '' when the
 * inputs match, so callers can treat a non-empty result as "real drift".
 */
export function unifiedDiff(oldText, newText, oldLabel = 'a', newLabel = 'b', context = 3) {
  const a = String(oldText).split('\n');
  const b = String(newText).split('\n');
  if (a.length === b.length && a.every((line, idx) => line === b[idx])) return '';

  const n = a.length;
  const m = b.length;
  const dp = [];
  for (let i = 0; i <= n; i++) dp.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: ' ', text: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: '-', text: a[i] }); i++; } else { ops.push({ t: '+', text: b[j] }); j++; }
  }
  while (i < n) { ops.push({ t: '-', text: a[i] }); i++; }
  while (j < m) { ops.push({ t: '+', text: b[j] }); j++; }

  const changed = [];
  ops.forEach((op, idx) => { if (op.t !== ' ') changed.push(idx); });
  if (changed.length === 0) return '';

  const groups = [[changed[0]]];
  for (let k = 1; k < changed.length; k++) {
    const last = groups[groups.length - 1];
    if (changed[k] - last[last.length - 1] <= context * 2) last.push(changed[k]);
    else groups.push([changed[k]]);
  }

  const lines = [`--- ${oldLabel}`, `+++ ${newLabel}`];
  for (const group of groups) {
    const start = Math.max(0, group[0] - context);
    const end = Math.min(ops.length - 1, group[group.length - 1] + context);
    let oldStart = 0;
    let newStart = 0;
    for (let k = 0; k < start; k++) {
      if (ops[k].t !== '+') oldStart++;
      if (ops[k].t !== '-') newStart++;
    }
    let oldCount = 0;
    let newCount = 0;
    for (let k = start; k <= end; k++) {
      lines.push(`${ops[k].t}${ops[k].text}`);
      if (ops[k].t !== '+') oldCount++;
      if (ops[k].t !== '-') newCount++;
    }
    lines.splice(lines.length - (end - start + 1), 0, `@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`);
  }
  return `${lines.join('\n')}\n`;
}

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
  // Composed at init from the active pack's `path-rules/` overlay
  // (init/seed-governance.js applySurfaceOverlays). The child's committed
  // copies are starter-distribution templates describing an application
  // workspace; the lab's describe the engine workspace. Neither direction may
  // overwrite the other — pack improvements already propagate via `packs/`.
  /\.shiftstone[\\/]path-scoped-rules[\\/]code-quality\.md$/,
  /\.shiftstone[\\/]path-scoped-rules[\\/]structure\.md$/,
  /\.shiftstone[\\/]path-scoped-rules[\\/]ui-rules\.md$/,
  /\.shiftstone[\\/]path-scoped-rules[\\/]workspace-init-rules\.md$/,
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

/**
 * @typedef {Object} EngineDiffItem
 * @property {string} rel    Path relative to `.shiftstone/`, posix separators.
 * @property {string} src    Absolute source path.
 * @property {string} dst    Absolute destination path.
 * @property {boolean} [templated] True when the file lives in a templated rule area.
 * @property {string} [srcText]    Raw source text (templated items only).
 * @property {string} [rendered]   Identity-rendered text to write on apply (templated items only).
 * @property {string} [diff]       Unified diff of the normalized contents (templated drift only).
 * @property {number} [bytesDiff]  Size delta of the compared contents.
 */

/**
 * @typedef {Object} EngineDiff
 * @property {'outward'|'inward'} direction
 * @property {string} srcBase
 * @property {string} dstBase
 * @property {string[]} identical
 * @property {EngineDiffItem[]} created
 * @property {EngineDiffItem[]} updated
 * @property {string[]} protectedSkipped
 * @property {string[]} errors
 */

/**
 * @param {{ parentRoot?: string, childRoot?: string, direction?: 'outward'|'inward', pathFilter?: string|null }} [options]
 * @returns {EngineDiff}
 */
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
    const templated = isTemplatedArea(rel);

    if (!existsSync(dstFile)) {
      const item = { rel, src: srcFile, dst: dstFile, templated };
      if (templated) {
        try {
          item.srcText = readFileSync(srcFile, 'utf8');
          item.rendered = renderForDirection(item.srcText, direction);
        } catch (err) {
          result.errors.push(`Error reading file ${rel}: ${err.message}`);
          continue;
        }
      }
      result.created.push(item);
      continue;
    }

    try {
      if (templated) {
        const srcText = readFileSync(srcFile, 'utf8');
        const dstText = readFileSync(dstFile, 'utf8');
        const srcKey = compareKey(srcText);
        const dstKey = compareKey(dstText);
        if (srcKey === dstKey) {
          result.identical.push(rel);
        } else {
          const srcRole = direction === 'outward' ? 'lab' : 'child';
          const dstRole = direction === 'outward' ? 'child' : 'lab';
          result.updated.push({
            rel,
            src: srcFile,
            dst: dstFile,
            templated: true,
            bytesDiff: Buffer.byteLength(srcKey) - Buffer.byteLength(dstKey),
            srcText,
            rendered: renderForDirection(srcText, direction),
            diff: unifiedDiff(
              dstKey,
              srcKey,
              `a/.shiftstone/${rel} (${dstRole})`,
              `b/.shiftstone/${rel} (${srcRole})`,
            ),
          });
        }
        continue;
      }

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

/**
 * Writes an already-computed diff to disk. Kept separate from computeEngineDiff
 * so callers can enumerate (and preview) every proposed write before any of
 * them lands — templated rule areas must never be overwritten sight-unseen.
 */
export function applyEngineDiff(diff, options = {}) {
  let actionsApplied = 0;
  if (options.dryRun) return { actionsApplied };
  for (const item of [...diff.created, ...diff.updated]) {
    const targetDir = path.dirname(item.dst);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    if (item.templated) {
      writeFileSync(item.dst, item.rendered, 'utf8');
    } else {
      copyFileSync(item.src, item.dst);
    }
    actionsApplied++;
  }
  return { actionsApplied };
}

export function buildStats(diff, options = {}) {
  return {
    direction: diff.direction,
    dryRun: Boolean(options.dryRun),
    checkOnly: Boolean(options.check),
    identical: diff.identical.length,
    created: diff.created.length,
    updated: diff.updated.length,
    templatedDrift: diff.updated.filter((u) => u.templated).length,
    protectedSkipped: diff.protectedSkipped.length,
    errors: diff.errors,
    actionsApplied: 0,
  };
}

export function syncEngine(options = {}) {
  const diff = computeEngineDiff(options);
  const dryRun = Boolean(options.dryRun);
  const checkOnly = Boolean(options.check);
  const stats = buildStats(diff, options);

  if (diff.errors.length > 0) {
    return { ok: false, stats, diff };
  }

  if (checkOnly) {
    const inSync = diff.created.length === 0 && diff.updated.length === 0;
    return { ok: inSync, stats, diff };
  }

  stats.actionsApplied = applyEngineDiff(diff, { dryRun }).actionsApplied;
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

  const diff = computeEngineDiff({ direction, pathFilter });
  const stats = buildStats(diff, { dryRun, check });

  if (stats.errors.length > 0) {
    for (const err of stats.errors) {
      console.error(`ERROR: ${err}`);
    }
    process.exit(1);
  }

  console.log('--- Summary ---');
  console.log(`  Identical files:     ${stats.identical}`);
  console.log(`  Files to create:     ${stats.created}`);
  console.log(`  Files to update:     ${stats.updated}`);
  if (stats.templatedDrift > 0) {
    console.log(`    of which templated rule drift: ${stats.templatedDrift}`);
  }
  console.log(`  Protected (skipped): ${stats.protectedSkipped}`);
  console.log('');

  if (diff.created.length > 0) {
    console.log('➕ Created files:');
    for (const f of diff.created) {
      console.log(`  + .shiftstone/${f.rel}${f.templated ? ' [templated]' : ''}`);
    }
    console.log('');
  }

  if (diff.updated.length > 0) {
    console.log('🔄 Updated files:');
    for (const f of diff.updated) {
      const marker = f.templated ? ' [templated rule drift]' : '';
      console.log(`  ~ .shiftstone/${f.rel} (${f.bytesDiff >= 0 ? '+' : ''}${f.bytesDiff} bytes)${marker}`);
    }
    console.log('');
  }

  // Proposal-safe: every templated overwrite is shown as a unified diff before
  // applyEngineDiff() is allowed to run, in both preview and apply mode.
  if (!check && diff.updated.some((f) => f.templated && f.diff)) {
    console.log('📝 Templated rule diffs (identity-normalized):');
    for (const f of diff.updated) {
      if (!f.templated || !f.diff) continue;
      console.log('');
      process.stdout.write(f.diff);
    }
    console.log('');
  }

  if (check) {
    const driftedRules = diff.updated.filter((f) => f.templated).map((f) => f.rel);
    const inSync = diff.created.length === 0 && diff.updated.length === 0;
    if (!inSync) {
      if (driftedRules.length > 0) {
        console.error('Drifted rule files (post identity-normalization):');
        for (const rel of driftedRules) {
          console.error(`  ~ .shiftstone/${rel}`);
        }
      }
      console.error(`FAIL: Drift detected between engines (${stats.created} creates, ${stats.updated} updates). Run with --dry-run or apply.`);
      process.exit(1);
    }
    console.log('PASS: Engine directories are 100% in sync.');
    process.exit(0);
  }

  const { actionsApplied } = applyEngineDiff(diff, { dryRun });
  if (dryRun) {
    console.log('Dry run complete. No files written.');
  } else {
    console.log(`Successfully synchronized ${actionsApplied} file(s).`);
  }
}
