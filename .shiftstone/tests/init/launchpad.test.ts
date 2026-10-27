/**
 * Unit Tests for Unit U12: Scalable Next-Steps Suggestion Engine (Launchpad)
 *
 * Traceability:
 *   - REQ-INIT-11 (Scalable Next-Steps Suggestion Engine / Launchpad)
 *   - LOCK-INIT-11 (Scalable Next-Steps Launchpad)
 *   - Unit U12 (AC-U12-01, AC-U12-02, AC-U12-03, TS-U12-01)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  finalizeLaunchpad,
  generateLaunchpad,
  injectLaunchpadIntoAgentsMd,
  renderLaunchpadMarkdown,
} from '../../init/launchpad.js';
import { createReceipt, loadReceipt, writeReceipt } from '../../init/receipt.js';
import { saveCheckpoint } from '../../init/session-state.js';
import { makeWorkspace } from './workspace-fixture.js';

describe('Unit U12 — Scalable Next-Steps Launchpad (REQ-INIT-11, LOCK-INIT-11)', () => {
  it('AC-U12-01: extracts skipped_steps from session state and resolves post_init_suggestion metadata', async () => {
    const root = await makeWorkspace();
    saveCheckpoint(root, {
      skipped_steps: ['step_5_branding', 'step_7_research'],
      context_data: {
        projectName: 'AcmeCloud',
        packageManager: 'pnpm',
      },
    });

    const launchpad = generateLaunchpad({ root });

    expect(launchpad.skipped_count).toBe(2);
    expect(launchpad.deferred_setup.length).toBe(2);

    const branding = launchpad.deferred_setup.find((s) => s.step_id === 'step_5_branding');
    expect(branding).toBeDefined();
    expect(branding?.command).toBe('/ss-brand');
    expect(branding?.title).toBe('Brand Identity & Living Brand Book');
    expect(branding?.timing).toContain('Before building user-facing UI');

    const research = launchpad.deferred_setup.find((s) => s.step_id === 'step_7_research');
    expect(research).toBeDefined();
    expect(research?.command).toBe('/ss-research');
    expect(research?.timing).toContain('Before implementing external third-party API integrations');
  });

  it('AC-U12-02: renders formatted Markdown Launchpad with Deferred Setup and Core Lifecycle Actions', () => {
    const launchpadData = {
      deferred_setup: [
        {
          step_id: 'step_5_branding',
          command: '/ss-brand',
          action: 'Formulate brand strategy, accessible OKLCH palette, and living Brand Book',
          timing: 'Before building UI',
          rationale: 'Brand identity was deferred during initialization.',
        },
      ],
      core_lifecycle_actions: [
        {
          command: '/ss-plan',
          action: 'Plan Phase 1 backlog items in docs/plans/ with bounded context and Red-First TDD',
          timing: 'Immediately (Start here)',
        },
        {
          command: '/ss-nexus',
          action: 'Run monorepo type-checks, lints, and test suites',
          timing: 'Before committing',
        },
        {
          command: 'pnpm dev',
          action: 'Start local development server',
          timing: 'When ready to preview',
        },
      ],
    };

    const markdown = renderLaunchpadMarkdown(launchpadData);

    // Markdown assertions
    expect(markdown).toContain('# 🚀 ShiftStone Next-Steps Launchpad');
    expect(markdown).toContain('## Deferred Initializer Setup');
    expect(markdown).toContain('`/ss-brand`');
    expect(markdown).toContain('Brand identity was deferred during initialization.');
    expect(markdown).toContain('## Core Lifecycle Actions');
    expect(markdown).toContain('`/ss-plan`');
    expect(markdown).toContain('`/ss-nexus`');
    expect(markdown).toContain('`pnpm dev`');
    expect(markdown).toContain('👉 **Recommended Next Action:** Run `/ss-plan`');
  });

  it('AC-U12-03: writes suggested_next_steps into .workspace-init-receipt.json and injects into AGENTS.md', async () => {
    const root = await makeWorkspace();
    const state = {
      session_id: 'init-test-session-123',
      started_at: '2026-10-26T10:00:00.000Z',
      elapsed_sec: 250,
      completed_steps: ['gate_1_problem_space', 'step_6_stack_archetype'],
      skipped_steps: ['step_5_branding'],
      context_data: {
        projectName: 'OmniFlow',
        layout: 'monorepo',
        packageManager: 'pnpm',
      },
    };

    const result = finalizeLaunchpad({
      root,
      state,
      curatedSkills: ['stack', 'ui'],
      excludedSkills: ['cloudflare-cron'],
    });

    // 1. Verify receipt written
    const receiptPath = path.join(root, '.workspace-init-receipt.json');
    expect(existsSync(receiptPath)).toBe(true);

    const loadedReceipt = loadReceipt(root);
    expect(loadedReceipt).not.toBeNull();
    expect(loadedReceipt?.version).toBe('2.2.0');
    expect(loadedReceipt?.session_id).toBe('init-test-session-123');
    expect(loadedReceipt?.status).toBe('completed');
    expect(loadedReceipt?.skipped_steps).toContain('step_5_branding');
    expect(loadedReceipt?.suggested_next_steps.length).toBeGreaterThanOrEqual(2);

    const receiptBranding = loadedReceipt?.suggested_next_steps.find(
      (s: any) => s.command === '/ss-brand',
    );
    expect(receiptBranding).toBeDefined();

    // 2. Verify AGENTS.md injected
    const agentsMd = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agentsMd).toContain('## Suggested Next Steps');
    expect(agentsMd).toContain('<!-- NEXT-STEPS:BEGIN -->');
    expect(agentsMd).toContain('`/ss-brand`');
    expect(agentsMd).toContain('`/ss-plan`');
    expect(agentsMd).toContain('`/ss-nexus`');
  });

  it('TS-U12-01 (L1): simulated skipped branding asserts output launchpad contains /ss-brand with exact rationale and parameters', async () => {
    const root = await makeWorkspace();
    saveCheckpoint(root, {
      skipped_steps: ['step_5_branding'],
      context_data: {
        projectName: 'SaaSify',
        packageManager: 'pnpm',
      },
    });

    const launchpad = generateLaunchpad({ root });

    expect(launchpad.deferred_setup.length).toBe(1);
    const branding = launchpad.deferred_setup[0];

    // Assert exact command, rationale and parameters
    expect(branding.command).toBe('/ss-brand');
    expect(branding.step_id).toBe('step_5_branding');
    expect(branding.parameters).toBe('--name="SaaSify"');
    expect(branding.rationale).toBe(
      'Brand identity was deferred during initialization. Run /ss-brand to define your visual identity, OKLCH palette, and living Brand Book.',
    );
    expect(branding.action).toContain('living Brand Book');

    // Assert Markdown output includes exact rationale
    const markdown = renderLaunchpadMarkdown(launchpad);
    expect(markdown).toContain('`/ss-brand`');
    expect(markdown).toContain('Brand identity was deferred during initialization');
  });
});
