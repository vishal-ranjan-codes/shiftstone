import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateTaxonomy } from '../../init/bible-topology.js';
import {
  applySteeringCustomization,
  generateBibleRule,
  generateGlobalRule,
  generateProductRule,
  STATIC_RULE_LINE_LIMIT,
} from '../../init/steering-customizer.js';

describe('Unit U10 — Context-Aware Steering Customization & Dynamic Drift Rules (REQ-INIT-09)', () => {
  let tempDir: string;

  const sampleContext = {
    projectName: 'FinTech Pulse',
    valueProp: 'Real-time ledger and compliance automation engine',
    thesis: 'FinTech Pulse eliminates compliance latency with sub-second ledger reconciliation.',
    targetAudience: 'Chief Compliance Officers and FinTech platform engineers',
    stack: 'React Router 8, Cloudflare Workers, Supabase PostgreSQL, Tailwind CSS v4',
    appPath: 'apps/console',
    goals: [
      'Achieve sub-50ms audit query responses via indexed ledger schemas',
      'Provide zero-data-loss double-entry guarantees',
    ],
    antiGoals: [
      'Do NOT allow unverified client-side ledger mutations',
      'Do NOT log raw PII into unencrypted observability channels',
    ],
    domainRules: [
      'Double-entry balance check: sum of debits must strictly equal sum of credits per transaction.',
      'Immutable ledger entries: entries once sealed cannot be updated or deleted.',
    ],
    isolationInvariants: [
      'Every ledger account is scoped to an active organization_id with mandatory RLS enforcement.',
      'Service role key access is restricted to asynchronous reconciler workers only.',
    ],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'steering-customizer-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U10-01 (L1) — Steering Rule Generation & Budget Compliance', () => {
    it('generates valid product.md with all required product attributes and within line budget', () => {
      const productMd = generateProductRule(sampleContext);
      expect(productMd).toContain('activation: always');
      expect(productMd).toContain('FinTech Pulse — Product & Workspace Identity');
      expect(productMd).toContain('Thesis**: FinTech Pulse eliminates compliance latency');
      expect(productMd).toContain('Target Audience**: Chief Compliance Officers');
      expect(productMd).toContain('Stack Identity**: React Router 8');
      expect(productMd).toContain('Core Goals vs Anti-Goals');
      expect(productMd).toContain('Achieve sub-50ms audit query responses');
      expect(productMd).toContain('Do NOT allow unverified client-side ledger mutations');
      expect(productMd).toContain('apps/console/');

      const lineCount = productMd.trim().split('\n').length;
      expect(lineCount).toBeLessThanOrEqual(STATIC_RULE_LINE_LIMIT);
    });

    it('generates valid global.md incorporating project domain rules and isolation invariants', () => {
      const globalMd = generateGlobalRule(sampleContext);
      expect(globalMd).toContain('activation: always');
      expect(globalMd).toContain('Double-entry balance check');
      expect(globalMd).toContain('Every ledger account is scoped to an active organization_id');
      expect(globalMd).toContain('Task → Rule File Dispatch');
      expect(globalMd).toContain('Mode Detection (Bible Update Checks)');

      const lineCount = globalMd.trim().split('\n').length;
      expect(lineCount).toBeLessThanOrEqual(STATIC_RULE_LINE_LIMIT);
    });

    it('generates dynamic bible-rules.md mapping source paths to active modular Bible chapters', () => {
      const taxonomy = evaluateTaxonomy({ domain: 'fintech' });
      const bibleRulesMd = generateBibleRule(taxonomy, { appPath: 'apps/console' });

      expect(bibleRulesMd).toContain('activation: always');
      expect(bibleRulesMd).toContain('ShiftStone — Bible Rules');
      expect(bibleRulesMd).toContain('apps/console/supabase/');
      expect(bibleRulesMd).toContain('03-database/schema-reference.md');
      expect(bibleRulesMd).toContain('03-database/rls-policies.md');
      expect(bibleRulesMd).toContain('03-database/migrations.md');
      expect(bibleRulesMd).toContain('compliance-and-ledger');

      // Assert CLI taxonomy excludes frontend and maps CLI commands
      const cliTaxonomy = evaluateTaxonomy({ productType: 'cli' });
      const cliBibleRules = generateBibleRule(cliTaxonomy, { appPath: 'apps/cli' });
      expect(cliBibleRules).not.toContain('07-frontend');
      expect(cliBibleRules).toContain('plugin-architecture');
      expect(cliBibleRules).toContain('cli-commands-and-flags');
      expect(cliBibleRules).toContain('apps/cli/commands/');
    });

    it('applies steering customization to target workspace directories', () => {
      const taxonomy = evaluateTaxonomy({ productType: 'fullstack_saas' });
      const result = applySteeringCustomization(tempDir, sampleContext, taxonomy);

      expect(result.success).toBe(true);
      expect(existsSync(result.paths.product)).toBe(true);
      expect(existsSync(result.paths.global)).toBe(true);
      expect(existsSync(result.paths.bibleRules)).toBe(true);

      const productContent = readFileSync(result.paths.product, 'utf8');
      expect(productContent).toContain('FinTech Pulse');
    });
  });
});
