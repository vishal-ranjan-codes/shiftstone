/**
 * ShiftStone Initializer v2.2 — Scalable Next-Steps Suggestion Engine (Launchpad)
 *
 * Implements post-init suggestion synthesis, aggregating deferred setup steps
 * (e.g. skipped branding or research) into prioritized actions, rendering
 * a Markdown Launchpad, recording them into `.workspace-init-receipt.json`,
 * and injecting actionable tables into `AGENTS.md`.
 *
 * Traceability:
 *   - REQ-INIT-11 (Scalable Next-Steps Suggestion Engine / Launchpad)
 *   - LOCK-INIT-11 (Scalable Next-Steps Launchpad)
 *   - Unit U12
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadPipeline } from './pipeline-runner.js';
import { createReceipt, writeReceipt } from './receipt.js';
import { loadState } from './session-state.js';

export const CORE_LIFECYCLE_ACTIONS = [
  {
    command: '/ss-plan',
    title: 'Phase 1 Backlog Planning & Stage Contracts',
    action: 'Plan Phase 1 backlog items in docs/plans/ with bounded context (<= 4,500 tokens) and Red-First TDD',
    timing: 'Immediately (Start here)',
    rationale: 'Establishes ICM stage contracts (CONTEXT.md) and granular plan units for feature implementation.',
  },
  {
    command: '/ss-nexus',
    title: 'Workspace Health & Test Suite Runner',
    action: 'Run monorepo type-checks, lints, and test suites across all workspaces',
    timing: 'Before committing or deploying code',
    rationale: 'Verifies compilation, linting rules, and tests across all workspace packages.',
  },
  {
    command: 'pnpm dev',
    title: 'Local Development Server',
    action: 'Start local development server and interactive application preview',
    timing: 'When ready to interact with the local development environment',
    rationale: 'Spins up the local development server for testing user flows and routes.',
  },
];

/** Detailed metadata dictionary for known skipped steps */
export const SKIPPED_STEP_METADATA = {
  step_5_branding: {
    command: '/ss-brand',
    title: 'Brand Identity & Living Brand Book',
    action: 'Formulate brand strategy, accessible OKLCH color palette, typography scales, design tokens, and living Brand Book (docs/brand/brand-book.html)',
    timing: 'Before building user-facing UI or shipping public pages',
    rationale: 'Brand identity was deferred during initialization. Run /ss-brand to define your visual identity, OKLCH palette, and living Brand Book.',
    parameters: '',
  },
  step_7_research: {
    command: '/ss-research',
    title: 'Pre-Scaffold Tech Research',
    action: 'Investigate third-party APIs, performance constraints, and architectural trade-offs in docs/research/',
    timing: 'Before implementing external third-party API integrations',
    rationale: 'Pre-scaffold research was deferred. Run /ss-research to produce authoritative technology dossiers with live web receipts.',
    parameters: '',
  },
};

/**
 * Generates the Next-Steps Launchpad data structure from session state.
 *
 * @param {Object} [options]
 * @param {string} [options.root] - Workspace root directory.
 * @param {Record<string, any>} [options.state] - Session state (or loaded from disk).
 * @param {Array<Record<string, any>>} [options.pipeline] - Pipeline steps (or loaded from registry).
 * @returns {{
 *   deferred_setup: Array<Record<string, any>>,
 *   core_lifecycle_actions: Array<Record<string, any>>,
 *   suggested_next_steps: Array<Record<string, any>>,
 *   skipped_count: number,
 * }}
 */
export function generateLaunchpad({
  root = process.cwd(),
  state = null,
  pipeline = null,
} = {}) {
  const currentState = state || loadState(root) || {};
  const currentPipeline = pipeline || loadPipeline();
  const skippedStepIds = Array.isArray(currentState.skipped_steps) ? currentState.skipped_steps : [];

  const contextData = currentState.context_data || {};
  const projectName = contextData.projectName || 'MyProject';
  const pm = contextData.packageManager || 'pnpm';

  const deferred = [];
  for (const stepId of skippedStepIds) {
    const stepDef = currentPipeline.find((s) => s.id === stepId);
    const knownMeta = SKIPPED_STEP_METADATA[stepId];

    if (knownMeta) {
      deferred.push({
        step_id: stepId,
        command: knownMeta.command,
        title: knownMeta.title,
        action: knownMeta.action,
        timing: knownMeta.timing,
        rationale: knownMeta.rationale,
        parameters: knownMeta.parameters || `--name="${projectName}"`,
      });
    } else if (stepDef) {
      const suggestion = stepDef.skip_behavior?.post_init_suggestion || `/${stepDef.id}`;
      deferred.push({
        step_id: stepId,
        command: suggestion,
        title: stepDef.title,
        action: stepDef.description,
        timing: 'As needed before feature completion',
        rationale: `${stepDef.title} was deferred during initialization. Run ${suggestion} to complete it.`,
        parameters: '',
      });
    }
  }

  // Adjust dev command to match project package manager
  const devCommand = pm === 'npm' ? 'npm run dev' : pm === 'yarn' ? 'yarn dev' : 'pnpm dev';
  const lifecycleActions = CORE_LIFECYCLE_ACTIONS.map((item) => {
    if (item.command === 'pnpm dev') {
      return { ...item, command: devCommand };
    }
    return { ...item };
  });

  const suggestedNextSteps = [...deferred, ...lifecycleActions];

  return {
    deferred_setup: deferred,
    core_lifecycle_actions: lifecycleActions,
    suggested_next_steps: suggestedNextSteps,
    skipped_count: deferred.length,
  };
}

