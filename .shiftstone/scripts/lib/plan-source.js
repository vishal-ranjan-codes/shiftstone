import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolveRepoPath } from './plan-schema.js';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const digest = (value) => sha256(Buffer.from(JSON.stringify(value)));

export const environmentKeys = new Set([
  'node-version',
  'npm-version',
  'pnpm-version',
  'python-version',
  'site-url-id',
  'fixture-version',
  'served-assets-digest',
]);

const excluded = new Set([
  '.git',
  'node_modules',
  'vendor',
  'output',
  'outputs',
  'handoffs',
  '.aws',
  '.codex',
  'secrets',
]);

const generated = new Set(['build', 'dist', 'assets']);

export function secretPath(file) {
  return file.split('/').some(
    (part) =>
      /^\.env(?:\.|$)/i.test(part) ||
      /^(?:credentials|\.npmrc|\.netrc|id_rsa|id_ed25519)$/i.test(part) ||
      /\.(?:pem|key|p12|pfx)$/i.test(part)
  );
}

export function maskStatus(bytes, file) {
  if (path.posix.basename(file).toLowerCase() !== 'readme.md') return bytes;
  return Buffer.from(
    bytes
      .toString('utf8')
      .replace(
        /<!-- plan-status:start -->[\s\S]*?<!-- plan-status:end -->/g,
        '<!-- plan-status:start --><!-- plan-status:end -->'
      )
  );
}

export function normalizedSourceFiles(root, files) {
  return files.map((file) => {
    if (!file.indexBlob || path.posix.basename(file.path).toLowerCase() !== 'readme.md') {
      return file;
    }
    if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(file.indexBlob)) {
      throw new Error(`Invalid recorded Git blob identity: ${file.path}`);
    }
    try {
      const bytes = execFileSync(
        'git',
        ['-c', 'core.fsmonitor=false', 'cat-file', 'blob', file.indexBlob],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] }
      );
      if (!bytes.includes(Buffer.from('<!-- plan-status:start -->'))) return file;
      return { ...file, indexBlob: `masked-sha256:${sha256(maskStatus(bytes, file.path))}` };
    } catch {
      return file;
    }
  });
}

export function sourceDigest(root, scopePaths, files) {
  return digest({ scopePaths, files: normalizedSourceFiles(root, files) });
}

export function git(root, args, optional = false) {
  if (!fs.existsSync(path.join(root, '.git'))) return null;
  try {
    return execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (optional && error.status === 128) return null;
    if (error.status === 128 && /not a git repository/.test(error.stderr?.toString() || '')) {
      return null;
    }
    throw new Error(`Git metadata unavailable: ${error.message}`);
  }
}

export function gitIndex(root) {
  const map = new Map();
  for (const line of (git(root, ['ls-files', '--stage', '-z']) || '').split('\0').filter(Boolean)) {
    const split = line.indexOf('\t');
    const [mode, blob, stage] = line.slice(0, split).split(' ');
    const name = line.slice(split + 1);
    if (stage !== '0') throw new Error(`Unmerged index: ${name}`);
    if (mode) map.set(name, blob);
  }
  return map;
}

export function dirtyPaths(root) {
  const parts = (
    git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']) || ''
  )
    .split('\0')
    .filter(Boolean);
  const items = [];
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i].slice(0, 2);
    const file = parts[i].slice(3);
    if (status === '??') {
      items.push({ path: file, state: 'untracked' });
    } else {
      if (/[RC]/.test(status)) {
        items.push({ path: file, state: status.includes('R') ? 'renamed' : 'staged' });
        const old = parts[++i];
        if (old && status.includes('R')) items.push({ path: old, state: 'deleted' });
        if (status[1] !== ' ' && !/[RC]/.test(status[1])) {
          items.push({ path: file, state: status[1] === 'D' ? 'deleted' : 'unstaged' });
        }
      } else {
        if (status[0] !== ' ') items.push({ path: file, state: status[0] === 'D' ? 'deleted' : 'staged' });
        if (status[1] !== ' ') items.push({ path: file, state: status[1] === 'D' ? 'deleted' : 'unstaged' });
      }
    }
  }
  return items.sort((a, b) => a.path.localeCompare(b.path) || a.state.localeCompare(b.state));
}

export function environmentState(keys = [], values = {}) {
  return [...new Set(keys)].sort().map((key) => {
    if (!environmentKeys.has(key)) throw new Error(`Environment key is not allowlisted: ${key}`);
    const value = Object.hasOwn(values, key) ? values[key] : key === 'node-version' ? process.version : null;
    if (value !== null && typeof value !== 'string') {
      throw new Error(`Environment metadata must be a string: ${key}`);
    }
    return { key, valueSha256: value === null ? null : sha256(Buffer.from(value)) };
  });
}

/**
 * Captures source snapshot over declared scope paths.
 * @param {string} root
 * @param {string[]} scopePaths
 * @param {object} [options]
 * @returns {object}
 */
