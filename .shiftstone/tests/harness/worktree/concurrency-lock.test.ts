import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import { ConcurrencyLock, StageLockedCollisionError } from '../../../harness/worktree/concurrency-lock.js';

describe('Unit U3 — Concurrency Lock & Single-Writer Invariant Validator (REQ-03)', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      tempDir = null;
    }
  });

  function getTempDir(): string {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-lock-test-'));
    return tempDir;
  }

  it('TS-U3-01 (L2): Race condition simulation asserts simultaneous lock acquisition permits exactly one winner and rejects the second', () => {
    const dir = getTempDir();
    const lock1 = new ConcurrencyLock({ lockDir: dir });
    const lock2 = new ConcurrencyLock({ lockDir: dir });

    // 1. Lock 1 acquires lock
    const meta1 = lock1.acquireLock('P1', 'worker-1', 60000);
    expect(meta1.phaseId).toBe('P1');
    expect(meta1.lockOwner).toBe('worker-1');
    expect(fs.existsSync(path.join(dir, '.stage.lock'))).toBe(true);
    expect(lock1.isLocked()).toBe(true);

    // 2. Lock 2 attempts acquisition and is rejected with STAGE_LOCKED_COLLISION
    expect(() => {
      lock2.acquireLock('P2', 'worker-2', 60000);
    }).toThrowError(/STAGE_LOCKED_COLLISION/);

    // 3. Lock 1 releases lock
    const released = lock1.releaseLock('P1', 'worker-1');
    expect(released).toBe(true);
    expect(fs.existsSync(path.join(dir, '.stage.lock'))).toBe(false);
    expect(lock1.isLocked()).toBe(false);

    // 4. Lock 2 can now acquire lock
    const meta2 = lock2.acquireLock('P2', 'worker-2', 60000);
    expect(meta2.phaseId).toBe('P2');
    expect(meta2.lockOwner).toBe('worker-2');
  });

  it('TS-U3-02 (L2): Stale lock recovery test confirms expired lock is reclaimed safely after TTL window', () => {
    const dir = getTempDir();
    const lockPath = path.join(dir, '.stage.lock');

    // Seed a stale lock with an expired acquiredAt and a defunct PID
    const staleMeta = {
      lockOwner: 'defunct-worker',
      phaseId: 'P0',
      acquiredAt: new Date(Date.now() - 100000).toISOString(),
      ttlMs: 500, // expired long ago
      pid: 99999999, // non-existent PID
    };
    fs.writeFileSync(lockPath, JSON.stringify(staleMeta, null, 2), 'utf8');

    const lock = new ConcurrencyLock({ lockDir: dir });
    // An expired lock with defunct PID is detected as inactive
    expect(lock.isLocked()).toBe(false);

    // New worker attempts acquisition -> detects stale lock, reclaims it safely
    const meta = lock.acquireLock('P1', 'active-worker', 30000);
    expect(meta.phaseId).toBe('P1');
    expect(meta.lockOwner).toBe('active-worker');
    expect(meta.pid).toBe(process.pid);
    expect(lock.isLocked()).toBe(true);
  });
});
