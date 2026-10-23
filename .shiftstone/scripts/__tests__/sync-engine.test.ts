import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  computeEngineDiff,
  isProtected,
  PROTECTED_BOUNDARY_PATTERNS,
  syncEngine,
  UNIVERSAL_SYNC_AREAS,
} from '../sync-engine.js';

describe('sync-engine.js — Bi-Directional Engine Synchronization (DEC-014)', () => {
  it('protects environment boundary files from sync overwrite', () => {
    expect(isProtected('.shiftstone/governance/workspace-manifest.json')).toBe(true);
    expect(isProtected('.shiftstone/governance/implementation-status.json')).toBe(true);
    expect(isProtected('.shiftstone/static-rules/product.md')).toBe(true);
    expect(isProtected('.shiftstone/static-rules/global.md')).toBe(true);
    expect(isProtected('package.json')).toBe(true);
    expect(isProtected('AGENTS.md')).toBe(true);
    expect(isProtected('docs/bible/01-architecture/architecture-overview.md')).toBe(true);

    // Universal engine files must NOT be protected
    expect(isProtected('.shiftstone/scripts/validate-workspace.js')).toBe(false);
    expect(isProtected('.shiftstone/harness/loop-runner/runner.ts')).toBe(false);
    expect(isProtected('.shiftstone/context/skills-loader.ts')).toBe(false);
  });

  it('declares universal sync areas and protected boundary patterns', () => {
    expect(UNIVERSAL_SYNC_AREAS).toContain('scripts');
    expect(UNIVERSAL_SYNC_AREAS).toContain('harness');
    expect(UNIVERSAL_SYNC_AREAS).toContain('context');
    expect(UNIVERSAL_SYNC_AREAS).toContain('init');
    expect(PROTECTED_BOUNDARY_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it('runs dry-run sync without modifying target files', () => {
    const parentTemp = mkdtempSync(path.join(tmpdir(), 'sync-parent-'));
    const childTemp = mkdtempSync(path.join(tmpdir(), 'sync-child-'));

    try {
      // Setup mock parent and child .shiftstone/scripts/
      mkdirSync(path.join(parentTemp, '.shiftstone', 'scripts'), { recursive: true });
      mkdirSync(path.join(childTemp, '.shiftstone', 'scripts'), { recursive: true });

      writeFileSync(path.join(parentTemp, '.shiftstone', 'scripts', 'shared.js'), 'console.log("v2");\n', 'utf8');
      writeFileSync(path.join(childTemp, '.shiftstone', 'scripts', 'shared.js'), 'console.log("v1");\n', 'utf8');
      writeFileSync(path.join(parentTemp, '.shiftstone', 'scripts', 'new-tool.js'), 'console.log("new");\n', 'utf8');

      // Dry-run outward
      const dryRes = syncEngine({
        parentRoot: parentTemp,
        childRoot: childTemp,
        direction: 'outward',
        dryRun: true,
      });

      expect(dryRes.ok).toBe(true);
      expect(dryRes.stats.created).toBe(1);
      expect(dryRes.stats.updated).toBe(1);
      expect(dryRes.stats.actionsApplied).toBe(0);

      // Child file should NOT have changed in dry-run
      expect(readFileSync(path.join(childTemp, '.shiftstone', 'scripts', 'shared.js'), 'utf8')).toBe('console.log("v1");\n');
      expect(existsSync(path.join(childTemp, '.shiftstone', 'scripts', 'new-tool.js'))).toBe(false);

      // Apply outward
      const applyRes = syncEngine({
        parentRoot: parentTemp,
        childRoot: childTemp,
        direction: 'outward',
        dryRun: false,
      });

      expect(applyRes.ok).toBe(true);
      expect(applyRes.stats.actionsApplied).toBe(2);

      // Verify files written
      expect(readFileSync(path.join(childTemp, '.shiftstone', 'scripts', 'shared.js'), 'utf8')).toBe('console.log("v2");\n');
      expect(readFileSync(path.join(childTemp, '.shiftstone', 'scripts', 'new-tool.js'), 'utf8')).toBe('console.log("new");\n');

      // Check verification
      const checkRes = syncEngine({
        parentRoot: parentTemp,
        childRoot: childTemp,
        direction: 'outward',
        check: true,
      });
      expect(checkRes.ok).toBe(true);
      expect(checkRes.stats.identical).toBe(2);
      expect(checkRes.stats.created).toBe(0);
      expect(checkRes.stats.updated).toBe(0);
    } finally {
      rmSync(parentTemp, { recursive: true, force: true });
      rmSync(childTemp, { recursive: true, force: true });
    }
  });

  it('handles inward synchronization from framework to lab', () => {
    const parentTemp = mkdtempSync(path.join(tmpdir(), 'sync-p2-'));
    const childTemp = mkdtempSync(path.join(tmpdir(), 'sync-c2-'));

    try {
      mkdirSync(path.join(parentTemp, '.shiftstone', 'scripts'), { recursive: true });
      mkdirSync(path.join(childTemp, '.shiftstone', 'scripts'), { recursive: true });

      writeFileSync(path.join(childTemp, '.shiftstone', 'scripts', 'framework-fix.js'), 'export const fix = 1;\n', 'utf8');

      const inwardRes = syncEngine({
        parentRoot: parentTemp,
        childRoot: childTemp,
        direction: 'inward',
        dryRun: false,
      });

      expect(inwardRes.ok).toBe(true);
      expect(inwardRes.stats.created).toBe(1);
      expect(readFileSync(path.join(parentTemp, '.shiftstone', 'scripts', 'framework-fix.js'), 'utf8')).toBe('export const fix = 1;\n');
    } finally {
      rmSync(parentTemp, { recursive: true, force: true });
      rmSync(childTemp, { recursive: true, force: true });
    }
  });
});
