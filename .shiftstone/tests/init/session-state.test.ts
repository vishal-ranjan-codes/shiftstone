import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateAgainstSchema } from '../../init/schema-validate.js';
import {
  hasActiveSession,
  loadState,
  purgeState,
  saveCheckpoint,
  STATE_FILENAME,
} from '../../init/session-state.js';

describe('Unit U1 — State Schema & Persistence Helper', () => {
  let tempDir: string;
  let schema: any;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'init-state-test-'));
    const schemaPath = path.resolve(__dirname, '../../schemas/init-state.schema.json');
    if (existsSync(schemaPath)) {
      schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    }
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U1-01 (L1) — Schema Conformance', () => {
    it('validates a complete, compliant init state', () => {
      expect(schema).toBeDefined();
      const validState = {
        version: '2.2.0',
        session_id: 'sess-abc-123',
        status: 'in_progress',
        current_step: 'gate_1_problem_space',
        completed_steps: ['gate_0_precheck'],
        context_data: {
          projectName: 'NexusApp',
          valueProp: 'AI-driven workflow engine',
        },
      };

      const errors = validateAgainstSchema(validState, schema);
      expect(errors).toEqual([]);
    });

    it('rejects state missing mandatory fields (version, session_id, status, current_step, completed_steps, context_data)', () => {
      expect(schema).toBeDefined();
      const invalidState = {
        version: '2.2.0',
        // missing session_id, status, current_step, completed_steps, context_data
      };

      const errors = validateAgainstSchema(invalidState, schema);
      expect(errors.some((e: string) => e.includes('missing required property "session_id"'))).toBe(true);
      expect(errors.some((e: string) => e.includes('missing required property "status"'))).toBe(true);
      expect(errors.some((e: string) => e.includes('missing required property "current_step"'))).toBe(true);
      expect(errors.some((e: string) => e.includes('missing required property "completed_steps"'))).toBe(true);
      expect(errors.some((e: string) => e.includes('missing required property "context_data"'))).toBe(true);
    });

    it('rejects invalid enum values for status', () => {
      expect(schema).toBeDefined();
      const badStatusState = {
        version: '2.2.0',
        session_id: 'sess-123',
        status: 'invalid_status_value',
        current_step: 'gate_1',
        completed_steps: [],
        context_data: {},
      };

      const errors = validateAgainstSchema(badStatusState, schema);
      expect(errors.some((e: string) => e.includes('status') && e.includes('must be one of'))).toBe(true);
    });
  });

  describe('TS-U1-02 (L2) — Atomic Checkpointing & State Lifecycle', () => {
    it('saves state atomically and loads identical state back', () => {
      const stateUpdate = {
        session_id: 'sess-test-456',
        status: 'in_progress' as const,
        current_step: 'gate_2_actors',
        completed_steps: ['gate_1_problem'],
        context_data: {
          problem: 'Slow manual data entry',
          actors: ['admin', 'customer'],
        },
      };

      expect(hasActiveSession(tempDir)).toBe(false);
      expect(loadState(tempDir)).toBeNull();

      const saved = saveCheckpoint(tempDir, stateUpdate);
      expect(saved.session_id).toBe('sess-test-456');
      expect(saved.current_step).toBe('gate_2_actors');
      expect(saved.version).toBe('2.2.0');

      // Verify file exists on disk
      const filePath = path.join(tempDir, STATE_FILENAME);
      expect(existsSync(filePath)).toBe(true);

      // Verify loadState returns identical content
      const loaded = loadState(tempDir);
      expect(loaded).toEqual(saved);
      expect(hasActiveSession(tempDir)).toBe(true);
    });

    it('merges state updates progressively during consecutive checkpoints', () => {
      // Step 1
      saveCheckpoint(tempDir, {
        current_step: 'gate_1',
        completed_steps: [],
        context_data: { step1Answer: 'Alpha' },
      });

      // Step 2
      saveCheckpoint(tempDir, {
        current_step: 'gate_2',
        completed_steps: ['gate_1'],
        context_data: { step2Answer: 'Beta' },
      });

      const loaded = loadState(tempDir);
      expect(loaded?.current_step).toBe('gate_2');
      expect(loaded?.completed_steps).toEqual(['gate_1']);
      expect(loaded?.context_data).toEqual({
        step1Answer: 'Alpha',
        step2Answer: 'Beta',
      });
      expect(hasActiveSession(tempDir)).toBe(true);
    });

    it('purgeState cleanly removes .workspace-init-state.json', () => {
      saveCheckpoint(tempDir, {
        current_step: 'gate_1',
        completed_steps: [],
        context_data: {},
      });

      expect(hasActiveSession(tempDir)).toBe(true);

      const purged = purgeState(tempDir);
      expect(purged).toBe(true);
      expect(existsSync(path.join(tempDir, STATE_FILENAME))).toBe(false);
      expect(loadState(tempDir)).toBeNull();
      expect(hasActiveSession(tempDir)).toBe(false);

      // Purging again should be idempotent and return true
      expect(purgeState(tempDir)).toBe(true);
    });

    it('hasActiveSession returns false if status is completed or aborted', () => {
      saveCheckpoint(tempDir, {
        status: 'completed',
        current_step: 'done',
        completed_steps: ['gate_1', 'gate_2'],
        context_data: {},
      });

      expect(hasActiveSession(tempDir)).toBe(false);

      saveCheckpoint(tempDir, {
        status: 'aborted',
      });

      expect(hasActiveSession(tempDir)).toBe(false);
    });
  });
});
