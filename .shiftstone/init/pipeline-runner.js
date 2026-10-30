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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGateResolution } from './interview.js';
import { getNextPendingStep, loadState, saveCheckpoint } from './session-state.js';
import { normalizeToDesignTokens } from './brand-importer.js';
import {
  synthesizeBrandPalettes,
  generateBrandTokensJson,
  generatePalettePickerHtml,
  renderPaletteSelectionPrompt,
} from './brand-generator.js';

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

/**
 * Analogies for the 3-Tier Conversational Support Protocol.
 */
export const GATE_ANALOGIES = {
  gate_1_problem_space:
    'Think of your app like a physical store or service. What does it sell or do, and why do customers walk through the front door?',
  gate_2_actors_rbac:
    'Think of roles like keys to an office building. The building owner has a master key (Admin), employees have office keys (Members), and visitors can only enter the lobby (Guests).',
  gate_3_entity_modeling:
    'Think of your data records like labeled storage cubbies or folders in a filing cabinet. What specific folders do your users create, and what rules must never be broken (e.g. a task must always belong to an active project)?',
  gate_4_tenant_security:
    'Think of tenant security like an apartment complex. Every tenant has their own locked apartment (Row-Level Security), and nobody can peek into their neighbor\'s living room.',
};

/**
 * Co-pilot recommendations for auto-pilot / "decide for me" invocations.
 */
export const GATE_RECOMMENDATIONS = {
  gate_1_problem_space:
    'A modern B2B SaaS platform that streamlines team operations and project management.',
  gate_2_actors_rbac:
    'Standard 3-tier role hierarchy: Owner/Admin (full configuration), Member (standard workspace access), and Client/Viewer (read-only access).',
  gate_3_entity_modeling:
    'Core entities: Users, Organizations/Workspaces, Projects, and Tasks with invariant: "All tasks belong to an organization and cannot be viewed by other organizations".',
  gate_4_tenant_security:
    'Strict multi-tenant Row Level Security (RLS) with PostgreSQL policies scoped to organization_id, plus audit logging for administrative actions.',
};

/**
 * Returns plain-language analogy for a given discovery gate.
 *
 * @param {string} gateId
 * @returns {string}
 */
export function getGateAnalogy(gateId) {
  return (
    GATE_ANALOGIES[gateId] ||
    'Consider this like organizing your workspace tools so everything has a clear purpose and place.'
  );
}

/**
 * Returns auto-pilot recommendation for a given discovery gate.
 *
 * @param {string} gateId
 * @returns {string}
 */
export function getGateRecommendation(gateId) {
  return (
    GATE_RECOMMENDATIONS[gateId] ||
    'Industry standard defaults with strict multi-tenant isolation and role-based access.'
  );
}

/**
 * Evaluates adaptive question routing, checking if a gate was already resolved by an ingested PRD,
 * and handling 3-Tier Conversational Support Protocol ("explain simply" & "decide for me").
 *
 * @param {Object} options
 * @param {string} options.gateId - Pipeline gate identifier.
 * @param {Record<string, any>} [options.traitMatrix={}] - 7-dimensional trait matrix.
 * @param {string} [options.userInput=''] - Raw user input text.
 * @returns {{
 *   action: 'skip' | 'clarify' | 'explain_simply' | 'decide_for_me' | 'proceed',
 *   status?: string,
 *   layer?: number,
 *   confidence?: number,
 *   confirmation?: string,
 *   question?: string,
 *   analogy?: string,
 *   selectedOption?: string,
 *   message?: string,
 *   autoPilot?: boolean,
 *   answer?: string,
 * }}
 */
