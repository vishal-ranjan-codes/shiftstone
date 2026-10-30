import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDecisionsSync } from '../../scripts/compile-decisions.js';
import { generateDomainDecisions } from '../../init/decisions-generator.js';

describe('Unit U7 — Domain ADR Generation & Auto-Compiled Decisions Ledger (REQ-INIT3-07)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'decisions-gen-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U7-01 (L1) — generateDomainDecisions', () => {
    it('creates genuine physical OKF ADR files in docs/decisions/', () => {
      const mockContext = {
        projectName: 'NexusAgency',
        productType: 'b2b_saas',
        entities: ['Workspace', 'Task', 'Invoice'],
        paymentService: 'stripe',
        cronService: 'upstash-qstash',
      };

      const result = generateDomainDecisions(mockContext, tempDir);
      expect(result.length).toBeGreaterThanOrEqual(1);

      const decisionsDir = path.join(tempDir, 'docs', 'decisions');
      expect(existsSync(decisionsDir)).toBe(true);

      // Foundational domain ADR
      const dec010Path = path.join(decisionsDir, 'DEC-010-foundational-domain-architecture.md');
      expect(existsSync(dec010Path)).toBe(true);
      const dec010Content = readFileSync(dec010Path, 'utf8');
      expect(dec010Content).toContain('decisionId: DEC-010');
      expect(dec010Content).toContain('status: accepted');
      expect(dec010Content).toContain('Workspace');

      // Payment ADR
      const paymentAdrPath = path.join(decisionsDir, 'DEC-018-stripe-payment-integration.md');
      expect(existsSync(paymentAdrPath)).toBe(true);
      const paymentContent = readFileSync(paymentAdrPath, 'utf8');
      expect(paymentContent).toContain('decisionId: DEC-018');

      // Cron ADR
      const cronAdrPath = path.join(decisionsDir, 'DEC-019-upstash-qstash-background-jobs.md');
      expect(existsSync(cronAdrPath)).toBe(true);
      const cronContent = readFileSync(cronAdrPath, 'utf8');
      expect(cronContent).toContain('decisionId: DEC-019');
    });
  });

  describe('TS-U7-02 (L1) — Auto-Compiled Ledger Sync', () => {
    it('compiles generated ADRs into docs/bible/DECISIONS.md with checkDecisionsSync passing', () => {
      const mockContext = {
        projectName: 'NexusAgency',
        productType: 'b2b_saas',
        entities: ['Workspace', 'Task'],
        paymentService: 'dodo-payments',
      };

      generateDomainDecisions(mockContext, tempDir);

      const ledgerPath = path.join(tempDir, 'docs', 'bible', 'DECISIONS.md');
      expect(existsSync(ledgerPath)).toBe(true);
      const ledgerContent = readFileSync(ledgerPath, 'utf8');
      expect(ledgerContent).toContain('DEC-010');
      expect(ledgerContent).toContain('DEC-018');

      // Assert sync check passes cleanly
      const syncResult = checkDecisionsSync({ root: tempDir });
      expect(syncResult.inSync).toBe(true);
    });
  });
});
