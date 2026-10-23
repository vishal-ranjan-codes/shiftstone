import { describe, expect, it } from 'vitest';
import {
  loadModelRouting,
  parseModelRouting,
  resolveModelTier,
} from '../../context/model-routing.ts';

describe('model routing policy (task 3.8 / B7)', () => {
  it('resolves task classes to tiers with the documented OpEx split', () => {
    const routing = loadModelRouting();
    expect(routing.task_classes.design).toBe('frontier');
    expect(routing.task_classes.implementation).toBe('frontier');
    expect(routing.task_classes.test_generation).toBe('fast');
    expect(routing.task_classes.review).toBe('fast');
    expect(routing.task_classes.monitoring).toBe('fast');
    expect(routing.tiers.frontier.rationale).toMatch(/costly/i);
    expect(routing.tiers.fast.rationale).toMatch(/verify/i);
  });

  it('prefers the per-loop override over the declared task_class', () => {
    const routing = loadModelRouting();
    const overridden = resolveModelTier(routing, {
      task_class: 'implementation',
      loop: 'diagnose-loop',
    });
    expect(overridden).toEqual({
      tier: 'fast',
      task_class: 'monitoring',
      source: 'loop_override',
    });

    // A spec-declared class with no override resolves through task_classes
    const declared = resolveModelTier(routing, { task_class: 'review', loop: 'new-feature-loop' });
    expect(declared).toEqual({ tier: 'fast', task_class: 'review', source: 'task_class' });
  });

  it('falls back to the advisory default for unknown classes', () => {
    const routing = loadModelRouting();
    const unknown = resolveModelTier(routing, { task_class: 'vibes' });
    expect(unknown.source).toBe('default');
    expect(unknown.tier).toBe(routing.defaults.tier);
  });

  it('rejects malformed routing files', () => {
    expect(() => parseModelRouting('tiers: {}')).toThrow(/task_classes/);
    expect(() =>
      parseModelRouting('task_classes: {design: frontier}\ndefaults: {task_class: design}'),
    ).toThrow(/tier/);
    expect(() =>
      parseModelRouting('task_classes: {design: luxury}\ndefaults: {task_class: design, tier: frontier}'),
    ).toThrow(/unknown tier "luxury"/);
  });
});
