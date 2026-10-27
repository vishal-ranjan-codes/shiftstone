import fs from 'node:fs';
import path from 'node:path';
import { validateSchema, resolveRepoPath, walk } from './plan-schema.js';

export const sameSet = (a, b) => {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== a.length || sb.size !== b.length || sa.size !== sb.size) return false;
  for (const item of sa) if (!sb.has(item)) return false;
  return true;
};

export function unitIds(text) {
  if (!text || typeof text !== 'string') return [];
  const expanded = text.replace(
    /\bU([1-9][0-9]*)\s*[–—-]\s*U([1-9][0-9]*)\b/g,
    (match, a, b) => {
      const start = Number(a);
      const end = Number(b);
      return end >= start && end - start <= 1000
        ? Array.from({ length: end - start + 1 }, (_, i) => `U${start + i}`).join(' ')
        : match;
    }
  );
  return expanded.match(/\bU[1-9][0-9]*[a-z]?\b/g) || [];
}

/**
 * Parses markdown frontmatter and sections for ICM stage validation.
 */
function parseFrontmatter(content) {
  if (typeof content !== 'string') return { metadata: {}, body: '', error: 'Content must be a string' };
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n') && !normalized.startsWith('---')) {
    return { metadata: {}, body: normalized, error: 'missing YAML frontmatter' };
  }
  const startIdx = normalized.startsWith('---\n') ? 4 : 3;
  const endIdx = normalized.indexOf('\n---', startIdx);
  if (endIdx === -1) {
    return { metadata: {}, body: normalized, error: 'missing closing YAML frontmatter delimiter' };
  }
  const raw = normalized.substring(startIdx, endIdx);
  const body = normalized.substring(endIdx + 4).replace(/^\n+/, '');
  const metadata = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.substring(0, colon).trim();
    let val = trimmed.substring(colon + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    metadata[key] = val;
  }
  return { metadata, body, error: null };
}

function parseSections(markdown) {
  const sections = [];
  let current = null;
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (current) {
        current.content = current.lines.join('\n').trim();
        sections.push(current);
      }
      current = { level: match[1].length, title: match[2].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    current.content = current.lines.join('\n').trim();
    sections.push(current);
  }
  return sections;
}

function parseTable(text) {
  if (typeof text !== 'string') return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (lines.length < 2) return [];
  const parseRow = (r) => r.slice(1, -1).split('|').map((c) => c.trim());
  const headers = parseRow(lines[0]);
  let start = 1;
  if (/^\|[\s\-:|]+\|$/.test(lines[1])) start = 2;
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] !== undefined ? cells[idx] : '';
    });
    rows.push(obj);
  }
  return rows;
}

function parseStage(content) {
  const parsed = parseFrontmatter(content);
  const body = parsed.body.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
  const sections = parseSections(body);
  const tables = {};
  for (const s of sections.filter((s) => s.level <= 2)) {
    const norm = s.title.replace(/^Stage\s+/i, '').trim().toLowerCase();
    tables[norm] = parseTable(s.content);
  }
  return { ...parsed, body, sections, tables };
}

