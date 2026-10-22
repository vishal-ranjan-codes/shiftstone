#!/usr/bin/env node
/**
 * OKF frontmatter validator (amendment C7):
 *   - `type` is required (Google OKF's only required field)
 *   - `timestamp` must be an ISO-8601 datetime
 *
 *   node core/scripts/validate-okf-frontmatter.js           warn mode (exit 0)
 *   node core/scripts/validate-okf-frontmatter.js --strict  CI mode (exit 1)
 *   node core/scripts/validate-okf-frontmatter.js --fix     prepend missing frontmatter
 *
 * Strict scope = files that must be OKF-formatted today: bible chapters,
 * loop docs, generated indexes, _config references and skill manifests.
 */

import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { matchGlob } from '../context/skills-loader.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const STRICT_SCOPE = [
  'docs/bible/**/*.md',
  'docs/loops/README.md',
  'docs/loops/**/README.md',
  'docs/**/index.md',
  'packs/index.md',
  '.agents/skills/index.md',
  '_config/**/*.md',
  '.agents/skills/**/SKILL.md',
  'packs/*/skills/**/SKILL.md',
  'packs/*/bible-overlays/**/*.md',
  '**/CONTEXT.md',
];

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const SKIP_DIRS = new Set(['node_modules', '.git', '.loops', 'dist', 'build', 'coverage', 'resources']);

export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return { present: false, data: null };
  try {
    return { present: true, data: (parseYaml(match[1]) ?? null) };
  } catch {
    return { present: true, data: null, broken: true };
  }
}

export function checkFrontmatter(relPath, raw) {
  const problems = [];
  const { present, data, broken } = parseFrontmatter(raw);
  if (!present) {
    problems.push(`${relPath}: missing OKF frontmatter (--- block with type + timestamp)`);
    return problems;
  }
  if (broken || data === null) {
    problems.push(`${relPath}: frontmatter is not valid YAML`);
    return problems;
  }
  if (typeof data.type !== 'string' || data.type.trim().length === 0) {
    problems.push(`${relPath}: frontmatter missing required field "type"`);
  }
  if (typeof data.timestamp !== 'string' || !ISO_TIMESTAMP.test(data.timestamp)) {
    problems.push(`${relPath}: frontmatter "timestamp" must be an ISO-8601 datetime`);
  }
  return problems;
}

export async function collectMdFiles(root) {
  const out = [];
  const walk = async (dir) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.md')) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  await walk(root);
  return out;
}

function guessType(relPath) {
  const base = path.basename(relPath);
  if (base === 'index.md') return 'index';
  if (base === 'SKILL.md') return 'skill';
  if (base === 'README.md') return 'readme';
  if (base === 'DECISIONS.md') return 'decisions';
  if (base === 'CHANGELOG.md') return 'changelog';
  if (/^\d\d-/.test(path.basename(path.dirname(relPath)))) return 'chapter';
  return 'document';
}

async function fixFile(abs, relPath) {
  const raw = await readFile(abs, 'utf8');
  if (parseFrontmatter(raw).present) return false;
  const info = await stat(abs);
  const frontmatter = [
    '---',
    `type: ${guessType(relPath)}`,
    `timestamp: ${info.mtime.toISOString()}`,
    '---',
    '',
  ].join('\n');
  await writeFile(abs, `${frontmatter}${raw}`, 'utf8');
  return true;
}

export async function run({ strict = false, fix = false } = {}) {
  const files = await collectMdFiles(ROOT);
  const scoped = files.filter((abs) => {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    return STRICT_SCOPE.some((pattern) => matchGlob(pattern, rel));
  });

  let fixed = 0;
  if (fix) {
    for (const abs of scoped) {
      const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
      if (await fixFile(abs, rel)) fixed += 1;
    }
  }

  const problems = [];
  for (const abs of scoped) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    problems.push(...checkFrontmatter(rel, await readFile(abs, 'utf8')));
  }
  return { checked: scoped.length, problems, fixed, strict };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const strict = process.argv.includes('--strict');
  const fix = process.argv.includes('--fix');
  const result = await run({ strict, fix });
  if (result.fixed > 0) console.log(`fixed ${result.fixed} file(s)`);
  for (const problem of result.problems) {
    console.log(`${strict ? 'FAIL' : 'warn'}: ${problem}`);
  }
  console.log(`checked ${result.checked} in-scope file(s), ${result.problems.length} problem(s)`);
  if (strict && result.problems.length > 0) process.exit(1);
}
