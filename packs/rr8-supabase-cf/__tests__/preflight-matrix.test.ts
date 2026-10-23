import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPreflightMatrices, runSelfTest } from '../../../.shiftstone/scripts/agent-preflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MATRIX_PATH = path.join(ROOT, 'packs', 'rr8-supabase-cf', 'preflight-matrix.yaml');

describe('Unit U15: Pack Pre-Flight Reference Matrix (UG-14)', () => {
  it('TS-U15-01 (L1): validates preflight-matrix.yaml exists and has valid structure', () => {
    expect(existsSync(MATRIX_PATH)).toBe(true);

    const matrices = loadPreflightMatrices(ROOT);
    const rr8Matrix = matrices.find((m) => m.pack === 'rr8-supabase-cf');
    expect(rr8Matrix).toBeDefined();
    expect(Array.isArray(rr8Matrix?.rules)).toBe(true);
    expect(rr8Matrix?.rules.length).toBeGreaterThanOrEqual(5);

    for (const rule of rr8Matrix!.rules) {
      expect(rule.id).toBeDefined();
      expect(Array.isArray(rule.globs)).toBe(true);
      expect(rule.globs.length).toBeGreaterThan(0);
      expect(Array.isArray(rule.skills)).toBe(true);
      expect(Array.isArray(rule.bible)).toBe(true);
    }
  });

  it('TS-U15-01 (L1): passes agent-preflight self-test cleanly across active packs', () => {
    const res = runSelfTest(ROOT);
    expect(res.ok).toBe(true);
    expect(res.matricesCount).toBeGreaterThanOrEqual(1);
  });
});
