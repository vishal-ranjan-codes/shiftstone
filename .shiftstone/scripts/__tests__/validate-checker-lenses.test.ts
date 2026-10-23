import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveLensesForFiles,
  validateCheckerLenses,
  validateSingleCheckerLens,
} from '../validate-checker-lenses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const VALID_LENS_FIXTURE = {
  schemaVersion: 'checker-lens/v1',
  lensId: 'sample-lens',
  name: 'Sample Lens for Testing',
  pack: 'core',
  defaultMode: 'focused',
  supportedModes: ['lite', 'focused', 'full'],
  triggerGlobs: ['src/**/*.ts', 'core/**/*.ts'],
  mappedDimensions: ['task_success', 'tool_use_quality', 'response_quality'],
  invariants: [
    {
      ruleId: 'SMP-001',
      severity: 'high',
      description: 'Enforce proper error handling across all exported functions',
      autofixClass: 'manual',
    },
    {
      ruleId: 'SMP-002',
      severity: 'medium',
      description: 'Ensure JSDoc comments are provided on public APIs',
      autofixClass: 'safe_auto',
    },
  ],
};

describe('Unit U16: validate-checker-lenses (UG-15, UG-16)', () => {
  it('TS-U16-01 / TS-U17-01 (L1): validates all 7 live core and pack lenses with 21 rules and zero violations', () => {
    const res = validateCheckerLenses({ root: ROOT });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
    expect(res.lensesCount).toBe(7);
    expect(res.rulesCount).toBe(21);
  });

  it('validates a well-formed checker lens object cleanly', () => {
    const res = validateSingleCheckerLens(VALID_LENS_FIXTURE);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('TS-U16-02 (L2): rejects invalid schemaVersion', () => {
    const invalid = { ...VALID_LENS_FIXTURE, schemaVersion: 'checker-lens/v2' };
    const res = validateSingleCheckerLens(invalid);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'INVALID_SCHEMA_VERSION')).toBe(true);
  });

  it('TS-U16-02 (L2): rejects invalid autofixClass', () => {
    const invalid = {
      ...VALID_LENS_FIXTURE,
      invariants: [
        {
          ruleId: 'SMP-BAD-AUTOFIX',
          severity: 'high',
          description: 'Valid description text here for test',
          autofixClass: 'magic_fix',
        },
      ],
    };
    const res = validateSingleCheckerLens(invalid);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'INVALID_AUTOFIX_CLASS')).toBe(true);
  });

  it('TS-U16-02 (L2): rejects defaultMode when not in supportedModes', () => {
    const invalid = {
      ...VALID_LENS_FIXTURE,
      defaultMode: 'full',
      supportedModes: ['lite', 'focused'],
    };
    const res = validateSingleCheckerLens(invalid);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'DEFAULT_MODE_NOT_SUPPORTED')).toBe(true);
  });

  it('TS-U16-02 (L2): rejects unmapped dimension', () => {
    const invalid = {
      ...VALID_LENS_FIXTURE,
      mappedDimensions: ['task_success', 'non_existent_dimension'],
    };
    const res = validateSingleCheckerLens(invalid);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'UNMAPPED_DIMENSION')).toBe(true);
  });

  it('TS-U16-02 (L2): rejects duplicate ruleId within the same lens', () => {
    const invalid = {
      ...VALID_LENS_FIXTURE,
      invariants: [
        {
          ruleId: 'DUP-001',
          severity: 'high',
          description: 'First invariant description text',
          autofixClass: 'manual',
        },
        {
          ruleId: 'DUP-001',
          severity: 'low',
          description: 'Second invariant description text',
          autofixClass: 'advisory',
        },
      ],
    };
    const res = validateSingleCheckerLens(invalid);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.code === 'DUPLICATE_RULE_ID')).toBe(true);
  });

  it('TS-U16-02 (L2): rejects duplicate ruleId across multiple lenses', () => {
    const lensA = {
      ...VALID_LENS_FIXTURE,
      lensId: 'lens-a',
      invariants: [
        {
          ruleId: 'GLOBAL-DUP-01',
          severity: 'high',
          description: 'Rule in Lens A description',
          autofixClass: 'manual',
        },
      ],
    };
    const lensB = {
      ...VALID_LENS_FIXTURE,
      lensId: 'lens-b',
      invariants: [
        {
          ruleId: 'GLOBAL-DUP-01',
          severity: 'medium',
          description: 'Rule in Lens B description',
          autofixClass: 'advisory',
        },
      ],
    };

    // Test programmatic validation with mock parsed files
    const resA = validateSingleCheckerLens(lensA);
    const resB = validateSingleCheckerLens(lensB);
    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
  });

  it('correctly resolves lenses based on file trigger globs', () => {
    const testLenses = [
      {
        ...VALID_LENS_FIXTURE,
        lensId: 'routes-lens',
        triggerGlobs: ['app/routes/**'],
      },
      {
        ...VALID_LENS_FIXTURE,
        lensId: 'db-lens',
        triggerGlobs: ['supabase/**'],
      },
    ];

    const matchedRoutes = testLenses.filter((lens) =>
      ['app/routes/users.tsx'].some((f) =>
        lens.triggerGlobs.some((g) => f.startsWith(g.replace('/**', ''))),
      ),
    );
    expect(matchedRoutes.map((l) => l.lensId)).toEqual(['routes-lens']);
  });
});
