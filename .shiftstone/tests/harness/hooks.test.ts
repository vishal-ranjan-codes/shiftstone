import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HookManager, createDefaultHooks, secretScannerHook } from '../../harness/hooks/index.ts';
import type { Hook, HookPoint } from '../../harness/hooks/types.ts';
import { HOOK_POINTS } from '../../harness/hooks/types.ts';
import { LoopRunner } from '../../harness/loop-runner/runner.ts';
import { makeSpec, queuedRunner, scriptedExecutor, turn } from '../helpers.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PRE_COMMIT = path.join(REPO_ROOT, '.shiftstone', 'harness', 'hooks', 'pre-commit.js');

function recorder(points: HookPoint[]): Hook & { fired: { point: string; payload: unknown }[] } {
  const fired: { point: string; payload: unknown }[] = [];
  return {
    name: 'recorder',
    points,
    fired,
    run: (payload) => {
      fired.push({ point: 'current', payload });
      return { allowed: true };
    },
  };
}

describe('lifecycle hooks fire at each point (task 3.7)', () => {
  it('a hook registered for all points fires at pre-tool-call, post-file-edit and pre-commit', async () => {
    const hook = recorder([...HOOK_POINTS]);
    const manager = new HookManager().register(hook);

    const seen: HookPoint[] = [];
    for (const point of HOOK_POINTS) {
      const result = await manager.fire(point, { loop: 'test-loop', turn: 1, content: 'clean' });
      expect(result.allowed).toBe(true);
      if (result.allowed) seen.push(point);
    }
    expect(seen).toEqual(['pre-tool-call', 'post-file-edit', 'pre-commit']);
    expect(hook.fired).toHaveLength(3);
    expect((hook.fired[0].payload as { loop: string }).loop).toBe('test-loop');
  });

  it('a refusing hook blocks the point and reports itself', async () => {
    const blocker: Hook = {
      name: 'no-monday-commits',
      points: ['pre-commit'],
      run: () => ({ allowed: false, reason: 'not today' }),
    };
    const manager = new HookManager().register(blocker);
    const result = await manager.fire('pre-commit', {});
    expect(result.allowed).toBe(false);
    expect(result.blocked_by).toBe('no-monday-commits');
    expect(result.reason).toBe('not today');
  });

  it('critical hooks ignore disable requests; optional hooks honor them', async () => {
    const optional: Hook = { name: 'optional-style', points: ['pre-commit'], run: () => ({ allowed: true }) };
    const manager = new HookManager().register(secretScannerHook).register(optional);

    const result = await manager.fire(
      'pre-commit',
      { content: 'password: "hunter2secretvalue"' },
      { disable: ['secret-scanner', 'optional-style'] },
    );
    expect(result.allowed).toBe(false); // secret scanner still ran
    expect(result.blocked_by).toBe('secret-scanner');
    expect(result.warnings.join(' ')).toMatch(/critical — disable request ignored/);
  });

  it('warns when hooks exceed the 50ms budget', async () => {
    const slow: Hook = {
      name: 'slow-hook',
      points: ['pre-tool-call'],
      run: () => {
        const until = Date.now() + 75;
        while (Date.now() < until) {
          // busy-wait so the measurement is deterministic-ish
        }
        return { allowed: true };
      },
    };
    const manager = new HookManager().register(slow);
    const result = await manager.fire('pre-tool-call', {});
    expect(result.allowed).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/over the 50ms budget/);
  });
});

describe('secret scanner reference hook (task 3.7)', () => {
  const scanner = createDefaultHooks();

  it('blocks a planted secret at every hook point — content, command and mutations', async () => {
    const secrets = {
      'pre-tool-call': { tool: 'shell', command: 'curl -H "Authorization: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcd" x' },
      'post-file-edit': { mutations: ['edit app/config.ts'] as string[], content: undefined, files: [{ path: 'app/config.ts', content: 'const pw = { password: "hunter2realvalue" };' }] },
      'pre-commit': { content: 'const key = "AKIA1234567890ABCDEF";' },
    };
    for (const point of HOOK_POINTS) {
      const payload = secrets[point];
      const result = await scanner.fire(point, payload as Record<string, unknown>);
      expect(result.allowed, `point ${point}`).toBe(false);
      expect(result.blocked_by).toBe('secret-scanner');
      expect(result.findings?.length).toBeGreaterThan(0);
    }
  });

  it('lets placeholders and clean code through', async () => {
    const clean = await scanner.fire('pre-commit', {
      content: 'const conf = { password: process.env.PASSWORD, api_key: "your-api-key-here" };',
    });
    expect(clean.allowed).toBe(true);
  });
});

describe('hooks in the loop runner (task 3.7 — even on the inner gear)', () => {
  async function runWith(mutations: string[], hooks?: HookManager) {
    const root = await mkdtemp(path.join(tmpdir(), 'hooks-'));
    const spec = makeSpec({ name: 'hooked-loop', verification: { ladder_level: 1 } });
    return new LoopRunner(spec, {
      executor: scriptedExecutor([turn({ mutations })]),
      commandRunner: queuedRunner([1, 0]),
      hooks: hooks ?? createDefaultHooks(),
      workspaceRoot: root,
      loopsDir: path.join(root, 'loops'),
    }).run();
  }

  it('the default secret scanner blocks a turn that plants a secret (L1 inner gear)', async () => {
    const outcome = await runWith(['set password: "supersecretvalue99" in app.ts']);
    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/secret-scanner.*hardcoded secret/);
  });

  it('a clean turn passes the default hooks (inner gear, no ceremony)', async () => {
    const outcome = await runWith(['edit app.ts — refactor renderTree()']);
    expect(outcome.state).toBe('success');
  });

  it('pre-tool-call refuses the turn before the executor runs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'hooks-gate-'));
    let executed = false;
    const gateHook: Hook = {
      name: 'turn-gate',
      points: ['pre-tool-call'],
      run: () => ({ allowed: false, reason: 'frozen' }),
    };
    const spec = makeSpec({ name: 'gated-loop' });
    const outcome = await new LoopRunner(spec, {
      executor: {
        execute: async () => {
          executed = true;
          return turn();
        },
      },
      commandRunner: queuedRunner([1]),
      hooks: new HookManager().register(gateHook),
      workspaceRoot: root,
      loopsDir: path.join(root, 'loops'),
    }).run();

    expect(outcome.state).toBe('blocked');
    expect(outcome.reason).toMatch(/turn-gate.*frozen/);
    expect(executed).toBe(false);
  });
});

describe('pre-commit hook CLI (task 3.7)', () => {
  it('refuses a planted secret and passes clean files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'precommit-'));
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(
      path.join(root, 'src', 'bad.ts'),
      'export const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdef";\n',
      'utf8',
    );
    await writeFile(path.join(root, 'src', 'good.ts'), 'export const ok = 1;\n', 'utf8');

    const bad = spawnSync(
      process.execPath,
      [PRE_COMMIT, '--root', root, path.join('src', 'bad.ts')],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('BLOCKED');
    expect(bad.stderr).toContain('pre-commit blocked');

    const good = spawnSync(
      process.execPath,
      [PRE_COMMIT, '--root', root, path.join('src', 'good.ts')],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(good.status).toBe(0);
    expect(good.stdout).toContain('secret scan clean');
  }, 60_000);
});
