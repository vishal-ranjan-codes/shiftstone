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

      writeFileSync(
        path.join(chapterDir, 'schema-reference.md'),
        `# Database Schema Reference
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`,
        'utf8',
      );

      const report = validateBibleSynthesis(tempDir);
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

      const report = validateBibleSynthesis(tempDir);
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

      const report = validateBibleSynthesis(tempDir);
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

      const report = validateBibleSynthesis(tempDir);
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

      // Now fix the file
      writeFileSync(
        path.join(chapterDir, 'route-actions.md'),
        `# Actions
export const createItemSchema = z.object({ name: z.string().min(1) });
`,
        'utf8',
      );

      const passRun = spawnSync(process.execPath, [scriptPath, tempDir], { encoding: 'utf8' });
      expect(passRun.status).toBe(0);
      expect(passRun.stdout).toContain('ok — All synthesized Bible files are concrete');
    });
  });
});
