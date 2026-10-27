import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildResumptionOptions,
  getNextPendingStep,
  handleResumptionChoice,
  hasActiveSession,
  loadState,
  saveCheckpoint,
} from '../../init/session-state.js';

describe('Unit U2 — Resumption Detection & Interactive Continuation Modal', () => {
  let tempDir: string;

  const mockPipeline = [
    { id: 'gate_1_problem_space', title: 'Problem Space & Value Proposition', phase: 'discovery' },
    { id: 'gate_2_actors_rbac', title: 'Actors, Personas & RBAC Hierarchy', phase: 'discovery' },
    { id: 'gate_3_entity_modeling', title: 'Domain Entity Modeling & Invariants', phase: 'discovery' },
    { id: 'gate_4_tenant_security', title: 'Tenant Isolation & Security Posture', phase: 'discovery' },
    { id: 'step_5_brand_identity', title: 'Brand Identity & Design Tokens', phase: 'branding', is_optional: true },
    { id: 'step_6_stack_archetype', title: 'Stack Archetype Confirmation', phase: 'discovery' },
  ];

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'resumption-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U2-01 (L1) — Interruption Simulation & Resumption Gate', () => {
    it('detects interruption at Gate 3 and calculates Gate 4 as next step', () => {
      // Simulate completed Gates 1 and 2, interrupted while completing Gate 3
      saveCheckpoint(tempDir, {
        current_step: 'gate_3_entity_modeling',
        completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac'],
        context_data: {
          problem: 'Logistics dispatch bottlenecks',
          valueProp: 'Real-time fleet route optimization',
          actors: ['FleetManager', 'Driver', 'Dispatcher'],
          tenancy: 'Multi-tenant B2B',
        },
      });

      expect(hasActiveSession(tempDir)).toBe(true);
      const state = loadState(tempDir)!;
      expect(state).not.toBeNull();

      const nextStep = getNextPendingStep(state, mockPipeline);
      expect(nextStep).toBeDefined();
      expect(nextStep?.id).toBe('gate_3_entity_modeling');
    });

    it('builds standard 3-option resumption choices with recommended next step label', () => {
      // Gates 1, 2, 3 completed; next step is Gate 4
      saveCheckpoint(tempDir, {
        current_step: 'gate_4_tenant_security',
        completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac', 'gate_3_entity_modeling'],
        context_data: { gate1: 'ok', gate2: 'ok', gate3: 'ok' },
      });

      const state = loadState(tempDir)!;
      const options = buildResumptionOptions(state, mockPipeline);

      expect(options).toHaveLength(3);
      expect(options[0]).toContain('(Recommended) Resume from where I left off (Step 4: Tenant Isolation & Security Posture)');
      expect(options[1]).toBe('Review & modify previously completed answers');
      expect(options[2]).toBe('Discard checkpoint and restart initialization from scratch');
    });

    it('resumes directly at Gate 4 with 100% Gates 1–3 context preserved on Resume choice', () => {
      const initialContext = {
        valueProposition: 'Decentralized invoice settlement',
        actors: ['Buyer', 'Supplier', 'Auditor'],
        entities: ['Invoice', 'PaymentOrder', 'AuditRecord'],
      };

      // Completed gates 1, 2, 3
      saveCheckpoint(tempDir, {
        current_step: 'gate_3_entity_modeling',
        completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac', 'gate_3_entity_modeling'],
        context_data: initialContext,
      });

      // User selects Resume
      const result = handleResumptionChoice('resume', tempDir, mockPipeline);

      expect(result.action).toBe('resume');
      expect(result.current_step).toBe('gate_4_tenant_security');
      expect(result.context_data).toEqual(initialContext);

      // Disk state should be updated with new current_step
      const refreshedState = loadState(tempDir)!;
      expect(refreshedState.current_step).toBe('gate_4_tenant_security');
      expect(refreshedState.context_data).toEqual(initialContext);
    });

    it('purges checkpoint and restarts cleanly from Step 1 on Discard choice', () => {
      saveCheckpoint(tempDir, {
        current_step: 'gate_3_entity_modeling',
        completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac'],
        context_data: { testData: 'discard-me' },
      });

      expect(hasActiveSession(tempDir)).toBe(true);

      const result = handleResumptionChoice('discard', tempDir, mockPipeline);

      expect(result.action).toBe('discard');
      expect(result.current_step).toBe('gate_1_problem_space');
      expect(result.context_data).toEqual({});
      expect(hasActiveSession(tempDir)).toBe(false);
      expect(loadState(tempDir)).toBeNull();
    });

    it('returns loaded context without mutation on Review choice', () => {
      const savedContext = {
        name: 'OmniFlow',
        niche: 'B2B automation',
      };

      saveCheckpoint(tempDir, {
        current_step: 'gate_2_actors_rbac',
        completed_steps: ['gate_1_problem_space'],
        context_data: savedContext,
      });

      const result = handleResumptionChoice('review', tempDir, mockPipeline);

      expect(result.action).toBe('review');
      expect(result.current_step).toBe('gate_2_actors_rbac');
      expect(result.context_data).toEqual(savedContext);
      expect(hasActiveSession(tempDir)).toBe(true);
    });
  });
});
