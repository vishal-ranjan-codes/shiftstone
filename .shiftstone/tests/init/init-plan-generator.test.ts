import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compileInitializationBrief,
  generateInitializationPlan,
  generatePlanManifest,
} from '../../init/init-plan-generator.js';
import { validatePlans } from '../../scripts/validate-plans.js';

describe('Unit U17 — Tier 2 Workspace Initialization Plan Suite Generator', () => {
  const testRoot = path.join(__dirname, '..', '..', 'tmp', 'test-init-plan');

  beforeEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  describe('TS-U17-01 (L1) — Tier 2 Plan Suite File Emission & Brief Compilation', () => {
    it('emits all 9 plan suite files to docs/plans/workspace-initialization/ capturing 100% of traits (AC-U17-01, AC-U17-03)', () => {
      const context = {
        projectName: 'Nova Engine',
        productThesis: 'Ultra-low latency edge orchestration',
        valueProp: 'Autonomous distributed deployments with cryptographic verification',
        archetype: { primary: 'The Hero', secondary: 'The Creator' },
        coreGoals: [
          'Sub-10ms edge invocation latency',
          'Zero-downtime rolling state migrations',
        ],
        antiGoals: [
          'No vendor lock-in dependencies',
          'No unencrypted network egress',
        ],
        userPersonas: [
          'Platform Engineer',
          'Site Reliability Engineer',
          'Enterprise Admin',
        ],
        entities: [
          'deployments',
          'clusters',
          'routing_rules',
          'audit_records',
        ],
        businessInvariants: [
          'Cluster routing policies can never be modified while active deployments are in-flight.',
        ],
        tokens: {
          color: {
            primary: { $value: 'oklch(0.60 0.24 240)' },
            primaryDark: { $value: 'oklch(0.66 0.26 240)' },
            surface: {
              light: { $value: 'oklch(0.99 0.01 250)' },
              dark: { $value: 'oklch(0.14 0.02 250)' },
            },
          },
          fontFamily: {
            heading: { $value: 'Space Grotesk' },
            body: { $value: 'Inter' },
            mono: { $value: 'Fira Code' },
          },
        },
        services: ['cloudflare-workers', 'supabase-postgres', 'dodopayments'],
        envKeys: ['DATABASE_URL', 'CLOUDFLARE_API_TOKEN', 'DODO_PAYMENTS_API_KEY'],
        rawPrdText: '# Nova Engine PRD\n\nBuild the next-generation autonomous edge platform.',
      };

      const traitMatrix = {
        identity: {
          product_name: 'Nova Engine',
          thesis: 'Ultra-low latency edge orchestration',
        },
      };

      const result = generateInitializationPlan(testRoot, context, traitMatrix);

      expect(result.success).toBe(true);
      expect(result.filesCount).toBe(9);
      expect(result.files.length).toBe(9);

      const planDir = path.join(testRoot, 'docs', 'plans', 'workspace-initialization');

      // 1. CONTEXT.md
      const contextPath = path.join(planDir, 'CONTEXT.md');
      expect(existsSync(contextPath)).toBe(true);
      const briefContent = readFileSync(contextPath, 'utf8');
      expect(briefContent).toContain('Nova Engine');
      expect(briefContent).toContain('Ultra-low latency edge orchestration');
      expect(briefContent).toContain('Autonomous distributed deployments with cryptographic verification');
      expect(briefContent).toContain('The Hero');
      expect(briefContent).toContain('Platform Engineer');
      expect(briefContent).toContain('deployments');
      expect(briefContent).toContain('Cluster routing policies can never be modified');
      expect(briefContent).toContain('oklch(0.60 0.24 240)');
      expect(briefContent).toContain('Space Grotesk');
      expect(briefContent).toContain('DODO_PAYMENTS_API_KEY');
      expect(briefContent).toContain('# Nova Engine PRD');

      // 2. index.md
      const indexPath = path.join(planDir, 'index.md');
      expect(existsSync(indexPath)).toBe(true);
      const indexText = readFileSync(indexPath, 'utf8');
      expect(indexText).toContain('Workspace Initialization Plan Suite');
      expect(indexText).toContain('Phase 1: Product PRD & Vision');
      expect(indexText).toContain('Phase 5: AI Steering & Rules Harness');

      // 3. README.md
      const readmePath = path.join(planDir, 'README.md');
      expect(existsSync(readmePath)).toBe(true);
      const readmeText = readFileSync(readmePath, 'utf8');
      expect(readmeText).toContain('Nova Engine');
      expect(readmeText).toContain('<!-- plan-status:start -->');
      expect(readmeText).toContain('<!-- plan-status:end -->');

      // 4. plan-manifest.json
      const manifestPath = path.join(planDir, 'plan-manifest.json');
      expect(existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      expect(manifest.schema).toBe('plan-manifest/v1');
      expect(manifest.suiteId).toBe('workspace-initialization');
      expect(manifest.phases.length).toBe(5);

      // 5–9. Phase contract files
      const expectedPhaseFiles = [
        'phase-1-product-prd-and-vision.md',
        'phase-2-app-scaffolding-and-theming.md',
        'phase-3-technical-bible-and-adrs.md',
        'phase-4-actionable-task-backlog.md',
        'phase-5-ai-steering-and-harness.md',
      ];

      for (const phaseFile of expectedPhaseFiles) {
        const fullPath = path.join(planDir, phaseFile);
        expect(existsSync(fullPath)).toBe(true);
        const text = readFileSync(fullPath, 'utf8');
        expect(text).toMatch(/^---\ntype:\s*plan/m);
        expect(text).toContain('## 1. Objective & Scope');
        expect(text).toContain('## 2. Inputs & Context Dependencies');
        expect(text).toContain('## 3. Plan Units');
        expect(text).toContain('## 4. Verification & Outputs');
      }
    });
  });

  describe('TS-U17-02 (L1) — Schema Conformance & Plan Validation Gate', () => {
    it('validates that generated plan-manifest.json satisfies plan-manifest/v1 and passes validatePlans (AC-U17-02)', () => {
      const context = {
        projectName: 'Validator SaaS',
      };

      generateInitializationPlan(testRoot, context);

      const targetSuite = 'docs/plans/workspace-initialization';
      const validationResult = validatePlans(targetSuite, testRoot);

      expect(validationResult.errors).toEqual([]);
      expect(validationResult.suites.length).toBe(1);
      expect(validationResult.suites[0].status).toBe('valid');
      expect(validationResult.suites[0].phaseCount).toBe(5);
    });
  });
});
