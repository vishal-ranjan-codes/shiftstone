/**
 * StagnationDetector — the no-progress circuit breaker (blueprint §7.8).
 *
 * Default: halt after 2 barren turns. Detectors:
 *   consecutive_no_progress — no verify pass, no positive yardstick delta,
 *                             no enumerated items addressed
 *   output_hash_unchanged   — the turn's output hash equals the previous turn's
 *   yardstick_delta         — yardstick delta <= 0
 *   composite               — all three signals agree (reduces false stalls)
 */

import type { StagnationDetectorKind } from '../loop-runner/types.ts';

export interface StagnationConfig {
  max_barren_turns: number;
  detector: StagnationDetectorKind;
}

export interface TurnSignals {
  /** Progress = verify passed OR positive yardstick delta OR items addressed. */
  progress: boolean;
  /** Turn produced the same output hash as the previous turn. */
  output_hash_unchanged: boolean;
  yardstick_delta: number;
}

export class StagnationDetector {
  cfg: StagnationConfig;
  private barren: number;

  constructor(cfg: StagnationConfig) {
    this.cfg = cfg;
    this.barren = 0;
  }

  private isBarren(signals: TurnSignals): boolean {
    switch (this.cfg.detector) {
      case 'consecutive_no_progress':
        return !signals.progress;
      case 'output_hash_unchanged':
        return signals.output_hash_unchanged;
      case 'yardstick_delta':
        return signals.yardstick_delta <= 0;
      case 'composite':
        return !signals.progress && signals.output_hash_unchanged && signals.yardstick_delta <= 0;
    }
  }

  recordTurn(signals: TurnSignals): number {
    if (this.isBarren(signals)) {
      this.barren += 1;
    } else {
      this.barren = 0;
    }
    return this.barren;
  }

  barrenTurns(): number {
    return this.barren;
  }

  isStalled(): boolean {
    return this.barren >= this.cfg.max_barren_turns;
  }

  reset(): void {
    this.barren = 0;
  }
}
