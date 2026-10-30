import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateBibleSynthesis } from '../../init/validate-bible-synthesis.js';

describe('Unit U9 — Deep AI Domain Synthesis Engine (REQ-INIT-08)', () => {
  let tempDir: string;
  const scriptPath = path.resolve(__dirname, '../../init/validate-bible-synthesis.js');

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'bible-synthesis-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U9-01 (L1) — Deterministic Placeholder & Boilerplate Detection', () => {
    it('passes cleanly when bible files contain concrete technical content', () => {
      const chapterDir = path.join(tempDir, '03-database');
      mkdirSync(chapterDir, { recursive: true });

      // Create a substantive file (>30 lines, >300 words) with real technical content
      const substantiveContent = `# Database Schema Reference

## Overview
This document defines the schema architecture for the production PostgreSQL database.
The database stores multitenant records with row-level security enabled across all operational tables.
All primary keys use UUID v4 values generated via the pgcrypto extension.
Foreign keys enforce relational referential integrity with cascading deletions where appropriate.
Data isolation is guaranteed across tenants through row-level security policies evaluated at runtime.
Each session must set the current tenant configuration parameter prior to executing queries.

## Tenant Table Architecture
The tenant entity represents an organization or team workspace.
All workspace-scoped data must include a foreign key reference to this table.
The slug is used for routing and subdomain resolution across web applications.
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'standard',
  max_seats INTEGER NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

## User Profiles & Permissions
User profiles link Supabase or external authentication identities to workspace tenants.
Users can belong to multiple tenants, with roles governing administrative permissions.
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  avatar_url TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

## Subscriptions & Billing State
Subscription records synchronize billing events from Stripe webhooks.
The billing status drives feature gating, seat allocation limits, and grace period handling.
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

## Indexes & Constraints
CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_tenants_slug ON public.tenants(slug);
CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions(tenant_id);

## Row Level Security Policies
Security policies ensure zero leakage of multitenant records.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON public.tenants
  FOR ALL USING (id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY user_isolation_policy ON public.users
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY subscription_isolation_policy ON public.subscriptions
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
`;

      writeFileSync(path.join(chapterDir, 'schema-reference.md'), substantiveContent, 'utf8');

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(true);
      expect(report.valid).toBe(true);
      expect(report.violations).toHaveLength(0);
    });

    it('detects unresolved template substitution tokens (e.g. {{PROJECT_NAME}})', () => {
      const chapterDir = path.join(tempDir, '01-architecture');
      mkdirSync(chapterDir, { recursive: true });

      writeFileSync(
        path.join(chapterDir, 'topology.md'),
        `# Architecture Overview
This workspace hosts {{PROJECT_NAME}} on Cloudflare Workers.
`,
        'utf8',
      );

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.rule === 'RAW_TEMPLATE_TOKEN')).toBe(true);
      expect(report.violations[0].match).toBe('{{PROJECT_NAME}}');
    });

    it('detects unresolved TODO comments', () => {
      const chapterDir = path.join(tempDir, '05-core-systems');
      mkdirSync(chapterDir, { recursive: true });

      writeFileSync(
        path.join(chapterDir, 'domain-invariants.md'),
        `# Domain Rules
<!-- TODO: Add credit balance validation invariant -->
`,
        'utf8',
      );

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.rule === 'TODO_COMMENT')).toBe(true);
    });

    it('detects boilerplate prompt strings (e.g. "Describe your models here")', () => {
      const chapterDir = path.join(tempDir, '03-database');
      mkdirSync(chapterDir, { recursive: true });

      writeFileSync(
        path.join(chapterDir, 'schema-reference.md'),
        `# Database Schema
Describe your primary data models here.
`,
        'utf8',
      );

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(false);
      expect(report.violations.some((v) => v.rule === 'BOILERPLATE_PROMPT')).toBe(true);
    });

    it('runs as CLI and exits 1 when violations exist, 0 when clean', () => {
      const chapterDir = path.join(tempDir, '08-api-contracts');
      mkdirSync(chapterDir, { recursive: true });

      writeFileSync(
        path.join(chapterDir, 'route-actions.md'),
        `# Actions
Insert your Zod schemas here.
`,
        'utf8',
      );

      const failRun = spawnSync(process.execPath, [scriptPath, tempDir], { encoding: 'utf8' });
      expect(failRun.status).toBe(1);
      expect(failRun.stderr).toContain('FAIL — Unresolved placeholders');

      // Now fix the file with full substantive content
      const lines = [
        '# Actions Specification',
        '## Schema Validation',
        ...Array.from({ length: 32 }, (_, i) => `export const schemaItem${i} = z.object({ id: z.string().uuid(), name: z.string().min(1) });`),
      ].join('\n');
      writeFileSync(path.join(chapterDir, 'route-actions.md'), lines, 'utf8');

      const passRun = spawnSync(process.execPath, [scriptPath, tempDir], { encoding: 'utf8' });
      expect(passRun.status).toBe(0);
      expect(passRun.stdout).toContain('ok — All synthesized Bible files are concrete');
    });
  });
});

