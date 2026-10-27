/**
 * ShiftStone Initializer v2.2 — Initialization Receipt Auditor
 *
 * Emits and manages `.workspace-init-receipt.json` as the permanent, committed
 * audit record of workspace synthesis, preserving skipped configuration steps,
 * skill curation details, and prioritized next steps.
 *
 * Traceability:
 *   - REQ-INIT-11 (Scalable Next-Steps Suggestion Engine / Launchpad)
 *   - LOCK-INIT-02 (State File Git Policy & Permanent Receipt)
 *   - LOCK-INIT-11 (Scalable Next-Steps Launchpad)
 *   - Unit U12
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const RECEIPT_FILENAME = '.workspace-init-receipt.json';
export const CURRENT_RECEIPT_VERSION = '2.2.0';

/**
 * Creates a structured initialization receipt object.
 *
 * @param {Object} options
 * @param {string} [options.root] - Workspace root directory.
 * @param {Record<string, any>} [options.state={}] - Session state data.
 * @param {Record<string, any>} [options.launchpad={}] - Generated launchpad suggestions.
 * @param {string[]} [options.curatedSkills=[]] - List of retained curated skills.
 * @param {string[]} [options.excludedSkills=[]] - List of pruned excluded skills.
 * @param {any} [options.composition] - Active composition descriptor.
 * @param {Record<string, any>} [options.answers={}] - Interview or CLI answers.
 * @returns {Record<string, any>} Structured receipt object.
 */
export function createReceipt({
  root = process.cwd(),
  state = {},
  launchpad = {},
  curatedSkills = [],
  excludedSkills = [],
  composition = null,
  answers = {},
} = {}) {
  const context = state.context_data || {};
  const projectName = context.projectName || answers.projectName || 'ShiftStone Workspace';
  const layout = context.layout || answers.layout || 'monorepo';
  const packageManager = context.packageManager || answers.packageManager || 'pnpm';

  let archetypes = ['rr8-supabase-cf'];
  if (composition?.archetypes?.length) {
    archetypes = composition.archetypes.map((a) => a.name);
  } else if (answers.archetypes) {
    archetypes = Array.isArray(answers.archetypes) ? answers.archetypes : [String(answers.archetypes)];
  }

  const suggestedNextSteps =
    launchpad.suggested_next_steps ||
    launchpad.deferred_setup ||
    [];

  const receipt = {
    version: CURRENT_RECEIPT_VERSION,
    session_id: state.session_id || `init-${randomUUID()}`,
    status: 'completed',
    started_at: state.started_at || new Date().toISOString(),
    completed_at: new Date().toISOString(),
    elapsed_sec: typeof state.elapsed_sec === 'number' ? state.elapsed_sec : 0,
    archetypes,
    completed_steps: Array.isArray(state.completed_steps) ? state.completed_steps : [],
    skipped_steps: Array.isArray(state.skipped_steps) ? state.skipped_steps : [],
    context_summary: {
      projectName,
      layout,
      packageManager,
    },
    skills_curation: {
      curated_count: curatedSkills.length,
      excluded_count: excludedSkills.length,
      curated_skills: curatedSkills,
      excluded_skills: excludedSkills,
    },
    suggested_next_steps: suggestedNextSteps,
  };

  return receipt;
}

/**
 * Writes an initialization receipt to `.workspace-init-receipt.json`.
 *
 * @param {string} root - Workspace root.
 * @param {Record<string, any>} receiptData - Structured receipt object.
 * @returns {string} Absolute path to written receipt file.
 */
export function writeReceipt(root = process.cwd(), receiptData) {
  const targetPath = path.join(root, RECEIPT_FILENAME);
  const payload = JSON.stringify(receiptData, null, 2) + '\n';
  writeFileSync(targetPath, payload, 'utf8');
  return targetPath;
}

/**
 * Loads an initialization receipt from disk if present.
 *
 * @param {string} [root=process.cwd()] - Workspace root.
 * @returns {Record<string, any> | null} Parsed receipt data or null if not found.
 */
export function loadReceipt(root = process.cwd()) {
  const targetPath = path.join(root, RECEIPT_FILENAME);
  if (!existsSync(targetPath)) {
    return null;
  }
  try {
    const raw = readFileSync(targetPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
