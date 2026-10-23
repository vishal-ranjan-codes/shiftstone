import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkReceipt,
  runPreflight,
  runSelfTest,
  PREFLIGHT_RECEIPT_FILENAME,
  RECEIPT_TTL_MS,
} from '../agent-preflight.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RECEIPT_PATH = path.join(ROOT, PREFLIGHT_RECEIPT_FILENAME);

describe('Unit U10: 4-Layer Agent Pre-Flight Gate (UG-11)', () => {
  beforeEach(() => {
    if (existsSync(RECEIPT_PATH)) {
      unlinkSync(RECEIPT_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(RECEIPT_PATH)) {
      unlinkSync(RECEIPT_PATH);
    }
  });

  it('TS-U10-01 (L2): fails when missing a required skill or Bible chapter for a route file', () => {
    // Declaring skills that omit required skills (e.g. only 'bookkeeping')
    const result = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      skills: ['bookkeeping'], // missing react-router-routing, react-router-data-loading
      bible: ['docs/bible/08-api-contracts/route-contracts.md'],
      verifyCmd: 'npm test',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PREFLIGHT_GATE_FAILED');
    expect(result.violations.some((v) => v.includes('Claimed skills omit required skill'))).toBe(true);
    expect(existsSync(RECEIPT_PATH)).toBe(false);
  });

  it('TS-U10-01b (L2): fails when Bible document is missing or invalid', () => {
    const result = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      skills: ['react-router-routing', 'react-router-data-loading', 'ss-plan'],
      bible: ['docs/bible/non-existent-chapter.md'],
      verifyCmd: 'npm test',
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('PREFLIGHT_GATE_FAILED');
    expect(result.violations.some((v) => v.includes('Claimed Bible docs omit required chapter'))).toBe(true);
  });

  it('TS-U10-01c (L2): fails when verify-cmd is omitted', () => {
    const result = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      skills: ['react-router-routing', 'react-router-data-loading', 'ss-plan'],
      bible: ['docs/bible/08-api-contracts/route-contracts.md'],
      verifyCmd: '',
    });

    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes('Layer 4 Violation'))).toBe(true);
  });

  it('TS-U10-02 (L2): passes with valid skills/bible and allows --check to pass', () => {
    const preflight = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      verifyCmd: 'npm test',
    });

    expect(preflight.ok).toBe(true);
    expect(preflight.receipt).toBeDefined();
    expect(preflight.receipt.targetGlobs).toContain('app/routes/dashboard.tsx');
    expect(existsSync(RECEIPT_PATH)).toBe(true);

    // Verify --check on covered file
    const check1 = checkReceipt('app/routes/dashboard.tsx', ROOT);
    expect(check1.ok).toBe(true);
    expect(check1.receipt.verifyCmd).toBe('npm test');

    // Verify --check on uncovered file
    const check2 = checkReceipt('supabase/migrations/999_schema.sql', ROOT);
    expect(check2.ok).toBe(false);
    expect(check2.code).toBe('PREFLIGHT_SCOPE_MISMATCH');
  });

  it('handles receipt expiration cleanly', () => {
    // Generate expired receipt
    const expiredReceipt = {
      schemaVersion: 'preflight-receipt/v1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(), // expired 1s ago
      targetGlobs: ['app/routes/**'],
      verifiedSkills: ['react-router-routing'],
      verifiedBibleDocs: ['docs/bible/08-api-contracts/route-contracts.md'],
      verifyCmd: 'npm test',
      receiptHash: 'mock-hash',
    };
    writeFileSync(RECEIPT_PATH, JSON.stringify(expiredReceipt), 'utf8');

    const check = checkReceipt('app/routes/dashboard.tsx', ROOT);
    expect(check.ok).toBe(false);
    expect(check.code).toBe('PREFLIGHT_RECEIPT_EXPIRED');
  });

  it('passes runSelfTest() cleanly', () => {
    const res = runSelfTest(ROOT);
    expect(res.ok).toBe(true);
    expect(res.matricesCount).toBeGreaterThanOrEqual(1);
  });
});
