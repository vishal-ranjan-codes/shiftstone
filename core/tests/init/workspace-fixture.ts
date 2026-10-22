/**
 * Fixture: a minimal workspace skeleton for running the archetype composer
 * against a temp root (phase 4 exit-criteria tests). Copies exactly what
 * init reads or writes: packs, bible template, steering shims, static rules
 * and every tracked core skill.
 */

import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listCoreSkills } from '../../context/skill-paths.js';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
);

export async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'init-ws-'));
  const copy = (rel: string) =>
    cpSync(path.join(REPO_ROOT, rel), path.join(root, rel), { recursive: true });

  copy('packs');
  copy('docs/bible');
  copy('core/static-rules');
  copy('core/path-scoped-rules');
  copy('core/workflows');
  copy('core/context/token-budget.json');
  copy('AGENTS.md');
  copy('ANTIGRAVITY.md');
  copy('CLAUDE.md');
  copy('COMMANDCODE.md');
  copy('opencode.json');

  mkdirSync(path.join(root, '.agents', 'skills'), { recursive: true });
  for (const name of listCoreSkills(REPO_ROOT)) {
    copy(path.join('.agents', 'skills', name));
  }

  return root;
}

/** Recursively collect files under `dir` as relative posix paths (skips links). */
export function walkFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) out.push(...walkFiles(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out;
}
