import { describe, expect, it } from 'vitest';
import { validateSpec } from '../../harness/loop-runner/validator.ts';
import { RUBRIC_TEMPLATE } from '../../harness/evals/checker/rubric-template.ts';

function rawSpec(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    name: 'valid-loop',
    description: 'a valid loop',
    use_when: 'testing validity',
    trigger: { type: 'manual' },
    goal: { statement: 'checks pass', type: 'verifiable' },
    execution: {
      isolation: 'none',
      baseline: 'worktree-snapshot',
      ordering: 'worst-first',
      steps: ['do one thing'],
      skills: ['stack'],
      enumerate: 'list-targets',
    },
    verification: {
      ladder_level: 1,
      command: 'check',
      expected_exit: 0,
      red_green: true,
      success_streak: 2,
      maker_checker: false,
    },
    brakes: {
      budget: { max_iterations: 10, sub_loop_multiplier: 0.5 },
      stagnation: { max_barren_turns: 2, detector: 'consecutive_no_progress' },
      human_gates: ['git push'],
    },
    terminal_states: {
      success: 's',
      no_op: 'n',
      blocked: 'b',
      stalled: 'st',
      exhausted: 'e',
    },
    memory: { location: '.loops/valid-loop/state.json', format: 'json', curated: true },
    architecture: 'solo',
    actuation: '/goal',
    oversight: 'out',
    pattern_families: ['A_define_done'],
    health_metric: { name: 'cost_per_accepted_change', track_dollars: true, track_tokens: true },
    ...overrides,
  };
}

function refusals(overrides?: Record<string, unknown>): string[] {
  return validateSpec(rawSpec(overrides)).refusals;
}

describe('acceptance of a well-formed spec', () => {
  it('accepts and reports a passing 5-question checklist (A11)', () => {
    const result = validateSpec(rawSpec());
    expect(result.ok).toBe(true);
    expect(result.refusals).toEqual([]);
    expect(result.checklist).toHaveLength(5);
    expect(result.checklist.every((item) => item.pass)).toBe(true);
    expect(result.checklist.map((i) => i.question).join(' ')).toMatch(/Trigger/);
  });

  it('warns (but does not refuse) on missing A3/A4 declarations', () => {
    const spec = rawSpec();
    delete (spec['execution'] as Record<string, unknown>)['ordering'];
    delete (spec['execution'] as Record<string, unknown>)['enumerate'];
    const result = validateSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/A3: execution.ordering/);
    expect(result.warnings.join(' ')).toMatch(/A4: execution.enumerate/);
  });
});

describe('the 5 blueprint anti-patterns (§7.9)', () => {
  it('#1 while-true around a stranger: empty skills', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['skills'] = [];
    expect(validateSpec(spec).refusals.join(' ')).toMatch(/while-true around a stranger/);
  });

  it('#2 self-approving loop: L4 without maker_checker', () => {
    const result = validateSpec(
      rawSpec({
        verification: {
          ladder_level: 4,
          command: 'check',
          rubric: RUBRIC_TEMPLATE,
          maker_checker: false,
          success_streak: 2,
        },
        architecture: 'maker_checker',
      }),
    );
    expect(result.refusals.join(' ')).toMatch(/self-approving loop/);
  });

  it('#3 spec gaming: L1 loop writes its own tests without a hold-out', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['steps'] = ['edit tests/unit/foo.test.ts to fix it'];
    expect(refusals(spec).join(' ')).toMatch(/specification gaming/);
  });

  it('#3 is waived when a hold_out set is declared', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['steps'] = ['edit tests/unit/foo.test.ts to fix it'];
    (spec['verification'] as Record<string, unknown>)['hold_out'] = 'tests/hold-out/';
    const result = validateSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/hold_out/);
  });

  it('#4 pretending L4 is L1: L4 without a rubric', () => {
    const result = validateSpec(
      rawSpec({
        verification: {
          ladder_level: 4,
          command: 'check',
          maker_checker: true,
          success_streak: 2,
        },
        architecture: 'maker_checker',
      }),
    );
    expect(result.refusals.join(' ')).toMatch(/pretending level 4 is level 1/);
  });

  it('#5 unattended runaway: missing budget or stagnation brake', () => {
    const missingBudget = rawSpec();
    (missingBudget['brakes'] as Record<string, unknown>)['budget'] = {
      sub_loop_multiplier: 0.5,
    };
    expect(validateSpec(missingBudget).refusals.join(' ')).toMatch(/unattended runaway/);

    const missingStagnation = rawSpec();
    (missingStagnation['brakes'] as Record<string, unknown>)['stagnation'] = {
      detector: 'consecutive_no_progress',
    };
    expect(validateSpec(missingStagnation).refusals.join(' ')).toMatch(/unattended runaway/);
  });

  it('#5 refuses more than 10 iterations (paper N ≤ 10)', () => {
    const spec = rawSpec();
    (spec['brakes'] as Record<string, unknown>)['budget'] = {
      max_iterations: 50,
      sub_loop_multiplier: 0.5,
    };
    expect(refusals(spec).join(' ')).toMatch(/exceeds the paper's hard cap of 10/);
  });
});

