import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateContextBudgets, CEILINGS } from '../validate-context-budgets.js';

describe('Unit U1: validate-context-budgets (UG-01, UG-02)', () => {
  it('TS-U1-01 (L1): passes cleanly on the live repository', () => {
    const result = validateContextBudgets();
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.details.agents).not.toBeNull();
    expect(result.details.agents.lines).toBeLessThanOrEqual(CEILINGS.AGENTS_MAX_LINES);
    expect(result.details.agents.bytes).toBeLessThanOrEqual(CEILINGS.AGENTS_MAX_BYTES);
    expect(result.details.cumulativeAlwaysOnBytes).toBeLessThanOrEqual(CEILINGS.ALWAYS_ON_MAX_BYTES);
  });

  it('TS-U1-02 (L2): fails with BUDGET_EXCEEDED when a rule exceeds 120 lines', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'budget-test-'));
    try {
      mkdirSync(path.join(tmp, 'core', 'static-rules'), { recursive: true });
      writeFileSync(path.join(tmp, 'AGENTS.md'), '# Agents\n'.repeat(20));
      // 125 lines rule
      const longRule = '---\nactivation: always\n---\n' + 'line\n'.repeat(122);
      writeFileSync(path.join(tmp, 'core', 'static-rules', 'oversized.md'), longRule);

      const result = validateContextBudgets({ root: tmp });
      expect(result.ok).toBe(false);
      const violation = result.violations.find((v) => v.file.includes('oversized.md'));
      expect(violation).toBeDefined();
      expect(violation?.code).toBe('BUDGET_EXCEEDED');
      expect(violation?.metric).toBe('lines');
      expect(violation?.actual).toBeGreaterThan(120);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U1-02b (L2): fails with BUDGET_EXCEEDED when cumulative always-on exceeds 12,288 B', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'budget-test-cum-'));
    try {
      mkdirSync(path.join(tmp, 'core', 'static-rules'), { recursive: true });
      // 3 KB AGENTS.md
      writeFileSync(path.join(tmp, 'AGENTS.md'), 'A'.repeat(3000));
      // Rule 1: 5 KB
      writeFileSync(
        path.join(tmp, 'core', 'static-rules', 'rule1.md'),
        '---\nactivation: always\n---\n' + 'B'.repeat(5000),
      );
      // Rule 2: 5 KB (total cumulative > 13 KB)
      writeFileSync(
        path.join(tmp, 'core', 'static-rules', 'rule2.md'),
        '---\nactivation: always\n---\n' + 'C'.repeat(5000),
      );

      const result = validateContextBudgets({ root: tmp });
      expect(result.ok).toBe(false);
      const cumViolation = result.violations.find((v) => v.file === 'cumulative-always-on');
      expect(cumViolation).toBeDefined();
      expect(cumViolation?.code).toBe('BUDGET_EXCEEDED');
      expect(cumViolation?.actual).toBeGreaterThan(CEILINGS.ALWAYS_ON_MAX_BYTES);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U1-02c (L2): fails with BUDGET_EXCEEDED when SKILL.md exceeds 180 lines', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'budget-test-skill-'));
    try {
      const skillDir = path.join(tmp, '.agents', 'skills', 'bloated-skill');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), 'line\n'.repeat(185));

      const result = validateContextBudgets({ root: tmp });
      expect(result.ok).toBe(false);
      const skillViolation = result.violations.find((v) => v.file.includes('SKILL.md'));
      expect(skillViolation).toBeDefined();
      expect(skillViolation?.code).toBe('BUDGET_EXCEEDED');
      expect(skillViolation?.metric).toBe('lines');
      expect(skillViolation?.actual).toBe(185);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
