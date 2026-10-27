import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executePipelineStep,
  getMandatorySteps,
  getOptionalSteps,
  getStepById,
  loadPipeline,
  runStepPipeline,
} from '../../init/pipeline-runner.js';
import { loadState, saveCheckpoint } from '../../init/session-state.js';

describe('Unit U4 — Declarative Step Pipeline Registry & Pluggable Runner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U4-01 (L1) — Schema Conformance & Step Resolution', () => {
    it('validates step-pipeline.json contains the 9 core steps with unique IDs and valid properties', () => {
      const pipeline = loadPipeline();
      expect(Array.isArray(pipeline)).toBe(true);
      expect(pipeline.length).toBe(9);

      const ids = pipeline.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(9);

      for (const step of pipeline) {
        expect(step.id).toBeDefined();
        expect(typeof step.id).toBe('string');
        expect(step.title).toBeDefined();
        expect(typeof step.title).toBe('string');
        expect(step.phase).toBeDefined();
        expect(typeof step.is_optional).toBe('boolean');
        expect(typeof step.baseline_sec).toBe('number');
        expect(step.baseline_sec).toBeGreaterThan(0);
        expect(Array.isArray(step.substeps)).toBe(true);
        expect(step.substeps.length).toBeGreaterThan(0);
      }
    });

    it('correctly categorizes mandatory vs optional steps', () => {
      const pipeline = loadPipeline();
      const mandatory = getMandatorySteps(pipeline);
      const optional = getOptionalSteps(pipeline);

      expect(mandatory.length).toBe(7);
      expect(optional.length).toBe(2);

      const optionalIds = optional.map((s) => s.id);
      expect(optionalIds).toContain('step_5_branding');
      expect(optionalIds).toContain('step_7_research');

      for (const opt of optional) {
        expect(opt.skip_behavior).toBeDefined();
        expect(typeof opt.skip_behavior.prompt).toBe('string');
        expect(typeof opt.skip_behavior.post_init_suggestion).toBe('string');
      }
    });

    it('retrieves step by ID cleanly', () => {
      const pipeline = loadPipeline();
      const step5 = getStepById(pipeline, 'step_5_branding');
      expect(step5).toBeDefined();
      expect(step5?.title).toContain('Brand');
      expect(step5?.is_optional).toBe(true);

      const nonExistent = getStepById(pipeline, 'step_99_does_not_exist');
      expect(nonExistent).toBeUndefined();
    });
  });

  describe('TS-U4-02 (L2) — Execution & Skip Behavior Flow', () => {
    it('confirms skipping Step 5 records step_5_branding into skipped_steps and proceeds to Step 6', async () => {
      const pipeline = loadPipeline();

      // Initialize state at Gate 4 completed
      saveCheckpoint(tempDir, {
        current_step: 'step_5_branding',
        completed_steps: [
          'gate_1_problem_space',
          'gate_2_actors_rbac',
          'gate_3_entity_modeling',
          'gate_4_tenant_security',
        ],
        skipped_steps: [],
        context_data: { testVal: 'active' },
      });

      const step5 = getStepById(pipeline, 'step_5_branding')!;
      expect(step5).toBeDefined();

      // Mock prompt function returning "Skip for now"
      const mockPromptSkip = async (question: string, options: string[]) => {
        expect(options.some((o) => o.toLowerCase().includes('skip'))).toBe(true);
        return 'Skip for now';
      };

      const result = await executePipelineStep({
        root: tempDir,
        step: step5,
        pipeline,
        promptFn: mockPromptSkip,
      });

      expect(result.skipped).toBe(true);
      expect(result.nextStepId).toBe('step_6_stack_archetype');

      // Verify persisted state
      const state = loadState(tempDir)!;
      expect(state.skipped_steps).toContain('step_5_branding');
      expect(state.completed_steps).not.toContain('step_5_branding');
      expect(state.current_step).toBe('step_6_stack_archetype');
    });

    it('executes optional step when user chooses to configure it', async () => {
      const pipeline = loadPipeline();

      saveCheckpoint(tempDir, {
        current_step: 'step_5_branding',
        completed_steps: ['gate_1_problem_space'],
        skipped_steps: [],
        context_data: {},
      });

      const step5 = getStepById(pipeline, 'step_5_branding')!;

      // Mock prompt function returning "Configure now"
      const mockPromptConfigure = async (question: string, options: string[]) => {
        return 'Configure now';
      };

      // Mock step runner
      const mockStepHandler = async () => {
        return { brandColor: 'oklch(0.65 0.22 260)' };
      };

      const result = await executePipelineStep({
        root: tempDir,
        step: step5,
        pipeline,
        promptFn: mockPromptConfigure,
        handler: mockStepHandler,
      });

      expect(result.skipped).toBe(false);
      expect(result.completed).toBe(true);

      const state = loadState(tempDir)!;
      expect(state.completed_steps).toContain('step_5_branding');
      expect(state.skipped_steps).not.toContain('step_5_branding');
      expect(state.context_data).toHaveProperty('brandColor', 'oklch(0.65 0.22 260)');
    });

    it('runs pipeline step-by-step and respects skip and completion transitions', async () => {
      const pipeline = loadPipeline();

      // Run through gate 1 with mock handler
      const result = await executePipelineStep({
        root: tempDir,
        step: pipeline[0],
        pipeline,
        handler: async () => ({ valueProp: 'Autonomous AI Initializer' }),
      });

      expect(result.completed).toBe(true);
      const state = loadState(tempDir)!;
      expect(state.completed_steps).toContain('gate_1_problem_space');
      expect(state.context_data.valueProp).toBe('Autonomous AI Initializer');
      expect(result.nextStepId).toBe('gate_2_actors_rbac');
    });
  });
});