describe('amendment checks', () => {
  it('A1: red_green with baseline none is refused', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['baseline'] = 'none';
    expect(refusals(spec).join(' ')).toMatch(/A1: red_green proof requested/);
  });

  it('A6: sub-loop call-graph cycle is refused (a sub-loop may not invoke its caller)', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['sub_loops'] = [{ name: 'child-loop' }];
    const child = {
      ...rawSpec({ name: 'child-loop' }),
      execution: {
        ...(rawSpec().execution as object),
        sub_loops: [{ name: 'valid-loop' }],
      },
    };
    const result = validateSpec(spec, { subSpecs: { 'child-loop': child } });
    expect(result.refusals.join(' ')).toMatch(/cycle detected/);
    expect(result.refusals.join(' ')).toMatch(/recursion forbidden/);
  });

  it('A6: direct self-reference is refused', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['sub_loops'] = [{ name: 'valid-loop' }];
    expect(refusals(spec).join(' ')).toMatch(/cycle detected/);
  });

  it('A6: invalid sub-loop specs are refused with a sub-loop prefix', () => {
    const spec = rawSpec();
    (spec['execution'] as Record<string, unknown>)['sub_loops'] = [{ name: 'child-loop' }];
    const child = rawSpec({ name: 'child-loop' });
    (child['execution'] as Record<string, unknown>)['skills'] = [];
    const result = validateSpec(spec, { subSpecs: { 'child-loop': child } });
    expect(result.refusals.join(' ')).toMatch(/sub-loop "child-loop":.*while-true/);
  });

  it('A10: no command and no rubric is a scheduled one-shot, not a loop', () => {
    const spec = rawSpec();
    delete (spec['verification'] as Record<string, unknown>)['command'];
    expect(refusals(spec).join(' ')).toMatch(/scheduled one-shot, not a loop/);
  });

  it('A10: pure-judgment goal with no check is not loopable', () => {
    const spec = rawSpec({
      goal: { statement: 'make it feel premium', type: 'judged' },
      verification: { ladder_level: 5, success_streak: 1, maker_checker: false },
    });
    const result = validateSpec(spec);
    expect(result.refusals.join(' ')).toMatch(/pure-judgment goals are not loopable/);
  });

  it('A10: rubric-only verification warns instead of refusing', () => {
    const spec = rawSpec({
      verification: {
        ladder_level: 4,
        rubric: RUBRIC_TEMPLATE,
        maker_checker: true,
        success_streak: 2,
      },
      architecture: 'maker_checker',
      goal: { statement: 'judged well', type: 'judged' },
    });
    const result = validateSpec(spec);
    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/rubric-only verification/);
  });

  it('B2: L4 freeform prose rubrics are refused; structured rubrics pass', () => {
    const freeform = rawSpec({
      verification: {
        ladder_level: 4,
        command: 'check',
        rubric: 'Score 1.0 if it looks good.',
        maker_checker: true,
        success_streak: 2,
      },
      architecture: 'maker_checker',
    });
    const refused = validateSpec(freeform);
    expect(refused.ok).toBe(false);
    expect(refused.refusals.join(' ')).toMatch(/B2: L4 rubric must be structured/);
    expect(refused.refusals.join(' ')).toMatch(/rubric-schema\.json/);

    const structured = rawSpec({
      verification: {
        ladder_level: 4,
        command: 'check',
        rubric: RUBRIC_TEMPLATE,
        maker_checker: true,
        success_streak: 2,
      },
      architecture: 'maker_checker',
    });
    expect(validateSpec(structured).ok).toBe(true);
  });

  it('B2: a structured rubric missing a dimension is refused', () => {
    const partial = JSON.parse(JSON.stringify(RUBRIC_TEMPLATE)) as Record<string, unknown>;
    const dimensions = partial['dimensions'] as Record<string, unknown>;
    delete dimensions['hallucination'];
    const result = validateSpec(
      rawSpec({
        verification: {
          ladder_level: 4,
          command: 'check',
          rubric: partial,
          maker_checker: true,
          success_streak: 2,
        },
        architecture: 'maker_checker',
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.refusals.join(' ')).toMatch(/B2: missing required dimension: hallucination/);
  });

  it('A8: oversight must be declared, and oversight:in needs human gates', () => {
    const noOversight = rawSpec();
    delete noOversight['oversight'];
    expect(validateSpec(noOversight).refusals.join(' ')).toMatch(/oversight must be declared/);

    const inLoopNoGates = rawSpec({ oversight: 'in' });
    (inLoopNoGates['brakes'] as Record<string, unknown>)['human_gates'] = [];
    expect(refusals(inLoopNoGates).join(' ')).toMatch(/oversight="in" requires non-empty/);
  });

  it('structural: name pattern and all 5 terminal states', () => {
    expect(refusals({ ...rawSpec(), name: 'nope' }).join(' ')).toMatch(/must match/);
    const spec = rawSpec();
    (spec['terminal_states'] as Record<string, unknown>)['stalled'] = '';
    expect(refusals(spec).join(' ')).toMatch(/terminal_states.stalled/);
  });

  it('A11 checklist reports FAILs that map to warnings', () => {
    const spec = rawSpec();
    (spec['memory'] as Record<string, unknown>)['curated'] = false;
    const result = validateSpec(spec);
    const memory = result.checklist.find((i) => i.question.startsWith('Memory'));
    expect(memory?.pass).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/A11 memory/);
    // checklist failure alone is a warning, not a refusal
    expect(result.ok).toBe(true);
  });

  it('rejects non-object specs', () => {
    expect(validateSpec('not a spec').ok).toBe(false);
    expect(validateSpec(null).refusals[0]).toMatch(/mapping/);
  });

  it('B7: model.task_class must be a non-empty string when declared', () => {
    expect(validateSpec(rawSpec({ model: { task_class: 'implementation' } })).ok).toBe(true);
    const refused = validateSpec(rawSpec({ model: { task_class: '' } }));
    expect(refused.ok).toBe(false);
    expect(refused.refusals.join(' ')).toMatch(/model\.task_class must be a non-empty string/);
  });

  it('A7: an unattended trigger without a security sandbox is refused at load', () => {
    const result = validateSpec(
      rawSpec({ trigger: { type: 'scheduled', cron: '0 3 * * *' } }),
    );
    expect(result.ok).toBe(false);
    expect(result.refusals.join(' ')).toMatch(
      /A7: unattended trigger \(trigger\.type=scheduled\) refuses to start without a security sandbox/,
    );
    expect(result.refusals.join(' ')).toMatch(/network: none\|allowlist and credentials: scoped\|none/);
  });

  it('A7: sandboxed unattended loops pass; block fields are validated', () => {
    const sandboxed = rawSpec({
      trigger: { type: 'event', event_source: 'webhook:push' },
      execution: {
        ...(rawSpec().execution as object),
        isolation: { mode: 'container', network: 'none', credentials: 'scoped' },
      },
    });
    expect(validateSpec(sandboxed).ok).toBe(true);

    const badNetwork = rawSpec({
      trigger: { type: 'scheduled', cron: '0 3 * * *' },
      execution: {
        ...(rawSpec().execution as object),
        isolation: { mode: 'container', network: 'open', credentials: 'scoped' },
      },
    });
    expect(validateSpec(badNetwork).refusals.join(' ')).toMatch(/isolation\.network must be 'none' \| 'allowlist'/);

    const badCredentials = rawSpec({
      trigger: { type: 'scheduled', cron: '0 3 * * *' },
      execution: {
        ...(rawSpec().execution as object),
        isolation: { mode: 'worktree', network: 'none', credentials: 'admin' },
      },
    });
    expect(validateSpec(badCredentials).refusals.join(' ')).toMatch(/isolation\.credentials must be 'scoped' \| 'none'/);

    const unknownField = rawSpec({
      execution: {
        ...(rawSpec().execution as object),
        isolation: { mode: 'none', vibes: 'open' },
      },
    });
    expect(validateSpec(unknownField).refusals.join(' ')).toMatch(/unknown field: vibes/);

    const emptyAllowlist = rawSpec({
      execution: {
        ...(rawSpec().execution as object),
        isolation: { mode: 'none', network: 'allowlist', allowlist: [], credentials: 'none' },
      },
    });
    expect(validateSpec(emptyAllowlist).refusals.join(' ')).toMatch(/requires a non-empty allowlist/);
  });
});
