/**
 * Loop spec validator — anti-pattern refusal checks (blueprint §7.9) plus the
 * amendment checks A1, A3–A6, A8, A10, A11.
 *
 * Refusals block loading; warnings inform; the A11 checklist reports pass/fail
 * on the paper's five well-formed-loop review questions.
 */

import {
  LOOP_NAME_PATTERN,
  type PatternFamily,
} from './types.ts';
import { validateRubric } from '../evals/checker/rubric-template.ts';
import { checkAntiGaming } from '../../scripts/check-anti-gaming.js';
import { validateCheckerReport } from '../../scripts/validate-checker-report.js';
import { resolveLensesForFiles, validateCheckerLenses } from '../../scripts/validate-checker-lenses.js';

export interface ValidationResult {
  ok: boolean;
  refusals: string[];
  warnings: string[];
  checklist: ChecklistItem[];
}

export interface ChecklistItem {
  question: string;
  pass: boolean;
  detail: string;
}

export interface ValidateOpts {
  /** name → raw spec for directly referenced sub-loops (A6 call graph). */
  subSpecs?: Record<string, unknown>;
}

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Raw | undefined {
  return isRecord(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function list(value: unknown): unknown[] | undefined {
  return Array.isArray(value) ? value : undefined;
}

const GOAL_TYPES = new Set(['verifiable', 'judged', 'mixed']);
const TRIGGER_TYPES = new Set(['manual', 'scheduled', 'event']);
const ISOLATION_MODES = new Set(['worktree', 'container', 'none']);
const BASELINE_MODES = new Set(['git-stash', 'worktree-snapshot', 'none']);
const ORDERING_MODES = new Set(['worst-first', 'sequential']);
const DETECTORS = new Set([
  'consecutive_no_progress',
  'output_hash_unchanged',
  'yardstick_delta',
  'composite',
]);
const ARCHITECTURES = new Set(['solo', 'maker_checker', 'manager_helpers']);
const ACTUATIONS = new Set(['/goal', 'ralph_skeleton']);
const OVERSIGHT_MODES = new Set(['in', 'on', 'out']);
const PATTERN_FAMILIES = new Set([
  'A_define_done',
  'B_act_without_breaking',
  'C_earn_trust',
  'D_sustain',
]);

const TERMINAL_KEYS = ['success', 'no_op', 'blocked', 'stalled', 'exhausted'] as const;

/* ------------------------------------------------------------------ */
/* A6 — sub-loop call-graph cycle detection                            */
/* ------------------------------------------------------------------ */

function findCycle(
  start: string,
  graph: Record<string, string[]>,
  seen: Set<string>,
  stack: Set<string>,
): string[] | null {
  if (stack.has(start)) {
    return [start];
  }
  if (seen.has(start)) return null;
  seen.add(start);
  stack.add(start);
  for (const next of graph[start] ?? []) {
    const cycle = findCycle(next, graph, seen, stack);
    if (cycle) return [start, ...cycle];
  }
  stack.delete(start);
  return null;
}

function buildCallGraph(raw: Raw, subSpecs: Record<string, unknown>): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const addEdges = (node: string, spec: unknown): void => {
    const subs = list(asRecord(spec)?.['execution'] && asRecord(asRecord(spec)?.['execution'])?.['sub_loops']);
    const names = (subs ?? [])
      .map((s) => str(asRecord(s)?.['name']))
      .filter((n): n is string => !!n);
    graph[node] = names;
    for (const name of names) {
      if (!(name in graph) && subSpecs[name]) addEdges(name, subSpecs[name]);
    }
  };
  const rootName = str(raw['name']) ?? '<unnamed>';
  addEdges(rootName, raw);
  for (const [name, spec] of Object.entries(subSpecs)) {
    if (!(name in graph)) addEdges(name, spec);
  }
  return graph;
}

/* ------------------------------------------------------------------ */
/* Main validation                                                     */
/* ------------------------------------------------------------------ */

export function validateSpec(rawInput: unknown, opts?: ValidateOpts): ValidationResult {
  const refusals: string[] = [];
  const warnings: string[] = [];
  const checklist: ChecklistItem[] = [];

  if (!isRecord(rawInput)) {
    return {
      ok: false,
      refusals: ['spec must be a YAML mapping/object'],
      warnings: [],
      checklist: [],
    };
  }
  const raw = rawInput;
  const subSpecs = opts?.subSpecs ?? {};

  const name = str(raw['name']);
  const trigger = asRecord(raw['trigger']);
  const goal = asRecord(raw['goal']);
  const execution = asRecord(raw['execution']);
  const verification = asRecord(raw['verification']);
  const brakes = asRecord(raw['brakes']);
  const budget = asRecord(brakes?.['budget']);
  const stagnation = asRecord(brakes?.['stagnation']);
  const humanGates = list(brakes?.['human_gates']) ?? [];
  const terminalStates = asRecord(raw['terminal_states']);
  const memory = asRecord(raw['memory']);
  const healthMetric = asRecord(raw['health_metric']);

  /* ---- structural requirements ---- */
  if (!name) refusals.push('missing required field: name');
  else if (!LOOP_NAME_PATTERN.test(name)) {
    refusals.push(`name "${name}" must match ${LOOP_NAME_PATTERN} (e.g. "diagnose-loop")`);
  }
  if (!str(raw['description'])) refusals.push('missing required field: description');
  if (!str(raw['use_when'])) refusals.push('missing required field: use_when');
  if (!trigger) refusals.push('missing required field: trigger');
  else {
    const type = str(trigger['type']);
    if (!type || !TRIGGER_TYPES.has(type)) {
      refusals.push(`trigger.type must be one of manual|scheduled|event (got ${JSON.stringify(trigger['type'])})`);
    } else if (type === 'scheduled' && !str(trigger['cron'])) {
      refusals.push('trigger.type=scheduled requires trigger.cron');
    } else if (type === 'event' && !str(trigger['event_source'])) {
      refusals.push('trigger.type=event requires trigger.event_source');
    }
  }
  if (!goal) refusals.push('missing required field: goal');
  else {
    const goalType = str(goal['type']);
    if (!goalType || !GOAL_TYPES.has(goalType)) {
      refusals.push(`goal.type must be verifiable|judged|mixed (got ${JSON.stringify(goal['type'])})`);
    }
    if (!str(goal['statement'])) refusals.push('missing required field: goal.statement');
  }
  if (!execution) refusals.push('missing required field: execution');
  else {
    if (!list(execution['steps'])?.length) {
      refusals.push('execution.steps must declare the steps of one turn');
    }
    if (!list(execution['skills'])?.length) {
      // Anti-pattern #1 — while-true around a stranger (paper §7)
      refusals.push(
        'Anti-pattern "while-true around a stranger": loop calls no named skills. ' +
          'Loops must compose named, tested skills.',
      );
    }
    const skills = list(execution['skills']) ?? [];
    for (const skill of skills) {
      if (typeof skill !== 'string' || skill.trim().length === 0) {
        refusals.push('execution.skills entries must be non-empty skill names');
        break;
      }
    }
    const isolationValue = execution['isolation'];
    let isolationMode: string | undefined;
    let isolationNetwork: string | undefined;
    let isolationCredentials: string | undefined;
    if (typeof isolationValue === 'string') {
      if (!ISOLATION_MODES.has(isolationValue)) {
        refusals.push('execution.isolation must be worktree|container|none');
      } else {
        isolationMode = isolationValue;
      }
    } else if (isRecord(isolationValue)) {
      // A7 — sandbox block form
      isolationMode = str(isolationValue['mode']);
      isolationNetwork = str(isolationValue['network']);
      isolationCredentials = str(isolationValue['credentials']);
      if (!isolationMode || !ISOLATION_MODES.has(isolationMode)) {
        refusals.push(
          'execution.isolation block requires mode: worktree|container|none (A7)',
        );
      }
      if (isolationNetwork !== undefined && !['none', 'allowlist'].includes(isolationNetwork)) {
        refusals.push("execution.isolation.network must be 'none' | 'allowlist' (A7)");
      }
      if (isolationCredentials !== undefined && !['scoped', 'none'].includes(isolationCredentials)) {
        refusals.push("execution.isolation.credentials must be 'scoped' | 'none' (A7)");
      }
      const allowlist = isolationValue['allowlist'];
      if (allowlist !== undefined) {
        if (!Array.isArray(allowlist) || allowlist.some((h) => typeof h !== 'string')) {
          refusals.push('execution.isolation.allowlist must be a list of host strings (A7)');
        } else if (isolationNetwork === 'allowlist' && allowlist.length === 0) {
          refusals.push('execution.isolation.network=allowlist requires a non-empty allowlist (A7)');
        }
      }
      for (const key of Object.keys(isolationValue)) {
        if (!['mode', 'network', 'allowlist', 'credentials'].includes(key)) {
          refusals.push(`execution.isolation has unknown field: ${key} (A7 block: mode, network, allowlist, credentials)`);
        }
      }
    } else {
      refusals.push(
        'execution.isolation must be worktree|container|none or a {mode, network, credentials} block (A7)',
      );
    }
    // A7 — unattended triggers must declare the security sandbox before start
    const triggerType = str(trigger?.['type']);
    if (triggerType && triggerType !== 'manual') {
      const networkOk = isolationNetwork === 'none' || isolationNetwork === 'allowlist';
      const credentialsOk = isolationCredentials === 'scoped' || isolationCredentials === 'none';
      if (!networkOk || !credentialsOk) {
        refusals.push(
          `A7: unattended trigger (trigger.type=${triggerType}) refuses to start without a security sandbox — ` +
            'execution.isolation must declare network: none|allowlist and credentials: scoped|none ' +
            '(isolated container, no network, scoped credentials are not optional — Macedo 09)',
        );
      }
    }
    const baseline = str(execution['baseline']);
    if (baseline !== undefined && !BASELINE_MODES.has(baseline)) {
      refusals.push("execution.baseline must be 'git-stash' | 'worktree-snapshot' | 'none'");
    }
    const ordering = str(execution['ordering']);
    if (ordering === undefined) {
      // A3
      warnings.push(
        'A3: execution.ordering not declared — declare worst-first or sequential so triage order is explicit',
      );
    } else if (!ORDERING_MODES.has(ordering)) {
      refusals.push("execution.ordering must be 'worst-first' | 'sequential'");
    }
    if (!str(execution['enumerate'])) {
      // A4
      warnings.push(
        'A4: execution.enumerate not declared — without the full target surface, success can exit on a shallow happy path',
      );
    }
    // C9 — incremental (Make-style) gate: refuse a declared-but-malformed block
    const incremental = execution['incremental'];
    if (incremental !== undefined) {
      if (!isRecord(incremental)) {
        refusals.push(
          'C9: execution.incremental must be a mapping with root (folder of CONTEXT.md stages) and/or stages (inline stage list)',
        );
      } else {
        const incRoot = str(incremental['root']);
        const incStages = list(incremental['stages']);
        if (!incRoot && (!incStages || incStages.length === 0)) {
          refusals.push(
            'C9: execution.incremental declares neither root nor a non-empty stages list — nothing to fingerprint',
          );
        }
        if (incStages) {
          const seenIds = new Set<string>();
          for (const stage of incStages) {
            if (!isRecord(stage)) {
              refusals.push('C9: execution.incremental.stages entries must be mappings');
              break;
            }
            const id = str(stage['id']);
            const inputs = list(stage['inputs']);
            if (!id) {
              refusals.push('C9: every incremental stage needs a non-empty id');
              break;
            }
            if (seenIds.has(id)) {
              refusals.push(`C9: duplicate incremental stage id "${id}"`);
              break;
            }
            seenIds.add(id);
            if (!inputs || inputs.length === 0) {
              refusals.push(`C9: incremental stage "${id}" declares no inputs to fingerprint`);
              break;
            }
            if (inputs.some((p) => typeof p !== 'string' || p.trim().length === 0)) {
              refusals.push(`C9: incremental stage "${id}" inputs must be non-empty paths`);
              break;
            }
            if (inputs.some((p) => typeof p === 'string' && p.includes('*'))) {
              refusals.push(
                `C9: incremental stage "${id}" input is a glob — fingerprint concrete files or directories`,
              );
              break;
            }
          }
        }
      }
    }
    const families = list(raw['pattern_families']);
    if (!families || families.length === 0) {
      warnings.push('pattern_families is empty — declare which pattern families the loop relies on');
    } else {
      for (const f of families) {
        if (typeof f !== 'string' || !PATTERN_FAMILIES.has(f as PatternFamily)) {
          refusals.push(`unknown pattern family: ${JSON.stringify(f)}`);
          break;
        }
      }
    }
  }
  if (!verification) refusals.push('missing required field: verification');
  if (!brakes || !budget || !stagnation) {
    refusals.push(
      // Anti-pattern #5 — unattended runaway (paper §7)
      'Anti-pattern "unattended runaway": loop lacks budget or stagnation brake. Required.',
    );
  }
  if (!terminalStates) {
    refusals.push('missing required field: terminal_states');
  } else {
    for (const key of TERMINAL_KEYS) {
      if (!str(terminalStates[key])) {
        refusals.push(`terminal_states.${key} must be named (all 5 terminal states are required)`);
      }
    }
  }
  if (!memory) refusals.push('missing required field: memory');
  else if (!str(memory['location'])) refusals.push('memory.location must declare an on-disk path');
  if (!str(raw['architecture']) || !ARCHITECTURES.has(str(raw['architecture'])!)) {
    refusals.push('architecture must be solo|maker_checker|manager_helpers');
  }
  if (!str(raw['actuation']) || !ACTUATIONS.has(str(raw['actuation'])!)) {
    refusals.push("actuation must be '/goal' | 'ralph_skeleton'");
  }
  const oversight = str(raw['oversight']);
  if (!oversight || !OVERSIGHT_MODES.has(oversight)) {
    // A8
    refusals.push("oversight must be declared: 'in' | 'on' | 'out' (human autonomy spectrum, A8)");
  } else if (oversight === 'in' && humanGates.length === 0) {
    // A8 — human gates must be non-empty for oversight:in
    refusals.push(
      'A8: oversight="in" requires non-empty brakes.human_gates — the human checkpoint must gate irreversible actions',
    );
  }
  const model = asRecord(raw['model']);
  if (model !== undefined && !str(model['task_class'])) {
    // B7
    refusals.push('model.task_class must be a non-empty string (B7: task-class → model-tier routing)');
  }
  if (!healthMetric || healthMetric['name'] !== 'cost_per_accepted_change') {
    // A10(3)
    warnings.push(
      'A10: no measurable health_metric yardstick — declare health_metric.name=cost_per_accepted_change so a budget-burning loop is visibly broken',
    );
  }

  /* ---- verification-derived checks ---- */
  const level = num(verification?.['ladder_level']);
  const levelValid = level === 1 || level === 2 || level === 3 || level === 4 || level === 5;
  if (!levelValid) {
    refusals.push('verification.ladder_level must be an integer 1..5 (true level must be declared)');
  }
  const command = str(verification?.['command']);
  const rubricRaw = verification?.['rubric'];
  const rubricText = str(rubricRaw);
  const rubricStructured = isRecord(rubricRaw);
  const hasRubric = !!rubricText || rubricStructured;
  const makerChecker = bool(verification?.['maker_checker']) ?? false;
  const redGreenDeclared = bool(verification?.['red_green']);
  const redGreenRequired = redGreenDeclared ?? (levelValid && level !== null && level <= 3 && !!command);
  const baselineMode = str(execution?.['baseline']) ?? 'worktree-snapshot'; // loader default

  if (!command && !hasRubric) {
    // A10 golden rule + when-NOT-to-loop #1/#2
    refusals.push(
      'when-NOT-to-loop: no check that pushes back (no verification.command, no rubric) — ' +
        'the outcome of a turn cannot inform the next action; this is a scheduled one-shot, not a loop',
    );
  } else if (!command && hasRubric) {
    warnings.push(
      'A10: rubric-only verification — no deterministic command pushes back each turn; consider adding an L1 command as a pre-check',
    );
  }
  if (goal && str(goal['type']) === 'judged' && !command && !hasRubric) {
    refusals.push(
      'when-NOT-to-loop #2: pure-judgment goals are not loopable — the goal is pure taste with no reproducible check',
    );
  }
  if (levelValid && level !== null && level <= 3 && !command) {
    refusals.push(
      `L${level} verification requires a concrete verification command (a test, assertion, or exit code)`,
    );
  }
  if (level === 4) {
    if (!hasRubric) {
      // Anti-pattern #4 — pretending L4 is L1 (paper §7)
      refusals.push(
        'Anti-pattern "pretending level 4 is level 1": L4 declared but no rubric. ' +
          'Either lower the ladder level or add a rubric.',
      );
    } else if (rubricText && !rubricStructured) {
      // B2 — freeform prose rubrics are refused at L4
      refusals.push(
        'B2: L4 rubric must be structured — freeform prose rubrics are refused. ' +
          'Declare dimensions (task_success, tool_use_quality, trajectory_compliance, hallucination, ' +
          'response_quality; weights sum to 1) + threshold per .shiftstone/harness/evals/rubric-schema.json. ' +
          'Start from RUBRIC_TEMPLATE in .shiftstone/harness/evals/checker/rubric-template.ts.',
      );
    } else if (rubricStructured) {
      for (const problem of validateRubric(rubricRaw)) {
        refusals.push(`B2: ${problem}`);
      }
    }
    if (!makerChecker) {
      // Anti-pattern #2 — self-approving loop (paper §7)
      refusals.push(
        'Anti-pattern "self-approving loop": L4 verification requires a disjoint maker-checker split (maker_checker=true).',
      );
    }
    if (str(raw['architecture']) !== 'maker_checker') {
      refusals.push('L4 verification requires architecture: maker_checker');
    }
  }
  if (redGreenRequired && baselineMode === 'none') {
    // A1 — red-before/green-after proof impossible without a baseline
    refusals.push(
      'A1: red_green proof requested but execution.baseline="none" — the verifier can never fail against a pre-mutation baseline. ' +
        'Use worktree-snapshot or git-stash, or disable red_green.',
    );
  }
  const critics = num(verification?.['critics']) ?? 1;
  if (!Number.isInteger(critics) || critics < 1) {
    refusals.push('verification.critics must be an integer >= 1 (A5 multi-critic consensus)');
  }
  const streak = num(verification?.['success_streak']) ?? 2;
  if (!Number.isInteger(streak) || streak < 1) {
    refusals.push('verification.success_streak must be an integer >= 1');
  }
  if (verification?.['eval_suite'] !== undefined && !str(verification['eval_suite'])) {
    refusals.push('verification.eval_suite must be a non-empty suite name (B1: evals/<name>/)');
  }
  const evaluate = str(verification?.['evaluate']);
  if (evaluate !== undefined && !['output', 'trajectory', 'both'].includes(evaluate)) {
    // B3
    refusals.push("verification.evaluate must be 'output' | 'trajectory' | 'both' (B3)");
  }

  /* ---- anti-pattern #3 — spec gaming (L1 writable tests) ---- */
  if (level === 1) {
    const steps = (list(execution?.['steps']) ?? []).map((s) => String(s));
    const writesTests = steps.some(
      (s) =>
        /\btests?\//i.test(s) ||
        /\btests?\b.*\b(edit|modif|change|skip|mock|disable|rewrite|delete)/i.test(s),
    );
    const holdOut = str(verification?.['hold_out']);
    if (writesTests && !holdOut) {
      refusals.push(
        'Anti-pattern "specification gaming": L1 verification requires read-only test files. Use hold_out set.',
      );
    } else if (writesTests && holdOut) {
      warnings.push('L1 loop edits tests but also declares hold_out — ensure the agent cannot write the hold-out set');
    }
  }

  /* ---- brakes ---- */
  const maxIterations = num(budget?.['max_iterations']);
  if (maxIterations === undefined) {
    refusals.push(
      'Anti-pattern "unattended runaway": brakes.budget.max_iterations missing — a hard iteration ceiling (N <= 10) is required',
    );
  } else if (maxIterations > 10) {
    refusals.push(`brakes.budget.max_iterations=${maxIterations} exceeds the paper's hard cap of 10`);
  } else if (maxIterations < 1) {
    refusals.push('brakes.budget.max_iterations must be >= 1');
  }
  const maxBarren = num(stagnation?.['max_barren_turns']);
  if (maxBarren === undefined) {
    refusals.push(
      'Anti-pattern "unattended runaway": brakes.stagnation.max_barren_turns missing — a no-progress detector is required',
    );
  } else if (maxBarren < 1) {
    refusals.push('brakes.stagnation.max_barren_turns must be >= 1');
  }
  const detector = str(stagnation?.['detector']);
  if (detector === undefined) {
    warnings.push('brakes.stagnation.detector not declared — defaulting to consecutive_no_progress');
  } else if (!DETECTORS.has(detector)) {
    refusals.push(
      `brakes.stagnation.detector must be one of ${[...DETECTORS].join('|')}`,
    );
  }
  const multiplier = num(budget?.['sub_loop_multiplier']);
  if (multiplier !== undefined && (multiplier <= 0 || multiplier > 1)) {
    refusals.push('brakes.budget.sub_loop_multiplier must be in (0, 1] — sub-loops get a fraction of the parent budget');
  }

  /* ---- A6 — no-recursion rule ---- */
  const rootName = name ?? '<unnamed>';
  const graph = buildCallGraph(raw, subSpecs);
  const cycle = findCycle(rootName, graph, new Set(), new Set());
  if (cycle) {
    refusals.push(
      `A6: sub-loop call-graph cycle detected (${cycle.join(' → ')}) — ` +
        'a sub-loop may not invoke its own caller (recursion forbidden).',
    );
  }
  for (const [subName, subRaw] of Object.entries(subSpecs)) {
    const subResult = validateSpec(subRaw, { subSpecs: {} });
    for (const r of subResult.refusals) {
      refusals.push(`sub-loop "${subName}": ${r}`);
    }
  }

  /* ---- A11 — well-formed-loop 5-question checklist ---- */
  const q1Pass = !!command || hasRubric;
  checklist.push({
    question: 'Trigger: is the loop justified over a scheduled one-shot?',
    pass: q1Pass,
    detail: q1Pass
      ? 'a check exists, so turn t can inform turn t+1'
      : 'no check — feedback cannot change the next action',
  });

  const q2Pass =
    !!levelValid &&
    ((level! <= 3 && !!command) || (level! >= 4 && hasRubric && makerChecker));
  checklist.push({
    question: 'Goal & Verification: is the true ladder level declared and L4 hardened?',
    pass: q2Pass,
    detail: q2Pass
      ? `L${level} with ${level! >= 4 ? 'rubric + disjoint checker' : 'deterministic command'}`
      : `L${level} declared without ${level! >= 4 ? 'rubric/maker-checker' : 'a deterministic command'}`,
  });

  const q3Pass = level === undefined || level === null || level < 4 || (makerChecker && str(raw['architecture']) === 'maker_checker');
  checklist.push({
    question: 'Architecture: is the maker distinct from the checker where a judge is involved?',
    pass: q3Pass,
    detail: q3Pass ? 'maker/checker disjoint' : 'same-context maker and checker',
  });

  const q4Issues: string[] = [];
  if (!terminalStates || TERMINAL_KEYS.some((k) => !str(terminalStates[k]))) q4Issues.push('not all 5 terminal states named');
  if (maxBarren === undefined || maxBarren > 2) q4Issues.push('does not halt on 2 barren turns');
  if (maxIterations === undefined) q4Issues.push('no strict budget ceiling');
  const q4Pass = q4Issues.length === 0;
  checklist.push({
    question: 'Stopping Rules: terminal states named, error ≠ success, 2-barren halt, budget ceiling?',
    pass: q4Pass,
    detail: q4Pass ? 'all stopping rules present' : q4Issues.join('; '),
  });
  if (!q4Pass && maxBarren !== undefined && maxBarren > 2) {
    warnings.push(`stagnation.max_barren_turns=${maxBarren} — the paper's checklist expects a halt on 2 barren turns`);
  }

  const q5Issues: string[] = [];
  if (!memory || !str(memory['location'])) q5Issues.push('no on-disk memory location');
  if (memory && bool(memory['curated']) !== true) q5Issues.push('memory not curated (lessons pruned on evidence)');
  const q5Pass = q5Issues.length === 0;
  checklist.push({
    question: 'Memory: is state curated and persisted on disk with per-turn context reset?',
    pass: q5Pass,
    detail: q5Pass ? 'on-disk, curated memory declared' : q5Issues.join('; '),
  });
  if (!q5Pass) warnings.push(`A11 memory: ${q5Issues.join('; ')}`);

  return { ok: refusals.length === 0, refusals, warnings, checklist };
}

export function formatValidation(result: ValidationResult): string {
  const lines: string[] = [];
  lines.push('Well-formed-loop checklist (A11):');
  for (const item of result.checklist) {
    lines.push(`  [${item.pass ? 'PASS' : 'FAIL'}] ${item.question}`);
    lines.push(`         ${item.detail}`);
  }
  if (result.refusals.length > 0) {
    lines.push('Refusals:');
    for (const r of result.refusals) lines.push(`  ✗ ${r}`);
  }
  if (result.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of result.warnings) lines.push(`  ! ${w}`);
  }
  lines.push(result.ok ? 'RESULT: accepted' : 'RESULT: REFUSED');
  return lines.join('\n');
}

export interface AntiGamingGateResult {
  ok: boolean;
  violations: Array<{ code: string; file?: string; line?: string; message: string }>;
  filesInspected: number;
}

/**
 * Level 1.5 Anti-Gaming Gate: Inspects git diffs before Level 2 execution to prevent
 * test file deletion, bypass modifiers (.skip), and suppression directives (UG-18, UG-19).
 */
export function runAntiGamingGate(opts?: {
  diff?: string;
  root?: string;
  hasApproval?: boolean;
  allowConfigMutation?: boolean;
}): AntiGamingGateResult {
  return checkAntiGaming(opts);
}

/**
 * Level 4 Two-Gate Checker Report Validator: Enforces the LOCK-03 Two-Gate contract
 * (Gate A: zero unresolved high/crit findings + Gate B: calibrated normalized score)
 * on Checker review output.
 */
export function validateLevel4CheckerReport(
  report: unknown,
  opts?: { filePath?: string },
) {
  return validateCheckerReport(report, opts);
}

/**
 * Resolves active conditional checker lenses matching target file paths (UG-15, UG-16).
 */
export function resolveCheckerLenses(
  files: string[],
  opts?: { root?: string },
) {
  return resolveLensesForFiles(files, opts);
}

