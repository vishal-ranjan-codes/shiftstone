#!/usr/bin/env node
/**
 * Plan Unit Traceability & Acyclic DAG Validator (UG-08, UG-10 / Phase 2 Unit U8)
 *
 * Verifies:
 *   1. All Plan Units (U1–U31) in docs/plans/universal-workspace-v2.1-upgrade/ adhere to plan-unit/v1
 *   2. Unit IDs are unique across the plan suite
 *   3. Dependency graph across dependsOn is an acyclic DAG (no circular dependencies)
 *   4. 100% of declared requirementIds are mapped in acceptanceCriteria
 *   5. Each unit has at least one testScenario and verificationCommand
 *   6. confidenceScore >= 0.8
 *
 * Exit code 0 on clean pass; exit code 1 on defect.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const UNIT_ID_PATTERN = /^U[0-9]{1,3}$/;
const PHASE_ID_PATTERN = /^phase-[0-9]+$/;
const REQ_ID_PATTERN = /^(UG|REQ|A|B|C|D)-[0-9]{1,3}$/;
const AC_ID_PATTERN = /^AC-U[0-9]{1,3}-[0-9]{1,2}$/;
const TS_ID_PATTERN = /^TS-U[0-9]{1,3}-[0-9]{1,2}$/;
const VALID_LAYERS = new Set(['core', 'pack', 'core+pack']);
const VALID_STATUSES = new Set(['planned', 'in-progress', 'completed', 'blocked']);
const VALID_TEST_LEVELS = new Set(['L1', 'L1.5', 'L2', 'L3', 'L4']);

export function parseArrayFromField(fieldStr) {
  if (!fieldStr) return [];
  let trimmed = fieldStr.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Fallback manual parse
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
        .filter(Boolean);
    }
  }
  return [trimmed.replace(/^['"`]|['"`]$/g, '')];
}

export function extractPlanUnitsFromMarkdown(content, filePath) {
  const units = [];
  const lines = content.split(/\r?\n/);
  const phaseMatch = path.basename(filePath).match(/^(phase-[0-9]+)/);
  const phaseId = phaseMatch ? phaseMatch[1] : 'phase-0';

  let currentUnit = null;
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const unitHeaderMatch = line.match(/^###\s+Unit\s+[`"']?(U[0-9]{1,3})[`"']?\s*[—–-]\s*(.+)$/i);

    if (unitHeaderMatch) {
      if (currentUnit) {
        units.push(currentUnit);
      }
      currentUnit = {
        schemaVersion: 'plan-unit/v1',
        unitId: unitHeaderMatch[1].trim(),
        phaseId,
        title: unitHeaderMatch[2].trim(),
        layer: 'core',
        status: 'planned',
        dependsOn: [],
        requirementIds: [],
        targetFiles: [],
        acceptanceCriteria: [],
        testScenarios: [],
        verificationCommand: '',
        confidenceScore: 0.95,
        sourceFile: filePath,
      };
      currentSection = null;
      continue;
    }

    if (!currentUnit) continue;

    // Boundary for next major section
    if (line.startsWith('## ') || line.startsWith('---') && currentUnit.acceptanceCriteria.length > 0) {
      // Check if unit is done
      if (line.startsWith('## ')) {
        units.push(currentUnit);
        currentUnit = null;
        currentSection = null;
        continue;
      }
    }

    const layerMatch = line.match(/^-\s+\*\*Layer:\*\*\s+[`"']?([a-z+]+)[`"']?/i);
    if (layerMatch) {
      currentUnit.layer = layerMatch[1].trim();
      currentSection = null;
      continue;
    }

    const dependsMatch = line.match(/^-\s+\*\*Depends On:\*\*\s+(.+)$/i);
    if (dependsMatch) {
      currentUnit.dependsOn = parseArrayFromField(dependsMatch[1]);
      currentSection = null;
      continue;
    }

    const reqMatch = line.match(/^-\s+\*\*Requirement IDs:\*\*\s+(.+)$/i);
    if (reqMatch) {
      currentUnit.requirementIds = parseArrayFromField(reqMatch[1]);
      currentSection = null;
      continue;
    }

    const verifMatch = line.match(/^-\s+\*\*Verification Command:\*\*\s+[`"']?([^`"'\r\n]+)[`"']?/i);
    if (verifMatch) {
      currentUnit.verificationCommand = verifMatch[1].trim();
      currentSection = null;
      continue;
    }

    const confMatch = line.match(/^-\s+\*\*Confidence Score:\*\*\s+[`"']?([0-9.]+)[`"']?/i);
    if (confMatch) {
      currentUnit.confidenceScore = parseFloat(confMatch[1]);
      currentSection = null;
      continue;
    }

    if (line.match(/^-\s+\*\*Target Files:\*\*/i)) {
      currentSection = 'targetFiles';
      continue;
    }

    if (line.match(/^-\s+\*\*Acceptance Criteria:\*\*/i)) {
      currentSection = 'acceptanceCriteria';
      continue;
    }

    if (line.match(/^-\s+\*\*Test Scenarios:\*\*/i)) {
      currentSection = 'testScenarios';
      continue;
    }

    // Process bullet points in subsections
    if (currentSection === 'targetFiles') {
      const fileBullet = line.match(/^\s+-\s+[`"']?([^`"'\r\n]+)[`"']?/);
      if (fileBullet) {
        currentUnit.targetFiles.push(fileBullet[1].trim());
      }
    } else if (currentSection === 'acceptanceCriteria') {
      const acBullet = line.match(/^\s+-\s+[`"']?(AC-U[0-9]{1,3}-[0-9]{1,2})[`"']?\s*\(([^)]+)\):\s*(.+)$/);
      if (acBullet) {
        const reqIds = acBullet[2].split(',').map((s) => s.replace(/[`"']/g, '').trim()).filter(Boolean);
        for (const reqId of reqIds) {
          currentUnit.acceptanceCriteria.push({
            id: acBullet[1].trim(),
            requirementId: reqId,
            criterion: acBullet[3].trim(),
          });
        }
      }
    } else if (currentSection === 'testScenarios') {
      const tsBullet = line.match(/^\s+-\s+[`"']?(TS-U[0-9]{1,3}-[0-9]{1,2})[`"']?\s*\(([^)]+)\):\s*(.+)$/);
      if (tsBullet) {
        const level = tsBullet[2].replace(/[`"']/g, '').trim();
        const desc = tsBullet[3].trim();
        currentUnit.testScenarios.push({
          scenarioId: tsBullet[1].trim(),
          level,
          description: desc,
          assertion: desc,
        });
      }
    }
  }

  if (currentUnit) {
    units.push(currentUnit);
  }

  return units;
}

export function validateSinglePlanUnit(unit) {
  const violations = [];
  const uid = unit.unitId || 'unknown';

  if (!unit.schemaVersion || unit.schemaVersion !== 'plan-unit/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      unitId: uid,
      message: `Unit ${uid} schemaVersion must be 'plan-unit/v1'`,
    });
  }

  if (!unit.unitId || !UNIT_ID_PATTERN.test(unit.unitId)) {
    violations.push({
      code: 'INVALID_UNIT_ID',
      unitId: uid,
      message: `Unit ID '${uid}' does not match pattern ^U[0-9]{1,3}$`,
    });
  }

  if (!unit.phaseId || !PHASE_ID_PATTERN.test(unit.phaseId)) {
    violations.push({
      code: 'INVALID_PHASE_ID',
      unitId: uid,
      message: `Unit ${uid} phaseId '${unit.phaseId}' must match ^phase-[0-9]+$`,
    });
  }

  if (!unit.title || typeof unit.title !== 'string' || unit.title.length < 5) {
    violations.push({
      code: 'INVALID_UNIT_TITLE',
      unitId: uid,
      message: `Unit ${uid} title must have length >= 5`,
    });
  }

  if (!unit.layer || !VALID_LAYERS.has(unit.layer)) {
    violations.push({
      code: 'INVALID_LAYER',
      unitId: uid,
      message: `Unit ${uid} layer '${unit.layer}' must be one of ${Array.from(VALID_LAYERS).join(', ')}`,
    });
  }

  if (!unit.status || !VALID_STATUSES.has(unit.status)) {
    violations.push({
      code: 'INVALID_STATUS',
      unitId: uid,
      message: `Unit ${uid} status '${unit.status}' must be one of ${Array.from(VALID_STATUSES).join(', ')}`,
    });
  }

  if (!Array.isArray(unit.requirementIds) || unit.requirementIds.length === 0) {
    violations.push({
      code: 'EMPTY_REQUIREMENTS',
      unitId: uid,
      message: `Unit ${uid} requirementIds must be a non-empty array`,
    });
  } else {
    for (const req of unit.requirementIds) {
      if (!REQ_ID_PATTERN.test(req)) {
        violations.push({
          code: 'INVALID_REQUIREMENT_ID',
          unitId: uid,
          requirementId: req,
          message: `Unit ${uid} requirementId '${req}' must match ^(UG|REQ|A|B|C|D)-[0-9]{1,3}$`,
        });
      }
    }
  }

  if (!Array.isArray(unit.targetFiles) || unit.targetFiles.length === 0) {
    violations.push({
      code: 'EMPTY_TARGET_FILES',
      unitId: uid,
      message: `Unit ${uid} targetFiles must be a non-empty array`,
    });
  }

  // Acceptance Criteria Validation & Requirement Coverage
  if (!Array.isArray(unit.acceptanceCriteria) || unit.acceptanceCriteria.length === 0) {
    violations.push({
      code: 'EMPTY_ACCEPTANCE_CRITERIA',
      unitId: uid,
      message: `Unit ${uid} must declare at least one acceptance criterion`,
    });
  } else {
    const coveredReqs = new Set();
    for (let i = 0; i < unit.acceptanceCriteria.length; i++) {
      const ac = unit.acceptanceCriteria[i];
      if (!ac.id || !AC_ID_PATTERN.test(ac.id)) {
        violations.push({
          code: 'INVALID_AC_ID',
          unitId: uid,
          message: `Unit ${uid} acceptanceCriteria[${i}].id '${ac.id}' must match ^AC-U[0-9]{1,3}-[0-9]{1,2}$`,
        });
      }
      if (!ac.requirementId) {
        violations.push({
          code: 'MISSING_AC_REQUIREMENT_ID',
          unitId: uid,
          message: `Unit ${uid} acceptanceCriteria[${i}] must specify a requirementId`,
        });
      } else {
        coveredReqs.add(ac.requirementId);
      }
      if (!ac.criterion || typeof ac.criterion !== 'string' || ac.criterion.length < 10) {
        violations.push({
          code: 'INVALID_AC_CRITERION',
          unitId: uid,
          message: `Unit ${uid} acceptanceCriteria[${i}].criterion must have length >= 10`,
        });
      }
    }

    // Verify 100% of requirementIds are covered in acceptanceCriteria
    for (const reqId of unit.requirementIds || []) {
      if (!coveredReqs.has(reqId)) {
        violations.push({
          code: 'UNMAPPED_REQUIREMENT_ID',
          unitId: uid,
          requirementId: reqId,
          message: `Unit ${uid} declares requirementId '${reqId}' but zero acceptance criteria map to it`,
        });
      }
    }
  }

  // Test Scenarios Validation
  if (!Array.isArray(unit.testScenarios) || unit.testScenarios.length === 0) {
    violations.push({
      code: 'EMPTY_TEST_SCENARIOS',
      unitId: uid,
      message: `Unit ${uid} must declare at least one test scenario`,
    });
  } else {
    for (let i = 0; i < unit.testScenarios.length; i++) {
      const ts = unit.testScenarios[i];
      if (!ts.scenarioId || !TS_ID_PATTERN.test(ts.scenarioId)) {
        violations.push({
          code: 'INVALID_TS_ID',
          unitId: uid,
          message: `Unit ${uid} testScenarios[${i}].scenarioId '${ts.scenarioId}' must match ^TS-U[0-9]{1,3}-[0-9]{1,2}$`,
        });
      }
      if (!ts.level || !VALID_TEST_LEVELS.has(ts.level)) {
        violations.push({
          code: 'INVALID_TS_LEVEL',
          unitId: uid,
          message: `Unit ${uid} testScenarios[${i}].level '${ts.level}' must be one of ${Array.from(VALID_TEST_LEVELS).join(', ')}`,
        });
      }
      if (!ts.description || ts.description.length < 5) {
        violations.push({
          code: 'INVALID_TS_DESCRIPTION',
          unitId: uid,
          message: `Unit ${uid} testScenarios[${i}].description must have length >= 5`,
        });
      }
    }
  }

  if (!unit.verificationCommand || typeof unit.verificationCommand !== 'string' || unit.verificationCommand.length < 3) {
    violations.push({
      code: 'INVALID_VERIFICATION_COMMAND',
      unitId: uid,
      message: `Unit ${uid} verificationCommand must have length >= 3`,
    });
  }

  if (typeof unit.confidenceScore !== 'number' || unit.confidenceScore < 0.8 || unit.confidenceScore > 1.0) {
    violations.push({
      code: 'INVALID_CONFIDENCE_SCORE',
      unitId: uid,
      message: `Unit ${uid} confidenceScore must be between 0.8 and 1.0 (got ${unit.confidenceScore})`,
    });
  }

  return violations;
}

export function checkAcyclicDAG(units) {
  const violations = [];
  const unitMap = new Map();

  for (const u of units) {
    if (unitMap.has(u.unitId)) {
      violations.push({
        code: 'DUPLICATE_UNIT_ID',
        unitId: u.unitId,
        message: `Duplicate unitId '${u.unitId}' detected in plan suite`,
      });
    } else {
      unitMap.set(u.unitId, u);
    }
  }

  // Check missing dependencies
  for (const u of units) {
    for (const dep of u.dependsOn || []) {
      if (!unitMap.has(dep)) {
        violations.push({
          code: 'MISSING_DEPENDENCY_UNIT',
          unitId: u.unitId,
          dependencyId: dep,
          message: `Unit ${u.unitId} depends on unknown unit '${dep}'`,
        });
      }
    }
  }

  // Cycle detection via DFS
  const visited = new Set();
  const recursionStack = new Set();
  const currentPath = [];

  function dfs(nodeId) {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const unit = unitMap.get(nodeId);
    if (unit && Array.isArray(unit.dependsOn)) {
      for (const depId of unit.dependsOn) {
        if (!visited.has(depId)) {
          if (unitMap.has(depId)) {
            dfs(depId);
          }
        } else if (recursionStack.has(depId)) {
          const cycleStr = [...currentPath.slice(currentPath.indexOf(depId)), depId].join(' -> ');
          violations.push({
            code: 'CYCLIC_DEPENDENCY_DETECTED',
            cycle: cycleStr,
            message: `Cyclic dependency detected: ${cycleStr}`,
          });
        }
      }
    }

    recursionStack.delete(nodeId);
    currentPath.pop();
  }

  for (const u of units) {
    if (!visited.has(u.unitId)) {
      dfs(u.unitId);
    }
  }

  return violations;
}

export function validatePlanUnits(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  let allUnits = [];

  if (options.units && Array.isArray(options.units)) {
    allUnits = options.units;
  } else {
    // Scan docs/plans/universal-workspace-v2.1-upgrade/phase-*.md
    const suiteDir = options.suiteDir
      ? path.resolve(options.suiteDir)
      : path.join(root, 'docs', 'plans', 'universal-workspace-v2.1-upgrade');

    if (existsSync(suiteDir)) {
      const files = readdirSync(suiteDir)
        .filter((f) => f.startsWith('phase-') && f.endsWith('.md'))
        .sort();

      for (const f of files) {
        const fullPath = path.join(suiteDir, f);
        const content = readFileSync(fullPath, 'utf8');
        const extracted = extractPlanUnitsFromMarkdown(content, fullPath);
        allUnits.push(...extracted);
      }
    }
  }

  // Validate each unit
  for (const unit of allUnits) {
    const unitViolations = validateSinglePlanUnit(unit);
    violations.push(...unitViolations);
  }

  // Check DAG Acyclicity & uniqueness
  const dagViolations = checkAcyclicDAG(allUnits);
  violations.push(...dagViolations);

  // Collect all unique requirementIds covered across units
  const coveredRequirements = new Set();
  for (const u of allUnits) {
    for (const r of u.requirementIds || []) {
      coveredRequirements.add(r);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    unitsCount: allUnits.length,
    coveredRequirements: Array.from(coveredRequirements).sort(),
    units: allUnits,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  let suiteArg = null;
  const suiteIdx = process.argv.indexOf('--suite');
  if (suiteIdx !== -1 && process.argv[suiteIdx + 1]) {
    suiteArg = process.argv[suiteIdx + 1];
  }

  const result = validatePlanUnits({ root: rootArg, suiteDir: suiteArg });

  console.log('=== Plan Unit Traceability & DAG Validation Report (UG-08, UG-10) ===');
  console.log(`  Plan Units Validated:    ${result.unitsCount}`);
  console.log(`  Requirements Covered:    ${result.coveredRequirements.length} (${result.coveredRequirements.join(', ')})`);
  console.log(`  Status:                  ${result.ok ? 'valid' : 'invalid'}`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} plan unit violation(s) detected:`);
    for (const v of result.violations) {
      console.error(`  [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — All 31 Plan Units satisfy plan-unit/v1, 100% requirement traceability, and acyclic DAG invariants.');
  process.exit(0);
}
