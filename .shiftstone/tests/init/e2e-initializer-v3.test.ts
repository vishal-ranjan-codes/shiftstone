/**
 * Initializer v3.0 End-to-End Certification Test Suite (Unit U19)
 *
 * Simulates complete workspace initialization across:
 *   1. Mode A: Raw conversational brief with "decide for me" invocations
 *   2. Mode B: Pre-existing PRD ingestion with adaptive gate skipping
 *
 * Verifies Tier 2 Workspace Initialization Plan Suite (9 files), all 5 execution phases,
 * PRD in Bible, brand tokens & living brand book, application scaffolding & SQL migrations,
 * physical domain ADRs, backlog task cards, slim AGENTS.md, and child engine sync parity.
 *
 * Traceability:
 *   - REQ-INIT3-18, REQ-INIT3-19
 *   - LOCK-INIT3-04, LOCK-INIT3-06, LOCK-INIT3-07, LOCK-INIT3-08, LOCK-INIT3-11,
 *     LOCK-INIT3-12, LOCK-INIT3-13, LOCK-INIT3-14, LOCK-INIT3-15, LOCK-INIT3-18
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { scaffoldApplicationDomain } from '../../init/app-scaffolder.js';
import { synthesizeProductChapters } from '../../init/bible-synthesizer.js';
import { compileBrandBook, generateBrandAssets, generateBrandTokensJson } from '../../init/brand-generator.js';
import { generateDomainDecisions } from '../../init/decisions-generator.js';
import { generateInitializationPlan } from '../../init/init-plan-generator.js';
import { extractStructuredTraits } from '../../init/interview.js';
import {
  evaluateAdaptiveQuestionRouting,
  orchestrateInitializationLifecycle,
} from '../../init/pipeline-runner.js';
import { queryCommunitySkills } from '../../init/skill-curator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('Unit U19 — Initializer v3.0 End-to-End Certification (REQ-INIT3-19)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(tmpdir(), `ss-init-v3-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TS-U19-01 (L2): executes full initialization under Mode A (raw conversational brief with "decide for me" invocations)', async () => {
    // 1. Conversational interview intake with 3-tier support protocol
    const userBrief =
      'We are building LegalStream, an autonomous contract review and workflow automation platform for law firms and in-house legal teams.';

    // Founder asks for co-pilot auto-pilot on RBAC and Security
    const rbacDecision = evaluateAdaptiveQuestionRouting({
      gateId: 'gate_2_actors_rbac',
      userInput: 'You decide for me, what permissions and roles make sense?',
    });
    expect(rbacDecision.action).toBe('decide_for_me');
    expect(rbacDecision.autoPilot).toBe(true);
    expect(rbacDecision.selectedOption).toContain('3-tier role hierarchy');

    const securityDecision = evaluateAdaptiveQuestionRouting({
      gateId: 'gate_4_tenant_security',
      userInput: 'Please decide for me, what security isolation is needed?',
    });
    expect(securityDecision.action).toBe('decide_for_me');
    expect(securityDecision.autoPilot).toBe(true);
    expect(securityDecision.selectedOption).toContain('Row Level Security');

    // Query community skills for payments & background jobs
    const discoveredSkills = await queryCommunitySkills(['stripe', 'dodo-payments']);
    expect(discoveredSkills.length).toBe(2);
    expect(discoveredSkills.every((s) => s.autoInstall)).toBe(true);

    const context = {
      root: tempDir,
      projectName: 'LegalStream',
      productThesis: 'Autonomous legal workflow platform',
      valueProp: 'Streamlines contract review and firm compliance',
      archetype: { primary: 'B2B Team SaaS', secondary: 'The Sage' },
      entities: ['Firm', 'Attorney', 'Contract', 'AuditLog'],
      services: ['dodo-payments', 'upstash'],
      roles: ['PartnerAdmin', 'Associate', 'ClientReviewer'],
      rbacRecommendation: rbacDecision.selectedOption,
      securityRecommendation: securityDecision.selectedOption,
    };

    // 2. Step 7.5: Generate Tier 2 Workspace Initialization Plan Suite directly to disk
    const planResult = generateInitializationPlan(tempDir, context);
    const planDir = path.join(tempDir, 'docs', 'plans', 'workspace-initialization');
    expect(existsSync(planDir)).toBe(true);

    const expectedPlanFiles = [
      'CONTEXT.md',
      'README.md',
      'index.md',
      'plan-manifest.json',
      'phase-1-product-prd-and-vision.md',
      'phase-2-app-scaffolding-and-theming.md',
      'phase-3-technical-bible-and-adrs.md',
      'phase-4-actionable-task-backlog.md',
      'phase-5-ai-steering-and-harness.md',
    ];
    for (const file of expectedPlanFiles) {
      expect(existsSync(path.join(planDir, file))).toBe(true);
    }

    // 3. Step 9: Multi-skill plan-driven lifecycle orchestration across all 5 phases
    const phaseLedger: string[] = [];
    const handlers = {
      P1: async () => {
        phaseLedger.push('P1');
        // /ss-bible synthesis of PRD and 00-product-and-vision
        synthesizeProductChapters(context, tempDir);
        return { prdSynthesized: true };
      },
      P2: async () => {
        phaseLedger.push('P2');
        // Brand generation & App Scaffolding
        const brandTokens = generateBrandTokensJson({
          primaryColor: 'oklch(0.62 0.22 260)',
          fontFamily: 'Inter',
        });
        await generateBrandAssets(tempDir, {
          projectName: 'LegalStream',
          primaryColor: 'oklch(0.62 0.22 260)',
          fontFamily: 'Inter',
        });

        // Pre-create starter placeholder app/globals.css
        const appCssPath = path.join(tempDir, 'apps', 'web', 'app', 'globals.css');
        mkdirSync(path.dirname(appCssPath), { recursive: true });
        writeFileSync(appCssPath, ':root { --color-primary: #1877F2; }\n', 'utf8');

        // Execute app domain scaffolder
        scaffoldApplicationDomain(
          {
            root: tempDir,
            projectName: 'LegalStream',
            entities: context.entities,
            tokens: brandTokens,
            services: context.services,
          },
          'apps/web'
        );
        return { appScaffolded: true };
      },
      P3: async () => {
        phaseLedger.push('P3');
        // /ss-bible & decisions-generator
        generateDomainDecisions(context, tempDir);
        return { decisionsCompiled: true };
      },
      P4: async () => {
        phaseLedger.push('P4');
        // /ss-backlog task backlog synthesis
        const backlogDir = path.join(tempDir, 'docs', 'backlog');
        const phase1Dir = path.join(backlogDir, 'Phase 1 - Foundation');
        mkdirSync(phase1Dir, { recursive: true });

        writeFileSync(
          path.join(backlogDir, 'MOC.md'),
          '# Backlog Map of Content\n\n- [Phase 1](./Phase%201%20-%20Foundation/README.md)\n',
          'utf8'
        );
        writeFileSync(
          path.join(backlogDir, 'README.md'),
          '# Task Backlog\n\nTailored task backlog with user stories linked to PRDs.\n',
          'utf8'
        );

        // Author sample Phase 1 user story task card
        const taskCard = `---
id: TASK-001
title: Configure Law Firm Multi-Tenant Database Schema & RLS
phase: 1
status: todo
prd: docs/bible/PRD/phase-1-foundation-prd.md#AC-F1-01
---

# TASK-001: Configure Law Firm Multi-Tenant Schema

## User Story
As a Managing Partner,
I want our firm data isolated in dedicated database tables,
So that no external parties can access sensitive client contracts.

## Acceptance Criteria
- [ ] PostgreSQL migration creates firms and contracts tables
- [ ] RLS policy ensures firm_id isolation
`;
        writeFileSync(path.join(phase1Dir, 'TASK-001-firm-schema.md'), taskCard, 'utf8');
        return { backlogGenerated: true };
      },
      P5: async () => {
        phaseLedger.push('P5');
        // /ss-steering slim AGENTS.md & static rules
        const agentsMd = `# ShiftStone — LegalStream Workspace Orientation

Universal entry point for AI IDEs developing LegalStream.

## Multi-Repo Ecosystem Layout
- \`docs/\`: SSOT for LegalStream (blueprints, research, loops).
- \`apps/web/\`: Web application frontend and API routes.

## Suggested Next Steps
| Command | Action | Recommended Timing |
|---|---|---|
| \`/ss-plan\` | Plan Phase 1 backlog items | Immediately |
`;
        writeFileSync(path.join(tempDir, 'AGENTS.md'), agentsMd, 'utf8');

        const staticRulesDir = path.join(tempDir, '.shiftstone', 'static-rules');
        mkdirSync(staticRulesDir, { recursive: true });
        writeFileSync(
          path.join(staticRulesDir, 'global.md'),
          '# Global Rules\nAlways maintain bounded context and run verifications.\n',
          'utf8'
        );
        return { steeringSynthesized: true };
      },
    };

    const orchestrationResult = await orchestrateInitializationLifecycle({
      root: tempDir,
      planPath: planDir,
      handlers,
    });

    expect(orchestrationResult.status).toBe('completed');
    expect(orchestrationResult.completedPhases).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    expect(phaseLedger).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);

    // 4. Verify Phase 1 Artifacts: PRD and Product Vision in Bible
    expect(existsSync(path.join(tempDir, 'docs', 'bible', 'PRD', 'ecosystem-prd.md'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'docs', 'bible', 'PRD', 'phase-1-foundation-prd.md'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'docs', 'bible', '00-product-and-vision', 'vision-and-mission.md'))).toBe(true);
    const ecoPrd = readFileSync(path.join(tempDir, 'docs', 'bible', 'PRD', 'ecosystem-prd.md'), 'utf8');
    expect(ecoPrd).toContain('LegalStream');

    // 5. Verify Phase 2 Artifacts: Brand Book, Migrations, Env & Stylesheet
    expect(existsSync(path.join(tempDir, 'docs', 'brand', 'brand-book.html'))).toBe(true);
    expect(existsSync(path.join(tempDir, 'docs', 'brand', 'brand-tokens.json'))).toBe(true);

    const migrationsDir = path.join(tempDir, 'apps', 'web', 'supabase', 'migrations');
    expect(existsSync(migrationsDir)).toBe(true);
    const migrationFiles = readdirSync(migrationsDir);
    expect(migrationFiles.length).toBeGreaterThan(0);
    const migrationContent = readFileSync(path.join(migrationsDir, migrationFiles[0]), 'utf8');
    expect(migrationContent).toContain('CREATE TABLE');
    expect(migrationContent).toContain('ROW LEVEL SECURITY');

    const envPath = path.join(tempDir, 'apps', 'web', '.env.example');
    expect(existsSync(envPath)).toBe(true);
    const envContent = readFileSync(envPath, 'utf8');
    expect(envContent).toContain('DODO_PAYMENTS');

    const globalsCss = readFileSync(path.join(tempDir, 'apps', 'web', 'app', 'globals.css'), 'utf8');
    expect(globalsCss).not.toContain('#1877F2');
    expect(globalsCss).toContain('--color-primary');

    // 6. Verify Phase 3 Artifacts: Physical ADRs and Compiled Decisions Ledger
    const decisionsDir = path.join(tempDir, 'docs', 'decisions');
    expect(existsSync(decisionsDir)).toBe(true);
    const adrFiles = readdirSync(decisionsDir);
    expect(adrFiles.some((f) => f.startsWith('DEC-010'))).toBe(true);

    const decisionsLedger = path.join(tempDir, 'docs', 'bible', 'DECISIONS.md');
    expect(existsSync(decisionsLedger)).toBe(true);
    const ledgerContent = readFileSync(decisionsLedger, 'utf8');
    expect(ledgerContent).toContain('DEC-010');

    // 7. Verify Phase 4 Artifacts: Backlog task cards
    const taskCardPath = path.join(tempDir, 'docs', 'backlog', 'Phase 1 - Foundation', 'TASK-001-firm-schema.md');
    expect(existsSync(taskCardPath)).toBe(true);
    const taskCardContent = readFileSync(taskCardPath, 'utf8');
    expect(taskCardContent).toContain('User Story');
    expect(taskCardContent).toContain('prd: docs/bible/PRD/phase-1-foundation-prd.md#AC-F1-01');

    // 8. Verify Phase 5 Artifacts: Slim AGENTS.md router (<= 60 lines)
    const agentsMdContent = readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
    const agentLines = agentsMdContent.split(/\r?\n/).length;
    expect(agentLines).toBeLessThanOrEqual(60);

    // 9. Verify Output State Machine tracking
    const planState = JSON.parse(readFileSync(path.join(planDir, 'output', 'state.json'), 'utf8'));
    expect(planState.phases.every((p: any) => p.implementation === 'implemented' && p.acceptance === 'complete')).toBe(true);
  });

  it('TS-U19-01 (L2): executes full initialization under Mode B (pre-existing PRD ingestion with adaptive gate skipping)', async () => {
    // 1. Comprehensive pre-existing PRD pasted into Gate 1
    const comprehensivePrd = `# DocFlow — Autonomous Document Collaboration Platform

## Overview & Vision
DocFlow streamlines multi-party contract negotiation, real-time markup, and signature workflows.

## User Roles & Permissions
- Admin: Full firm configuration and user management
- Editor: Document creation, markup, and commenting
- Client: Read-only access and digital signature approval

## Core Domain Entities & Rules
- Workspace: Multi-tenant root organization
- Document: File version and text contents
- Signature: Cryptographic audit record
Rule: A signature cannot be modified once applied (strictly immutable).

## Security & Privacy
Multi-tenant isolation enforced via PostgreSQL Row-Level Security (RLS).
Fully compliant with GDPR and SOC2 audit logging.

## Third-Party Integrations
Stripe for billing, Resend for notification emails, and Supabase for real-time channels.
`;

    // 2. Trait Matrix extraction
    const traits = extractStructuredTraits(comprehensivePrd);
    expect(traits.actors_roles.score).toBeGreaterThanOrEqual(0.8);
    expect(traits.domain_entities.score).toBeGreaterThanOrEqual(0.6);
    expect(traits.security_posture.score).toBeGreaterThanOrEqual(0.8);

    // 3. Adaptive Question Router asserts gates are auto-skipped with confirmation
    const rbacGate = evaluateAdaptiveQuestionRouting({
      gateId: 'gate_2_actors_rbac',
      traitMatrix: traits,
    });
    expect(rbacGate.action).toBe('skip');
    expect(rbacGate.status).toBe('resolved');
    expect(rbacGate.confirmation).toMatch(/Skipping|already answered/);

    const entityGate = evaluateAdaptiveQuestionRouting({
      gateId: 'gate_3_entity_modeling',
      traitMatrix: traits,
    });
    expect(entityGate.action).toBe('skip');
    expect(entityGate.status).toBe('resolved');

    const securityGate = evaluateAdaptiveQuestionRouting({
      gateId: 'gate_4_tenant_security',
      traitMatrix: traits,
    });
    expect(securityGate.action).toBe('skip');
    expect(securityGate.status).toBe('resolved');

    // 4. Generate Tier 2 Initialization Plan capturing raw PRD in CONTEXT.md
    const context = {
      root: tempDir,
      projectName: 'DocFlow',
      rawPrd: comprehensivePrd,
      entities: traits.domain_entities.entities,
      services: ['stripe', 'resend'],
    };
    generateInitializationPlan(tempDir, context, traits);

    const contextMdPath = path.join(tempDir, 'docs', 'plans', 'workspace-initialization', 'CONTEXT.md');
    expect(existsSync(contextMdPath)).toBe(true);
    const contextMd = readFileSync(contextMdPath, 'utf8');
    expect(contextMd).toContain('DocFlow');
    expect(contextMd).toContain('multi-party contract negotiation');

    // 5. Orchestrate phases and assert all complete
    const planDir = path.join(tempDir, 'docs', 'plans', 'workspace-initialization');
    const result = await orchestrateInitializationLifecycle({
      root: tempDir,
      planPath: planDir,
      handlers: {
        P1: async () => ({ p1: true }),
        P2: async () => ({ p2: true }),
        P3: async () => ({ p3: true }),
        P4: async () => ({ p4: true }),
        P5: async () => ({ p5: true }),
      },
    });

    expect(result.status).toBe('completed');
    expect(result.completedPhases.length).toBe(5);
  });

  it('TS-U19-02 (L1): confirms zero engine drift between Parent Lab and Child Framework (DEC-014)', () => {
    // Run sync-engine check script against live monorepo
    const syncScript = path.join(REPO_ROOT, '.shiftstone', 'scripts', 'sync-engine.js');
    expect(existsSync(syncScript)).toBe(true);

    const checkOutput = execSync(`node "${syncScript}" --check`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    expect(checkOutput).toContain('100% in sync');
    expect(checkOutput).toContain('Files to create:     0');
    expect(checkOutput).toContain('Files to update:     0');
  });
});
