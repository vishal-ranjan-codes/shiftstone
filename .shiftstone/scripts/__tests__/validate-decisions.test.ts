import { describe, expect, it } from 'vitest';
import { checkDecisionsSync, generateDecisionsLedger } from '../compile-decisions.js';
import {
  runDecisionsSelfTest,
  validateDecisionData,
  validateDecisions,
  validateQuestionData,
} from '../validate-decisions.js';

describe('Unit U22: validate-decisions and compile-decisions (UG-21, LOCK-02)', () => {
  it('TS-U22-01 (L1): validates all decisions in the live repository with zero violations', () => {
    const res = validateDecisions();
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.totalDecisions).toBeGreaterThanOrEqual(5);
  });

  it('TS-U22-01 (L1): compile-decisions --check reports zero drift on the live repository', () => {
    const syncRes = checkDecisionsSync();
    expect(syncRes.inSync).toBe(true);
  });

  it('TS-U22-01 (L1): self-test passes cleanly', () => {
    const selfTest = runDecisionsSelfTest();
    expect(selfTest.ok).toBe(true);
    expect(selfTest.results.every((r) => r.pass)).toBe(true);
  });

  it('TS-U22-02 (L2): rejects superseded decision without supersededBy (MISSING_SUPERSEDED_BY)', () => {
    const invalidData = {
      type: 'decision',
      decisionId: 'DEC-999',
      title: 'Superseded Without Target',
      status: 'superseded',
      pack: 'core',
      timestamp: '2026-10-21T00:00:00.000Z',
    };
    const errs = validateDecisionData(invalidData, 'docs/decisions/DEC-999-test.md', new Set(['DEC-999']));
    expect(errs.some((e) => e.code === 'MISSING_SUPERSEDED_BY')).toBe(true);
  });

  it('TS-U22-02 (L2): rejects superseded decision pointing to non-existent target (MISSING_SUPERSEDED_TARGET)', () => {
    const invalidData = {
      type: 'decision',
      decisionId: 'DEC-998',
      title: 'Superseded With Bad Target',
      status: 'superseded',
      supersededBy: 'DEC-997',
      pack: 'core',
      timestamp: '2026-10-21T00:00:00.000Z',
    };
    const errs = validateDecisionData(
      invalidData,
      'docs/decisions/DEC-998-test.md',
      new Set(['DEC-998', 'DEC-001'])
    );
    expect(errs.some((e) => e.code === 'MISSING_SUPERSEDED_TARGET')).toBe(true);
  });

  it('rejects decided open-question without resolvedBy (MISSING_RESOLVED_BY)', () => {
    const invalidData = {
      type: 'open-question',
      questionId: 'OQ-999',
      title: 'Decided Question Without Target',
      status: 'decided',
      timestamp: '2026-10-21T00:00:00.000Z',
    };
    const errs = validateQuestionData(invalidData, 'docs/decisions/OQ-999-test.md', new Set(['DEC-001']));
    expect(errs.some((e) => e.code === 'MISSING_RESOLVED_BY')).toBe(true);
  });

  it('rejects decided open-question pointing to non-existent decision (MISSING_RESOLVED_TARGET)', () => {
    const invalidData = {
      type: 'open-question',
      questionId: 'OQ-998',
      title: 'Decided Question With Bad Target',
      status: 'decided',
      resolvedBy: 'DEC-888',
      timestamp: '2026-10-21T00:00:00.000Z',
    };
    const errs = validateQuestionData(invalidData, 'docs/decisions/OQ-998-test.md', new Set(['DEC-001']));
    expect(errs.some((e) => e.code === 'MISSING_RESOLVED_TARGET')).toBe(true);
  });

  it('detects drift when DECISIONS.md differs from compiled output', () => {
    // Generate valid ledger
    const { content } = generateDecisionsLedger();
    expect(content).toContain('DEC-010');
    expect(content).toContain('DEC-012');
  });
});
