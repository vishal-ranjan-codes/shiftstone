import { describe, expect, it } from 'vitest';
import {
  calculateRemainingEta,
  formatDuration,
  renderProgressCard,
} from '../../init/progress-renderer.js';

describe('Unit U3 — Real-Time Visual Progress Card Renderer & Duration Estimator', () => {
  const testPipeline = [
    { id: 'step_1', title: 'Problem Space', is_optional: false, baseline_sec: 60 },
    { id: 'step_2', title: 'Personas & RBAC', is_optional: false, baseline_sec: 90 },
    { id: 'step_3', title: 'Entity Modeling', is_optional: false, baseline_sec: 120 },
    { id: 'step_4', title: 'Tenant Security', is_optional: false, baseline_sec: 60 },
    { id: 'step_5', title: 'Brand Identity', is_optional: true, baseline_sec: 180 },
    { id: 'step_6', title: 'Stack Archetype', is_optional: false, baseline_sec: 60 },
    { id: 'step_7', title: 'Tech Research', is_optional: true, baseline_sec: 120 },
    { id: 'step_8', title: 'Scaffold Engine', is_optional: false, baseline_sec: 60 },
    { id: 'step_9', title: 'Bible Synthesis', is_optional: false, baseline_sec: 240 },
  ];

  describe('Duration formatting helper', () => {
    it('formats seconds into clean minute and second representations', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(45)).toBe('45s');
      expect(formatDuration(60)).toBe('1m 0s');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(150)).toBe('2m 30s');
    });
  });

  describe('calculateRemainingEta (AC-U3-02)', () => {
    it('calculates total duration when no steps are completed or skipped', () => {
      const state = {
        completed_steps: [],
        skipped_steps: [],
        current_step: 'step_1',
      };
      // Total = 60 + 90 + 120 + 60 + 180 + 60 + 120 + 60 + 240 = 990s
      expect(calculateRemainingEta(state, testPipeline)).toBe(990);
    });

    it('TS-U3-02 (L2): drops ETA by exactly the skipped step baseline when an optional step is bypassed', () => {
      const stateBeforeSkip = {
        completed_steps: ['step_1', 'step_2'],
        skipped_steps: [],
        current_step: 'step_3',
      };
      // Pending: step_3 (120), step_4 (60), step_5 (180), step_6 (60), step_7 (120), step_8 (60), step_9 (240) = 840s
      const etaBefore = calculateRemainingEta(stateBeforeSkip, testPipeline);
      expect(etaBefore).toBe(840);

      // Skip optional step_5 (baseline: 180s)
      const stateAfterSkip = {
        completed_steps: ['step_1', 'step_2'],
        skipped_steps: ['step_5'],
        current_step: 'step_3',
      };
      const etaAfter = calculateRemainingEta(stateAfterSkip, testPipeline);

      expect(etaAfter).toBe(etaBefore - 180);
      expect(etaAfter).toBe(660);
    });

    it('returns 0s remaining when all steps are completed or skipped', () => {
      const state = {
        completed_steps: ['step_1', 'step_2', 'step_3', 'step_4', 'step_6', 'step_8', 'step_9'],
        skipped_steps: ['step_5', 'step_7'],
        current_step: 'done',
      };
      expect(calculateRemainingEta(state, testPipeline)).toBe(0);
    });
  });

  describe('TS-U3-01 (L1) — Progress Card Markdown Rendering', () => {
    it('renders 0% completion state card with correct markdown format and checkboxes', () => {
      const state = {
        completed_steps: [],
        skipped_steps: [],
        current_step: 'step_1',
        elapsed_sec: 0,
      };

      const card = renderProgressCard(state, { pipeline: testPipeline });

      expect(card).toContain('### 🚀 Workspace Initializer Progress [0/9 Steps Completed • 0%]');
      expect(card).toContain('⏱️ Elapsed: 0s • Remaining ETA: ~16m 30s');
      expect(card).toContain('[>] **Problem Space**');
      expect(card).toContain('[ ] Personas & RBAC (~1m 30s)');
    });

    it('renders partial completion state with [x], [>], [-], and [ ] indicators', () => {
      const state = {
        completed_steps: ['step_1', 'step_2'],
        skipped_steps: ['step_5'],
        current_step: 'step_3',
        elapsed_sec: 150,
      };

      const card = renderProgressCard(state, { pipeline: testPipeline });

      // 2 completed + 1 skipped = 3 resolved out of 9? Or completed count: 2/9 Steps Completed • 22%
      expect(card).toContain('### 🚀 Workspace Initializer Progress [2/9 Steps Completed • 22%]');
      expect(card).toContain('⏱️ Elapsed: 2m 30s • Remaining ETA: ~11m 0s');
      expect(card).toContain('[x] **Problem Space**');
      expect(card).toContain('[x] **Personas & RBAC**');
      expect(card).toContain('[>] **Entity Modeling**');
      expect(card).toContain('[-] ~~Brand Identity~~ (skipped)');
      expect(card).toContain('[ ] Tenant Security (~1m 0s)');
    });

    it('renders 100% completion state with 0s ETA remaining and all completed checkmarks', () => {
      const state = {
        completed_steps: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6', 'step_7', 'step_8', 'step_9'],
        skipped_steps: [],
        current_step: 'completed',
        elapsed_sec: 900,
      };

      const card = renderProgressCard(state, { pipeline: testPipeline });

      expect(card).toContain('### 🚀 Workspace Initializer Progress [9/9 Steps Completed • 100%]');
      expect(card).toContain('⏱️ Elapsed: 15m 0s • Remaining ETA: 0s');
      expect(card).not.toContain('[ ]');
      expect(card).not.toContain('[>]');
    });

    it('uses shipped step-pipeline.json by default if no pipeline option is passed', () => {
      const state = {
        completed_steps: [],
        current_step: 'gate_1_problem_space',
        elapsed_sec: 10,
      };

      const card = renderProgressCard(state);
      expect(card).toContain('### 🚀 Workspace Initializer Progress [0/9 Steps Completed • 0%]');
      expect(card).toContain('[>] **Problem Space & Value Proposition**');
    });
  });
});
