/**
 * BudgetGuard — hard ceilings for loops (blueprint §7.8, paper N ≤ 10).
 *
 * Every ceiling is honored: iterations (hard-capped at 10 even if the spec
 * asks for more), tokens, dollars, wall-clock. Sub-loops receive the parent's
 * budget × sub_loop_multiplier (default 0.5).
 */

import type { BudgetConfig } from '../loop-runner/types.ts';

export const MAX_ITERATIONS_CAP = 10;

export interface BudgetUsage {
  attempts: number;
  tokens: number;
  dollars: number;
  elapsed_s: number;
}

export interface BudgetExhausted {
  reason: string;
  ceiling: string;
}

export interface BudgetGuardOpts {
  now?: () => number;
  startedAtMs?: number;
  /** Effective multiplier for this guard's ceilings (1 = top-level loop). */
  multiplier?: number;
}

export class BudgetGuard {
  cfg: BudgetConfig;
  multiplier: number;
  now: () => number;
  startedAtMs: number;

  constructor(cfg: BudgetConfig, opts?: BudgetGuardOpts) {
    this.cfg = cfg;
    this.multiplier = opts?.multiplier ?? 1;
    this.now = opts?.now ?? Date.now;
    this.startedAtMs = opts?.startedAtMs ?? this.now();
  }

  /** Ceilings after the paper's N ≤ 10 cap and the sub-loop multiplier. */
  ceilings(): {
    max_iterations: number;
    max_tokens?: number;
    max_dollars_usd?: number;
    max_wallclock_s?: number;
  } {
    const scale = (value: number | undefined): number | undefined =>
      value === undefined ? undefined : Math.floor(value * this.multiplier);
    return {
      max_iterations: Math.min(
        Math.floor(this.cfg.max_iterations * this.multiplier),
        MAX_ITERATIONS_CAP,
      ),
      max_tokens: scale(this.cfg.max_tokens),
      max_dollars_usd: scale(this.cfg.max_dollars_usd),
      max_wallclock_s: scale(this.cfg.max_wallclock_s),
    };
  }

  exhausted(usage?: Partial<BudgetUsage>): BudgetExhausted | null {
    const c = this.ceilings();
    const attempts = usage?.attempts ?? 0;
    const tokens = usage?.tokens ?? 0;
    const dollars = usage?.dollars ?? 0;
    const elapsed_s =
      usage?.elapsed_s ?? (this.now() - this.startedAtMs) / 1000;

    if (attempts >= c.max_iterations) {
      return { reason: `max_iterations reached (${attempts}/${c.max_iterations})`, ceiling: 'max_iterations' };
    }
    if (c.max_tokens !== undefined && tokens >= c.max_tokens) {
      return { reason: `max_tokens reached (${tokens}/${c.max_tokens})`, ceiling: 'max_tokens' };
    }
    if (c.max_dollars_usd !== undefined && dollars >= c.max_dollars_usd) {
      return { reason: `max_dollars_usd reached ($${dollars}/$${c.max_dollars_usd})`, ceiling: 'max_dollars_usd' };
    }
    if (c.max_wallclock_s !== undefined && elapsed_s >= c.max_wallclock_s) {
      return { reason: `max_wallclock_s reached (${elapsed_s}s/${c.max_wallclock_s}s)`, ceiling: 'max_wallclock_s' };
    }
    return null;
  }

  /** A sub-loop gets this loop's budget × sub_loop_multiplier. */
  subLoop(): BudgetGuard {
    return new BudgetGuard(this.cfg, {
      now: this.now,
      startedAtMs: this.now(),
      multiplier: this.multiplier * this.cfg.sub_loop_multiplier,
    });
  }
}
