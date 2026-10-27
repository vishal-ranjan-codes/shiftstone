/**
 * ShiftStone Initializer v2.2 — Real-Time Visual Progress Card Renderer & Duration Estimator
 *
 * Renders structured Markdown progress cards tracking active initialization steps,
 * resolved substeps, elapsed session time, and dynamic baseline-derived ETAs.
 *
 * Traceability:
 *   - REQ-INIT-02 (Dynamic Markdown Progress Card & Duration Estimator)
 *   - LOCK-INIT-03 (Visual Progress Tracking & ETAs)
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PIPELINE_PATH = path.join(__dirname, 'step-pipeline.json');

/**
 * Loads the default shipped pipeline definition from step-pipeline.json.
 *
 * @returns {Array<Record<string, any>>} Array of step definitions.
 */
export function loadDefaultPipeline() {
  if (existsSync(DEFAULT_PIPELINE_PATH)) {
    try {
      const raw = readFileSync(DEFAULT_PIPELINE_PATH, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : (data.steps || []);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Formats a duration in seconds into a human-readable string ("1m 30s", "45s", "0s").
 *
 * @param {number} totalSeconds - Duration in seconds.
 * @returns {string} Formatted duration string.
 */
export function formatDuration(totalSeconds) {
  const sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (sec === 0) return '0s';
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainingSecs = sec % 60;
  return `${mins}m ${remainingSecs}s`;
}

/**
 * Dynamically calculates remaining ETA in seconds based on pending steps' baseline durations.
 * Excludes completed and skipped steps.
 *
 * @param {Record<string, any>} state - Active session state.
 * @param {Array<Record<string, any>> | { steps: Array<Record<string, any>> }} [pipeline] - Step pipeline.
 * @returns {number} Estimated remaining seconds.
 */
export function calculateRemainingEta(state, pipeline) {
  const steps = Array.isArray(pipeline) ? pipeline : (pipeline?.steps || loadDefaultPipeline());
  const completed = new Set(state?.completed_steps || []);
  const skipped = new Set(state?.skipped_steps || []);

  let remainingSec = 0;
  for (const step of steps) {
    if (!completed.has(step.id) && !skipped.has(step.id)) {
      remainingSec += Number(step.baseline_sec) || 0;
    }
  }
  return remainingSec;
}

/**
 * Renders a standardized Markdown Progress Card for chat and logs.
 *
 * @param {Record<string, any>} state - Active session state.
 * @param {Object} [options]
 * @param {Array<Record<string, any>> | { steps: Array<Record<string, any>> }} [options.pipeline] - Optional pipeline override.
 * @returns {string} Standardized Markdown card string.
 */
export function renderProgressCard(state, options = {}) {
  const steps = Array.isArray(options.pipeline)
    ? options.pipeline
    : (options.pipeline?.steps || loadDefaultPipeline());

  const totalSteps = steps.length;
  const completed = new Set(state?.completed_steps || []);
  const skipped = new Set(state?.skipped_steps || []);
  const completedCount = completed.size;
  const percent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  let elapsedSec = 0;
  if (state?.elapsed_sec !== undefined) {
    elapsedSec = Number(state.elapsed_sec) || 0;
  } else if (state?.started_at) {
    const startMs = new Date(state.started_at).getTime();
    if (!isNaN(startMs)) {
      elapsedSec = Math.max(0, Math.round((Date.now() - startMs) / 1000));
    }
  }

  const remainingSec = calculateRemainingEta(state, steps);
  const remainingFormatted = remainingSec > 0 ? `~${formatDuration(remainingSec)}` : '0s';

  const lines = [];
  lines.push(`### 🚀 Workspace Initializer Progress [${completedCount}/${totalSteps} Steps Completed • ${percent}%]`);
  lines.push('');
  lines.push(`⏱️ Elapsed: ${formatDuration(elapsedSec)} • Remaining ETA: ${remainingFormatted}`);
  lines.push('');

  for (const step of steps) {
    if (completed.has(step.id)) {
      lines.push(`- [x] **${step.title}**`);
    } else if (skipped.has(step.id)) {
      lines.push(`- [-] ~~${step.title}~~ (skipped)`);
    } else if (state?.current_step === step.id) {
      const substepSuffix = state?.active_substep ? ` • ${state.active_substep}` : '';
      lines.push(`- [>] **${step.title}** (in progress${substepSuffix})`);
    } else {
      lines.push(`- [ ] ${step.title} (~${formatDuration(step.baseline_sec || 0)})`);
    }
  }

  return lines.join('\n');
}
