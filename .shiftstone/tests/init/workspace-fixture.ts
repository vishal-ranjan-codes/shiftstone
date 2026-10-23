/**
 * Fixture: a minimal workspace skeleton for running the archetype composer
 * against a temp root (phase 4 exit-criteria tests). Copies exactly what
 * init reads or writes: packs, bible template, steering shims, static rules
 * and every tracked core skill.
 */

import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
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

export const TEMPLATE_ROOT = existsSync(path.join(REPO_ROOT, 'frameworks', 'shiftstone'))
  ? path.join(REPO_ROOT, 'frameworks', 'shiftstone')
  : REPO_ROOT;

export async function makeWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'init-ws-'));
  const copy = (rel: string) =>
    cpSync(path.join(TEMPLATE_ROOT, rel), path.join(root, rel), { recursive: true });

  if (existsSync(path.join(TEMPLATE_ROOT, '.shiftstone', 'packs'))) {
    mkdirSync(path.join(root, '.shiftstone'), { recursive: true });
    cpSync(
      path.join(TEMPLATE_ROOT, '.shiftstone', 'packs'),
      path.join(root, '.shiftstone', 'packs'),
      { recursive: true },
    );
  } else if (existsSync(path.join(TEMPLATE_ROOT, 'packs'))) {
    copy('packs');
  }
  copy('docs/bible');
  copy('.shiftstone/static-rules');
  copy('.shiftstone/path-scoped-rules');
  copy('.shiftstone/workflows');
  copy('.shiftstone/context/token-budget.json');
  copy('AGENTS.md');
  copy('ANTIGRAVITY.md');
  copy('CLAUDE.md');
  copy('COMMANDCODE.md');
  copy('opencode.json');

  mkdirSync(path.join(root, '.agents', 'skills'), { recursive: true });
  for (const name of listCoreSkills(TEMPLATE_ROOT)) {
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
