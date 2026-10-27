/**
 * ShiftStone Initializer v2.2 — Declarative Step Pipeline Runner
 *
 * Dynamically iterates through the 9 initialization steps declared in `step-pipeline.json`,
 * resolving mandatory vs optional steps, executing skip behaviors with interactive prompting,
 * and checkpointing progress after every step.
 *
 * Traceability:
 *   - REQ-INIT-03 (Declarative, pluggable step pipeline registry)
 *   - LOCK-INIT-04 (Modular Pipeline Registry)
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNextPendingStep, loadState, saveCheckpoint } from './session-state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PIPELINE_PATH = path.join(__dirname, 'step-pipeline.json');

/**
 * Loads the step pipeline registry from disk.
 *
 * @param {string} [customPath] - Optional custom path to pipeline json.
 * @returns {Array<Record<string, any>>} List of pipeline step definitions.
 */
export function loadPipeline(customPath = DEFAULT_PIPELINE_PATH) {
  if (!existsSync(customPath)) {
    return [];
  }
  try {
    const raw = readFileSync(customPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data.steps || []);
  } catch {
    return [];
  }
}

/**
 * Retrieves a single step definition by ID.
 *
 * @param {Array<Record<string, any>>} pipeline
 * @param {string} id
 * @returns {Record<string, any> | undefined}
 */
export function getStepById(pipeline, id) {
  const steps = Array.isArray(pipeline) ? pipeline : loadPipeline();
  return steps.find((s) => s.id === id);
}

/**
 * Returns all mandatory (non-optional) steps in the pipeline.
 *
 * @param {Array<Record<string, any>>} pipeline
 * @returns {Array<Record<string, any>>}
 */
export function getMandatorySteps(pipeline) {
  const steps = Array.isArray(pipeline) ? pipeline : loadPipeline();
  return steps.filter((s) => !s.is_optional);
}

/**
 * Returns all optional steps in the pipeline.
 *
 * @param {Array<Record<string, any>>} pipeline
 * @returns {Array<Record<string, any>>}
 */
export function getOptionalSteps(pipeline) {
  const steps = Array.isArray(pipeline) ? pipeline : loadPipeline();
  return steps.filter((s) => Boolean(s.is_optional));
}

/**
 * Executes a single pipeline step with skip prompt handling and session checkpointing.
 *
 * @param {Object} options
 * @param {string} options.root - Workspace root.
 * @param {Record<string, any>} options.step - Step definition.
 * @param {Array<Record<string, any>>} [options.pipeline] - Pipeline steps.
 * @param {Function} [options.promptFn] - Interactive prompt function (question, options) => answer.
 * @param {Function} [options.handler] - Step execution handler.
 * @returns {Promise<{ skipped: boolean, completed: boolean, nextStepId: string | null, result?: any }>}
 */
export async function executePipelineStep({
  root = process.cwd(),
  step,
  pipeline = loadPipeline(),
  promptFn,
  handler,
}) {
  const currentState = loadState(root) || {};
  const currentSkipped = new Set(currentState.skipped_steps || []);
  const currentCompleted = new Set(currentState.completed_steps || []);

  // 1. Check if step is optional and prompt for skipping if promptFn provided
  if (step.is_optional && promptFn) {
    const promptText = step.skip_behavior?.prompt || `Skip ${step.title} for now?`;
    const options = [
      '(Recommended) Configure now',
      'Skip for now (configure post-init via launchpad)',
    ];

    const answer = await promptFn(promptText, options);
    const normalized = String(answer || '').toLowerCase();

    if (normalized.includes('skip')) {
      currentSkipped.add(step.id);
      const skippedList = Array.from(currentSkipped);

      const stateDelta = {
        skipped_steps: skippedList,
      };

      const temporaryState = { ...currentState, skipped_steps: skippedList };
      const nextPending = getNextPendingStep(temporaryState, pipeline);
      const nextStepId = nextPending?.id || 'completed';

      stateDelta.current_step = nextStepId;
      saveCheckpoint(root, stateDelta);

      return {
        skipped: true,
        completed: false,
        nextStepId,
      };
    }
  }

  // 2. Execute step handler
  let handlerResult = {};
  if (typeof handler === 'function') {
    handlerResult = (await handler(step, currentState)) || {};
  }

  // 3. Mark step completed and advance
  currentCompleted.add(step.id);
  const completedList = Array.from(currentCompleted);

  const mergedContext = {
    ...(currentState.context_data || {}),
    ...(handlerResult || {}),
  };

  const temporaryState = {
    ...currentState,
    completed_steps: completedList,
    context_data: mergedContext,
  };
  const nextPending = getNextPendingStep(temporaryState, pipeline);
  const nextStepId = nextPending?.id || 'completed';

  saveCheckpoint(root, {
    completed_steps: completedList,
    current_step: nextStepId,
    context_data: handlerResult,
  });

  return {
    skipped: false,
    completed: true,
    nextStepId,
    result: handlerResult,
  };
}

/**
 * Runs the pipeline step-by-step from the active checkpoint to completion.
 *
 * @param {Object} options
 * @param {string} options.root - Workspace root.
 * @param {Array<Record<string, any>>} [options.pipeline] - Step pipeline.
 * @param {Function} [options.promptFn] - Interactive prompt function.
 * @param {Record<string, Function>} [options.handlers] - Map of step.id => handler function.
 * @param {Function} [options.onProgress] - Callback invoked before each step with progress card.
 * @returns {Promise<Record<string, any>>} Final workspace state.
 */
export async function runStepPipeline({
  root = process.cwd(),
  pipeline = loadPipeline(),
  promptFn,
  handlers = {},
  onProgress,
}) {
  let state = loadState(root) || saveCheckpoint(root, { current_step: pipeline[0]?.id });

  while (state.status === 'in_progress') {
    const nextStep = getNextPendingStep(state, pipeline);
    if (!nextStep) {
      saveCheckpoint(root, { status: 'completed', current_step: 'completed' });
      break;
    }

    if (typeof onProgress === 'function') {
      await onProgress(state, nextStep);
    }

    const handler = handlers[nextStep.id];
    await executePipelineStep({
      root,
      step: nextStep,
      pipeline,
      promptFn,
      handler,
    });

    state = loadState(root) || {};
  }

  return state;
}
