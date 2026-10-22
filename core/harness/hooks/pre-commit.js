#!/usr/bin/env node
/**
 * Pre-commit hook entry (amendment B6) — scans content with the reference
 * secret scanner and refuses the commit when a hardcoded secret is found.
 *
 *   node core/harness/hooks/pre-commit.js --staged
 *       scan everything staged in git (used by git-hooks/pre-commit)
 *   node core/harness/hooks/pre-commit.js --root <dir> <file...>
 *       scan explicit files (tests, non-git use)
 *
 * Install once per clone:
 *   git config core.hooksPath core/harness/hooks/git-hooks
 *
 * Exit 0 = commit may proceed; exit 1 = blocked, findings printed.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanText } from './secret-scanner.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..', '..', '..');

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function report(label, findings) {
  for (const finding of findings) console.error(`  BLOCKED ${label}: ${finding}`);
}

function scanStaged() {
  const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'])
    .split(String.fromCharCode(0))
    .filter(Boolean);
  let blocked = 0;
  for (const name of names) {
    let content;
    try {
      content = git(['show', `:${name}`]);
    } catch {
      continue; // staged rename/delete edge — nothing to scan
    }
    if (content.includes(String.fromCharCode(0))) continue; // binary file
    const { findings } = scanText(content);
    if (findings.length > 0) {
      blocked += 1;
      report(name, findings);
    }
  }
  return blocked;
}

function scanFiles(root, files) {
  let blocked = 0;
  for (const file of files) {
    let content;
    try {
      content = readFileSync(path.resolve(root, file), 'utf8');
    } catch {
      console.error(`  warn: cannot read ${file}`);
      continue;
    }
    const { findings } = scanText(content);
    if (findings.length > 0) {
      blocked += 1;
      report(file, findings);
    }
  }
  return blocked;
}

const argv = process.argv.slice(2);
let blocked;
if (argv.includes('--staged')) {
  blocked = scanStaged();
} else {
  const rootIndex = argv.indexOf('--root');
  const root = rootIndex >= 0 ? argv[rootIndex + 1] : DEFAULT_ROOT;
  const files = argv.filter((a, i) => a !== '--root' && i !== rootIndex + 1 && !a.startsWith('--'));
  blocked = scanFiles(root, files);
}

if (blocked > 0) {
  console.error(`pre-commit blocked: ${blocked} file(s) contain hardcoded secrets (B6)`);
  process.exit(1);
}
console.log('pre-commit: secret scan clean');
