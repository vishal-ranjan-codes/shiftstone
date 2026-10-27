import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateTaxonomy,
  recordTopologyDecision,
  restructureBible,
  updateBibleToc,
} from '../../init/bible-topology.js';

describe('Unit U7 — Autonomous Bible Restructuring & Topology Engine (REQ-INIT-06)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'bible-topology-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U7-01 (L1) — Taxonomy Evaluation & Pruning', () => {
    it('evaluates Full-Stack SaaS context into 8 core chapters in sequential order', () => {
      const taxonomy = evaluateTaxonomy({ productType: 'fullstack_saas' });
      expect(taxonomy.productType).toBe('fullstack_saas');
      expect(taxonomy.hasFrontend).toBe(true);
      expect(taxonomy.chapters).toHaveLength(8);

      // Verify sequential numbering 01 through 08
      taxonomy.chapters.forEach((chap, idx) => {
        const expectedNum = String(idx + 1).padStart(2, '0');
        expect(chap.number).toBe(expectedNum);
        expect(chap.slug.startsWith(expectedNum)).toBe(true);
      });

      expect(taxonomy.chapters.map((c) => c.name)).toEqual([
        'architecture',
        'setup-and-workflow',
        'database',
        'auth-and-rbac',
        'core-systems',
        'integrations',
        'frontend',
        'api-contracts',
      ]);
    });

    it('asserts CLI project context produces a pruned taxonomy without frontend and with valid sequential numbering', () => {
      const taxonomy = evaluateTaxonomy({ productType: 'cli' });
      expect(taxonomy.productType).toBe('cli_devtool');
      expect(taxonomy.hasFrontend).toBe(false);

      // Drops frontend, adds plugin-architecture, transforms api-contracts to cli-commands-and-flags
      const names = taxonomy.chapters.map((c) => c.name);
      expect(names).not.toContain('frontend');
      expect(names).toContain('plugin-architecture');
      expect(names).toContain('cli-commands-and-flags');
      expect(names).not.toContain('api-contracts');

      // Assert strictly valid sequential numbering 01 through 08 without gaps
      expect(taxonomy.chapters).toHaveLength(8);
      taxonomy.chapters.forEach((chap, idx) => {
        const expectedNum = String(idx + 1).padStart(2, '0');
        expect(chap.number).toBe(expectedNum);
        expect(chap.slug.startsWith(`${expectedNum}-`)).toBe(true);
      });
    });

    it('injects compliance and audit chapters for Fintech archetype', () => {
      const taxonomy = evaluateTaxonomy({ domain: 'fintech' });
      expect(taxonomy.productType).toBe('fintech_compliance');
      expect(taxonomy.chapters).toHaveLength(10);

      const names = taxonomy.chapters.map((c) => c.name);
      expect(names).toContain('compliance-and-ledger');
      expect(names).toContain('audit-and-security');

      // Valid sequential numbering
      taxonomy.chapters.forEach((chap, idx) => {
        const expectedNum = String(idx + 1).padStart(2, '0');
        expect(chap.number).toBe(expectedNum);
        expect(chap.slug.startsWith(`${expectedNum}-`)).toBe(true);
      });
    });

    it('injects vector storage and prompt evals for AI Agent / RAG archetype', () => {
      const taxonomy = evaluateTaxonomy({ type: 'ai_agent' });
      expect(taxonomy.productType).toBe('ai_agent_rag');
      expect(taxonomy.chapters).toHaveLength(10);

      const names = taxonomy.chapters.map((c) => c.name);
      expect(names).toContain('vector-storage-and-embeddings');
      expect(names).toContain('evals-and-prompt-chains');

      // Sequential numbering check
      taxonomy.chapters.forEach((chap, idx) => {
        const expectedNum = String(idx + 1).padStart(2, '0');
        expect(chap.number).toBe(expectedNum);
        expect(chap.slug.startsWith(`${expectedNum}-`)).toBe(true);
      });
    });
  });

  describe('TS-U7-02 (L2) — DEC-017 Architectural Rationale Logging', () => {
    it('appends DEC-017 to DECISIONS.md with timestamp, context, and consequences', () => {
      const bibleDir = path.join(tempDir, 'docs', 'bible');
      mkdirSync(bibleDir, { recursive: true });
      const decisionsFile = path.join(bibleDir, 'DECISIONS.md');
      writeFileSync(decisionsFile, '# Architecture Decisions\n\nExisting content...\n', 'utf8');

      const testTimestamp = '2026-10-26T12:00:00.000Z';
      const taxonomy = evaluateTaxonomy({ productType: 'cli' });

      recordTopologyDecision(tempDir, {
        taxonomy,
        timestamp: testTimestamp,
      });

      const updated = readFileSync(decisionsFile, 'utf8');
      expect(updated).toContain('DEC-017: Adaptive Product Documentation Topology');
      expect(updated).toContain(`Timestamp:** ${testTimestamp}`);
      expect(updated).toContain('Context:**');
      expect(updated).toContain('Decision:**');
      expect(updated).toContain('Consequences:**');
      expect(updated).toContain('cli_devtool');
    });

    it('restructures bible directory autonomously without prompt halting', async () => {
      const bibleDir = path.join(tempDir, 'docs', 'bible');
      mkdirSync(bibleDir, { recursive: true });
      writeFileSync(path.join(bibleDir, 'README.md'), '# Bible README\n\n## Table of Contents\n', 'utf8');
      writeFileSync(path.join(bibleDir, 'DECISIONS.md'), '# ADRs\n', 'utf8');

      // Pre-create 07-frontend to test pruning for CLI
      const frontendDir = path.join(bibleDir, '07-frontend');
      mkdirSync(frontendDir, { recursive: true });
      writeFileSync(path.join(frontendDir, 'index.md'), '# Old frontend\n', 'utf8');

      const taxonomy = evaluateTaxonomy({ productType: 'cli' });
      const result = await restructureBible(tempDir, taxonomy, {
        timestamp: '2026-10-26T12:00:00.000Z',
      });

      expect(result.success).toBe(true);
      expect(result.chaptersCount).toBe(8);

      // 07-frontend should be pruned
      expect(existsSync(frontendDir)).toBe(false);

      // New CLI chapters should exist
      expect(existsSync(path.join(bibleDir, '04-plugin-architecture', 'index.md'))).toBe(true);
      expect(existsSync(path.join(bibleDir, '08-cli-commands-and-flags', 'index.md'))).toBe(true);

      // README ToC should be updated
      const readme = readFileSync(path.join(bibleDir, 'README.md'), 'utf8');
      expect(readme).toContain('04-plugin-architecture');
      expect(readme).toContain('08-cli-commands-and-flags');
      expect(readme).not.toContain('07-frontend');

      // DECISIONS.md should have DEC-017
      const decisions = readFileSync(path.join(bibleDir, 'DECISIONS.md'), 'utf8');
      expect(decisions).toContain('DEC-017: Adaptive Product Documentation Topology');
    });
  });
});
