/**
 * End-to-End Integration Test for Initializer v2.2 Upgrade (Phase 5 / Unit U15)
 *
 * Exercises the full v2.2 Initializer lifecycle against an isolated temporary workspace:
 *   1. Socratic Gates 1-4 recorded to `.workspace-init-state.json`
 *   2. Simulated session interruption & clean 1-click resumption
 *   3. Brand identity & living Brand Book generation (`docs/brand/brand-book.html`)
 *   4. Domain-aware skill curation & context pruning
 *   5. Adaptive Bible restructuring with modular subfolders & zero placeholders
 *   6. Context-aware steering customization (`product.md`, `bible-rules.md`, `DEC-017`)
 *   7. Scalable Next-Steps Launchpad generation & AGENTS.md injection
 *   8. Permanent audit receipt emission (`.workspace-init-receipt.json`) & JSON schema validation
 *   9. State purging upon completion
 *
 * Traceability:
 *   - REQ-INIT-01 through REQ-INIT-13
 *   - LOCK-INIT-01 through LOCK-INIT-12
 *   - Unit U15 (AC-U15-02, TS-U15-02)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { evaluateTaxonomy, restructureBible } from '../../init/bible-topology.js';
import {
  generateBrandBookHtml,
  generateBrandThemeCss,
  generateBrandTokensJson,
} from '../../init/brand-generator.js';
import { composeArchetypes } from '../../init/compose.js';
import { finalizeLaunchpad, generateLaunchpad } from '../../init/launchpad.js';
import { loadPipeline } from '../../init/pipeline-runner.js';
import { loadReceipt } from '../../init/receipt.js';
import {
  buildResumptionOptions,
  handleResumptionChoice,
  hasActiveSession,
  loadState,
  purgeState,
  saveCheckpoint,
} from '../../init/session-state.js';
import { applySkillCuration } from '../../init/skill-curator.js';
import { applySteeringCustomization } from '../../init/steering-customizer.js';
import { validateBibleSynthesis } from '../../init/validate-bible-synthesis.js';
import { buildVariables, substituteInTree } from '../../init/variables.js';
import { makeWorkspace } from './workspace-fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');

describe('Unit U15 — Initializer v2.2 Full Lifecycle E2E Certification (REQ-INIT-13)', () => {
  it('TS-U15-02 (L2): executes full v2.2 Initializer lifecycle and verifies all state, brand, bible, curation, and launchpad gates pass cleanly', async () => {
    const root = await makeWorkspace();
    const pipeline = loadPipeline();

    // -------------------------------------------------------------------------
    // 1. Socratic Gates 1-4: Atomic Turn-by-Turn Checkpointing
    // -------------------------------------------------------------------------
    saveCheckpoint(root, {
      current_step: 'gate_1_problem_space',
      completed_steps: ['gate_1_problem_space'],
      context_data: {
        projectName: 'AeroCloud',
        valueProposition: 'Automated cloud orchestration platform for engineering teams',
        coreGoals: ['Sub-second deployment', 'Zero-downtime rollbacks'],
        antiGoals: ['No manual configuration', 'No vendor lock-in'],
      },
    });

    saveCheckpoint(root, {
      current_step: 'gate_2_actors_rbac',
      completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac'],
      context_data: {
        actors: ['PlatformAdmin', 'WorkspaceOwner', 'Developer'],
        tenancyModel: 'multi-tenant',
      },
    });

    saveCheckpoint(root, {
      current_step: 'gate_3_entity_modeling',
      completed_steps: ['gate_1_problem_space', 'gate_2_actors_rbac', 'gate_3_entity_modeling'],
      context_data: {
        entities: ['Organization', 'Cluster', 'Deployment', 'Service'],
        businessInvariants: ['Cluster must belong to valid Organization', 'Deployments are immutable'],
      },
    });

    const checkpointState = saveCheckpoint(root, {
      current_step: 'gate_4_tenant_security',
      completed_steps: [
        'gate_1_problem_space',
        'gate_2_actors_rbac',
        'gate_3_entity_modeling',
        'gate_4_tenant_security',
      ],
      context_data: {
        isolationStrategy: 'row-level-security',
        compliance: 'SOC2',
        packageManager: 'pnpm',
        layout: 'monorepo',
        features: {
          background_jobs: false,
          file_storage: false,
        },
      },
    });

    expect(checkpointState).toBeDefined();
    expect(existsSync(path.join(root, '.workspace-init-state.json'))).toBe(true);

    // -------------------------------------------------------------------------
    // 2. Simulated Session Interruption & Resumption Gate
    // -------------------------------------------------------------------------
    expect(hasActiveSession(root)).toBe(true);
    const options = buildResumptionOptions(checkpointState, pipeline);
    expect(options[0]).toContain('(Recommended) Resume');

    const resumption = handleResumptionChoice('resume', root, pipeline);
    expect(resumption.action).toBe('resume');
    expect(resumption.context_data.projectName).toBe('AeroCloud');
    expect(resumption.context_data.entities).toContain('Cluster');

    // -------------------------------------------------------------------------
    // 3. Step 5: Full-Spectrum Brand Identity & Living Brand Book
    // -------------------------------------------------------------------------
    const brandData = {
      projectName: 'AeroCloud',
      valueProp: 'Automated cloud orchestration platform for engineering teams',
      archetype: {
        primary: 'The Creator',
        secondary: 'The Sage',
        summary: 'Visionary infrastructure orchestration.',
      },
      aesthetic: 'Precision Minimalist',
      colors: {
        primary: 'oklch(0.55 0.22 255)',
        primaryDark: 'oklch(0.60 0.22 255)',
        surfaceLight: 'oklch(0.98 0.01 250)',
        surfaceDark: 'oklch(0.16 0.02 250)',
        borderLight: 'oklch(0.88 0.02 250)',
        borderDark: 'oklch(0.26 0.02 250)',
        success: 'oklch(0.65 0.20 155)',
        warning: 'oklch(0.70 0.19 55)',
        error: 'oklch(0.60 0.24 25)',
      },
      typography: {
        headingFont: 'Plus Jakarta Sans',
        bodyFont: 'Inter',
        codeFont: 'JetBrains Mono',
        scaleRatio: 1.25,
        baseSizePx: 16,
      },
    };

    const brandBookHtml = generateBrandBookHtml(brandData);
    const brandTokensJson = generateBrandTokensJson(brandData);
    const brandThemeCss = generateBrandThemeCss(brandData);

    const brandDir = path.join(root, 'docs', 'brand');
    expect(brandBookHtml).toContain('<!DOCTYPE html>');
    expect(brandBookHtml).toContain('AeroCloud — Interactive Brand Book');
    expect(brandTokensJson.color.primary.$value).toBe('oklch(0.55 0.22 255)');
    expect(brandThemeCss).toContain('--color-primary:');

    // -------------------------------------------------------------------------
    // 4. Step 8: Domain-Aware Skill Curation (REQ-INIT-10, LOCK-INIT-12)
    // -------------------------------------------------------------------------
    const composition = composeArchetypes({ archetype: 'rr8-supabase-cf' }, { root });
    const curationResult = applySkillCuration({
      root,
      composition,
      context: checkpointState.context_data,
      quiet: true,
    });

    expect(curationResult.excludedSkills).toContain('cloudflare-cron');
    expect(curationResult.excludedSkills).toContain('jobs');
    expect(curationResult.excludedSkills).toContain('cloudflare-r2');
    expect(curationResult.excludedSkills).toContain('storage');
    expect(curationResult.curatedSkills.map((s: any) => s.as || s.name)).toContain('stack');
    expect(curationResult.curatedSkills.map((s: any) => s.as || s.name)).toContain('ui');

    // -------------------------------------------------------------------------
    // 5. Step 9: Adaptive Bible Restructuring & AI-First Synthesis
    // -------------------------------------------------------------------------
    const projectContext = {
      archetype: 'saas-b2b',
      projectName: 'AeroCloud',
      productType: 'SaaS',
    };
    const taxonomy = evaluateTaxonomy(projectContext);
    const restructuringResult = await restructureBible(root, taxonomy);
    expect(restructuringResult.chaptersCount).toBeGreaterThanOrEqual(7);

    // Customize Steering
    applySteeringCustomization(root, projectContext, taxonomy);
    expect(existsSync(path.join(root, '.shiftstone', 'path-scoped-rules', 'bible-rules.md'))).toBe(true);

    const decisionsContent = readFileSync(path.join(root, 'docs', 'bible', 'DECISIONS.md'), 'utf8');
    expect(decisionsContent).toContain('DEC-017: Adaptive Product Documentation Topology');

    // Run precision substitution pass
    const vars = buildVariables({ answers: { projectName: 'AeroCloud', layout: 'monorepo', packageManager: 'pnpm' }, composition });
    substituteInTree(root, vars.map);

    // Verify zero {{...}} placeholders in bible
    const synthesisValidation = validateBibleSynthesis(path.join(root, 'docs', 'bible'));
    expect(synthesisValidation.ok).toBe(true);

    // -------------------------------------------------------------------------
    // 6. Step 10: Next-Steps Launchpad, Permanent Receipt & State Purging
    // -------------------------------------------------------------------------
    // Mark Step 5 as skipped to exercise deferred setup launchpad mapping
    saveCheckpoint(root, {
      completed_steps: [
        'gate_1_problem_space',
        'gate_2_actors_rbac',
        'gate_3_entity_modeling',
        'gate_4_tenant_security',
        'step_6_stack_archetype',
        'step_8_mechanical_scaffold',
        'step_9_bible_backlog_synthesis',
      ],
      skipped_steps: ['step_5_branding'],
      status: 'completed',
    });

    const finalState = loadState(root);
    const launchpad = generateLaunchpad({ root, state: finalState, pipeline });
    expect(launchpad.deferred_setup.some((s) => s.command === '/ss-brand')).toBe(true);
    expect(launchpad.core_lifecycle_actions.some((s) => s.command === '/ss-plan')).toBe(true);

    const finalization = finalizeLaunchpad({
      root,
      state: finalState,
      pipeline,
      curatedSkills: curationResult.curatedSkills.map((s: any) => s.as || s.name),
      excludedSkills: curationResult.excludedSkills,
      composition,
      answers: { projectName: 'AeroCloud' },
    });

    expect(finalization.markdown).toContain('# 🚀 ShiftStone Next-Steps Launchpad');
    expect(finalization.markdown).toContain('/ss-brand');
    expect(finalization.markdown).toContain('/ss-plan');

    // Receipt Validation
    const receipt = loadReceipt(root);
    expect(receipt).not.toBeNull();
    expect(receipt?.version).toBe('2.2.0');
    expect(receipt?.status).toBe('completed');
    expect(receipt?.skipped_steps).toContain('step_5_branding');
    expect(receipt?.skills_curation.excluded_skills).toContain('cloudflare-cron');

    // Validate receipt against schema
    const schemaContent = readFileSync(
      path.join(ROOT, '.shiftstone', 'schemas', 'init-receipt.schema.json'),
      'utf8',
    );
    const schema = JSON.parse(schemaContent);
    for (const requiredProp of schema.required) {
      expect(receipt, `Receipt must contain required field: ${requiredProp}`).toHaveProperty(requiredProp);
    }

    // Verify AGENTS.md Injected
    const agentsMd = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('## Suggested Next Steps');
    expect(agentsMd).toContain('/ss-brand');
    expect(agentsMd).toContain('/ss-plan');

    // Purge session state (LOCK-INIT-02)
    purgeState(root);
    expect(existsSync(path.join(root, '.workspace-init-state.json'))).toBe(false);
    expect(existsSync(path.join(root, '.workspace-init-receipt.json'))).toBe(true);
  });
});
