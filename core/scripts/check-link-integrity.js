#!/usr/bin/env node
/**
 * Relative-link integrity checker (amendment C7) — the relative link graph is
 * the lineage graph (OKF §5).
 *
 *   node core/scripts/check-link-integrity.js           warn mode (exit 0)
 *   node core/scripts/check-link-integrity.js --strict  CI mode (exit 1)
 *
 * Strict scope: OKF-formatted trees + steering docs + harness docs. Legacy
 * trees are checked in warn mode and promoted to strict once clean.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchGlob } from '../context/skills-loader.ts';
import { collectMdFiles } from './validate-okf-frontmatter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const STRICT_SCOPE = [
  'docs/bible/**/*.md',
  'docs/loops/**/*.md',
  'docs/**/index.md',
  'packs/index.md',
  '.agents/skills/index.md',
  '_config/**/*.md',
  'core/**/*.md',
  'AGENTS.md',
  'ANTIGRAVITY.md',
  'CLAUDE.md',
  'COMMANDCODE.md',
  '.agents/skills/**/SKILL.md',
  'packs/*/skills/**/SKILL.md',
  '**/CONTEXT.md',
];

export function extractRelativeLinks(raw) {
  const text = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  const links = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    let target = match[1];
    if (/^(https?:|mailto:|\/\/|\/)/.test(target)) continue;
    if (target.includes('{{')) continue; // starter template placeholders
    target = target.split('#')[0];
    if (target.length > 0) links.push(target);
  }
  return [...new Set(links)];
}

export async function checkFile(abs, rel) {
  const raw = await readFile(abs, 'utf8');
  const baseDir = path.dirname(abs);
  const problems = [];
  for (const target of extractRelativeLinks(raw)) {
    const resolved = path.resolve(baseDir, target);
    // Directory links resolve through the directory's OKF index (C5).
    const candidate = target.endsWith('/') ? path.join(resolved, 'index.md') : resolved;
    const exists = await readFile(candidate).then(() => true, () => false);
    if (!exists) problems.push(`${rel}: broken relative link -> ${target}`);
  }
  return problems;
}

export async function run({ strict = false } = {}) {
  const files = await collectMdFiles(ROOT);
  const problems = [];
  let checked = 0;
  for (const abs of files) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const inStrictScope = STRICT_SCOPE.some((pattern) => matchGlob(pattern, rel));
    if (strict && !inStrictScope) continue;
    checked += 1;
    problems.push(...(await checkFile(abs, rel)));
  }
  return { checked, problems, strict };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const result = await run({ strict });
  for (const problem of result.problems) {
    console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  }
  console.log(`checked ${result.checked} file(s), ${result.problems.length} broken link(s)`);
  if (strict && result.problems.length > 0) process.exit(1);
}
