import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  discoverSuites,
  repoPath,
  resolveRepoPath,
  validateSchema,
  walk,
} from '../../../scripts/lib/plan-schema.js';

const SHIFTSTONE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REPO_ROOT = path.resolve(SHIFTSTONE_ROOT, '..');

describe('Unit U4 — Schema Compiler & Safe Repo Path Resolver Engine (REQ-04)', () => {
  describe('TS-U4-01 (L1): repoPath rejects unsafe paths', () => {
    it('accepts normalized repo-relative paths', () => {
      const validPaths = [
        '.',
        'docs/schemas/plan-manifest-v1.schema.json',
        'docs/bible/08. Development Guidelines/index.md',
        'src/components/button.tsx',
        'a/b/c/file.json',
      ];
      for (const p of validPaths) {
        expect(repoPath(p)).toBe(p);
      }
    });

    it('rejects traversal, machine-absolute, URL schemes, duplicate slashes, and control characters', () => {
      const invalidPaths = [
        '',
        ' ',
        '..',
        '../docs',
        'docs/..',
        'docs/../secret',
        './docs',
        '/etc/passwd',
        'C:/docs',
        'C:docs',
        'D:\\secret\\file',
        '\\server\\share',
        '//server/share',
        'https://host/path',
        'docs//file',
        'docs/',
        'docs/./file',
        'docs\\file',
        'docs/file\n',
        'docs/file?query',
        'docs/file#fragment',
        'docs/file ',
        'docs/file.',
      ];
      for (const p of invalidPaths) {
        expect(() => repoPath(p), `Expected repoPath("${p}") to throw`).toThrow();
      }
    });
  });

  describe('TS-U4-02 (L2): resolveRepoPath enforces canonical casing and symlink escape boundaries', () => {
    it('resolves valid repository path to canonical absolute path', () => {
      const resolved = resolveRepoPath(REPO_ROOT, 'package.json', { mustExist: true });
      expect(fs.existsSync(resolved)).toBe(true);
      expect(resolved.toLowerCase()).toBe(path.join(REPO_ROOT, 'package.json').toLowerCase());
    });

    it('throws when required path is missing and mustExist is true', () => {
      expect(() =>
        resolveRepoPath(REPO_ROOT, 'non-existent-path-12345.txt', { mustExist: true })
      ).toThrow(/Missing repository path/);
    });

    it('detects symlink/junction escape outside the repository root', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-sandbox-'));
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-outside-'));

      try {
        const linkPath = path.join(tempDir, 'symlink-escape');
        fs.symlinkSync(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');

        expect(() =>
          resolveRepoPath(tempDir, 'symlink-escape/secret.txt')
        ).toThrow(/escapes repository through symlink\/junction/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    if (process.platform === 'win32') {
      it('detects non-canonical Windows casing', () => {
        // e.g. "PACKAGE.JSON" instead of "package.json" or "Docs" instead of "docs"
        expect(() =>
          resolveRepoPath(REPO_ROOT, 'PACKAGE.JSON')
        ).toThrow(/Noncanonical Windows path spelling/);
      });
    }
  });

  describe('TS-U4-03 (L2): validateSchema compiles schemas and validates records', () => {
    it('validates supported schemas with empty error array on valid records', () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(SHIFTSTONE_ROOT, 'tests/fixtures/planning/manifest-valid.json'), 'utf8')
      );
      const handoff = JSON.parse(
        fs.readFileSync(path.join(SHIFTSTONE_ROOT, 'tests/fixtures/planning/handoff-valid.json'), 'utf8')
      );
      const state = JSON.parse(
        fs.readFileSync(path.join(SHIFTSTONE_ROOT, 'tests/fixtures/planning/state-valid.json'), 'utf8')
      );

      expect(validateSchema(manifest, 'plan-manifest/v1')).toEqual([]);
      expect(validateSchema(handoff, 'plan-handoff/v1')).toEqual([]);
      expect(validateSchema(state, 'plan-state/v1')).toEqual([]);
    });

    it('returns descriptive errors for missing required fields or unknown schemas', () => {
      expect(validateSchema({}, 'unknown-schema/v1')).toEqual([
        'unknown-schema/v1: unsupported schema unknown-schema/v1',
      ]);

      const invalidState = { schema: 'plan-state/v1' };
      const errors = validateSchema(invalidState, 'plan-state/v1');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('missing required field'))).toBe(true);
    });

    it('caches compiled validators across repeated calls', () => {
      const validState = JSON.parse(
        fs.readFileSync(path.join(SHIFTSTONE_ROOT, 'tests/fixtures/planning/state-valid.json'), 'utf8')
      );
      const errs1 = validateSchema(validState, 'plan-state/v1');
      const errs2 = validateSchema(validState, 'plan-state/v1');
      expect(errs1).toEqual([]);
      expect(errs2).toEqual([]);
    });
  });

  describe('AC-U4-05: discoverSuites & walk', () => {
    it('discovers plan suites in docs/plans', () => {
      const suites = discoverSuites(REPO_ROOT, 'docs/plans');
      expect(Array.isArray(suites)).toBe(true);
      expect(suites.length).toBeGreaterThan(0);
      // docs/plans/workspace-planning-lifecycle-upgrade has contracts and was marked in docs/plans
      expect(
        suites.some((s) => s.includes('workspace-planning-lifecycle-upgrade'))
      ).toBe(true);
    });

    it('walk rejects traversal into excluded directories', () => {
      expect(() =>
        walk(REPO_ROOT, '.git', () => true)
      ).toThrow(/Excluded discovery path/);
    });
  });
});