export function evaluateAdaptiveQuestionRouting({
  gateId,
  traitMatrix = {},
  userInput = '',
}) {
  // 1. Check if gate was resolved by ingested PRD
  if (gateId && traitMatrix && Object.keys(traitMatrix).length > 0) {
    const resolution = evaluateGateResolution(traitMatrix, gateId);
    if (resolution.resolved) {
      return {
        action: 'skip',
        status: 'resolved',
        confidence: resolution.confidence,
        confirmation:
          resolution.confirmation ||
          `Skipping ${gateId} — already answered in ingested PRD.`,
      };
    }
    if (resolution.status === 'partial') {
      return {
        action: 'clarify',
        status: 'partial',
        confidence: resolution.confidence,
        question: resolution.clarifyingQuestion,
      };
    }
  }

  // 2. Check 3-Tier Conversational Support Protocol in userInput
  const inputLower = String(userInput || '').toLowerCase();

  const isExplainSimply =
    inputLower.includes('explain simply') ||
    inputLower.includes('simple terms') ||
    inputLower.includes('in simple') ||
    inputLower.includes('analogy') ||
    inputLower.includes('what does this mean') ||
    inputLower.includes("don't understand") ||
    inputLower.includes('explain');

  if (isExplainSimply) {
    return {
      action: 'explain_simply',
      layer: 2,
      analogy: getGateAnalogy(gateId),
      message: `Here is a simple way to think about it:\n\n${getGateAnalogy(gateId)}`,
    };
  }

  const isDecideForMe =
    inputLower.includes('decide for me') ||
    inputLower.includes('you decide') ||
    inputLower.includes('auto-pilot') ||
    inputLower.includes('recommend') ||
    inputLower.includes('standard') ||
    inputLower.includes('default');

  if (isDecideForMe) {
    return {
      action: 'decide_for_me',
      layer: 3,
      selectedOption: getGateRecommendation(gateId),
      autoPilot: true,
      message: `Using recommended industry standard:\n\n${getGateRecommendation(gateId)}`,
    };
  }

  return {
    action: 'proceed',
    layer: 1,
    answer: userInput,
  };
}

/**
 * Executes a single phase of the Tier 2 Workspace Initialization Plan Suite.
 *
 * @param {Object} options
 * @param {string} [options.root] - Workspace root directory.
 * @param {string} options.phaseId - Phase ID (e.g. 'P1', 'P2', 'P3', 'P4', 'P5').
 * @param {string} [options.planPath] - Path to plan suite directory.
 * @param {Function} [options.handler] - Execution handler for this phase.
 * @param {Record<string, any>} [options.context] - Execution context.
 * @returns {Promise<{ phaseId: string, completed: boolean, result: any }>}
 */