export function captureSourceSnapshot(
  root,
  scopePaths,
  {
    keys = [],
    values = {},
    previousFiles = [],
    maxFiles = 10000,
    maxBytes = 268435456,
  } = {}
) {
  const scopes = [...new Set(scopePaths)].sort();
  const names = new Set();
  const index = gitIndex(root);
  const dirty = dirtyPaths(root);
  const inside = (file) => scopes.some((scope) => scope === '.' || file === scope || file.startsWith(`${scope}/`));

  function permitted(file, explicit) {
    if (secretPath(file)) {
      if (explicit) throw new Error(`Secret path cannot be hashed: ${file}`);
      return false;
    }
    if (file.split('/').some((part) => excluded.has(part.toLowerCase()))) {
      if (explicit) throw new Error(`Excluded source path: ${file}`);
      return false;
    }
    return explicit || !file.split('/').some((part) => generated.has(part.toLowerCase()));
  }

  function expand(file, explicit = false) {
    if (!permitted(file, explicit)) return;
    const full = resolveRepoPath(root, file);
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (!stat) {
      const known = [
        ...index.keys(),
        ...dirty.filter((item) => item.state === 'deleted').map((item) => item.path),
        ...previousFiles.filter((item) => item.tracked || item.worktreeSha256 !== null).map((item) => item.path),
      ];
      if (!known.some((name) => name === file || name.startsWith(`${file}/`))) {
        throw new Error(`Required source path never existed or lacks deletion provenance: ${file}`);
      }
      if (known.includes(file)) names.add(file);
      return;
    }
    if (stat.isSymbolicLink()) throw new Error(`Source inventory does not follow symlinks/junctions: ${file}`);
    if (stat.isFile()) {
      names.add(file);
      return;
    }
    if (!stat.isDirectory()) throw new Error(`Unsupported source type: ${file}`);
    for (const entry of fs.readdirSync(full).sort()) {
      expand(file === '.' ? entry : `${file}/${entry}`);
    }
  }

  for (const scope of scopes) expand(scope, true);
  for (const file of [
    ...index.keys(),
    ...dirty.filter((x) => x.state === 'deleted').map((x) => x.path),
    ...previousFiles.map((x) => x.path),
  ]) {
    if (inside(file) && permitted(file, scopes.includes(file))) names.add(file);
  }
  if (names.size > maxFiles) {
    throw new Error(`Source inventory exceeds bounded file limit: ${maxFiles}`);
  }

  let totalBytes = 0;
  const files = [...names].sort().map((file) => {
    const full = resolveRepoPath(root, file);
    const stat = fs.lstatSync(full, { throwIfNoEntry: false });
    if (stat?.isSymbolicLink() || (stat && !stat.isFile())) {
      throw new Error(`Expected scoped regular file: ${file}`);
    }
    totalBytes += stat?.size || 0;
    if (totalBytes > maxBytes) {
      throw new Error(`Source inventory exceeds bounded byte limit: ${maxBytes}`);
    }
    return {
      path: file,
      tracked: index.has(file) || dirty.some((item) => item.path === file && item.state === 'deleted'),
      worktreeSha256: stat ? sha256(maskStatus(fs.readFileSync(full), file)) : null,
      indexBlob: index.get(file) || null,
    };
  });

  const environment = environmentState(keys, values);
  return {
    head: (git(root, ['rev-parse', '--verify', 'HEAD'], true) || '').trim() || null,
    branch: (git(root, ['branch', '--show-current']) || '').trim() || null,
    scopePaths: scopes,
    scopeDigest: sourceDigest(root, scopes, files),
    environmentDigest: digest(environment),
    files,
    environment,
  };
}

export const snapshot = (root, scopePaths, keys = [], values = {}, options = {}) =>
  captureSourceSnapshot(root, scopePaths, { keys, values, ...options });

export function definitionHash(root, suite, phase, units, policyPaths = []) {
  const activeUnits = units.filter((unit) => phase.unitIds.includes(unit.record.unitId));
  const controlling = (file) => {
    const lower = file.toLowerCase();
    return (
      lower === 'agents.md' ||
      /^(?:\.shiftstone\/static-rules|\.agents\/skills|\.shiftstone\/governance\/schemas)(?:\/|$)/.test(lower) ||
      (lower.startsWith('docs/plans/') && !/\/(?:output|_archive)(?:\/|$)/.test(lower))
    );
  };
  const declared = activeUnits
    .flatMap((unit) => unit.record.allowedInputs || unit.record.targetFiles || [])
    .map((file) => file.replace(/\/$/, ''))
    .filter(controlling);
  const paths = [
    ...new Set([
      `${suite}/plan-manifest.json`,
      phase.contract,
      ...activeUnits.map((unit) => unit.path),
      ...policyPaths,
      ...declared,
    ]),
  ].sort();
  paths.forEach((file) => resolveRepoPath(root, file, { mustExist: true }));
  const inventory = snapshot(root, paths);
  const files = inventory.files.map((file) => ({ path: file.path, sha256: file.worktreeSha256 }));
  return digest({ paths, files });
}

export function readEvidence(root, reference) {
  if (
    secretPath(reference.path) ||
    reference.path
      .split('/')
      .some((part) => ['.git', '.aws', '.codex', 'secrets', 'node_modules', 'vendor'].includes(part.toLowerCase()))
  ) {
    throw new Error(`Secret or excluded evidence path: ${reference.path}`);
  }
  const full = resolveRepoPath(root, reference.path, { mustExist: true });
  if (!fs.statSync(full).isFile()) throw new Error(`Evidence must be a file: ${reference.path}`);
  const bytes = fs.readFileSync(full);
  if (sha256(bytes) !== reference.sha256) throw new Error(`Evidence bytes changed: ${reference.path}`);
  return bytes;
}

export function preservationInventory(root, before, after) {
  return dirtyPaths(root).map((item) => ({
    ...item,
    origin: 'unknown',
    action: 'preserve',
    reason: 'Inventory existing work; origin requires actual observation.',
    entrySha256: before?.files?.find((file) => file.path === item.path)?.worktreeSha256 || null,
    exitSha256: after?.files?.find((file) => file.path === item.path)?.worktreeSha256 || null,
  }));
}
