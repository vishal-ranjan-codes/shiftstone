#!/usr/bin/env node
/**
 * IDE folder link manager — enforces the Anti-Duplication Mandate
 * (blueprint §6.6): content lives once under core/ and packs/, IDE folders
 * are junction links (locally created, gitignored).
 *
 * Usage:
 *   node .shiftstone/scripts/link-ide-folders.js            create missing links
 *   node .shiftstone/scripts/link-ide-folders.js --replace  replace real folders that
 *                                                    only contain .md files
 *                                                    whose names exist in core/
 *   node .shiftstone/scripts/link-ide-folders.js --check    exit 1 if a link slot is a
 *                                                    real folder (duplication)
 *   node .shiftstone/scripts/link-ide-folders.js --root=<dir>  operate on another workspace
 */

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listActivePackSkills, readPackRegistry } from '../context/skill-paths.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STATIC_LINKS = [
  { link: '.agent/rules', target: '.shiftstone/static-rules', alsoIn: ['.shiftstone/path-scoped-rules'] },
  { link: '.claude/rules', target: '.shiftstone/path-scoped-rules', alsoIn: ['.shiftstone/static-rules'] },
  { link: '.commandcode/rules', target: '.shiftstone/path-scoped-rules', alsoIn: ['.shiftstone/static-rules'] },
  { link: '.claude/skills', target: '.agents/skills', alsoIn: [] },
  { link: '.commandcode/skills', target: '.agents/skills', alsoIn: [] },
];

function isLink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function listMdFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) out.push(entry.name);
    }
  };
  walk(dir);
  return out;
}

function canonicalNames(spec, root) {
  const names = new Set();
  for (const dir of [spec.target, ...spec.alsoIn]) {
    const abs = path.join(root, dir);
    if (!existsSync(abs)) continue;
    for (const name of listMdFiles(abs)) names.add(name);
  }
  return names;
}

function safeToReplace(linkAbs, spec, root) {
  const files = listMdFiles(linkAbs);
  const all = readdirSync(linkAbs, { withFileTypes: true });
  if (all.some((entry) => !entry.isSymbolicLink() && !entry.isDirectory() && !entry.name.endsWith('.md'))) return false;
  if (files.length === 0) return false;
  const canonical = canonicalNames(spec, root);
  return files.every((name) => canonical.has(name));
}

function createLink(linkAbs, targetAbs) {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  symlinkSync(targetAbs, linkAbs, type);
}

/**
 * Resolve the link table for a workspace root: the 9 static IDE slots plus
 * one slot per active pack skill (task 4.2), honoring the registry's
 * namespaced skill list (--force-namespace escape hatch).
 */
export function linkTable(root) {
  const links = [...STATIC_LINKS];
  const { namespacedSkills } = readPackRegistry(root);
  for (const skill of listActivePackSkills(root)) {
    const slot = namespacedSkills.has(skill.name) ? `${skill.pack}--${skill.name}` : skill.name;
    links.push({
      link: `.agents/skills/${slot}`,
      target: `packs/${skill.pack}/skills/${skill.name}`,
      alsoIn: [],
    });
  }
  return links;
}

/**
 * @param {{ root?: string, replace?: boolean, checkOnly?: boolean, quiet?: boolean }} [options]
 * @returns {{ failures: number, verified: number, messages: string[] }}
 */
export function linkIdeFolders({ root = ROOT, replace = false, checkOnly = false, quiet = false } = {}) {
  const messages = [];
  const log = (line) => {
    messages.push(line);
    if (!quiet) console.log(line);
  };
  const err = (line) => {
    messages.push(line);
    if (!quiet) console.error(line);
  };

  let failures = 0;
  let verified = 0;

  if (checkOnly) {
    try {
      const staticPaths = STATIC_LINKS.map((s) => s.link);
      const out = execFileSync('git', ['ls-files', ...staticPaths], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (out) {
        const tracked = out.split(/\r?\n/).filter(Boolean);
        for (const file of tracked) {
          err(`FAIL    ${file} is tracked in git (junction slots must not contain tracked files)`);
          failures += 1;
        }
      }
    } catch {
      // outside git repo or git not found
    }
  }

  for (const spec of linkTable(root)) {
    const linkAbs = path.join(root, spec.link);
    const targetAbs = path.join(root, spec.target);

    if (!existsSync(targetAbs)) {
      err(`error: canonical target missing: ${spec.target}`);
      failures += 1;
      continue;
    }

    if (isLink(linkAbs)) {
      verified += 1;
      if (!checkOnly) log(`ok      ${spec.link} -> ${spec.target} (already linked)`);
      continue;
    }

    if (!existsSync(linkAbs)) {
      if (checkOnly) {
        verified += 1;
        log(`ok      ${spec.link} (absent — created after clone by this script)`);
        continue;
      }
      mkdirSync(path.dirname(linkAbs), { recursive: true });
      createLink(linkAbs, targetAbs);
      log(`linked  ${spec.link} -> ${spec.target}`);
      continue;
    }

    // A real folder sits where a link belongs = duplicated content
    if (checkOnly) {
      err(`FAIL    ${spec.link} is a real folder (expected junction to ${spec.target})`);
      failures += 1;
      continue;
    }
    if (!replace) {
      err(`FAIL    ${spec.link} is a real folder — rerun with --replace (it only replaces folders whose .md files all exist under core/)`);
      failures += 1;
      continue;
    }
    if (!safeToReplace(linkAbs, spec, root)) {
      err(`REFUSED ${spec.link} contains files not found under ${spec.target}${spec.alsoIn.length ? ' or ' + spec.alsoIn.join(', ') : ''} — will not delete`);
      failures += 1;
      continue;
    }
    rmSync(linkAbs, { recursive: true, force: true });
    createLink(linkAbs, targetAbs);
    log(`replaced ${spec.link} -> ${spec.target}`);
  }

  if (checkOnly) log(`ok — ${verified} link slot(s) verified, ${failures} real folder(s) found`);
  return { failures, verified, messages };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const rootArg = args.find((a) => a.startsWith('--root='));
  const result = linkIdeFolders({
    root: rootArg ? rootArg.slice('--root='.length) : ROOT,
    replace: args.includes('--replace'),
    checkOnly: args.includes('--check'),
  });
  process.exit(result.failures > 0 ? 1 : 0);
}
