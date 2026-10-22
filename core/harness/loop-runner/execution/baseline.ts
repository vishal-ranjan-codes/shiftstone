/**
 * A2 — Baseline snapshots before mutation (Family B).
 *
 * Modes:
 *   worktree-snapshot (default) — copy every worktree file (git-aware,
 *     ignoring ignored paths) into .loops/<name>/baselines/<ref>/ before the
 *     turn; restore copies back and deletes files the turn created.
 *   git-stash — `git stash create` (a pure, non-mutating commit object) for
 *     tracked changes, plus a copy of the untracked files that existed at
 *     capture time; restore pulls tracked files from that commit and puts the
 *     untracked copies back. Intended for git worktree isolation.
 *   none — no baseline (A1 red-green proof is then impossible; the validator
 *     refuses red_green specs without a baseline).
 */

import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BaselineManager, BaselineMode } from '../types.ts';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.loops',
  'dist',
  'build',
  'coverage',
  '.wrangler',
  '.react-router',
  '.turbo',
]);

interface SnapshotManifest {
  ref: string;
  created_at: string;
  files: string[];
  untracked?: string[];
}

async function runGit(args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd });
    let out = '';
    child.stdout.on('data', (c: Buffer) => (out += c.toString()));
    child.on('error', () => resolve({ code: 127, out: '' }));
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

async function walkFiles(root: string, rel = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, rel), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, relPath)));
    } else {
      files.push(relPath);
    }
  }
  return files;
}

/** git-aware file list; falls back to a plain walk outside a git repo. */
export async function listWorktreeFiles(root: string): Promise<string[]> {
  const res = await runGit(['ls-files', '-co', '--exclude-standard'], root);
  if (res.code === 0) {
    const listed = res.out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    // git lists tracked-but-deleted paths too — keep only what exists
    const existing = await Promise.all(
      [...new Set(listed)].map(async (rel) => {
        const info = await stat(path.join(root, rel)).catch(() => null);
        return info !== null && info.isFile() ? rel : null;
      }),
    );
    const files = existing.filter((f): f is string => f !== null);
    if (files.length > 0) return files;
  }
  return walkFiles(root);
}

async function copyIn(root: string, files: readonly string[], from: string): Promise<void> {
  for (const rel of files) {
    const src = path.join(from, rel);
    const dest = path.join(root, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest, { force: true });
  }
}

export class WorktreeSnapshotBaseline {
  workspaceRoot: string;
  storeDir: string;
  counter: number;

  constructor(workspaceRoot: string, storeDir: string) {
    this.workspaceRoot = workspaceRoot;
    this.storeDir = storeDir;
    this.counter = 0;
  }

  async capture(): Promise<string> {
    const files = await listWorktreeFiles(this.workspaceRoot);
    const ref = `snap-${Date.now()}-${++this.counter}`;
    const dest = path.join(this.storeDir, ref);
    await mkdir(dest, { recursive: true });
    await copyIn(dest, files, this.workspaceRoot);
    const manifest: SnapshotManifest = {
      ref,
      created_at: new Date().toISOString(),
      files,
    };
    await writeFile(path.join(dest, '__manifest__.json'), JSON.stringify(manifest, null, 2));
    return ref;
  }

  async restore(ref: string): Promise<void> {
    const dir = path.join(this.storeDir, ref);
    const manifest = JSON.parse(
      await readFile(path.join(dir, '__manifest__.json'), 'utf8'),
    ) as SnapshotManifest;
    const captured = new Set(manifest.files);
    const current = await listWorktreeFiles(this.workspaceRoot);
    for (const rel of current) {
      if (!captured.has(rel)) {
        await rm(path.join(this.workspaceRoot, rel), { force: true });
      }
    }
    await copyIn(this.workspaceRoot, manifest.files, dir);
  }
}

export class GitStashBaseline {
  workspaceRoot: string;
  storeDir: string;
  counter: number;

  constructor(workspaceRoot: string, storeDir: string) {
    this.workspaceRoot = workspaceRoot;
    this.storeDir = storeDir;
    this.counter = 0;
  }

  async untracked(): Promise<string[]> {
    const res = await runGit(['status', '--porcelain'], this.workspaceRoot);
    if (res.code !== 0) return [];
    return res.out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('??'))
      .map((l) => l.slice(2).replace(/"/g, ''))
      .filter((p) => !p.endsWith('/'));
  }

  async capture(): Promise<string> {
    const ref = `stash-${Date.now()}-${++this.counter}`;
    const dest = path.join(this.storeDir, ref);
    await mkdir(dest, { recursive: true });

    const create = await runGit(['stash', 'create'], this.workspaceRoot);
    const stashCommit = create.code === 0 ? create.out.trim() : '';
    const head = await runGit(['rev-parse', 'HEAD'], this.workspaceRoot);

    const untracked = await this.untracked();
    await copyIn(dest, untracked, this.workspaceRoot);

    const manifest: SnapshotManifest = {
      ref,
      created_at: new Date().toISOString(),
      files: [],
      untracked,
    };
    await writeFile(
      path.join(dest, '__manifest__.json'),
      JSON.stringify({ ...manifest, source: stashCommit || head.out.trim() }, null, 2),
    );
    return ref;
  }

  async restore(ref: string): Promise<void> {
    const dir = path.join(this.storeDir, ref);
    const manifest = JSON.parse(
      await readFile(path.join(dir, '__manifest__.json'), 'utf8'),
    ) as SnapshotManifest & { source: string };
    if (manifest.source) {
      await runGit(
        ['restore', `--source=${manifest.source}`, '--worktree', '--staged', '--', '.'],
        this.workspaceRoot,
      );
    }
    const stored = new Set(manifest.untracked ?? []);
    await copyIn(this.workspaceRoot, manifest.untracked ?? [], dir);
    // delete files created by the turn (untracked now, not present at capture)
    const currentUntracked = await this.untracked();
    for (const rel of currentUntracked) {
      if (!stored.has(rel)) {
        await rm(path.join(this.workspaceRoot, rel), { force: true });
      }
    }
  }
}

class NoopBaseline {
  async capture(): Promise<string> {
    return 'none';
  }
  async restore(): Promise<void> {
    /* no baseline to restore */
  }
}

export type { BaselineMode };

export function createBaselineManager(
  mode: BaselineMode,
  opts: { workspaceRoot: string; storeDir: string },
): BaselineManager {
  switch (mode) {
    case 'worktree-snapshot':
      return new WorktreeSnapshotBaseline(opts.workspaceRoot, opts.storeDir);
    case 'git-stash':
      return new GitStashBaseline(opts.workspaceRoot, opts.storeDir);
    case 'none':
      return new NoopBaseline();
  }
}
