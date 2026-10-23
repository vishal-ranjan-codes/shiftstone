/**
 * Model routing resolver (amendment B7) — task-class → model-tier map from
 * .shiftstone/context/model-routing.yaml. Advisory defaults with explicit per-loop
 * overrides: a loop's override wins over a declared task_class, which wins
 * over the file default.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_ROUTING_PATH = path.join(HERE, 'model-routing.yaml');

export const MODEL_TIERS = ['frontier', 'fast'] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export interface ModelRouting {
  tiers: Record<string, { label?: string; rationale?: string }>;
  task_classes: Record<string, string>;
  defaults: { task_class: string; tier: ModelTier };
  loop_overrides?: Record<string, string>;
}

export interface TierResolution {
  tier: ModelTier;
  task_class: string;
  source: 'loop_override' | 'task_class' | 'default';
}

export function parseModelRouting(raw: string): ModelRouting {
  const data = parse(raw) as Partial<ModelRouting> | null;
  if (!data || typeof data !== 'object') {
    throw new Error('model-routing.yaml must be a YAML mapping');
  }
  if (!data.task_classes || typeof data.task_classes !== 'object') {
    throw new Error('model-routing.yaml missing task_classes map');
  }
  if (!data.defaults?.task_class || !data.defaults?.tier) {
    throw new Error('model-routing.yaml missing defaults.{task_class,tier}');
  }
  if (!MODEL_TIERS.includes(data.defaults.tier)) {
    throw new Error(`defaults.tier must be one of ${MODEL_TIERS.join('|')}`);
  }
  for (const [cls, tier] of Object.entries(data.task_classes)) {
    if (!MODEL_TIERS.includes(tier as ModelTier)) {
      throw new Error(`task_classes.${cls}: unknown tier "${tier}" (allowed: ${MODEL_TIERS.join('|')})`);
    }
  }
  return {
    tiers: data.tiers ?? {},
    task_classes: data.task_classes,
    defaults: data.defaults as ModelRouting['defaults'],
    loop_overrides: data.loop_overrides ?? {},
  };
}

export function loadModelRouting(file = MODEL_ROUTING_PATH): ModelRouting {
  return parseModelRouting(readFileSync(file, 'utf8'));
}

/** Resolve the model tier for a task class (loop overrides win). */
export function resolveModelTier(
  routing: ModelRouting,
  opts: { task_class?: string; loop?: string },
): TierResolution {
  const override = opts.loop ? routing.loop_overrides?.[opts.loop] : undefined;
  if (override) {
    const tier = routing.task_classes[override] ?? (override as ModelTier);
    if (MODEL_TIERS.includes(tier as ModelTier)) {
      return { tier: tier as ModelTier, task_class: override, source: 'loop_override' };
    }
  }
  if (opts.task_class) {
    const tier = routing.task_classes[opts.task_class];
    if (MODEL_TIERS.includes(tier as ModelTier)) {
      return { tier: tier as ModelTier, task_class: opts.task_class, source: 'task_class' };
    }
  }
  return {
    tier: routing.defaults.tier,
    task_class: opts.task_class ?? routing.defaults.task_class,
    source: 'default',
  };
}
