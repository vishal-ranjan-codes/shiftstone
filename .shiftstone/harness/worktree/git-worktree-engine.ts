import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync } from 'node:child_process';
import {
  DisjointPathViolationError,
  type WorktreeEngineOptions,
  type WorktreeRecord,
} from './types.js';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function pathsOverlap(a: string, b: string): boolean {
  const normA = normalizePath(a);
  const normB = normalizePath(b);
  if (normA === normB) return true;
  if (normA.startsWith(normB + '/')) return true;
  if (normB.startsWith(normA + '/')) return true;
  return false;
}

export class GitWorktreeEngine {
  readonly root: string;
  readonly worktreePrefix: string;
  readonly gitExecutable: string;
  private readonly activeWorktrees = new Map<string, WorktreeRecord>();
  private exitHandlerRegistered = false;

  constructor(options: WorktreeEngineOptions = {}) {
    this.root = path.resolve(options.root || process.cwd());
    this.worktreePrefix = options.worktreePrefix || path.join('.shiftstone', '.worktrees');
    this.gitExecutable = options.gitExecutable || 'git';

    const fullPrefix = path.resolve(this.root, this.worktreePrefix);
    if (!fs.existsSync(fullPrefix)) {
      fs.mkdirSync(fullPrefix, { recursive: true });
    }

    this.registerExitHandler();
  }

  private registerExitHandler(): void {
    if (this.exitHandlerRegistered) return;
    this.exitHandlerRegistered = true;

    const cleanup = () => {
      for (const phaseId of Array.from(this.activeWorktrees.keys())) {
        try {
          this.removeWorktree(phaseId);
        } catch {
          // Ignore cleanup errors during process exit
        }
      }
    };

    process.once('exit', cleanup);
  }

  private execGit(args: string[]): string {
    return execFileSync(this.gitExecutable, args, {
      cwd: this.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  private isBranchExisting(branch: string): boolean {
    try {
      this.execGit(['rev-parse', '--verify', `refs/heads/${branch}`]);
      return true;
    } catch {
      return false;
    }
  }

  createWorktree(phaseId: string, branch: string, sourcePaths: string[] = []): WorktreeRecord {
    if (this.activeWorktrees.has(phaseId)) {
      throw new Error(`Worktree for phase "${phaseId}" already exists and is active`);
    }

    // AC-U2-02: Validate source path disjointness against active worktrees
    for (const [activeId, active] of this.activeWorktrees) {
      for (const existingPath of active.sourcePaths) {
        for (const newPath of sourcePaths) {
          if (pathsOverlap(existingPath, newPath)) {
            throw new DisjointPathViolationError(
              `DISJOINT_PATH_VIOLATION: Overlapping sourcePaths detected between phase "${phaseId}" and "${activeId}": "${newPath}" collides with "${existingPath}"`,
              phaseId,
              activeId,
              newPath
            );
          }
        }
      }
    }

    const targetPath = path.resolve(this.root, this.worktreePrefix, phaseId);

    // If directory exists from prior run, clean it up
    if (fs.existsSync(targetPath)) {
      try {
        this.execGit(['worktree', 'remove', '--force', targetPath]);
      } catch {
        // Fallback to direct rimraf
      }
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    }

    // Git worktree add command
    if (this.isBranchExisting(branch)) {
      this.execGit(['worktree', 'add', targetPath, branch]);
    } else {
      this.execGit(['worktree', 'add', '-b', branch, targetPath, 'HEAD']);
    }

    const record: WorktreeRecord = {
      phaseId,
      branch,
      path: targetPath,
      sourcePaths: [...sourcePaths],
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.activeWorktrees.set(phaseId, record);
    return record;
  }

  listWorktrees(): WorktreeRecord[] {
    return Array.from(this.activeWorktrees.values());
  }

  removeWorktree(phaseId: string): void {
    const record = this.activeWorktrees.get(phaseId);
    const targetPath = record ? record.path : path.resolve(this.root, this.worktreePrefix, phaseId);

    try {
      this.execGit(['worktree', 'remove', '--force', targetPath]);
    } catch {
      // Ignore if not recognized by git
    }

    try {
      this.execGit(['worktree', 'prune']);
    } catch {
      // Ignore prune errors
    }

    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }

    this.activeWorktrees.delete(phaseId);
  }

  cleanOrphans(): string[] {
    const prefixDir = path.resolve(this.root, this.worktreePrefix);
    if (!fs.existsSync(prefixDir)) return [];

    try {
      this.execGit(['worktree', 'prune']);
    } catch {
      // ignore
    }

    const entries = fs.readdirSync(prefixDir);
    const cleaned: string[] = [];

    for (const entry of entries) {
      if (this.activeWorktrees.has(entry)) continue;

      const orphanPath = path.join(prefixDir, entry);
      const stat = fs.lstatSync(orphanPath, { throwIfNoEntry: false });
      if (stat && stat.isDirectory()) {
        try {
          this.execGit(['worktree', 'remove', '--force', orphanPath]);
        } catch {
          // ignore
        }
        if (fs.existsSync(orphanPath)) {
          fs.rmSync(orphanPath, { recursive: true, force: true });
        }
        cleaned.push(entry);
      }
    }

    return cleaned;
  }
}
