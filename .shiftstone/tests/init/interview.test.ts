/**
 * Phase 4 — task 4.7 verification: the interactive interview path works.
 * Drives `interview()` with a scripted stdin and asserts the answers it
 * returns (archetype selection, layout, package manager, starter clone).
 */

import { PassThrough, Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  evaluateContextSufficiency,
  evaluateGateResolution,
  extractStructuredTraits,
  interview,
  OPENING_GREETING,
  TRI_ARCHETYPES,
} from '../../init/interview.js';
import { listPackNames } from '../../init/pack-loader.js';
import { REPO_ROOT } from './workspace-fixture.js';

/** Index (1-based) of the flagship pack in the alphabetical pack list. */
function flagshipChoice(): string {
  const packNames = listPackNames(REPO_ROOT);
  return `${packNames.indexOf('rr8-supabase-cf') + 1}\n`;
}

/** Pushes one answer line every 20ms so readline consumes them per question. */
async function* scriptedAnswers(lines: string[]): AsyncGenerator<string> {
  for (const line of lines) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    yield line;
  }
}

function sink(): { stream: PassThrough; text: () => string } {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  return { stream, text: () => Buffer.concat(chunks).toString('utf8') };
}

describe('4.7 — interactive interview', () => {
  it('collects archetype + scoping answers in order', async () => {
    const output = sink();
    // packs/ is listed alphabetically; the flagship's position shifts as packs
    // are added, so resolve it instead of hard-coding a choice number.
    const input = Readable.from(scriptedAnswers([flagshipChoice(), 'InterviewApp\n', '1\n', '1\n', 'octo\n', 'n\n', 'stripe\n']));

    const answers = await interview({ root: REPO_ROOT, input, output: output.stream });

    expect(answers.archetypes).toBe('rr8-supabase-cf');
    expect(answers.projectName).toBe('InterviewApp');
    expect(answers.layout).toBe('monorepo');
    expect(answers.packageManager).toBe('pnpm');
    expect(answers.ghUser).toBe('octo');
    expect(answers.cloneStarter).toBe(false);
    expect(answers.skills).toBe('stripe');
    expect(output.text()).toContain('Enter choice');
    expect(output.text()).toContain('Project Name');
    expect(output.text()).toContain('clone the official starter');
  }, 15_000);

  it('falls back to defaults on empty answers', async () => {
    const output = sink();
    const input = Readable.from(scriptedAnswers(['\n', '\n', '\n', '\n', '\n', 'n\n', '\n']));

    const answers = await interview({ root: REPO_ROOT, input, output: output.stream });

    expect(answers.archetypes).toBe('rr8-supabase-cf'); // default choice
    expect(answers.projectName).toBe('MySaaSApp');
    expect(answers.layout).toBe('monorepo');
    expect(answers.packageManager).toBe('pnpm');
    expect(answers.ghUser).toBeNull();
    expect(answers.skills).toBeNull();
  }, 15_000);
});

