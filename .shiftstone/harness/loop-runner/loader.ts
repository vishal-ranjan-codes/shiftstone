/**
 * Loop spec loader — reads <loop>/spec.md (YAML), validates it (refusals
 * include the paper's rationale), resolves the sub-loop call graph (A6) and
 * applies loader defaults.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

import { SpecRefusedError, type IsolationConfig, type LoopSpecification } from './types.ts';
import { validateSpec, type ValidationResult } from './validator.ts';
import { loadModelRouting } from '../../context/model-routing.ts';

export interface LoadOptions {
  root?: string;
  /** false = return the validation result instead of throwing on refusals */
  throwOnRefusal?: boolean;
}

export interface LoadedSpec {
  spec: LoopSpecification;
  source: string;
  validation: ValidationResult;
}

export interface SpecFileValidation extends ValidationResult {
  source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function resolveSpecPath(idOrPath: string, root = process.cwd()): Promise<string> {
  const looksLikePath =
    idOrPath.endsWith('.md') || idOrPath.includes('/') || idOrPath.includes('\\');
  if (looksLikePath) {
    return path.resolve(root, idOrPath);
  }
  const candidates = [
    path.join(root, 'docs', 'loops', idOrPath, 'spec.md'),
    path.join(root, '.loops', idOrPath, 'spec.md'),
  ];
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `loop "${idOrPath}" not found (looked in ${candidates.map((c) => path.relative(root, c)).join(', ')})`,
  );
}

async function readSpecFile(file: string): Promise<unknown> {
  const text = await readFile(file, 'utf8');
  return parse(text);
}

/** B7 — advisory: a declared task_class should exist in model-routing.yaml. */
function modelRoutingWarnings(raw: unknown): string[] {
  const model = (raw as Record<string, unknown>)?.['model'] as { task_class?: unknown } | undefined;
  const taskClass = typeof model?.task_class === 'string' ? model.task_class.trim() : '';
  if (!taskClass) return [];
  try {
    const routing = loadModelRouting();
    if (!Object.keys(routing.task_classes).includes(taskClass)) {
      return [
        `B7: model.task_class "${taskClass}" is unknown in .shiftstone/context/model-routing.yaml — the advisory default tier applies`,
      ];
    }
  } catch (error) {
    return [`B7: model-routing.yaml unreadable — ${error instanceof Error ? error.message : String(error)}`];
  }
  return [];
}

function subLoopNames(raw: unknown): string[] {
  if (!isRecord(raw)) return [];
  const execution = raw['execution'];
  if (!isRecord(execution)) return [];
  const subs = execution['sub_loops'];
  if (!Array.isArray(subs)) return [];
  return subs
    .map((s) => (isRecord(s) && typeof s['name'] === 'string' ? s['name'] : undefined))
    .filter((n): n is string => !!n);
}

/** Load direct + transitive sub-loop specs for the A6 call graph. */
async function collectSubSpecs(
  raw: unknown,
  root: string,
  missing: string[],
  depth = 0,
  seen: Set<string> = new Set(),
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  if (depth > 5) return out;
  for (const name of subLoopNames(raw)) {
    if (seen.has(name)) continue; // revisit guarded by the validator's cycle check
    seen.add(name);
    try {
      const subPath = path.join(root, 'docs', 'loops', name, 'spec.md');
      const subRaw = await readSpecFile(subPath);
      out[name] = subRaw;
      Object.assign(out, await collectSubSpecs(subRaw, root, missing, depth + 1, seen));
    } catch {
      missing.push(name);
    }
  }
  return out;
}

/** A7 — the legacy string form (`isolation: worktree`) normalizes to the block. */
function normalizeIsolation(value: unknown): IsolationConfig {
  if (typeof value === 'string') return { mode: value as IsolationConfig['mode'] };
  if (isRecord(value)) {
    return {
      mode: value['mode'] as IsolationConfig['mode'],
      network: value['network'] as IsolationConfig['network'],
      allowlist: value['allowlist'] as string[] | undefined,
      credentials: value['credentials'] as IsolationConfig['credentials'],
    };
  }
  return { mode: value as IsolationConfig['mode'] };
}

