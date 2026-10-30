import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020');

const schemaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../governance/schemas');

const schemaFiles = {
  'plan-unit/v1': 'plan-unit-v1.schema.json',
  'plan-manifest/v1': 'plan-manifest-v1.schema.json',
  'plan-handoff/v1': 'plan-handoff-v1.schema.json',
  'plan-state/v1': 'plan-state-v1.schema.json',
  'checker-report/v1': 'checker-report.schema.json',
  'protected-action/v1': 'protected-action-approval.schema.json',
};

// strictRequired is an authoring lint, not a data-validation restriction.
const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
ajv.addFormat('date-time', (value) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 19) === value.slice(0, 19);
});

const validators = new Map();

/**
 * Validates a data record against a registered governance schema.
 * @param {object} record
 * @param {string} kind
 * @param {string} [label]
 * @returns {string[]} Array of error strings, or empty array if valid.
 */
export function validateSchema(record, kind, label = kind) {
  if (!schemaFiles[kind]) return [`${label}: unsupported schema ${kind}`];
  if (!validators.has(kind)) {
    const schemaPath = path.join(schemaRoot, schemaFiles[kind]);
    validators.set(kind, ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8'))));
  }
  const validate = validators.get(kind);
  if (validate(record)) return [];
  return validate.errors.map((error) => {
    if (error.keyword === 'required') {
      return `${label}${error.instancePath}: missing required field "${error.params.missingProperty}"`;
    }
    if (error.instancePath === '/unitId') {
      return `${label}: unitId "${record?.unitId}" ${error.message}`;
    }
    return `${label}${error.instancePath || '/'}: ${error.message} ${JSON.stringify(error.params)}`;
  });
}

/**
 * Validates that a string is a safe, normalized repository-relative path.
 * Rejects absolute paths, drive letters, backslashes, URL schemes, traversal segments ('..'),
 * duplicate slashes, leading/trailing slashes, and control characters.
 * @param {string} value
 * @returns {string} The validated relative path.
 */
export function repoPath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    /[\\:\x00-\x1f\x7f?#]/.test(value) ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.includes('//') ||
    (value !== '.' && value.split('/').some((part) => part === '.' || part === '..' || /[. ]$/.test(part)))
  ) {
    throw new Error(`Unsafe repository path: ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Resolves a repo-relative path against the root, verifying that it does not escape
 * through symlinks/junctions, and enforces Windows case-normalization.
 * @param {string} root
 * @param {string} value
 * @param {{ mustExist?: boolean }} [options]
 * @returns {string} The canonical absolute filesystem path.
 */
export function resolveRepoPath(root, value, { mustExist = false } = {}) {
  repoPath(value);
  const realRoot = fs.realpathSync(root);
  const full = path.resolve(realRoot, value);
  let ancestor = full;
  while (!fs.existsSync(ancestor)) {
    if (fs.lstatSync(ancestor, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Broken symlink/junction: ${value}`);
    }
    ancestor = path.dirname(ancestor);
  }
  const resolved = fs.realpathSync(ancestor);
  const rel = path.relative(realRoot, resolved);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`Path escapes repository through symlink/junction: ${value}`);
  }
  const canonical = path.resolve(resolved, path.relative(ancestor, full));
  if (full !== canonical) {
    throw new Error(
      `Noncanonical or aliased path spelling: ${value}; use ${
        path.relative(realRoot, canonical).replace(/\\/g, '/') || '.'
      }`
    );
  }
  // Windows realpath may retain caller's case. Compare actual directory entries.
  if (process.platform === 'win32' && value !== '.') {
    let cursor = realRoot;
    for (const segment of value.split('/')) {
      if (!fs.existsSync(cursor) || !fs.statSync(cursor).isDirectory()) break;
      const entries = fs.readdirSync(cursor);
      if (!entries.includes(segment)) {
        if (
          entries.some((entry) => entry.toLowerCase() === segment.toLowerCase()) ||
          fs.existsSync(path.join(cursor, segment))
        ) {
          throw new Error(`Noncanonical Windows path spelling: ${value}`);
        }
        break;
      }
      cursor = path.join(cursor, segment);
    }
  }
  if (mustExist && !fs.existsSync(full)) {
    throw new Error(`Missing repository path: ${value}`);
  }
  return full;
}