describe('Unit U11 — Substantive Bible Synthesis Validator (REQ-INIT3-11, LOCK-INIT3-05)', () => {
  let tempDir: string;
  let templateDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'bible-substantive-test-'));
    templateDir = mkdtempSync(path.join(tmpdir(), 'bible-template-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    if (templateDir && existsSync(templateDir)) {
      rmSync(templateDir, { recursive: true, force: true });
    }
  });

  describe('TS-U11-01 (L1) — Boilerplate Diff & Substantive Line/Word Floors', () => {
    it('detects and rejects untouched starter template boilerplate files (AC-U11-01)', () => {
      const chapterDir = path.join(tempDir, '02-backend');
      const tplChapterDir = path.join(templateDir, '02-backend');
      mkdirSync(chapterDir, { recursive: true });
      mkdirSync(tplChapterDir, { recursive: true });

      const boilerplateContent = `# Backend Architecture Boilerplate
This is the default boilerplate starter pack template for backend architecture.
It describes standard REST and RPC conventions before project synthesis.
` + Array.from({ length: 30 }, (_, i) => `Line ${i}: Default template standard configuration and environment setup.`).join('\n');

      writeFileSync(path.join(tplChapterDir, 'api-routes.md'), boilerplateContent, 'utf8');
      writeFileSync(path.join(chapterDir, 'api-routes.md'), boilerplateContent, 'utf8');

      const report = validateBibleSynthesis(tempDir, {
        starterTemplateDir: templateDir,
      });

      expect(report.ok).toBe(false);
      const boilerplateViolation = report.violations.find((v) => v.rule === 'BOILERPLATE_UNTOUCHED');
      expect(boilerplateViolation).toBeDefined();
      expect(boilerplateViolation?.relativePath).toBe('02-backend/api-routes.md');
      expect(boilerplateViolation?.message).toContain('100% identical to boilerplate');
    });

    it('rejects topic markdown files falling below the 30 substantive lines and 300 words floor', () => {
      const chapterDir = path.join(tempDir, '04-integrations');
      mkdirSync(chapterDir, { recursive: true });

      // Shallow 8-line file
      const shallowContent = `# Third-Party Integrations
We use Stripe for payments and Resend for transactional email.
Webhooks are authenticated via HMAC signatures.
`;
      writeFileSync(path.join(chapterDir, 'payment-gateway.md'), shallowContent, 'utf8');

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(false);
      const depthViolation = report.violations.find((v) => v.rule === 'INSUFFICIENT_SUBSTANTIVE_DEPTH');
      expect(depthViolation).toBeDefined();
      expect(depthViolation?.relativePath).toBe('04-integrations/payment-gateway.md');
      expect(depthViolation?.message).toContain('floor is 30 lines / 300 words');
    });

    it('exempts index and meta files (index.md, README.md, log.md, CHANGELOG.md) from the 30-line floor', () => {
      const chapterDir = path.join(tempDir, '01-architecture');
      mkdirSync(chapterDir, { recursive: true });

      // Short index.md
      writeFileSync(path.join(tempDir, 'index.md'), '# Development Bible\nIndex of architecture chapters.', 'utf8');
      writeFileSync(path.join(chapterDir, 'index.md'), '# Chapter 01\nArchitecture overview index.', 'utf8');

      // Substantive topic file
      const topicLines = [
        '# Core System Topology',
        '## System Architecture Description',
        'The infrastructure is deployed across edge worker regions with low latency.',
        ...Array.from({ length: 35 }, (_, i) => `Section ${i}: Detailed specifications for edge routing, caching layers, and database replica synchronization protocols.`),
      ].join('\n');
      writeFileSync(path.join(chapterDir, 'topology.md'), topicLines, 'utf8');

      const report = validateBibleSynthesis(tempDir, { substantive: true });
      expect(report.ok).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });

  describe('TS-U11-02 (L1) — Domain Vocabulary Density & Genuinely Synthesized Bible', () => {
    it('flags chapters with zero mentions of required project domain entities (AC-U11-02)', () => {
      const chapterDir = path.join(tempDir, '05-workflows');
      mkdirSync(chapterDir, { recursive: true });

      const genericSubstantive = [
        '# Workflow Engine Architecture',
        '## Overview of Background Tasks',
        ...Array.from({ length: 35 }, (_, i) => `Paragraph ${i}: Generic workflow step processing queue messages and executing asynchronous tasks safely.`),
      ].join('\n');
      writeFileSync(path.join(chapterDir, 'task-runner.md'), genericSubstantive, 'utf8');

      // Validate requiring domain entities
      const report = validateBibleSynthesis(tempDir, {
        domainEntities: ['Patient', 'Appointment', 'Prescription'],
      });

      expect(report.ok).toBe(false);
      const vocabViolation = report.violations.find((v) => v.rule === 'MISSING_DOMAIN_VOCABULARY');
      expect(vocabViolation).toBeDefined();
      expect(vocabViolation?.relativePath).toBe('05-workflows/task-runner.md');
      expect(vocabViolation?.message).toContain('Patient, Appointment, Prescription');
    });

    it('passes cleanly when genuinely synthesized Bible has custom domain entities and passes all floors', () => {
      const chapterDir = path.join(tempDir, '05-workflows');
      mkdirSync(chapterDir, { recursive: true });

      const customSubstantive = [
        '# Workflow Engine Architecture for Telehealth',
        '## Patient Appointment Scheduling',
        'When a Patient creates an Appointment, the system schedules notification workers.',
        ...Array.from({ length: 35 }, (_, i) => `Paragraph ${i}: The Appointment lifecycle updates the Patient status and prepares Prescription fulfillment.`),
      ].join('\n');
      writeFileSync(path.join(chapterDir, 'task-runner.md'), customSubstantive, 'utf8');

      const report = validateBibleSynthesis(tempDir, {
        domainEntities: ['Patient', 'Appointment', 'Prescription'],
      });

      expect(report.ok).toBe(true);
      expect(report.violations).toHaveLength(0);
    });
  });
});