function validateDetailedUnits(body, ids) {
  const errors = [];
  const matches = [...body.matchAll(/^#{3,4}\s+Unit\s+(U[1-9][0-9]*[a-z]?)\s*:[^\n]*/gm)];
  for (const id of ids) {
    const locations = matches.filter((m) => m[1] === id);
    if (locations.length !== 1) {
      errors.push(`${id}: expected exactly one detailed specification`);
      continue;
    }
    const current = locations[0];
    const rest = body.slice(current.index + current[0].length);
    const end = rest.search(/^#{1,4}\s+/m);
    const unit = current[0] + (end === -1 ? rest : rest.slice(0, end));
    if (!/(?:^|\n)\s*[-*]?\s*\*{0,2}Target Files\*{0,2}\s*:/i.test(unit)) {
      errors.push(`${id}: missing Target Files specification`);
    }
    if (
      !/(?:^|\n)\s*[-*]?\s*\*{0,2}(?:Step-by-Step Implementation Mechanics|Implementation Mechanics|Implementation Details|Detailed Scenario Coverage|Verification Mechanics|Documentation Updates|Component & State Architecture|Server-Side Rendering|Frontend Interactivity)[^*:]*\*{0,2}\s*:/i.test(
        unit
      )
    ) {
      errors.push(`${id}: missing implementation mechanics`);
    }
    if (unit.trim().length < 200) {
      errors.push(`${id}: insufficient specification depth`);
    }
  }
  return errors;
}

/**
 * Loads and validates plan-manifest.json for a suite.
 * @param {string} root
 * @param {string} suitePath
 * @returns {{ manifest: any, diagnostics: Array<{ code: string, path: string, message: string }> }}
 */
export function loadPlanManifest(root, suitePath) {
  const diagnostics = [];
  const manifestFile = `${suitePath}/plan-manifest.json`;
  const full = resolveRepoPath(root, manifestFile, { mustExist: true });
  const manifest = JSON.parse(fs.readFileSync(full, 'utf8'));
  const schemaErrors = validateSchema(manifest, 'plan-manifest/v1', manifestFile);
  for (const err of schemaErrors) {
    diagnostics.push({ code: 'SCHEMA', path: manifestFile, message: err });
  }
  return { manifest, diagnostics };
}

/**
 * Validates the DAG and check graph of a plan manifest.
 * @param {object} manifest
 * @param {{ root?: string, manifestPath?: string }} [options]
 * @returns {Array<{ code: string, path: string, message: string }>}
 */
export function validatePlanGraph(manifest, options = {}) {
  const manifestPath = options.manifestPath || 'plan-manifest.json';
  const diagnostics = [];
  const error = (code, file, message) => diagnostics.push({ code, path: file, message });

  const phases = new Map();
  for (const phase of manifest.phases || []) {
    if (phases.has(phase.phaseId)) error('DUPLICATE_PHASE', manifestPath, phase.phaseId);
    if (new Set(phase.dependsOn.map((dep) => dep.phaseId)).size !== phase.dependsOn.length) {
      error('DUPLICATE_DEPENDENCY', manifestPath, phase.phaseId);
    }
    phases.set(phase.phaseId, phase);
  }

  const ancestors = new Map();
  const visiting = new Set();
  const cyclePaths = [];

  function visit(id, currentPath = []) {
    if (visiting.has(id)) {
      const cycle = [...currentPath, id].join(' -> ');
      cyclePaths.push(cycle);
      error('CYCLE', manifestPath, `Cycle detected: ${cycle}`);
      return new Set();
    }
    if (ancestors.has(id)) return ancestors.get(id);
    visiting.add(id);
    const prior = new Set();
    const phase = phases.get(id);
    if (phase) {
      for (const dep of phase.dependsOn || []) {
        if (!phases.has(dep.phaseId)) {
          error('UNKNOWN_DEPENDENCY', manifestPath, `${id}: ${dep.phaseId}`);
          continue;
        }
        if (dep.phaseId === id) {
          error('SELF_DEPENDENCY', manifestPath, id);
          continue;
        }
        prior.add(dep.phaseId);
        for (const earlier of visit(dep.phaseId, [...currentPath, id])) {
          prior.add(earlier);
        }
      }
    }
    visiting.delete(id);
    ancestors.set(id, prior);
    return prior;
  }

  for (const id of phases.keys()) {
    visit(id);
  }

  // Check phase regression links
  const checkIds = new Set();
  for (const phase of manifest.phases || []) {
    for (const check of phase.checks || []) {
      if (checkIds.has(check.id)) error('DUPLICATE_CHECK', manifestPath, check.id);
      checkIds.add(check.id);
      const phaseAncestors = ancestors.get(phase.phaseId) || new Set();
      for (const earlier of check.regressionFor || []) {
        if (!phaseAncestors.has(earlier)) {
          error('REGRESSION_REFERENCE', manifestPath, `${check.id}: ${earlier} is not a predecessor of ${phase.phaseId}`);
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Validates a plan suite end-to-end: manifest, plan units, DAG, bidirectional tracing, and stage contracts.
 * @param {string} root
 * @param {string} suite
 * @returns {object}
 */
export function validatePlan(root, suite) {
  const diagnostics = [];
  const error = (code, file, message) => diagnostics.push({ code, path: file, message });
  const load = (file) => JSON.parse(fs.readFileSync(resolveRepoPath(root, file, { mustExist: true }), 'utf8'));
  const result = {
    suite,
    status: 'invalid',
    phaseCount: 0,
    activeUnits: 0,
    diagnostics,
    manifest: null,
    units: [],
  };

  try {
    resolveRepoPath(root, suite, { mustExist: true });
    const manifestPath = `${suite}/plan-manifest.json`;
    if (!fs.existsSync(resolveRepoPath(root, manifestPath))) {
      result.status = 'legacy/unverified';
      return result;
    }
    const manifest = load(manifestPath);
    result.manifest = manifest;
    for (const message of validateSchema(manifest, 'plan-manifest/v1', manifestPath)) {
      error('SCHEMA', manifestPath, message);
    }
    if (diagnostics.length) return result;

    const unitDir = `${suite}/plan-units`;
    const hasUnitDir = fs.existsSync(resolveRepoPath(root, unitDir, { mustExist: false }));
    const unitFiles = hasUnitDir
      ? walk(root, unitDir, (file) => file.endsWith('.json'))
      : [];
    for (const file of unitFiles) {
      const record = load(file);
      const messages = validateSchema(record, 'plan-unit/v1', file);
      messages.forEach((message) => error('UNIT_SCHEMA', file, message));
      result.units.push({ path: file, record });
    }
    if (diagnostics.length) return result;

    const units = new Map();
    const phases = new Map();
    const membership = new Map();
    const checkIds = new Set();

    for (const { path: file, record } of result.units) {
      if (units.has(record.unitId)) error('DUPLICATE_UNIT', file, record.unitId);
      units.set(record.unitId, record);

      const criteriaIds = (record.acceptanceCriteria || []).map((item) => item.id);
      const declaredAcceptanceIds = record.acceptanceIds || criteriaIds;
      if (!sameSet(declaredAcceptanceIds, criteriaIds)) {
        error(
          'ACCEPTANCE_SET',
          file,
          `${record.unitId}: acceptanceIds and criteria IDs must be identical unique sets`
        );
      }
      for (const dependency of record.dependsOn || record.dependencies || []) {
        if (!result.units.some((u) => u.record.unitId === dependency)) {
          error('UNIT_DEPENDENCY', file, `${record.unitId}: unknown ${dependency}`);
        }
      }
    }

    for (const phase of manifest.phases) {
      if (phases.has(phase.phaseId)) error('DUPLICATE_PHASE', manifestPath, phase.phaseId);
      if (new Set(phase.dependsOn.map((dep) => dep.phaseId)).size !== phase.dependsOn.length) {
        error('DUPLICATE_DEPENDENCY', manifestPath, phase.phaseId);
      }
      phases.set(phase.phaseId, phase);
    }

    const ancestors = new Map();
    const visiting = new Set();
    function visit(id, currentPath = []) {
      if (visiting.has(id)) {
        error('CYCLE', manifestPath, id);
        return new Set();
      }
      if (ancestors.has(id)) return ancestors.get(id);
      visiting.add(id);
      const prior = new Set();
      for (const dep of phases.get(id).dependsOn) {
        if (!phases.has(dep.phaseId)) {
          error('UNKNOWN_DEPENDENCY', manifestPath, `${id}: ${dep.phaseId}`);
          continue;
        }
        if (dep.phaseId === id) {
          error('SELF_DEPENDENCY', manifestPath, id);
          continue;
        }
        prior.add(dep.phaseId);
        for (const earlier of visit(dep.phaseId, [...currentPath, id])) {
          prior.add(earlier);
        }
      }
      visiting.delete(id);
      ancestors.set(id, prior);
      return prior;
    }
    for (const id of phases.keys()) visit(id);

    for (const phase of manifest.phases) {
      const contractPath = phase.contract;
      const accepted = new Set();
      for (const id of phase.unitIds) {
        if (membership.has(id)) error('MULTIPLE_PHASES', manifestPath, id);
        membership.set(id, phase.phaseId);
        if (hasUnitDir && unitFiles.length > 0) {
          const unit = units.get(id);
          const isRetired = unit?.lifecycle === 'retired' || unit?.status === 'retired';
          if (!unit || isRetired) {
            error('UNKNOWN_ACTIVE_UNIT', manifestPath, id);
            continue;
          }
          const unitStage = unit.stage || unit.phaseId;
          if (unitStage && unitStage !== contractPath && !contractPath.includes(unitStage)) {
            error('STAGE_MISMATCH', contractPath, `${id}: ${unitStage}`);
          }
          (unit.acceptanceIds || (unit.acceptanceCriteria || []).map((a) => a.id)).forEach((accId) =>
            accepted.add(accId)
          );
        }
      }

      if (!hasUnitDir || unitFiles.length === 0) {
        for (const check of phase.checks) {
          for (const accId of check.acceptanceIds || []) {
            accepted.add(accId);
          }
        }
      }

      const covered = new Set();
      for (const check of phase.checks) {
        if (checkIds.has(check.id)) error('DUPLICATE_CHECK', manifestPath, check.id);
        checkIds.add(check.id);
        for (const id of check.acceptanceIds) {
          covered.add(id);
          if (!accepted.has(id)) error('ORPHAN_CHECK', manifestPath, `${check.id}: ${id}`);
        }
        for (const earlier of check.regressionFor || []) {
          if (!ancestors.get(phase.phaseId)?.has(earlier)) {
            error('REGRESSION_REFERENCE', manifestPath, `${check.id}: ${earlier} is not a predecessor`);
          }
        }
        for (const source of check.sourcePaths) resolveRepoPath(root, source);
        if (check.runner) resolveRepoPath(root, check.runner.cwd);
      }

      for (const id of accepted) {
        if (!covered.has(id)) error('ORPHAN_ACCEPTANCE', manifestPath, `${phase.phaseId}: ${id}`);
      }
      for (const source of phase.sourcePaths) resolveRepoPath(root, source);

      const contractFull = resolveRepoPath(root, contractPath, { mustExist: true });
      const rawContract = fs.readFileSync(contractFull, 'utf8');
      const stage = parseStage(rawContract);
      if (stage.error || (stage.metadata.type !== 'ICM Stage' && stage.metadata.type !== 'plan')) {
        error('STAGE', contractPath, stage.error || 'Expected ICM Stage or plan');
      }

      // Check ICM stage headings if structured as ICM Stage
      if (stage.metadata.type === 'ICM Stage') {
        const headings = stage.sections.filter((s) => s.level <= 2).map((s) => s.title.replace(/^Stage\s+/i, '').toLowerCase());
        const required = ['inputs', 'process', 'outputs', 'verification', 'durable memory', 'human checkpoint', 'blocked conditions', 'failure conditions'];
        if (!headings.includes('bounded loading & terminal state') && !(headings.includes('bounded loading') && headings.includes('terminal state'))) {
          error('STAGE_SECTION', contractPath, 'Missing bounded loading and terminal state');
        }
        for (const name of required) {
          if (headings.filter((h) => h === name).length !== 1) {
            error('STAGE_SECTION', contractPath, `Expected exactly one ${name}`);
          }
        }
        const processIds = (stage.tables.process || []).flatMap((row) => unitIds(row.Unit || ''));
        const traces = [...new Set((stage.tables.outputs || []).flatMap((row) => unitIds(row.Traces || '')))];
        const activeProcess = processIds.filter((id) => units.get(id)?.lifecycle !== 'retired');
        const activeTraces = traces.filter((id) => units.get(id)?.lifecycle !== 'retired');
        if (!sameSet(activeProcess, phase.unitIds)) {
          error('PROCESS_IDS', contractPath, `Process IDs ${activeProcess} differ from ${phase.unitIds}`);
        }
        if (!sameSet(activeTraces, phase.unitIds)) {
          error('OUTPUT_TRACES', contractPath, `Output traces ${activeTraces} differ from ${phase.unitIds}`);
        }
        const specs = [...stage.body.matchAll(/^#{3,4}\s+Unit\s+(U[1-9][0-9]*[a-z]?)\s*:/gm)].map((m) => m[1]);
        for (const id of specs) {
          if (!phase.unitIds.includes(id) && units.get(id)?.lifecycle !== 'retired') {
            error('UNKNOWN_UNIT_SPEC', contractPath, id);
          }
        }
        for (const id of phase.unitIds) {
          if (specs.filter((value) => value === id).length !== 1) {
            error('UNIT_SPEC', contractPath, `${id}: expected exactly one detailed specification`);
          }
        }
        for (const message of validateDetailedUnits(stage.body, phase.unitIds)) {
          error('UNIT_SPEC_DEPTH', contractPath, message);
        }
        if (!(stage.tables.inputs || []).length || stage.tables.inputs.length > 8 || !(stage.tables.outputs || []).length) {
          error('STAGE_TABLE', contractPath, 'Expected bounded Inputs and Outputs tables');
        }
        for (const row of stage.tables.inputs || []) {
          const value = row.Path;
          if (!value) {
            error('INPUT_PATH', contractPath, 'Input row requires a Path');
            continue;
          }
          if (/\(upstream\)/i.test(value)) continue;
          const targets = [...value.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
          for (const target of targets.length ? targets : [value]) {
            resolveRepoPath(root, target.replace(/\/$/, ''), { mustExist: true });
          }
        }
        for (const row of stage.tables.outputs || []) {
          if (!row.Destination || !row.Traces) {
            error('OUTPUT_ROW', contractPath, 'Every output requires a destination and unit traces');
          }
        }
        const verification = stage.sections.find((s) => s.title.toLowerCase() === 'verification')?.content || '';
        if (!/level\s+[1-5]/i.test(verification) || !/`[^`]+`/.test(verification)) {
          error('STAGE_VERIFICATION', contractPath, 'Verification requires a level and concrete command');
        }
      }
    }

    if (hasUnitDir && unitFiles.length > 0) {
      for (const [id, unit] of units) {
        const isRetired = unit.lifecycle === 'retired' || unit.status === 'retired';
        if (!isRetired && !membership.has(id)) {
          error('ORPHAN_UNIT', manifestPath, id);
        }
      }

      for (const [id, unit] of units) {
        const isRetired = unit.lifecycle === 'retired' || unit.status === 'retired';
        if (isRetired) continue;
        for (const dependency of unit.dependsOn || unit.dependencies || []) {
          const ownPhase = membership.get(id);
          const dependencyPhase = membership.get(dependency);
          const depUnit = units.get(dependency);
          const depRetired = depUnit?.lifecycle === 'retired' || depUnit?.status === 'retired';
          if (!dependencyPhase || depRetired) {
            error('RETIRED_DEPENDENCY', manifestPath, `${id}: dependency ${dependency} has no active phase`);
          } else if (ownPhase !== dependencyPhase && !ancestors.get(ownPhase)?.has(dependencyPhase)) {
            error('PHASE_UNIT_DEPENDENCY', manifestPath, `${id}: ${dependencyPhase} must be a declared predecessor of ${ownPhase}`);
          }
        }
      }

      const unitVisit = (id, stack = new Set(), done = new Set()) => {
        if (stack.has(id)) {
          error('UNIT_CYCLE', manifestPath, id);
          return;
        }
        if (done.has(id) || !units.has(id)) return;
        stack.add(id);
        const deps = units.get(id).dependsOn || units.get(id).dependencies || [];
        deps.forEach((dep) => unitVisit(dep, stack, done));
        stack.delete(id);
        done.add(id);
      };
      for (const id of units.keys()) unitVisit(id);
    }

    result.phaseCount = phases.size;
    result.activeUnits = (hasUnitDir && unitFiles.length > 0)
      ? [...units.values()].filter((u) => u.lifecycle !== 'retired' && u.status !== 'retired').length
      : [...manifest.phases].reduce((sum, p) => sum + (p.unitIds?.length || 0), 0);
    result.status = diagnostics.length ? 'invalid' : 'valid';
  } catch (failure) {
    error('INPUT', suite, failure.message);
  }

  return result;
}