/**
 * Normalizes a suite identifier or path. If the suite does not exist directly
 * at the repository root but exists under `docs/plans/<suite>`, automatically resolves it.
 * @param {string} root
 * @param {string} suite
 * @returns {string} The normalized repo-relative suite path.
 */
export function normalizeSuite(root, suite) {
  if (!suite) return suite;
  const cleaned = String(suite).replace(/[/\\]+$/, '').replace(/\\/g, '/');
  try {
    const realRoot = fs.realpathSync(root);
    if (fs.existsSync(path.resolve(realRoot, cleaned, 'plan-manifest.json'))) {
      return cleaned;
    }
    const withDocsPlans = `docs/plans/${cleaned}`;
    if (
      fs.existsSync(path.resolve(realRoot, withDocsPlans, 'plan-manifest.json')) ||
      fs.existsSync(path.resolve(realRoot, withDocsPlans))
    ) {
      return withDocsPlans;
    }
    if (fs.existsSync(path.resolve(realRoot, cleaned))) {
      return cleaned;
    }
  } catch (_) {}
  return cleaned;
}

const excludedDirectories = new Set(['_archive', '.git', 'node_modules', 'vendor']);

/**
 * Recursively walks a directory ignoring excluded folders, symlinks, and broken entries.
 * @param {string} root
 * @param {string} relative
 * @param {(file: string) => boolean} accept
 * @param {string[]} [result]
 * @returns {string[]}
 */
export function walk(root, relative, accept, result = []) {
  if (relative.split('/').some((part) => excludedDirectories.has(part.toLowerCase()))) {
    throw new Error(`Excluded discovery path: ${relative}`);
  }
  const full = resolveRepoPath(root, relative, { mustExist: true });
  const stat = fs.lstatSync(full);
  if (stat.isSymbolicLink()) {
    throw new Error(`Discovery does not follow symlinks/junctions: ${relative}`);
  }
  if (stat.isFile()) {
    if (accept(relative)) result.push(relative);
    return result;
  }
  if (!stat.isDirectory()) {
    throw new Error(`Unsupported input path: ${relative}`);
  }
  for (const entry of fs.readdirSync(full).sort()) {
    if (!excludedDirectories.has(entry.toLowerCase())) {
      walk(root, relative === '.' ? entry : `${relative}/${entry}`, accept, result);
    }
  }
  return result;
}

/**
 * Discovers all opted-in plan suites in target directory.
 * @param {string} root
 * @param {string} [target]
 * @returns {string[]}
 */
export function discoverSuites(root, target = 'docs/plans') {
  resolveRepoPath(root, target, { mustExist: true });
  const manifestCandidate = `${target}/plan-manifest.json`;
  const unitsCandidate = `${target}/plan-units`;
  if (
    fs.existsSync(resolveRepoPath(root, manifestCandidate)) ||
    fs.existsSync(resolveRepoPath(root, unitsCandidate))
  ) {
    return [target];
  }

  const markers = walk(
    root,
    target,
    (file) =>
      /(?:^|\/)plan-manifest\.json$/.test(file) ||
      /\/plan-units\/[^/]+\.json$/.test(file) ||
      /(?:^|\/)CONTEXT\.md$/.test(file) ||
      /(?:^|\/)phase-[0-9]+[a-z0-9-]*\.md$/i.test(file) ||
      /(?:^|\/)[0-9]{2}-[a-z0-9-]+\.md$/i.test(file)
  );

  const suites = new Set();
  for (const file of markers) {
    if (file.includes('/plan-units/')) {
      suites.add(file.split('/plan-units/')[0]);
    } else {
      suites.add(path.posix.dirname(file));
    }
  }

  return [...suites].sort();
}
