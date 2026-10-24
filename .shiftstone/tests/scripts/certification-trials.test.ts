import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCertificationTrials, getActivePacks } from '../../scripts/run-certification-trials.js';

describe('U10 — Registry-Driven Certification Trials (REQ-06)', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'cert-trials-test-'));
    mkdirSync(path.join(tmpRoot, '.shiftstone', 'packs', 'rr8-supabase-cf', 'trials'), { recursive: true });
    writeFileSync(path.join(tmpRoot, '.shiftstone', 'packs', 'rr8-supabase-cf', 'manifest.yaml'), 'name: rr8-supabase-cf\n');
    mkdirSync(path.join(tmpRoot, '.shiftstone', 'packs', 'fastapi-pg', 'trials'), { recursive: true });
    writeFileSync(path.join(tmpRoot, '.shiftstone', 'packs', 'fastapi-pg', 'manifest.yaml'), 'name: fastapi-pg\n');
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('runs flagship Factory Trials F1–F6 when flagship is active', async () => {
    const results = await runCertificationTrials({ suite: 'all', record: false });
    expect(results.harness.length).toBe(3);
    expect(results.factory.length).toBe(6);
    expect(results.totalPassed).toBe(9);
    expect(results.totalFailed).toBe(0);
    expect(results.totalSkipped).toBe(0);
    expect(results.skipped).toHaveLength(0);
  });

  it('skips flagship F-trials with explicit reason when fastapi-pg is active', async () => {
    const results = await runCertificationTrials({
      suite: 'all',
      activePacks: ['fastapi-pg'],
      record: false,
    });
    expect(results.harness.length).toBe(3);
    expect(results.factory.length).toBe(0);
    expect(results.totalSkipped).toBe(6);
    expect(results.totalPassed).toBe(3);
    expect(results.totalFailed).toBe(0);

    for (const s of results.skipped) {
      expect(s.status).toBe('skipped');
      expect(s.reason).toContain('inactive pack: rr8-supabase-cf');
      expect(s.reason).toContain('active: fastapi-pg');
    }
  });

  it('fails fast with a clear error on unknown pack name', async () => {
    await expect(
      runCertificationTrials({
        suite: 'all',
        activePacks: ['non-existent-pack'],
        record: false,
      })
    ).rejects.toThrow(/Unknown pack "non-existent-pack"/);
  });

  it('resolves active packs from _registry.yaml fixture correctly', () => {
    const regDir = path.join(tmpRoot, '.shiftstone', 'packs');
    mkdirSync(regDir, { recursive: true });
    writeFileSync(
      path.join(regDir, '_registry.yaml'),
      'apiVersion: workspace/v1\nkind: PackRegistry\nactivePacks:\n  - fastapi-pg\n',
      'utf8'
    );
    const resolved = getActivePacks(tmpRoot);
    expect(resolved).toEqual(['fastapi-pg']);
  });
});
