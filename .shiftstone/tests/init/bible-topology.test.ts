import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateTaxonomy,
  PRODUCT_CHAPTERS,
  recordTopologyDecision,
  restructureBible,
  updateBibleToc,
} from '../../init/bible-topology.js';
import { normalizePastedPrd } from '../../init/bible-synthesizer.js';

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

  describe('Unit U4 — PRD Ingestion & Product-Vision Chapter Topology Engine (REQ-INIT3-04)', () => {
    it('TS-U4-01 (L1): asserts evaluateTaxonomy includes 00-product-and-vision and PRD across all project contexts', () => {
      const emptyTaxonomy = evaluateTaxonomy({});
      const slugs = emptyTaxonomy.chapterSlugs;
      expect(slugs).toContain('00-product-and-vision');
      expect(slugs).toContain('PRD');

      const cliTaxonomy = evaluateTaxonomy({ productType: 'cli' });
      expect(cliTaxonomy.chapterSlugs).toContain('00-product-and-vision');
      expect(cliTaxonomy.chapterSlugs).toContain('PRD');

      const fintechTaxonomy = evaluateTaxonomy({ domain: 'fintech' });
      expect(fintechTaxonomy.chapterSlugs).toContain('00-product-and-vision');
      expect(fintechTaxonomy.chapterSlugs).toContain('PRD');
    });

    it('TS-U4-02 (L1): restructureBible creates all topic files under docs/bible/PRD/ and docs/bible/00-product-and-vision/', async () => {
      const taxonomy = evaluateTaxonomy({ productType: 'fullstack_saas' });
      await restructureBible(tempDir, taxonomy);

      const prdDir = path.join(tempDir, 'docs', 'bible', 'PRD');
      expect(existsSync(prdDir)).toBe(true);
      expect(existsSync(path.join(prdDir, 'index.md'))).toBe(true);
      expect(existsSync(path.join(prdDir, 'ecosystem-prd.md'))).toBe(true);
      expect(existsSync(path.join(prdDir, 'phase-1-foundation-prd.md'))).toBe(true);

      const visionDir = path.join(tempDir, 'docs', 'bible', '00-product-and-vision');
      expect(existsSync(visionDir)).toBe(true);
      expect(existsSync(path.join(visionDir, 'index.md'))).toBe(true);
      expect(existsSync(path.join(visionDir, 'vision-and-mission.md'))).toBe(true);
      expect(existsSync(path.join(visionDir, 'target-audience.md'))).toBe(true);
      expect(existsSync(path.join(visionDir, 'product-philosophy.md'))).toBe(true);
      expect(existsSync(path.join(visionDir, 'business-model.md'))).toBe(true);
      expect(existsSync(path.join(visionDir, 'market-landscape.md'))).toBe(true);
    });

    it('TS-U4-03 (L2): normalizePastedPrd normalizes raw PRD and derives phase-1-foundation-prd', () => {
      const rawPrd = `
# TaskPulse PRD
A collaborative task management application for digital marketing agencies.

## Core Features
1. Workspace kanban boards.
2. Time tracking on billable cards.
3. Monthly client invoice PDF export.
`;
      const result = normalizePastedPrd(rawPrd, { projectName: 'TaskPulse' });
      expect(result.ecosystemPrd).toContain('TaskPulse');
      expect(result.ecosystemPrd).toContain('4-Pillar System Architecture');
      expect(result.ecosystemPrd).toContain('Invariants');
      expect(result.foundationPrd).toContain('Phase 1 Foundation PRD');
      expect(result.foundationPrd).toContain('Acceptance Criteria');
    });
  });

  describe('Unit U5 — Dynamic Semantic Taxonomy Restructuring (REQ-INIT3-05)', () => {
    it('TS-U5-01 (L1): dynamically matches diverse archetypes and provisions domain-specific chapters', () => {
      const marketplaceTaxonomy = evaluateTaxonomy({ domain: 'marketplace' });
      expect(marketplaceTaxonomy.chapterSlugs).toContain('00-product-and-vision');
      expect(marketplaceTaxonomy.chapterSlugs).toContain('PRD');
      expect(marketplaceTaxonomy.chapterSlugs.some((s) => s.includes('commerce-and-catalog'))).toBe(true);
      expect(marketplaceTaxonomy.chapterSlugs.some((s) => s.includes('orders-and-fulfillment'))).toBe(true);

      const teamTaxonomy = evaluateTaxonomy({ type: 'b2b_team' });
      expect(teamTaxonomy.chapterSlugs.some((s) => s.includes('team-workspaces'))).toBe(true);

      const devTaxonomy = evaluateTaxonomy({ productType: 'developer_platform' });
      expect(devTaxonomy.chapterSlugs.some((s) => s.includes('sdk-and-client-libraries'))).toBe(true);
      expect(devTaxonomy.chapterSlugs.some((s) => s.includes('api-governance'))).toBe(true);
    });

    it('TS-U5-02 (L2): sequences technical chapters with two-digit prefixes without gaps', () => {
      const taxonomy = evaluateTaxonomy({ productType: 'fullstack_saas' });
      const technicalChapters = taxonomy.chapters.filter(
        (c) => c.slug !== '00-product-and-vision' && c.slug !== 'PRD',
      );

      expect(technicalChapters.length).toBeGreaterThanOrEqual(8);
      technicalChapters.forEach((chap, idx) => {
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
      expect(result.chaptersCount).toBe(10);

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
