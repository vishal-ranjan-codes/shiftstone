import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setupIdeJunctions, verifyIdeJunctions } from '../setup-ide-junctions.js';

describe('Unit U3: setup-ide-junctions & parity (UG-04, UG-05)', () => {
  it('TS-U3-01 (L1): live repo junctions verify cleanly as OS links', () => {
    const result = verifyIdeJunctions();
    expect(result.ok).toBe(true);
    expect(result.problems).toHaveLength(0);
    expect(result.status.length).toBeGreaterThanOrEqual(2);
    for (const s of result.status) {
      expect(s.ok).toBe(true);
      expect(s.target).toContain('skills');
    }
  });

  it('TS-U3-02 (L2): detects NOT_A_JUNCTION_DUPLICATION_RISK when a physical folder replaces junction', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'junction-dup-'));
    try {
      // Create canonical skills
      mkdirSync(path.join(tmp, '.agents', 'skills'), { recursive: true });

      // Create fake physical folder instead of junction
      mkdirSync(path.join(tmp, '.claude', 'skills'), { recursive: true });
      writeFileSync(path.join(tmp, '.claude', 'skills', 'duplicated-skill.md'), '# Duplicated');

      const result = verifyIdeJunctions({ root: tmp });
      expect(result.ok).toBe(false);
      const p = result.problems.find((x) => x.code === 'NOT_A_JUNCTION_DUPLICATION_RISK');
      expect(p).toBeDefined();
      expect(p?.path).toBe('.claude/skills');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U3-03 (L2): detects DEPRECATED_LEGACY_DIRECTORY_EXISTS when legacy workflow folder exists', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'junction-legacy-'));
    try {
      mkdirSync(path.join(tmp, '.agents', 'skills'), { recursive: true });
      // Set up junctions
      setupIdeJunctions({ root: tmp });

      // Plant legacy workflow folder
      mkdirSync(path.join(tmp, '.claude', 'commands'), { recursive: true });
      writeFileSync(path.join(tmp, '.claude', 'commands', 'test.md'), '# Legacy');

      const result = verifyIdeJunctions({ root: tmp });
      expect(result.ok).toBe(false);
      const p = result.problems.find((x) => x.code === 'DEPRECATED_LEGACY_DIRECTORY_EXISTS');
      expect(p).toBeDefined();
      expect(p?.path).toBe('.claude/commands');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U3-04 (L2): setupIdeJunctions creates junctions and removes legacy directories', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'junction-setup-'));
    try {
      mkdirSync(path.join(tmp, '.agents', 'skills'), { recursive: true });
      mkdirSync(path.join(tmp, '.agent', 'workflows'), { recursive: true });

      const setupRes = setupIdeJunctions({ root: tmp });
      expect(setupRes.ok).toBe(true);

      // Verify legacy directory was deleted
      const verifyRes = verifyIdeJunctions({ root: tmp });
      expect(verifyRes.ok).toBe(true);

      const claudeSkills = path.join(tmp, '.claude', 'skills');
      expect(lstatSync(claudeSkills).isSymbolicLink()).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
