import { describe, expect, it } from 'vitest';
import { BudgetGuard, MAX_ITERATIONS_CAP } from '../../harness/brakes/budget.ts';
import type { BudgetConfig } from '../../harness/loop-runner/types.ts';

const base: BudgetConfig = {
  max_iterations: 10,
  max_tokens: 500_000,
  max_dollars_usd: 15,
  max_wallclock_s: 1_800,
  sub_loop_multiplier: 0.5,
};

describe('BudgetGuard ceilings (§7.8)', () => {
  it('honors max_iterations', () => {
    const guard = new BudgetGuard({ ...base, max_tokens: undefined, max_dollars_usd: undefined, max_wallclock_s: undefined });
    expect(guard.exhausted({ attempts: 0 })).toBeNull();
    expect(guard.exhausted({ attempts: 9 })).toBeNull();
    expect(guard.exhausted({ attempts: 10 })?.ceiling).toBe('max_iterations');
  });

  it('hard-caps max_iterations at the paper limit of 10', () => {
    const guard = new BudgetGuard({ ...base, max_iterations: 50 });
    expect(guard.ceilings().max_iterations).toBe(MAX_ITERATIONS_CAP);
    expect(guard.exhausted({ attempts: 10 })?.ceiling).toBe('max_iterations');
    expect(guard.exhausted({ attempts: 9 })).toBeNull();
  });

  it('honors max_tokens', () => {
    const guard = new BudgetGuard(base);
    expect(guard.exhausted({ attempts: 0, tokens: 499_999 })).toBeNull();
    expect(guard.exhausted({ attempts: 0, tokens: 500_000 })?.ceiling).toBe('max_tokens');
  });

  it('honors max_dollars_usd', () => {
    const guard = new BudgetGuard(base);
    expect(guard.exhausted({ attempts: 0, dollars: 14.99 })).toBeNull();
    expect(guard.exhausted({ attempts: 0, dollars: 15 })?.ceiling).toBe('max_dollars_usd');
  });

  it('honors max_wallclock_s via the clock', () => {
    let nowMs = 0;
    const guard = new BudgetGuard(base, { now: () => nowMs, startedAtMs: 0 });
    expect(guard.exhausted({ attempts: 0 })).toBeNull();
    nowMs = 1_799_000;
    expect(guard.exhausted({ attempts: 0 })).toBeNull();
    nowMs = 1_800_000;
    expect(guard.exhausted({ attempts: 0 })?.ceiling).toBe('max_wallclock_s');
  });

  it('sub-loops get sub_loop_multiplier (0.5) of the parent budget', () => {
    const parent = new BudgetGuard(base);
    const sub = parent.subLoop();
    expect(sub.ceilings()).toEqual({
      max_iterations: 5,
      max_tokens: 250_000,
      max_dollars_usd: 7,
      max_wallclock_s: 900,
    });
    // nested sub-loops multiply again (0.5 × 0.5 = 0.25)
    expect(sub.subLoop().ceilings().max_iterations).toBe(2);
    expect(parent.ceilings().max_iterations).toBe(10);
  });
});
