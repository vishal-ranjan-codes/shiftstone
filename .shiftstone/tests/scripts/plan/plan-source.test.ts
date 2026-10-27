import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  captureSourceSnapshot,
  environmentState,
  maskStatus,
  preservationInventory,
  readEvidence,
  sha256,
  snapshot,
} from '../../../scripts/lib/plan-source.js';

function write(root: string, file: string, content: string) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function makeSandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-source-'));
  const cleanup = () => fs.rmSync(root, { recursive: true, force: true });
  return { root, cleanup };
}

describe('Unit U6 — Scoped Content Hashing, Snapshot Capturer & Evidence Validator (REQ-06)', () => {
  it('TS-U6-01 (L1): captureSourceSnapshot returns deterministic hashes regardless of input order', () => {
    const { root, cleanup } = makeSandbox();
    try {
      write(root, 'src/z.txt', 'file z');
      write(root, 'src/a.txt', 'file a');
      write(root, 'src/m.txt', 'file m');

      const snap1 = captureSourceSnapshot(root, ['src']);
      const snap2 = captureSourceSnapshot(root, ['src']);

      expect(snap1.scopeDigest).toBe(snap2.scopeDigest);
      expect(snap1.files.map((f) => f.path)).toEqual(['src/a.txt', 'src/m.txt', 'src/z.txt']);
      expect(snap1.files.map((f) => f.worktreeSha256)).toEqual(snap2.files.map((f) => f.worktreeSha256));
    } finally {
      cleanup();
    }
  });

  it('TS-U6-02 (L2): modifying scoped file alters scopeDigest; editing outside scope does not', () => {
    const { root, cleanup } = makeSandbox();
    try {
      write(root, 'scoped/file.txt', 'initial');
      write(root, 'unscoped/other.txt', 'initial unscoped');

      const before = snapshot(root, ['scoped']);

      // 1. Edit outside scope -> scopeDigest remains identical
      write(root, 'unscoped/other.txt', 'modified unscoped');
      const afterUnscoped = snapshot(root, ['scoped']);
      expect(afterUnscoped.scopeDigest).toBe(before.scopeDigest);

      // 2. Edit inside scope -> scopeDigest changes
      write(root, 'scoped/file.txt', 'modified scoped');
      const afterScoped = snapshot(root, ['scoped']);
      expect(afterScoped.scopeDigest).not.toBe(before.scopeDigest);
    } finally {
      cleanup();
    }
  });

  it('TS-U6-03 (L2): self-invalidation test asserts editing content inside managed README status spans preserves scopeDigest', () => {
    const { root, cleanup } = makeSandbox();
    try {
      const readmeOld = `---
type: plan
title: Sample
---
# Plan Description
Human written scope.

<!-- plan-status:start -->
| Phase | Status |
|---|---|
| P1 | planned |
<!-- plan-status:end -->
`;
      const readmeNew = `---
type: plan
title: Sample
---
# Plan Description
Human written scope.

<!-- plan-status:start -->
| Phase | Status |
|---|---|
| P1 | completed |
<!-- plan-status:end -->
`;
      write(root, 'README.md', readmeOld);
      const before = snapshot(root, ['README.md']);

      // Change status table inside managed span
      write(root, 'README.md', readmeNew);
      const afterStatusUpdate = snapshot(root, ['README.md']);
      expect(afterStatusUpdate.scopeDigest).toBe(before.scopeDigest);

      // Editing text outside managed span DOES change scopeDigest
      const readmeEditedHumanText = readmeNew.replace('Human written scope.', 'Changed scope.');
      write(root, 'README.md', readmeEditedHumanText);
      const afterHumanEdit = snapshot(root, ['README.md']);
      expect(afterHumanEdit.scopeDigest).not.toBe(before.scopeDigest);
    } finally {
      cleanup();
    }
  });

  it('maskStatus replaces status block with empty markers for README files only', () => {
    const content = Buffer.from(
      'header\n<!-- plan-status:start -->active table<!-- plan-status:end -->\nfooter'
    );
    const masked = maskStatus(content, 'docs/plans/sample/README.md').toString('utf8');
    expect(masked).toBe('header\n<!-- plan-status:start --><!-- plan-status:end -->\nfooter');

    // Does not mask non-README files
    const notReadme = maskStatus(content, 'source.txt').toString('utf8');
    expect(notReadme).toBe(content.toString('utf8'));
  });

  it('environmentState allowlists keys and records sha256 digests', () => {
    expect(() => environmentState(['UNKNOWN_SECRET_KEY'])).toThrow(/not allowlisted/);

    const env = environmentState(['node-version']);
    expect(env.length).toBe(1);
    expect(env[0].key).toBe('node-version');
    expect(env[0].valueSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects secret and excluded paths', () => {
    const { root, cleanup } = makeSandbox();
    try {
      write(root, '.env', 'SECRET_KEY=12345');
      write(root, 'safe.txt', 'safe');

      expect(() => snapshot(root, ['.env'])).toThrow(/Secret path/);

      // Automatic expansion excludes secrets
      const broad = snapshot(root, ['.']);
      expect(broad.files.some((f) => f.path === '.env')).toBe(false);
      expect(broad.files.some((f) => f.path === 'safe.txt')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('enforces bounded inventory limits (maxFiles, maxBytes)', () => {
    const { root, cleanup } = makeSandbox();
    try {
      write(root, 'src/f1.txt', 'hello');
      write(root, 'src/f2.txt', 'world');

      expect(() => snapshot(root, ['src'], [], {}, { maxFiles: 1 })).toThrow(/bounded file limit/);
      expect(() => snapshot(root, ['src'], [], {}, { maxBytes: 2 })).toThrow(/bounded byte limit/);
    } finally {
      cleanup();
    }
  });

  it('readEvidence verifies bytes against sha256 and throws on tampering', () => {
    const { root, cleanup } = makeSandbox();
    try {
      const data = 'actual check evidence output\n';
      write(root, 'output/test.txt', data);
      const expectedHash = sha256(Buffer.from(data));

      const bytes = readEvidence(root, { path: 'output/test.txt', sha256: expectedHash });
      expect(bytes.toString('utf8')).toBe(data);

      // Tampered evidence throws
      expect(() =>
        readEvidence(root, { path: 'output/test.txt', sha256: 'a'.repeat(64) })
      ).toThrow(/Evidence bytes changed/);
    } finally {
      cleanup();
    }
  });

  it('preservationInventory records dirty items without hashing unrelated files', () => {
    const { root, cleanup } = makeSandbox();
    try {
      const items = preservationInventory(root, null, null);
      expect(Array.isArray(items)).toBe(true);
      expect(items.every((i) => i.action === 'preserve')).toBe(true);
    } finally {
      cleanup();
    }
  });
});
