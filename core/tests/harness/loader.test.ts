import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { applyDefaults, loadSpec, resolveSpecPath, validateSpecFile } from '../../harness/loop-runner/loader.ts';
import { SpecRefusedError } from '../../harness/loop-runner/types.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('reference loops pass the refusal gate', () => {
  it.each(['diagnose-loop', 'schema-sync-loop', 'new-feature-loop', 'quality-flywheel-loop'])(
    'loads %s with a fully passing validation',
    async (id) => {
      const { spec, validation, source } = await loadSpec(id, { root: REPO_ROOT });
      expect(spec.name).toBe(id);
      expect(validation.ok).toBe(true);
      expect(validation.checklist).toHaveLength(5);
      expect(source.endsWith(path.join('docs', 'loops', id, 'spec.md'))).toBe(true);
    },
  );

  it('applies loader defaults (A5 critics, judge threshold, streak, baseline, multiplier)', () => {
    const spec = applyDefaults({
      name: 'defaults-loop',
      description: 'd',
      use_when: 'u',
      trigger: { type: 'manual' },
      goal: { statement: 'g', type: 'verifiable' },
      execution: { isolation: 'none', steps: ['s'], skills: ['stack'] },
      verification: { ladder_level: 1, command: 'check', maker_checker: false },
      brakes: {
        budget: { max_iterations: 3 },
        stagnation: { max_barren_turns: 2 },
      },
      terminal_states: { success: 'a', no_op: 'b', blocked: 'c', stalled: 'd', exhausted: 'e' },
      memory: { location: '.loops/defaults-loop/state.json' },
      architecture: 'solo',
      actuation: '/goal',
      oversight: 'out',
      pattern_families: ['A_define_done'],
      health_metric: { name: 'cost_per_accepted_change', track_dollars: true, track_tokens: true },
    });

    expect(spec.execution.baseline).toBe('worktree-snapshot'); // A2 default
    expect(spec.execution.ordering).toBe('sequential'); // A3 default
    expect(spec.execution.isolation).toEqual({ mode: 'none' }); // A7: string form → block
    expect(spec.verification.red_green).toBe(true); // A1 default for L1 + command
    expect(spec.verification.critics).toBe(1); // A5 default
    expect(spec.verification.success_streak).toBe(2); // Family A default
    expect(spec.verification.judge_score_threshold).toBe(0.8);
    expect(spec.brakes.budget.sub_loop_multiplier).toBe(0.5);
    expect(spec.brakes.stagnation.detector).toBe('consecutive_no_progress');
    expect(spec.health_metric.name).toBe('cost_per_accepted_change');
  });

  it('reports a missing loop with the searched paths', async () => {
    await expect(loadSpec('no-such-loop', { root: REPO_ROOT })).rejects.toThrow(/not found/);
    await expect(resolveSpecPath('no-such-loop', REPO_ROOT)).rejects.toThrow(/docs.loops/);
  });

  it('A7 — passes the isolation sandbox block through unchanged', () => {
    const spec = applyDefaults({
      name: 'sandbox-loop',
      description: 'd',
      use_when: 'u',
      trigger: { type: 'scheduled', cron: '0 3 * * *' },
      goal: { statement: 'g', type: 'verifiable' },
      execution: {
        isolation: { mode: 'container', network: 'none', credentials: 'scoped' },
        steps: ['s'],
        skills: ['stack'],
      },
      verification: { ladder_level: 1, command: 'check', maker_checker: false },
      brakes: {
        budget: { max_iterations: 3 },
        stagnation: { max_barren_turns: 2 },
      },
      terminal_states: { success: 'a', no_op: 'b', blocked: 'c', stalled: 'd', exhausted: 'e' },
      memory: { location: '.loops/sandbox-loop/state.json' },
      architecture: 'solo',
      actuation: '/goal',
      oversight: 'out',
      pattern_families: ['A_define_done'],
      health_metric: { name: 'cost_per_accepted_change', track_dollars: true, track_tokens: true },
    });
    expect(spec.execution.isolation).toEqual({
      mode: 'container',
      network: 'none',
      credentials: 'scoped',
    });
  });

  it('the shipped quality-flywheel-loop passes the refusal gate (A7 block form)', async () => {
    const { spec, validation } = await loadSpec('quality-flywheel-loop', { root: REPO_ROOT });
    expect(validation.ok).toBe(true);
    expect(spec.execution.isolation).toEqual({
      mode: 'none',
      network: 'none',
      credentials: 'none',
    });
    expect(spec.model).toEqual({ task_class: 'monitoring' }); // B7 passthrough
    expect(spec.verification.evaluate).toBe('output'); // B3 default
  });
});

describe('refused specs throw SpecRefusedError', () => {
  it('refuses a spec with anti-patterns and lists every refusal', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'bad-spec-'));
    await mkdir(path.join(root, 'docs', 'loops', 'bad-loop'), { recursive: true });
    await writeFile(
      path.join(root, 'docs', 'loops', 'bad-loop', 'spec.md'),
      [
        'name: bad-loop',
        'description: has anti-patterns',
        'use_when: never',
        'trigger: {type: manual}',
        'goal: {statement: g, type: verifiable}',
        'execution:',
        '  isolation: none',
        '  steps: ["edit tests/a.test.ts"]',
        '  skills: []',
        'verification: {ladder_level: 1, command: check}',
        'brakes:',
        '  budget: {sub_loop_multiplier: 0.5}',
        '  stagnation: {detector: consecutive_no_progress}',
        '  human_gates: []',
        'terminal_states: {success: a, no_op: "", blocked: c, stalled: d, exhausted: e}',
        'memory: {location: x}',
        'architecture: solo',
        'actuation: /goal',
        'pattern_families: [A_define_done]',
        'health_metric: {name: cost_per_accepted_change}',
      ].join('\n'),
      'utf8',
    );

    await expect(loadSpec('bad-loop', { root: root })).rejects.toThrow(SpecRefusedError);
    const validation = await validateSpecFile('bad-loop', { root });
    expect(validation.ok).toBe(false);
    expect(validation.refusals.join(' ')).toMatch(/while-true/);
    expect(validation.refusals.join(' ')).toMatch(/unattended runaway/);
    expect(validation.refusals.join(' ')).toMatch(/oversight must be declared/);
  });
});