export function applyDefaults(raw: unknown): LoopSpecification {
  const r = raw as Record<string, unknown>;
  const trigger = (r['trigger'] ?? {}) as Record<string, unknown>;
  const goal = (r['goal'] ?? {}) as Record<string, unknown>;
  const execution = (r['execution'] ?? {}) as Record<string, unknown>;
  const verification = (r['verification'] ?? {}) as Record<string, unknown>;
  const brakes = (r['brakes'] ?? {}) as Record<string, unknown>;
  const budget = (brakes['budget'] ?? {}) as Record<string, unknown>;
  const stagnation = (brakes['stagnation'] ?? {}) as Record<string, unknown>;
  const memory = (r['memory'] ?? {}) as Record<string, unknown>;
  const health = (r['health_metric'] ?? {}) as Record<string, unknown>;

  const level = verification['ladder_level'] as 1 | 2 | 3 | 4 | 5;
  const command = verification['command'] as string | undefined;
  const redGreenDefault = level <= 3 && !!command;

  return {
    name: r['name'] as string,
    description: r['description'] as string,
    use_when: r['use_when'] as string,
    trigger: {
      type: trigger['type'] as LoopSpecification['trigger']['type'],
      cron: trigger['cron'] as string | undefined,
      event_source: trigger['event_source'] as string | undefined,
    },
    goal: {
      statement: goal['statement'] as string,
      type: goal['type'] as LoopSpecification['goal']['type'],
    },
    execution: {
      isolation: normalizeIsolation(execution['isolation']),
      baseline: (execution['baseline'] as LoopSpecification['execution']['baseline']) ?? 'worktree-snapshot',
      ordering: (execution['ordering'] as LoopSpecification['execution']['ordering']) ?? 'sequential',
      steps: (execution['steps'] as string[]) ?? [],
      skills: (execution['skills'] as string[]) ?? [],
      sub_loops: execution['sub_loops'] as LoopSpecification['execution']['sub_loops'],
      enumerate: execution['enumerate'] as string | undefined,
      turn_command: execution['turn_command'] as string | undefined,
      stage_contract: execution['stage_contract'] as string | undefined,
      incremental: execution['incremental'] as LoopSpecification['execution']['incremental'],
    },
    verification: {
      ladder_level: level,
      command,
      expected_exit: verification['expected_exit'] as number | undefined,
      rubric: verification['rubric'] as LoopSpecification['verification']['rubric'],
      red_green:
        (verification['red_green'] as boolean | undefined) ?? redGreenDefault,
      critics: (verification['critics'] as number | undefined) ?? 1,
      success_streak: (verification['success_streak'] as number | undefined) ?? 2,
      hold_out: verification['hold_out'] as string | undefined,
      maker_checker: (verification['maker_checker'] as boolean | undefined) ?? false,
      judge_score_threshold:
        (verification['judge_score_threshold'] as number | undefined) ?? 0.8,
      eval_suite: verification['eval_suite'] as string | undefined,
      evaluate: (verification['evaluate'] as LoopSpecification['verification']['evaluate']) ?? 'output',
    },
    brakes: {
      budget: {
        max_iterations: budget['max_iterations'] as number,
        max_tokens: budget['max_tokens'] as number | undefined,
        max_dollars_usd: budget['max_dollars_usd'] as number | undefined,
        max_wallclock_s: budget['max_wallclock_s'] as number | undefined,
        sub_loop_multiplier: (budget['sub_loop_multiplier'] as number | undefined) ?? 0.5,
      },
      stagnation: {
        max_barren_turns: stagnation['max_barren_turns'] as number,
        detector:
          (stagnation['detector'] as LoopSpecification['brakes']['stagnation']['detector']) ??
          'consecutive_no_progress',
      },
      human_gates: (brakes['human_gates'] as string[]) ?? [],
    },
    terminal_states: (r['terminal_states'] ?? {}) as LoopSpecification['terminal_states'],
    memory: {
      location: memory['location'] as string,
      format: (memory['format'] as LoopSpecification['memory']['format']) ?? 'json',
      curated: (memory['curated'] as boolean | undefined) ?? false,
      fresh_context_each_turn:
        (memory['fresh_context_each_turn'] as boolean | undefined) ?? false,
    },
    architecture: r['architecture'] as LoopSpecification['architecture'],
    actuation: r['actuation'] as LoopSpecification['actuation'],
    oversight: r['oversight'] as LoopSpecification['oversight'],
    model: r['model'] as LoopSpecification['model'] | undefined,
    pattern_families: (r['pattern_families'] as LoopSpecification['pattern_families']) ?? [],
    health_metric: {
      name: 'cost_per_accepted_change',
      track_dollars: (health['track_dollars'] as boolean | undefined) ?? true,
      track_tokens: (health['track_tokens'] as boolean | undefined) ?? true,
    },
  };
}

export async function loadSpec(idOrPath: string, opts?: LoadOptions): Promise<LoadedSpec> {
  const root = opts?.root ?? process.cwd();
  const source = await resolveSpecPath(idOrPath, root);
  const raw = await readSpecFile(source);

  const missing: string[] = [];
  const subSpecs = await collectSubSpecs(raw, root, missing);
  const validation = validateSpec(raw, { subSpecs });
  for (const name of missing) {
    validation.warnings.push(`sub-loop spec not found: docs/loops/${name}/spec.md`);
  }
  validation.warnings.push(...modelRoutingWarnings(raw));

  if (!validation.ok && opts?.throwOnRefusal !== false) {
    throw new SpecRefusedError(validation.refusals);
  }

  return { spec: applyDefaults(raw), source, validation };
}

export async function validateSpecFile(
  idOrPath: string,
  opts?: LoadOptions,
): Promise<SpecFileValidation> {
  const root = opts?.root ?? process.cwd();
  const source = await resolveSpecPath(idOrPath, root);
  const raw = await readSpecFile(source);
  const missing: string[] = [];
  const subSpecs = await collectSubSpecs(raw, root, missing);
  const validation = validateSpec(raw, { subSpecs });
  for (const name of missing) {
    validation.warnings.push(`sub-loop spec not found: docs/loops/${name}/spec.md`);
  }
  validation.warnings.push(...modelRoutingWarnings(raw));
  return { ...validation, source };
}
