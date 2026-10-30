import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it, afterEach } from 'vitest';
import { GitWorktreeEngine } from '../../../harness/worktree/git-worktree-engine.js';

function createTempGitRepo(): { repoDir: string; cleanup: () => void } {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftstone-wt-test-'));
  execSync('git init -b main', { cwd: repoDir, stdio: 'ignore' });
  execSync('git config user.name "Test Runner"', { cwd: repoDir, stdio: 'ignore' });
  execSync('git config user.email "test@shiftstone.local"', { cwd: repoDir, stdio: 'ignore' });
  
  // Create initial commit
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Test Repo\n', 'utf8');
  execSync('git add README.md', { cwd: repoDir, stdio: 'ignore' });
  execSync('git commit -m "initial commit"', { cwd: repoDir, stdio: 'ignore' });

  const cleanup = () => {
    try {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } catch {
      // ignore temp dir cleanup errors on Windows
    }
  };

  return { repoDir, cleanup };
}

describe('Unit U2 — Git Worktree Isolation & Sandboxing Engine (REQ-02)', () => {
  let activeCleanup: (() => void) | null = null;

  afterEach(() => {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  });

  it('TS-U2-01 (L2): Vitest exercises worktree creation, validates directory creation outside main working tree, and confirms clean teardown', () => {
    const { repoDir, cleanup } = createTempGitRepo();
    activeCleanup = cleanup;

    const engine = new GitWorktreeEngine({ root: repoDir });

    // 1. Create worktree for P1
    const record = engine.createWorktree('P1', 'worktree-p1', ['src/module-a']);
    expect(record.phaseId).toBe('P1');
    expect(record.branch).toBe('worktree-p1');
    expect(fs.existsSync(record.path)).toBe(true);
    expect(fs.existsSync(path.join(record.path, '.git'))).toBe(true);

    // 2. Query status
    const worktrees = engine.listWorktrees();
    expect(worktrees.some((w) => w.phaseId === 'P1')).toBe(true);

    // 3. Tear down
    engine.removeWorktree('P1');
    expect(fs.existsSync(record.path)).toBe(false);
    expect(engine.listWorktrees().some((w) => w.phaseId === 'P1')).toBe(false);
  });

  it('TS-U2-02 (L2): Disjoint path validator asserts overlapping path configurations are detected and blocked before git execution', () => {
    const { repoDir, cleanup } = createTempGitRepo();
    activeCleanup = cleanup;

    const engine = new GitWorktreeEngine({ root: repoDir });

    // 1. Create first worktree with scoped paths
    engine.createWorktree('P1', 'worktree-p1', ['src/auth', 'src/shared/utils.ts']);

    // 2. Child overlap should fail with DISJOINT_PATH_VIOLATION
    expect(() => {
      engine.createWorktree('P2', 'worktree-p2', ['src/auth/login.ts']);
    }).toThrowError(/DISJOINT_PATH_VIOLATION/);

    // 3. Parent overlap should fail with DISJOINT_PATH_VIOLATION
    expect(() => {
      engine.createWorktree('P3', 'worktree-p3', ['src']);
    }).toThrowError(/DISJOINT_PATH_VIOLATION/);

    // 4. Exact match overlap should fail
    expect(() => {
      engine.createWorktree('P4', 'worktree-p4', ['src/shared/utils.ts']);
    }).toThrowError(/DISJOINT_PATH_VIOLATION/);

    // 5. Completely disjoint path succeeds
    const disjoint = engine.createWorktree('P5', 'worktree-p5', ['src/billing', 'src/shared/math.ts']);
    expect(disjoint.phaseId).toBe('P5');
  });

  it('TS-U2-03 (L2): Automatically cleans orphaned worktree directories', () => {
    const { repoDir, cleanup } = createTempGitRepo();
    activeCleanup = cleanup;

    const engine = new GitWorktreeEngine({ root: repoDir });
    const orphanDir = path.join(repoDir, '.shiftstone', '.worktrees', 'orphaned-phase');
    fs.mkdirSync(orphanDir, { recursive: true });
    fs.writeFileSync(path.join(orphanDir, 'leftover.txt'), 'abandoned work', 'utf8');

    expect(fs.existsSync(orphanDir)).toBe(true);
    const cleaned = engine.cleanOrphans();
    expect(cleaned).toContain('orphaned-phase');
    expect(fs.existsSync(orphanDir)).toBe(false);
  });
});
