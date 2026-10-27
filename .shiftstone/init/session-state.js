/**
 * ShiftStone Initializer v2.2 — Session State & Checkpoint Persistence Helper
 *
 * Implements atomic turn-by-turn checkpointing to `.workspace-init-state.json`
 * with resilient resumption and state purging upon completion.
 *
 * Traceability:
 *   - REQ-INIT-01 (Atomic turn-by-turn checkpointing & 1-click resumption)
 *   - LOCK-INIT-01 (State Checkpointing & Resumability)
 *   - LOCK-INIT-02 (State File Git Policy)
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const STATE_FILENAME = '.workspace-init-state.json';
export const CURRENT_STATE_VERSION = '2.2.0';

/**
 * Loads the current initialization state from disk.
 *
 * @param {string} [root=process.cwd()] - Workspace root directory.
 * @returns {Record<string, any> | null} Parsed state object or null if absent/invalid.
 */
export function loadState(root = process.cwd()) {
  const filePath = path.join(root, STATE_FILENAME);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Atomically saves a state checkpoint to disk using a write-to-tmp + rename pattern.
 *
 * @param {string} root - Workspace root directory.
 * @param {Record<string, any>} stateUpdate - State delta or full state to persist.
 * @returns {Record<string, any>} The merged and persisted state object.
 */
export function saveCheckpoint(root, stateUpdate = {}) {
  const existing = loadState(root) || {};

  const mergedContext = {
    ...(existing.context_data || {}),
    ...(stateUpdate.context_data || {}),
  };

  const nextState = {
    version: stateUpdate.version || existing.version || CURRENT_STATE_VERSION,
    session_id: stateUpdate.session_id || existing.session_id || `init-${randomUUID()}`,
    status: stateUpdate.status || existing.status || 'in_progress',
    current_step: stateUpdate.current_step !== undefined ? stateUpdate.current_step : (existing.current_step || 'gate_1_problem_space'),
    completed_steps: Array.isArray(stateUpdate.completed_steps)
      ? stateUpdate.completed_steps
      : (existing.completed_steps || []),
    skipped_steps: Array.isArray(stateUpdate.skipped_steps)
      ? stateUpdate.skipped_steps
      : (existing.skipped_steps || []),
    context_data: mergedContext,
    started_at: existing.started_at || stateUpdate.started_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (stateUpdate.elapsed_sec !== undefined || existing.elapsed_sec !== undefined) {
    nextState.elapsed_sec = stateUpdate.elapsed_sec !== undefined ? stateUpdate.elapsed_sec : existing.elapsed_sec;
  }

  const targetPath = path.join(root, STATE_FILENAME);
  const tempPath = path.join(root, `${STATE_FILENAME}.tmp.${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Atomic write via temp file rename
  const payload = JSON.stringify(nextState, null, 2);
  writeFileSync(tempPath, payload, 'utf8');

  try {
    renameSync(tempPath, targetPath);
  } catch {
    // Windows fallback: if target exists and rename fails, unlink target first then rename
    if (existsSync(targetPath)) {
      try {
        unlinkSync(targetPath);
      } catch {
        // ignore
      }
    }
    renameSync(tempPath, targetPath);
  }

  return nextState;
}

/**
 * Purges the session state file from disk upon completion or reset.
 *
 * @param {string} [root=process.cwd()] - Workspace root directory.
 * @returns {boolean} True if successfully purged or file was already absent.
 */
export function purgeState(root = process.cwd()) {
  const filePath = path.join(root, STATE_FILENAME);
  if (!existsSync(filePath)) {
    return true;
  }
  try {
    unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether an active, in-progress initialization session exists on disk.
 *
 * @param {string} [root=process.cwd()] - Workspace root directory.
 * @returns {boolean} True if an in-progress session exists.
 */
export function hasActiveSession(root = process.cwd()) {
  const state = loadState(root);
  return Boolean(state && state.status === 'in_progress');
}

/**
 * Finds the first pending (uncompleted and unskipped) step from a pipeline registry.
 *
 * @param {Record<string, any>} state - Active session state.
 * @param {Array<Record<string, any>>} pipeline - Ordered step pipeline.
 * @returns {Record<string, any> | null} The next step descriptor, or null if all completed.
 */
export function getNextPendingStep(state, pipeline = []) {
  const completed = new Set(state?.completed_steps || []);
  const skipped = new Set(state?.skipped_steps || []);

  for (const step of pipeline) {
    if (!completed.has(step.id) && !skipped.has(step.id)) {
      return step;
    }
  }
  return null;
}

/**
 * Builds the interactive 3-option resumption choices for the resumption gate.
 *
 * @param {Record<string, any>} state - Active session state.
 * @param {Array<Record<string, any>>} pipeline - Ordered step pipeline.
 * @returns {string[]} Array of 3 formatted choice strings.
 */
export function buildResumptionOptions(state, pipeline = []) {
  const nextStep = getNextPendingStep(state, pipeline);
  let stepLabel = 'Next Step';
  if (nextStep) {
    const idx = pipeline.findIndex((s) => s.id === nextStep.id);
    const stepNumber = idx >= 0 ? idx + 1 : 1;
    stepLabel = `Step ${stepNumber}: ${nextStep.title || nextStep.id}`;
  }

  return [
    `(Recommended) Resume from where I left off (${stepLabel})`,
    'Review & modify previously completed answers',
    'Discard checkpoint and restart initialization from scratch',
  ];
}

/**
 * Handles the user's resumption modal selection.
 *
 * @param {string} choice - Selected option string or keyword ("resume", "review", "discard").
 * @param {string} root - Workspace root directory.
 * @param {Array<Record<string, any>>} pipeline - Ordered step pipeline.
 * @returns {{ action: 'resume' | 'review' | 'discard', current_step: string, context_data: Record<string, any> }}
 */
export function handleResumptionChoice(choice, root = process.cwd(), pipeline = []) {
  const normalized = String(choice || '').toLowerCase();

  if (normalized.includes('discard') || normalized.includes('restart')) {
    purgeState(root);
    const firstStep = pipeline[0]?.id || 'gate_1_problem_space';
    return {
      action: 'discard',
      current_step: firstStep,
      context_data: {},
    };
  }

  if (normalized.includes('review') || normalized.includes('modify')) {
    const state = loadState(root) || {};
    return {
      action: 'review',
      current_step: state.current_step || pipeline[0]?.id || 'gate_1_problem_space',
      context_data: state.context_data || {},
    };
  }

  // Default / "resume"
  const state = loadState(root) || {};
  const nextStep = getNextPendingStep(state, pipeline);
  const nextStepId = nextStep?.id || state.current_step || pipeline[0]?.id || 'gate_1_problem_space';

  saveCheckpoint(root, { current_step: nextStepId });

  return {
    action: 'resume',
    current_step: nextStepId,
    context_data: state.context_data || {},
  };
}
