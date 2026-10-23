import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateContextIntegrity } from '../validate-context-integrity.js';

describe('Unit U2: validate-context-integrity (UG-03)', () => {
  it('TS-U2-01 (L1): passes cleanly on the live repository with zero violations', () => {
    const result = validateContextIntegrity();
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.filesScanned).toBeGreaterThan(50);
  });

  it('TS-U2-02 (L2): detects CONTRADICTION_DETECTED when taste.md is pre-populated', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'integrity-test-'));
    try {
      mkdirSync(path.join(tmp, '.shiftstone', 'governance'), { recursive: true });
      mkdirSync(path.join(tmp, '.commandcode', 'taste'), { recursive: true });

      // Minimal rules yaml
      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'context-integrity-rules.yaml'),
        `
contradictionPairs:
  - id: taste-prepopulation-violation
    targets:
      - ".commandcode/taste/taste.md"
    forbiddenPatterns:
      - '(?i)##\\s*Coding Preferences'
    message: "taste.md contains pre-populated preferences"
`,
      );

      // Pre-populated taste.md
      writeFileSync(
        path.join(tmp, '.commandcode', 'taste', 'taste.md'),
        '# Taste\n## Coding Preferences\n- Prefer functional components\n',
      );

      const result = validateContextIntegrity({ root: tmp });
      expect(result.ok).toBe(false);
      const v = result.violations.find((x) => x.code === 'CONTRADICTION_DETECTED');
      expect(v).toBeDefined();
      expect(v?.ruleId).toBe('taste-prepopulation-violation');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U2-03 (L2): detects STACK_LEAK_DETECTED when core/ rule contains pack-specific terms', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'integrity-leak-'));
    try {
      mkdirSync(path.join(tmp, '.shiftstone', 'governance'), { recursive: true });
      mkdirSync(path.join(tmp, '.shiftstone', 'static-rules'), { recursive: true });

      writeFileSync(
        path.join(tmp, '.shiftstone', 'governance', 'context-integrity-rules.yaml'),
        `
coreStackDecoupling:
  targets:
    - ".shiftstone/static-rules/*.md"
  forbiddenStackTerms:
    - term: "react-router"
      reason: "React Router is a pack-specific contract"
`,
      );

      // Leaked core rule
      writeFileSync(
        path.join(tmp, '.shiftstone', 'static-rules', 'leaked.md'),
        '# Global Rules\nAlways import react-router for routing.\n',
      );

      const result = validateContextIntegrity({ root: tmp });
      expect(result.ok).toBe(false);
      const v = result.violations.find((x) => x.code === 'STACK_LEAK_DETECTED');
      expect(v).toBeDefined();
      expect(v?.term).toBe('react-router');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('TS-U2-04 (L2): detects FORBIDDEN_DIRECTIVE_DETECTED when legacy library is used', () => {
    const tmp = mkdtempSync(path.join(tmpdir(), 'integrity-directive-'));
    try {
      mkdirSync(path.join(tmp, 'packs', 'rr8-supabase-cf'), { recursive: true });
      mkdirSync(path.join(tmp, 'docs', 'bible'), { recursive: true });

      writeFileSync(
        path.join(tmp, 'packs', 'rr8-supabase-cf', 'pack.yaml'),
        `
spec:
  scanTargets:
    - "docs/bible/**/*.md"
  forbiddenDirectives:
    - pattern: "@supabase/auth-helpers"
      reason: "Deprecated auth helpers library"
      replacement: "@supabase/ssr"
`,
      );

      writeFileSync(
        path.join(tmp, 'docs', 'bible', 'legacy-auth.md'),
        'import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";\n',
      );

      const result = validateContextIntegrity({ root: tmp });
      expect(result.ok).toBe(false);
      const v = result.violations.find((x) => x.code === 'FORBIDDEN_DIRECTIVE_DETECTED');
      expect(v).toBeDefined();
      expect(v?.pattern).toBe('@supabase/auth-helpers');
      expect(v?.replacement).toBe('@supabase/ssr');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
