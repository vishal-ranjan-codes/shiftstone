import { describe, expect, it } from 'vitest';
import { StagnationDetector } from '../../harness/brakes/stagnation.ts';

const noProgress = { progress: false, output_hash_unchanged: false, yardstick_delta: 0 };
const progress = { progress: true, output_hash_unchanged: false, yardstick_delta: 1 };

describe('StagnationDetector (§7.8, default 2 barren turns)', () => {
  it('stalls after 2 barren turns under consecutive_no_progress', () => {
    const d = new StagnationDetector({ max_barren_turns: 2, detector: 'consecutive_no_progress' });
    expect(d.recordTurn(noProgress)).toBe(1);
    expect(d.isStalled()).toBe(false);
    expect(d.recordTurn(noProgress)).toBe(2);
    expect(d.isStalled()).toBe(true);
  });

  it('a productive turn resets the barren counter', () => {
    const d = new StagnationDetector({ max_barren_turns: 2, detector: 'consecutive_no_progress' });
    d.recordTurn(noProgress);
    d.recordTurn(progress);
    expect(d.barrenTurns()).toBe(0);
    expect(d.isStalled()).toBe(false);
    d.recordTurn(noProgress);
    expect(d.isStalled()).toBe(false);
  });

  it('output_hash_unchanged detector counts duplicate output as barren', () => {
    const d = new StagnationDetector({ max_barren_turns: 2, detector: 'output_hash_unchanged' });
    d.recordTurn({ progress: true, output_hash_unchanged: true, yardstick_delta: 5 });
    d.recordTurn({ progress: true, output_hash_unchanged: true, yardstick_delta: 5 });
    expect(d.isStalled()).toBe(true);
  });

  it('yardstick_delta detector counts delta <= 0 as barren', () => {
    const d = new StagnationDetector({ max_barren_turns: 2, detector: 'yardstick_delta' });
    d.recordTurn({ progress: false, output_hash_unchanged: false, yardstick_delta: 0 });
    d.recordTurn({ progress: false, output_hash_unchanged: false, yardstick_delta: -1 });
    expect(d.isStalled()).toBe(true);
  });

  it('composite detector requires all three signals to agree', () => {
    const d = new StagnationDetector({ max_barren_turns: 2, detector: 'composite' });
    // mixed signals: no progress but the output hash changed → not barren
    d.recordTurn({ progress: false, output_hash_unchanged: false, yardstick_delta: 0 });
    expect(d.barrenTurns()).toBe(0);
    // all three signals agree (no progress + same hash + delta <= 0) → barren
    const allAgree = { progress: false, output_hash_unchanged: true, yardstick_delta: 0 };
    d.recordTurn(allAgree);
    d.recordTurn(allAgree);
    expect(d.isStalled()).toBe(true);
  });

  it('honors a custom barren-turn ceiling', () => {
    const d = new StagnationDetector({ max_barren_turns: 3, detector: 'consecutive_no_progress' });
    d.recordTurn(noProgress);
    d.recordTurn(noProgress);
    expect(d.isStalled()).toBe(false);
    d.recordTurn(noProgress);
    expect(d.isStalled()).toBe(true);
  });
});
