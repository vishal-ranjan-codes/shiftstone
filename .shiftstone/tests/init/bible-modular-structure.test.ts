import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_LINES_PER_FILE,
  MIN_TOPIC_FILES_PER_CHAPTER,
  validateModularBibleStructure,
} from '../../init/bible-modular-structure.js';

describe('Unit U8 — Modular Chapter Subfolder Standard (REQ-INIT-07)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'bible-modular-test-'));
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('TS-U8-01 (L1) — Structural Linter & Flagship Overlays Verification', () => {
    it('asserts rr8-supabase-cf/bible-overlays conforms to the modular chapter subfolder standard', () => {
      const overlaysDir = path.resolve(__dirname, '../../packs/rr8-supabase-cf/bible-overlays');
      expect(existsSync(overlaysDir)).toBe(true);

      const result = validateModularBibleStructure(overlaysDir);
      expect(result.valid).toBe(true);
      expect(result.ok).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.chapterCount).toBe(8);

      // Verify each standard chapter has required topic files
      const chapters = result.chapters;
      expect(chapters['01-architecture']).toContain('index.md');
      expect(chapters['01-architecture']).toContain('topology.md');
      expect(chapters['01-architecture']).toContain('system-context.md');
      expect(chapters['01-architecture']).toContain('operational-envelope.md');

      expect(chapters['02-setup-and-workflow']).toContain('index.md');
      expect(chapters['02-setup-and-workflow']).toContain('local-environment.md');
      expect(chapters['02-setup-and-workflow']).toContain('dev-workflow.md');

      expect(chapters['03-database']).toContain('index.md');
      expect(chapters['03-database']).toContain('schema-reference.md');
      expect(chapters['03-database']).toContain('rls-policies.md');
      expect(chapters['03-database']).toContain('migrations.md');

      expect(chapters['04-auth-and-rbac']).toContain('index.md');
      expect(chapters['04-auth-and-rbac']).toContain('identity-providers.md');
      expect(chapters['04-auth-and-rbac']).toContain('permissions-matrix.md');
      expect(chapters['04-auth-and-rbac']).toContain('route-guards.md');

      expect(chapters['05-core-systems']).toContain('index.md');
      expect(chapters['05-core-systems']).toContain('domain-invariants.md');
      expect(chapters['05-core-systems']).toContain('state-machines.md');
      expect(chapters['05-core-systems']).toContain('error-taxonomy.md');

      expect(chapters['06-integrations']).toContain('index.md');
      expect(chapters['06-integrations']).toContain('third-party-services.md');
      expect(chapters['06-integrations']).toContain('webhooks.md');

      expect(chapters['07-frontend']).toContain('index.md');
      expect(chapters['07-frontend']).toContain('design-tokens.md');
      expect(chapters['07-frontend']).toContain('route-hierarchy.md');
      expect(chapters['07-frontend']).toContain('component-standards.md');

      expect(chapters['08-api-contracts']).toContain('index.md');
      expect(chapters['08-api-contracts']).toContain('route-actions.md');
      expect(chapters['08-api-contracts']).toContain('route-loaders.md');
    });

    it('passes on a valid modular chapter structure in a test fixture', () => {
      const chapter01 = path.join(tempDir, '01-architecture');
      mkdirSync(chapter01, { recursive: true });
      writeFileSync(path.join(chapter01, 'index.md'), '# Index\n', 'utf8');
      writeFileSync(path.join(chapter01, 'topology.md'), '# Topology\n', 'utf8');
      writeFileSync(path.join(chapter01, 'system-context.md'), '# System Context\n', 'utf8');

      const result = validateModularBibleStructure(tempDir);
      expect(result.ok).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('fails when a chapter is missing index.md', () => {
      const chapter01 = path.join(tempDir, '01-architecture');
      mkdirSync(chapter01, { recursive: true });
      writeFileSync(path.join(chapter01, 'topology.md'), '# Topology\n', 'utf8');
      writeFileSync(path.join(chapter01, 'system-context.md'), '# System Context\n', 'utf8');

      const result = validateModularBibleStructure(tempDir);
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.rule === 'MISSING_INDEX_MD')).toBe(true);
    });

    it('fails when a chapter has fewer than 2 topic files (insufficient topic files)', () => {
      const chapter01 = path.join(tempDir, '01-architecture');
      mkdirSync(chapter01, { recursive: true });
      writeFileSync(path.join(chapter01, 'index.md'), '# Index\n', 'utf8');
      writeFileSync(path.join(chapter01, 'single-monolith.md'), '# Monolith\n', 'utf8');

      const result = validateModularBibleStructure(tempDir);
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.rule === 'INSUFFICIENT_TOPIC_FILES')).toBe(true);
    });

    it('fails when a markdown file exceeds the line budget (400 lines)', () => {
      const chapter01 = path.join(tempDir, '01-architecture');
      mkdirSync(chapter01, { recursive: true });
      writeFileSync(path.join(chapter01, 'index.md'), '# Index\n', 'utf8');
      writeFileSync(path.join(chapter01, 'topic-a.md'), '# Topic A\n', 'utf8');

      // Create an oversized file
      const overLines = Array.from({ length: 405 }, (_, i) => `line ${i + 1}`).join('\n');
      writeFileSync(path.join(chapter01, 'topic-b.md'), overLines, 'utf8');

      const result = validateModularBibleStructure(tempDir);
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.rule === 'LINE_BUDGET_EXCEEDED')).toBe(true);
    });
  });
});
