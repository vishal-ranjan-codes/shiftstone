import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportResearchConduit, synthesizeResearchDossier } from '../../init/research-synthesizer.js';
import { validateResearchDossier } from '../../scripts/validate-research.js';

describe('Unit U12 — Production-Grade Research Engine with Live Web Search & Bible Conduit (REQ-INIT3-12, LOCK-INIT3-16)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'research-synthesizer-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U12-01 (L1) — Research Dossier Depth & Validation Thresholds', () => {
    it('rejects a 1 KB shallow skeleton dossier under byte floors and missing live source receipts (AC-U12-01)', () => {
      const dossierDir = path.join(tempDir, 'shallow-research');
      mkdirSync(dossierDir, { recursive: true });

      // Create shallow 1 KB skeleton files
      writeFileSync(path.join(dossierDir, '00-BRIEF.md'), '## Research Question\nShould we use Stripe?\n');
      writeFileSync(path.join(dossierDir, '01-SUMMARY.md'), '# Summary\nStripe is good.\n');
      writeFileSync(path.join(dossierDir, '02-FINDINGS.md'), '# Findings\nStripe handles credit card processing.\n');
      writeFileSync(path.join(dossierDir, '03-COMPARISON.md'), '# Comparison\nStripe vs PayPal.\n');
      writeFileSync(path.join(dossierDir, '04-CONCLUSION.md'), '## Recommendation\nUse Stripe.\n');
      writeFileSync(path.join(dossierDir, '05-IMPLEMENTATION.md'), '# Implementation\nCall stripe.createCustomer().\n');
      writeFileSync(path.join(dossierDir, '06-SOURCES.md'), '# Sources\nNo receipts yet.\n');

      const res = validateResearchDossier(dossierDir, { root: tempDir });
      expect(res.ok).toBe(false);

      const codes = res.violations.map((v) => v.code);
      // Must flag byte floor violations
      expect(codes).toContain('INSUFFICIENT_BYTE_SIZE');
      expect(codes).toContain('INSUFFICIENT_DOSSIER_SIZE');
      // Must flag missing runnable TypeScript/JavaScript code fence
      expect(codes).toContain('MISSING_IMPLEMENTATION_CODE');
      // Must flag missing Mermaid diagram
      expect(codes).toContain('MISSING_MERMAID_DIAGRAM');
      // Must flag insufficient search receipts
      expect(codes).toContain('INSUFFICIENT_SEARCH_RECEIPTS');
    });

    it('rejects dossiers where 02-FINDINGS.md is under 4,000 bytes or 05-IMPLEMENTATION.md is under 8,000 bytes', () => {
      const dossierDir = path.join(tempDir, 'byte-floor-research');
      mkdirSync(dossierDir, { recursive: true });

      writeFileSync(path.join(dossierDir, '00-BRIEF.md'), '## Research Question\nEvaluate payment integration architecture.\n');
      writeFileSync(path.join(dossierDir, '01-SUMMARY.md'), '# Summary\nEvaluation summary.\n');
      // 02-FINDINGS is 1,000 bytes (under 4,000 bytes floor)
      writeFileSync(path.join(dossierDir, '02-FINDINGS.md'), '# Findings\n' + 'A'.repeat(1000));
      writeFileSync(path.join(dossierDir, '03-COMPARISON.md'), '# Comparison\nComparison matrix.\n');
      writeFileSync(path.join(dossierDir, '04-CONCLUSION.md'), '## Recommendation\nAdopt recommended approach.\n');
      // 05-IMPLEMENTATION has code & mermaid, but only 2,000 bytes (under 8,000 bytes floor)
      writeFileSync(
        path.join(dossierDir, '05-IMPLEMENTATION.md'),
        '# Implementation\n```mermaid\ngraph TD; A-->B;\n```\n```typescript\nexport const x = 1;\n```\n' + 'B'.repeat(1500),
      );
      writeFileSync(
        path.join(dossierDir, '06-SOURCES.md'),
        `# Sources
| URL | Date | Query |
|---|---|---|
| https://stripe.com/docs | 2026-10-29 | stripe sdk |
| https://stripe.com/api | 2026-10-29 | stripe api |
| https://stripe.com/pricing | 2026-10-29 | stripe pricing |
`,
      );

      const res = validateResearchDossier(dossierDir, { root: tempDir });
      expect(res.ok).toBe(false);

      const findingsByteViolation = res.violations.find((v) => v.file.endsWith('02-FINDINGS.md') && v.code === 'INSUFFICIENT_BYTE_SIZE');
      expect(findingsByteViolation).toBeDefined();

      const implByteViolation = res.violations.find((v) => v.file.endsWith('05-IMPLEMENTATION.md') && v.code === 'INSUFFICIENT_BYTE_SIZE');
      expect(implByteViolation).toBeDefined();
    });
  });

  describe('TS-U12-02 (L1) — Research Synthesis & Bible Conduit Pipeline', () => {
    it('synthesizes rich research dossier satisfying all depth standards and search receipts (AC-U12-02)', async () => {
      const topicDir = path.join(tempDir, 'stripe-payments');

      // Mock search function returning rich receipts
      const mockSearch = async (query: string) => [
        {
          title: `Documentation for ${query}`,
          url: `https://stripe.com/docs/${encodeURIComponent(query)}`,
          snippet: `Current official SDK specifications and webhook signatures for ${query}.`,
        },
      ];

      const dossier = await synthesizeResearchDossier({
        topic: 'stripe-payments',
        category: 'payments',
        provider: 'Stripe',
        outputDir: topicDir,
        searchFn: mockSearch,
      });

      expect(dossier.files).toHaveLength(7);
      expect(existsSync(path.join(topicDir, '00-BRIEF.md'))).toBe(true);
      expect(existsSync(path.join(topicDir, '05-IMPLEMENTATION.md'))).toBe(true);

      // Verify file size floors
      const findingsStats = statSync(path.join(topicDir, '02-FINDINGS.md'));
      expect(findingsStats.size).toBeGreaterThanOrEqual(4000);

      const implStats = statSync(path.join(topicDir, '05-IMPLEMENTATION.md'));
      expect(implStats.size).toBeGreaterThanOrEqual(8000);

      // Verify presence of Mermaid diagram and TypeScript code
      const implContent = readFileSync(path.join(topicDir, '05-IMPLEMENTATION.md'), 'utf8');
      expect(implContent).toContain('```mermaid');
      expect(implContent).toContain('```typescript');
      expect(implContent).toContain('crypto.subtle'); // HMAC signature verification

      // Verify sources receipt table has at least 3 receipts
      const sourcesContent = readFileSync(path.join(topicDir, '06-SOURCES.md'), 'utf8');
      expect(sourcesContent).toContain('https://');

      // Dossier passes validateResearchDossier cleanly
      const validation = validateResearchDossier(topicDir, { root: tempDir });
      expect(validation.violations).toEqual([]);
      expect(validation.ok).toBe(true);
    });

    it('exports research findings into Bible integration chapter and environment variables conduit (AC-U12-02)', async () => {
      const topicDir = path.join(tempDir, 'stripe-payments');
      const bibleDir = path.join(tempDir, 'docs', 'bible');
      const envPath = path.join(tempDir, '.env.example');

      mkdirSync(path.join(bibleDir, '06-integrations'), { recursive: true });
      writeFileSync(envPath, '# Environment Variables\nNODE_ENV=production\n', 'utf8');

      await synthesizeResearchDossier({
        topic: 'stripe-payments',
        category: 'payments',
        provider: 'Stripe',
        outputDir: topicDir,
      });

      const conduit = await exportResearchConduit(topicDir, {
        bibleDir,
        envPath,
        writeBible: true,
        writeEnv: true,
      });

      expect(conduit.envKeys).toContain('STRIPE_SECRET_KEY');
      expect(conduit.envKeys).toContain('STRIPE_WEBHOOK_SECRET');
      expect(conduit.webhookSchemas.length).toBeGreaterThan(0);
      expect(conduit.integrationCode).toContain('export');

      // Verify written Bible chapter
      const bibleChapterPath = path.join(bibleDir, '06-integrations', 'stripe-payments.md');
      expect(existsSync(bibleChapterPath)).toBe(true);
      const bibleText = readFileSync(bibleChapterPath, 'utf8');
      expect(bibleText).toContain('# Integration Blueprint');
      expect(bibleText).toContain('STRIPE_WEBHOOK_SECRET');

      // Verify .env.example was updated
      const envText = readFileSync(envPath, 'utf8');
      expect(envText).toContain('STRIPE_SECRET_KEY=');
      expect(envText).toContain('STRIPE_WEBHOOK_SECRET=');
    });
  });
});