/**
 * Renders the formatted Markdown Launchpad card for display in chat or reports.
 *
 * @param {Record<string, any>} launchpadData - Result of generateLaunchpad.
 * @returns {string} Formatted markdown string.
 */
export function renderLaunchpadMarkdown(launchpadData) {
  const deferred = launchpadData.deferred_setup || [];
  const lifecycle = launchpadData.core_lifecycle_actions || CORE_LIFECYCLE_ACTIONS;

  const lines = [
    '# 🚀 ShiftStone Next-Steps Launchpad',
    '',
    'Your workspace is initialized and ready. Follow these prioritized next steps to commence development.',
    '',
    '## Deferred Initializer Setup',
  ];

  if (deferred.length === 0) {
    lines.push('*All initialization setup steps were completed! No deferred tasks.*');
  } else {
    lines.push('| Command | Action | Recommended Timing | Rationale |');
    lines.push('|---|---|---|---|');
    for (const item of deferred) {
      lines.push(
        `| \`${item.command}\` | ${item.action} | ${item.timing} | ${item.rationale} |`,
      );
    }
  }

  lines.push('');
  lines.push('## Core Lifecycle Actions');
  lines.push('| Command | Action | Recommended Timing |');
  lines.push('|---|---|---|');
  for (const item of lifecycle) {
    lines.push(`| \`${item.command}\` | ${item.action} | ${item.timing} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('👉 **Recommended Next Action:** Run `/ss-plan` to design and execute your first backlog user story.');

  return lines.join('\n');
}

/**
 * Injects or updates the pending commands table into AGENTS.md under `## Suggested Next Steps`.
 *
 * @param {string} root - Workspace root.
 * @param {Record<string, any>} launchpadData - Generated launchpad data.
 * @returns {boolean} True if successfully updated.
 */
export function injectLaunchpadIntoAgentsMd(root = process.cwd(), launchpadData) {
  const agentsPath = path.join(root, 'AGENTS.md');
  if (!existsSync(agentsPath)) {
    return false;
  }

  const agentsContent = readFileSync(agentsPath, 'utf8');
  const deferred = launchpadData.deferred_setup || [];
  const lifecycle = launchpadData.core_lifecycle_actions || CORE_LIFECYCLE_ACTIONS;

  const tableRows = [];
  for (const item of deferred) {
    tableRows.push(`| \`${item.command}\` | ${item.action} | ${item.timing} |`);
  }
  for (const item of lifecycle) {
    tableRows.push(`| \`${item.command}\` | ${item.action} | ${item.timing} |`);
  }

  const tableMarkdown = [
    '| Command | Action | Recommended Timing |',
    '|---|---|---|',
    ...tableRows,
  ].join('\n');

  const sectionBlock = [
    '## Suggested Next Steps',
    '',
    '<!-- NEXT-STEPS:BEGIN -->',
    tableMarkdown,
    '<!-- NEXT-STEPS:END -->',
    '',
  ].join('\n');

  let updated;
  if (agentsContent.includes('<!-- NEXT-STEPS:BEGIN -->')) {
    // Replace existing block
    updated = agentsContent.replace(
      /<!-- NEXT-STEPS:BEGIN -->[\s\S]*?<!-- NEXT-STEPS:END -->/,
      `<!-- NEXT-STEPS:BEGIN -->\n${tableMarkdown}\n<!-- NEXT-STEPS:END -->`,
    );
  } else if (agentsContent.includes('## Suggested Next Steps')) {
    // Replace existing section
    updated = agentsContent.replace(
      /## Suggested Next Steps[\s\S]*?(?=\n## |\n# |$)/,
      sectionBlock,
    );
  } else if (agentsContent.includes('## Load Order & Canonical Locations')) {
    // Insert before Load Order
    updated = agentsContent.replace(
      '## Load Order & Canonical Locations',
      `${sectionBlock}\n## Load Order & Canonical Locations`,
    );
  } else {
    // Append to end of file
    updated = `${agentsContent.trim()}\n\n${sectionBlock}`;
  }

  writeFileSync(agentsPath, updated, 'utf8');
  return true;
}

/**
 * Finalizes the launchpad at the end of initialization: generates launchpad data,
 * writes `.workspace-init-receipt.json`, updates `AGENTS.md`, and returns markdown.
 *
 * @param {Object} options
 * @param {string} [options.root] - Workspace root directory.
 * @param {Record<string, any>} [options.state] - Final session state.
 * @param {Array<Record<string, any>>} [options.pipeline] - Step pipeline.
 * @param {string[]} [options.curatedSkills] - Retained curated skills.
 * @param {string[]} [options.excludedSkills] - Pruned excluded skills.
 * @param {any} [options.composition] - Composition metadata.
 * @param {Record<string, any>} [options.answers] - Interview answers.
 * @returns {{
 *   launchpad: Record<string, any>,
 *   receipt: Record<string, any>,
 *   receiptPath: string,
 *   markdown: string,
 * }}
 */
export function finalizeLaunchpad({
  root = process.cwd(),
  state = null,
  pipeline = null,
  curatedSkills = [],
  excludedSkills = [],
  composition = null,
  answers = {},
} = {}) {
  const currentState = state || loadState(root) || {};
  const currentPipeline = pipeline || loadPipeline();
  const launchpad = generateLaunchpad({ root, state: currentState, pipeline: currentPipeline });

  const receipt = createReceipt({
    root,
    state: currentState,
    launchpad,
    curatedSkills,
    excludedSkills,
    composition,
    answers,
  });

  const receiptPath = writeReceipt(root, receipt);
  injectLaunchpadIntoAgentsMd(root, launchpad);
  const markdown = renderLaunchpadMarkdown(launchpad);

  return {
    launchpad,
    receipt,
    receiptPath,
    markdown,
  };
}