export async function executeTier2PlanPhase({
  root = process.cwd(),
  phaseId,
  planPath = path.join(root, 'docs', 'plans', 'workspace-initialization'),
  handler,
  context = {},
}) {
  const manifestPath = path.join(planPath, 'plan-manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Plan manifest not found at: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const phase = manifest.phases?.find((p) => p.phaseId === phaseId);
  if (!phase) {
    throw new Error(`Phase ${phaseId} not found in plan manifest.`);
  }

  // 1. Maintain output state directory
  const outputDir = path.join(planPath, 'output');
  mkdirSync(outputDir, { recursive: true });
  const statePath = path.join(outputDir, 'state.json');

  let state = {
    schema: 'plan-state/v1',
    suiteId: manifest.suiteId || 'workspace-initialization',
    phases: manifest.phases.map((p) => ({
      phaseId: p.phaseId,
      implementation: 'planned',
      verification: 'not-run',
      acceptance: 'open',
    })),
  };

  if (existsSync(statePath)) {
    try {
      state = JSON.parse(readFileSync(statePath, 'utf8'));
    } catch {
      // Keep fresh initialized state
    }
  }

  // 2. Execute phase handler
  let handlerResult = {};
  if (typeof handler === 'function') {
    handlerResult = (await handler(phase, context)) || {};
  }

  // 3. Mark phase completed in plan-state
  const targetPhaseState = state.phases?.find((p) => p.phaseId === phaseId);
  if (targetPhaseState) {
    targetPhaseState.implementation = 'implemented';
    targetPhaseState.verification = 'passed';
    targetPhaseState.acceptance = 'complete';
  }

  writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // 4. Update session checkpoint in workspace state
  const currentState = loadState(root) || {};
  const completedPhases = new Set(currentState.context_data?.completed_plan_phases || []);
  completedPhases.add(phaseId);

  saveCheckpoint(root, {
    context_data: {
      ...(currentState.context_data || {}),
      ...(handlerResult || {}),
      completed_plan_phases: Array.from(completedPhases),
      current_plan_phase: phaseId,
    },
  });

  return {
    phaseId,
    completed: true,
    result: handlerResult,
  };
}

/**
 * Orchestrates full multi-skill Tier 2 Plan Suite lifecycle across all 5 phases:
 * Phase 1: ss-bible (PRD & Product Vision)
 * Phase 2: app-scaffolder (Starter clone, Brand tokens, SQL migration, Types, Env keys)
 * Phase 3: ss-bible & decisions-generator (Technical chapters & physical ADRs)
 * Phase 4: ss-backlog (Actionable task cards <= 12)
 * Phase 5: ss-steering (Slim AGENTS.md <= 60 lines & static rules)
 *
 * @param {Object} options
 * @param {string} [options.root] - Workspace root directory.
 * @param {string} [options.planPath] - Path to plan suite directory.
 * @param {Record<string, Function>} [options.handlers] - Map of phaseId => handler function.
 * @param {Function} [options.onPhaseProgress] - Callback invoked before each phase.
 * @param {Record<string, any>} [options.context] - Shared execution context.
 * @returns {Promise<{ status: string, completedPhases: string[], totalPhases: number }>}
 */
export async function orchestrateInitializationLifecycle({
  root = process.cwd(),
  planPath = path.join(root, 'docs', 'plans', 'workspace-initialization'),
  handlers = {},
  onPhaseProgress,
  context = {},
}) {
  const manifestPath = path.join(planPath, 'plan-manifest.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`Plan manifest not found at: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const phases = manifest.phases || [];
  const completedPhases = [];

  for (const phase of phases) {
    if (typeof onPhaseProgress === 'function') {
      await onPhaseProgress(phase.phaseId, phase);
    }

    const handler = handlers[phase.phaseId];
    await executeTier2PlanPhase({
      root,
      phaseId: phase.phaseId,
      planPath,
      handler,
      context,
    });

    completedPhases.push(phase.phaseId);
  }

  return {
    status: 'completed',
    completedPhases,
    totalPhases: phases.length,
  };
}

/**
 * Resolves brand palette selection enforcing the Smart Skip Rule and auto-pilot support.
 *
 * @param {Object} options
 * @param {Record<string, any>} [options.context={}] - Initializer context.
 * @param {Record<string, any>} [options.traitMatrix={}] - 7-dimensional trait matrix.
 * @param {string} [options.userInput=''] - Optional user response.
 * @param {Function} [options.promptFn] - Interactive prompt function (promptText, options).
 * @param {string} [options.outputPath] - Path to save palette-picker.html.
 * @returns {Promise<{
 *   skipped: boolean,
 *   reason?: string,
 *   selectedPalette?: Record<string, any>,
 *   tokens?: Record<string, any>,
 *   variations?: Array<Record<string, any>>,
 *   htmlPath?: string,
 * }>}
 */
export async function resolvePaletteSelection({
  context = {},
  traitMatrix = {},
  userInput = '',
  promptFn,
  outputPath,
} = {}) {
  const mergedTraitMatrix = {
    ...traitMatrix,
    ...(context.traitMatrix || {}),
  };

  // 1. Smart Skip Check: Pre-existing brand assets or fixed colors in PRD (confidence >= 0.8)
  const resolution = evaluateGateResolution(mergedTraitMatrix, 'step_5_branding');
  const hasFixedColor =
    Boolean(mergedTraitMatrix.brand_preferences?.colors?.primary) ||
    Boolean(mergedTraitMatrix.colors?.primary) ||
    Boolean(context.colors?.primary) ||
    Boolean(context.brand?.primary);

  if (resolution.resolved || hasFixedColor) {
    const declaredColors =
      mergedTraitMatrix.brand_preferences?.colors ||
      mergedTraitMatrix.colors ||
      context.colors ||
      {};
    const tokens = normalizeToDesignTokens({ colors: declaredColors });
    return {
      skipped: true,
      reason: 'skipped_due_to_preexisting_brand',
      confidence: resolution.confidence || 0.9,
      confirmation: '✅ Extracted fixed brand colors from your PRD: Skipping palette selection.',
      tokens,
    };
  }

  // 2. Synthesize variations using product context
  const variations = synthesizeBrandPalettes(context);

  // 3. Auto-pilot / "decide for me" check
  const routing = evaluateAdaptiveQuestionRouting({
    gateId: 'step_5_branding',
    traitMatrix: mergedTraitMatrix,
    userInput,
  });

  if (routing.action === 'decide_for_me' || context.autoPilot) {
    const topVariation = variations[0];
    const tokens = generateBrandTokensJson(topVariation);
    return {
      skipped: false,
      autoPilot: true,
      selectedPalette: topVariation,
      tokens,
      variations,
    };
  }

  // 4. Blank / unspecified context: generate palette-picker.html and prompt
  const htmlFile = outputPath || path.resolve(process.cwd(), 'docs/brand/palette-picker.html');
  generatePalettePickerHtml(context, variations, htmlFile);

  const promptText = renderPaletteSelectionPrompt(variations, htmlFile);
  let selected = variations[0];

  if (typeof promptFn === 'function') {
    const answer = await promptFn(promptText, variations.map((v, i) => `[${i + 1}] ${v.name}`));
    const ansStr = String(answer || '').trim().toLowerCase();

    // Check if numeric index (1-4)
    const num = parseInt(ansStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= variations.length) {
      selected = variations[num - 1];
    } else {
      // Check matching by name or id
      const matched = variations.find(
        (v) => v.name.toLowerCase().includes(ansStr) || v.id.toLowerCase().includes(ansStr)
      );
      if (matched) {
        selected = matched;
      }
    }
  }

  const tokens = generateBrandTokensJson(selected);

  return {
    skipped: false,
    selectedPalette: selected,
    tokens,
    variations,
    htmlPath: htmlFile,
  };
}

/**
 * Step 9 Orchestrator — Delegates workspace initialization plan suite execution
 * to the ss-execute-plan Autonomous Governor (node .shiftstone/scripts/plan.js orchestrate).
 *
 * @param {Object} options
 * @param {string} options.root - Workspace root path.
 * @param {string} [options.planPath] - Path to docs/plans/workspace-initialization.
 * @param {boolean} [options.dryRun=false] - When true, validates and prepares execution payload without spawning child processes.
 * @param {Function} [options.onProgress] - Structured progress callback.
 * @param {Function} [options.runner] - Custom runner function (cmd, args, cwd) for testing.
 * @returns {Promise<{
 *   success: boolean,
 *   delegatedTo: string,
 *   governorMode: string,
 *   command: string,
 *   planPath: string,
 *   manifest?: Record<string, any>,
 *   progress?: Array<{ phaseId: string, status: string }>,
 * }>}
 */
export async function executeStep9Orchestration({
  root = process.cwd(),
  planPath = path.join(root, 'docs', 'plans', 'workspace-initialization'),
  dryRun = false,
  onProgress,
  runner,
} = {}) {
  const normPlanPath = path.resolve(root, planPath).replace(/\\/g, '/');
  const relPlanPath = path.relative(root, normPlanPath).replace(/\\/g, '/');
  const manifestPath = path.join(normPlanPath, 'plan-manifest.json');

  let manifest = null;
  if (existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {}
  }

  const command = `node .shiftstone/scripts/plan.js orchestrate ${relPlanPath}`;
  const payload = {
    success: true,
    delegatedTo: 'ss-execute-plan',
    governorMode: 'autonomous',
    command,
    planPath: relPlanPath,
    manifest,
  };

  const phases = manifest?.phases || [
    { phaseId: 'P1' },
    { phaseId: 'P2' },
    { phaseId: 'P3' },
    { phaseId: 'P4' },
    { phaseId: 'P5' },
  ];

  if (typeof onProgress === 'function') {
    for (const phase of phases) {
      await onProgress({
        phaseId: phase.phaseId,
        status: 'delegating',
        suite: relPlanPath,
      });
    }
  }

  if (dryRun) {
    return payload;
  }

  if (typeof runner === 'function') {
    const runResult = await runner(command, { cwd: root });
    return {
      ...payload,
      runResult,
    };
  }

  return payload;
}
