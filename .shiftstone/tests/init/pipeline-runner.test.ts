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
  executeTier2PlanPhase,
  orchestrateInitializationLifecycle,
  evaluateAdaptiveQuestionRouting,
} from '../../init/pipeline-runner.js';
import { generateInitializationPlan } from '../../init/init-plan-generator.js';
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

  describe('Unit U18 — Plan-Driven Multi-Skill Orchestrator & Adaptive Routing (REQ-INIT3-18)', () => {
    it('TS-U18-02 (L2): orchestrates execution through all 5 phases of Tier 2 init plan suite', async () => {
      // 1. Generate real Tier 2 plan suite in tempDir
      const context = {
        projectName: 'OrchestratorTestApp',
        productThesis: 'Enterprise collaboration engine',
        valueProp: 'Streamlines cross-functional approvals',
      };
      const traitMatrix = {
        identity: {
          product_name: 'OrchestratorTestApp',
          thesis: 'Enterprise collaboration engine',
        },
      };
      generateInitializationPlan(tempDir, context, traitMatrix);

      const planPath = path.join(tempDir, 'docs', 'plans', 'workspace-initialization');
      expect(existsSync(path.join(planPath, 'plan-manifest.json'))).toBe(true);

      // 2. Define phase handlers simulating skill delegations
      const executed: string[] = [];
      const handlers = {
        P1: async (phase: any) => {
          executed.push('P1');
          return { prdSynthesized: true };
        },
        P2: async (phase: any) => {
          executed.push('P2');
          return { appScaffolded: true };
        },
        P3: async (phase: any) => {
          executed.push('P3');
          return { bibleSynthesized: true };
        },
        P4: async (phase: any) => {
          executed.push('P4');
          return { backlogEmitted: true };
        },
        P5: async (phase: any) => {
          executed.push('P5');
          return { steeringSynthesized: true };
        },
      };

      // 3. Orchestrate full lifecycle
      const progressPhases: string[] = [];
      const result = await orchestrateInitializationLifecycle({
        root: tempDir,
        planPath,
        handlers,
        onPhaseProgress: async (phaseId) => {
          progressPhases.push(phaseId);
        },
      });

      expect(result.status).toBe('completed');
      expect(result.completedPhases).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
      expect(executed).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
      expect(progressPhases).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);

      // 4. Verify output state tracking
      const statePath = path.join(planPath, 'output', 'state.json');
      expect(existsSync(statePath)).toBe(true);
      const state = JSON.parse(readFileSync(statePath, 'utf8'));
      expect(state.phases.length).toBe(5);
      for (const p of state.phases) {
        expect(p.implementation).toBe('implemented');
        expect(p.verification).toBe('passed');
        expect(p.acceptance).toBe('complete');
      }

      // 5. Verify session checkpoint
      const sessionState = loadState(tempDir)!;
      expect(sessionState.context_data.completed_plan_phases).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    });

    it('AC-U18-03 (REQ-INIT3-18): skips resolved gates upon PRD ingestion with confirmation', () => {
      const traitMatrix = {
        actors_roles: {
          roles: ['Admin', 'Manager', 'Member'],
          score: 0.95,
        },
        security_posture: {
          rls: true,
          multiTenant: true,
          compliance: ['GDPR'],
          score: 0.95,
        },
      };

      const routingActors = evaluateAdaptiveQuestionRouting({
        gateId: 'gate_2_actors_rbac',
        traitMatrix,
      });
      expect(routingActors.action).toBe('skip');
      expect(routingActors.status).toBe('resolved');
      expect(routingActors.confirmation).toBeDefined();
      expect(routingActors.confidence).toBeGreaterThanOrEqual(0.8);

      const routingSecurity = evaluateAdaptiveQuestionRouting({
        gateId: 'gate_4_tenant_security',
        traitMatrix,
      });
      expect(routingSecurity.action).toBe('skip');
      expect(routingSecurity.status).toBe('resolved');
    });

    it('AC-U18-03 (REQ-INIT3-18): handles "explain simply" and "decide for me" 3-tier protocol inputs cleanly', () => {
      // Test explain simply
      const explainResult = evaluateAdaptiveQuestionRouting({
        gateId: 'gate_4_tenant_security',
        userInput: 'Can you explain simply what tenant security means?',
      });
      expect(explainResult.action).toBe('explain_simply');
      expect(explainResult.layer).toBe(2);
      expect(explainResult.analogy).toContain('apartment');
      expect(explainResult.message).toContain('apartment complex');

      // Test decide for me
      const decideResult = evaluateAdaptiveQuestionRouting({
        gateId: 'gate_4_tenant_security',
        userInput: 'You decide for me, what is the best practice?',
      });
      expect(decideResult.action).toBe('decide_for_me');
      expect(decideResult.layer).toBe(3);
      expect(decideResult.autoPilot).toBe(true);
      expect(decideResult.selectedOption).toContain('Row Level Security');

      // Test standard response
      const normalResult = evaluateAdaptiveQuestionRouting({
        gateId: 'gate_4_tenant_security',
        userInput: 'We need HIPAA and SOC2 compliance with single tenant isolation',
      });
      expect(normalResult.action).toBe('proceed');
      expect(normalResult.layer).toBe(1);
      expect(normalResult.answer).toBe('We need HIPAA and SOC2 compliance with single tenant isolation');
    });
  });
});
