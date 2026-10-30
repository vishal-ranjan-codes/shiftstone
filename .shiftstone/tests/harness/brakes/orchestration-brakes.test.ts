import { describe, expect, it } from 'vitest';
import { OrchestrationBrakes } from '../../../harness/brakes/orchestration-brakes.js';

describe('Unit U6 — Stagnation Detector & 3-Fix Circuit Breaker (REQ-06)', () => {
  it('TS-U6-01 (L2): Stagnation simulation confirms zero-diff runs are halted after 2 identical turns', () => {
    const brakes = new OrchestrationBrakes({ maxRetries: 3 });

    // Attempt 1: fails with diff hash "abc123"
    const r1 = brakes.recordAttempt('P1', {
      exitCode: 2,
      diffHash: 'abc123',
    });
    expect(r1.shouldRetry).toBe(true);
    expect(r1.nextMode).toBe('remediate');

    // Attempt 2: fails with identical diff hash "abc123" -> zero progress detected
    const r2 = brakes.recordAttempt('P1', {
      exitCode: 2,
      diffHash: 'abc123',
    });
    expect(r2.shouldRetry).toBe(false);
    expect(r2.trippedReason).toBe('STAGNATION_DETECTED');
    expect(r2.error).toContain('Zero-progress detected');
  });

  it('TS-U6-02 (L2): Maximum retry ceiling test asserts Governor trips circuit breaker and emits error report on the 4th failure', () => {
    const brakes = new OrchestrationBrakes({ maxRetries: 3 });

    // Attempt 1: different diff hashes
    const r1 = brakes.recordAttempt('P1', { exitCode: 2, diffHash: 'hash-1' });
    expect(r1.shouldRetry).toBe(true);

    // Attempt 2
    const r2 = brakes.recordAttempt('P1', { exitCode: 2, diffHash: 'hash-2' });
    expect(r2.shouldRetry).toBe(true);

    // Attempt 3
    const r3 = brakes.recordAttempt('P1', { exitCode: 2, diffHash: 'hash-3' });
    expect(r3.shouldRetry).toBe(true);

    // Attempt 4: hits retry ceiling (> 3 attempts) -> CIRCUIT_BREAKER_TRIPPED
    const r4 = brakes.recordAttempt('P1', { exitCode: 2, diffHash: 'hash-4' });
    expect(r4.shouldRetry).toBe(false);
    expect(r4.trippedReason).toBe('CIRCUIT_BREAKER_TRIPPED');
    expect(r4.diagnostics).toBeDefined();
    expect(r4.diagnostics?.attempts).toBe(4);
  });
});
