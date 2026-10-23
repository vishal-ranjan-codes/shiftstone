import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPreflight, PREFLIGHT_RECEIPT_FILENAME } from '../../../scripts/agent-preflight.js';
import { evaluatePreflightToolUse, preToolUsePreflightHook } from '../pre-tool-use.ts';
import { HookManager } from '../manager.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RECEIPT_PATH = path.join(ROOT, PREFLIGHT_RECEIPT_FILENAME);

describe('Unit U11: Pre-Tool-Use Hook Preflight Receipt Enforcement (UG-12)', () => {
  beforeEach(() => {
    if (existsSync(RECEIPT_PATH)) {
      unlinkSync(RECEIPT_PATH);
    }
  });

  afterEach(() => {
    if (existsSync(RECEIPT_PATH)) {
      unlinkSync(RECEIPT_PATH);
    }
  });

  it('TS-U11-01 (L2): blocks write_file tool to app/routes/dashboard.tsx when receipt is missing', () => {
    const payload = {
      tool: 'write_file',
      command: 'app/routes/dashboard.tsx',
      files: [{ path: 'app/routes/dashboard.tsx', content: 'export default function Dashboard() {}' }],
    };

    const decision = evaluatePreflightToolUse(payload, { root: ROOT, enforce: true });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('PREFLIGHT_RECEIPT_REQUIRED');
    expect(decision.findings).toContain('PREFLIGHT_RECEIPT_REQUIRED');
  });

  it('allows write_file when a valid receipt covers the target path', () => {
    // Generate valid receipt for app/routes/**
    const res = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      verifyCmd: 'npm test',
    });
    expect(res.ok).toBe(true);

    const payload = {
      tool: 'write_file',
      command: 'app/routes/dashboard.tsx',
      files: [{ path: 'app/routes/dashboard.tsx', content: 'export default function Dashboard() {}' }],
    };

    const decision = evaluatePreflightToolUse(payload, { root: ROOT, enforce: true });
    expect(decision.allowed).toBe(true);
  });

  it('blocks write_file when receipt covers a different scope', () => {
    // Generate receipt for app/routes/dashboard.tsx only
    const res = runPreflight({
      root: ROOT,
      target: 'app/routes/dashboard.tsx',
      verifyCmd: 'npm test',
    });
    expect(res.ok).toBe(true);

    const payload = {
      tool: 'write_file',
      command: 'supabase/migrations/001_init.sql',
      files: [{ path: 'supabase/migrations/001_init.sql', content: 'create table test();' }],
    };

    const decision = evaluatePreflightToolUse(payload, { root: ROOT, enforce: true });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('PREFLIGHT_SCOPE_MISMATCH');
  });

  it('allows write_file to non-governed paths without receipt', () => {
    const payload = {
      tool: 'write_file',
      command: 'docs/reports/analysis.md',
      files: [{ path: 'docs/reports/analysis.md', content: '# Analysis' }],
    };

    const decision = evaluatePreflightToolUse(payload, { root: ROOT, enforce: true });
    expect(decision.allowed).toBe(true);
  });

  it('allows tool call when preflight enforcement is disabled', () => {
    const payload = {
      tool: 'write_file',
      command: 'app/routes/dashboard.tsx',
      files: [{ path: 'app/routes/dashboard.tsx', content: 'export default function Dashboard() {}' }],
    };

    const decision = evaluatePreflightToolUse(payload, { root: ROOT, enforce: false });
    expect(decision.allowed).toBe(true);
  });

  it('integrates cleanly into HookManager pre-tool-call lifecycle', async () => {
    const manager = new HookManager().register(preToolUsePreflightHook);
    process.env.ENFORCE_PREFLIGHT_RECEIPT = 'true';

    try {
      const payload = {
        tool: 'write_file',
        command: 'app/routes/dashboard.tsx',
        files: [{ path: 'app/routes/dashboard.tsx' }],
      };

      const result = await manager.fire('pre-tool-call', payload);
      expect(result.allowed).toBe(false);
      expect(result.blocked_by).toBe('pre-tool-use-preflight');
      expect(result.reason).toContain('PREFLIGHT_RECEIPT_REQUIRED');
    } finally {
      delete process.env.ENFORCE_PREFLIGHT_RECEIPT;
    }
  });
});