describe('Unit U1 — Socratic Plain-Text Intake & Adaptive Question Router', () => {
  describe('TS-U1-01 (L1) — evaluateContextSufficiency', () => {
    it('returns sufficient: false for vague or short inputs and formulates follow-up question', () => {
      const vagueTurn = [{ role: 'user', content: 'a blog site' }];
      const result = evaluateContextSufficiency(vagueTurn);

      expect(result.sufficient).toBe(false);
      expect(result.wordCount).toBeLessThan(20);
      expect(result.missingAttributes.length).toBeGreaterThan(0);
      expect(typeof result.followUpQuestion).toBe('string');
      expect(result.followUpQuestion.length).toBeGreaterThan(10);
    });

    it('returns sufficient: true for comprehensive product descriptions with >= 2 attributes and >= 20 words', () => {
      const richTurn = [
        {
          role: 'user',
          content:
            'We are building a pet grooming marketplace for dog owners and mobile groomers where pet parents can book nearby appointments and groomers manage their calendar and payments smoothly.',
        },
      ];
      const result = evaluateContextSufficiency(richTurn);

      expect(result.sufficient).toBe(true);
      expect(result.wordCount).toBeGreaterThanOrEqual(20);
      expect(result.followUpQuestion).toBeNull();
    });
  });

  describe('TS-U1-02 (L1) — extractStructuredTraits & evaluateGateResolution', () => {
    const samplePRD = `
# Product Requirement Document: TaskPulse SaaS

## 1. Overview & Identity
TaskPulse is a modern project tracking and client collaboration platform for digital marketing agencies. It streamlines milestone approvals and client billing.

## 2. Actors & Permissions
- Public Client: can view invoice and leave comments.
- Agency Member: can create tasks and log hours.
- Agency Admin: full access to organization settings, team billing, and role assignments.

## 3. Domain Entities & Invariants
- Organization: Top-level tenant.
- Workspace: Belongs to Organization.
- Task: Belongs to Workspace, tracks assignees, due dates, and status.
- Invoice: Generated monthly; finalized invoices cannot be deleted or edited.

## 4. Privacy, Security & Isolation
- Multi-tenant data isolation enforced by PostgreSQL Row-Level Security (RLS) on organization_id.
- GDPR data portability and export endpoints.
- Audit logging for all permission changes and billing events.

## 5. Integrations & Third-Party Services
- Stripe Connect for automated agency payouts and invoicing.
- Resend for transactional email notifications.
- Slack webhooks for instant task update pings.

## 6. Branding & Design
- Brand tone: professional, sleek, confident.
- Primary color: Emerald green and Slate dark mode.
`;

    it('parses comprehensive PRD into a 7-dimensional Trait Matrix', () => {
      const traits = extractStructuredTraits(samplePRD);

      expect(traits).toBeDefined();
      expect(traits.identity).toBeDefined();
      expect(traits.actors_roles).toBeDefined();
      expect(traits.domain_entities).toBeDefined();
      expect(traits.security_posture).toBeDefined();
      expect(traits.integrations).toBeDefined();
      expect(traits.brand_preferences).toBeDefined();
      expect(traits.stack_preferences).toBeDefined();

      expect(traits.identity.score).toBeGreaterThanOrEqual(0.8);
      expect(traits.actors_roles.roles).toContain('admin');
      expect(traits.domain_entities.entities.length).toBeGreaterThanOrEqual(3);
      expect(traits.security_posture.rls).toBe(true);
      expect(traits.integrations.services).toContain('stripe');
    });

    it('evaluates gate resolution and marks documented gates as resolved (confidence >= 0.80)', () => {
      const traits = extractStructuredTraits(samplePRD);

      const gate1Res = evaluateGateResolution(traits, 'gate_1_problem_space');
      expect(gate1Res.resolved).toBe(true);
      expect(gate1Res.confidence).toBeGreaterThanOrEqual(0.8);
      expect(gate1Res.confirmation).toContain('✅');

      const gate2Res = evaluateGateResolution(traits, 'gate_2_actors_rbac');
      expect(gate2Res.resolved).toBe(true);
      expect(gate2Res.confidence).toBeGreaterThanOrEqual(0.8);
      expect(gate2Res.confirmation).toContain('user roles');

      const gate3Res = evaluateGateResolution(traits, 'gate_3_entity_modeling');
      expect(gate3Res.resolved).toBe(true);
      expect(gate3Res.confidence).toBeGreaterThanOrEqual(0.8);

      const gate4Res = evaluateGateResolution(traits, 'gate_4_tenant_security');
      expect(gate4Res.resolved).toBe(true);
      expect(gate4Res.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('returns partial or unresolved status for missing or sparse traits', () => {
      const sparseTraits = extractStructuredTraits('Just a simple note taking app with users.');
      const gate4Res = evaluateGateResolution(sparseTraits, 'gate_4_tenant_security');

      expect(gate4Res.resolved).toBe(false);
      expect(gate4Res.confidence).toBeLessThan(0.3);
      expect(gate4Res.gateQuestion).toBeDefined();
    });
  });

  describe('TS-U1-03 (L2) — Opening Greeting & Archetype Catalog', () => {
    it('defines opening greeting welcoming pre-existing PRDs without multiple-choice confinement', () => {
      expect(OPENING_GREETING).toContain('What kind of app or website is it');
      expect(OPENING_GREETING).toContain('Have an existing plan?');
      expect(OPENING_GREETING).toContain('paste the entire plan here');
    });

    it('provides tri-archetype catalog covering marketplace, B2B SaaS, and AI tool', () => {
      expect(TRI_ARCHETYPES.length).toBe(3);
      const ids = TRI_ARCHETYPES.map((a) => a.id);
      expect(ids).toContain('marketplace');
      expect(ids).toContain('b2b_saas');
      expect(ids).toContain('ai_tool');
    });
  });
});

describe('Unit U2 — 3-Tier Conversational Support Protocol & Jargon-Free Elicitation', () => {
  describe('TS-U2-01 (L1) — step-pipeline.json Jargon Elimination', () => {
    it('verifies user-facing titles contain zero instances of RBAC, Invariants, Tenant Isolation, or Value Proposition', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const pipelinePath = path.resolve(__dirname, '../../init/step-pipeline.json');
      const content = fs.readFileSync(pipelinePath, 'utf8');
      const pipeline = JSON.parse(content);

      const titles = pipeline.steps.map((s: any) => s.title);
      const forbiddenTerms = ['RBAC', 'Invariants', 'Tenant Isolation', 'Value Proposition'];

      for (const title of titles) {
        for (const term of forbiddenTerms) {
          expect(title.toLowerCase()).not.toContain(term.toLowerCase());
        }
      }

      // Assert renamed plain-English titles exist
      expect(titles).toContain("What You're Building & Why It Matters");
      expect(titles).toContain("Who Uses Your App & Their Permissions");
      expect(titles).toContain("Key Information Your App Stores & Critical Rules");
      expect(titles).toContain("Privacy, Security & Data Protection");
    });
  });

  describe('TS-U2-02 (L1) — interview-rubric.md 3-Tier Support Protocol & Universal Archetypes', () => {
    it('asserts interview-rubric.md embeds the 3-Tier Conversational Protocol and Tri-Archetypes', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const rubricPath = path.resolve(__dirname, '../../../.agents/skills/ss-init/resources/interview-rubric.md');
      const content = fs.readFileSync(rubricPath, 'utf8');

      // Check 3-Tier cues
      expect(content.toLowerCase()).toContain('explain simply');
      expect(content.toLowerCase()).toContain('you decide');
      expect(content.toLowerCase()).toContain('decide for me');

      // Check tri-archetypes
      expect(content).toContain('Local Consumer Marketplace');
      expect(content).toContain('B2B Team SaaS');
      expect(content).toContain('AI-Native Developer Tool');
    });
  });
});


