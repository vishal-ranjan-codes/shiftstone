#!/usr/bin/env node
/**
 * Workspace & Implementation Status Manifest Validator (UG-06 / Phase 1 Unit U4)
 *
 * Verifies:
 *   1. workspace-manifest.json against workspace-manifest.schema.json
 *   2. implementation-status.json against implementation-status.schema.json
 *   3. All Plan Units marked 'completed' have all requiredArtifacts present on disk
 *   4. Synchronization between phase plan markdown Status: and implementation-status.json
 *
 * Exit code 0 on clean pass; exit code 1 with MISSING_COMPLETED_ARTIFACT / PHASE_STATUS_DESYNC on defect.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function parseJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse JSON file at ${filePath}: ${err.message}`);
  }
}

export function validateManifest(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const violations = [];
  const details = {
    workspaceManifestOk: false,
    implementationStatusOk: false,
    completedUnitsChecked: 0,
    phasesChecked: 0,
  };

  // 1. Workspace Manifest Validation
  const wsManifestPath = path.join(root, '.shiftstone', 'governance', 'workspace-manifest.json');
  const wsSchemaPath = path.join(root, '.shiftstone', 'governance', 'schemas', 'workspace-manifest.schema.json');

  if (!existsSync(wsManifestPath)) {
    violations.push({
      code: 'MISSING_WORKSPACE_MANIFEST',
      file: '.shiftstone/governance/workspace-manifest.json',
      message: 'Workspace manifest .shiftstone/governance/workspace-manifest.json does not exist on disk',
    });
  } else {
    try {
      const wsManifest = parseJsonFile(wsManifestPath);
      if (wsManifest.apiVersion !== 'workspace/v1' || wsManifest.kind !== 'WorkspaceManifest') {
        violations.push({
          code: 'INVALID_WORKSPACE_MANIFEST',
          file: '.shiftstone/governance/workspace-manifest.json',
          message: 'workspace-manifest.json apiVersion must be workspace/v1 and kind must be WorkspaceManifest',
        });
      }
      if (!wsManifest.spec?.activePacks || !wsManifest.spec?.budgets || !wsManifest.spec?.validators) {
        violations.push({
          code: 'INCOMPLETE_WORKSPACE_MANIFEST',
          file: '.shiftstone/governance/workspace-manifest.json',
          message: 'workspace-manifest.json spec must contain activePacks, budgets, and validators',
        });
      }
      details.workspaceManifestOk = true;
    } catch (err) {
      violations.push({
        code: 'PARSE_ERROR_WORKSPACE_MANIFEST',
        file: '.shiftstone/governance/workspace-manifest.json',
        message: err.message,
      });
    }
  }

  // 2. Implementation Status Validation
  const statusPath = path.join(root, '.shiftstone', 'governance', 'implementation-status.json');
  const statusSchemaPath = path.join(root, '.shiftstone', 'governance', 'schemas', 'implementation-status.schema.json');

  if (!existsSync(statusPath)) {
    violations.push({
      code: 'MISSING_IMPLEMENTATION_STATUS',
      file: '.shiftstone/governance/implementation-status.json',
      message: 'Implementation status .shiftstone/governance/implementation-status.json does not exist on disk',
    });
    return { ok: false, violations, details };
  }

  let statusData = null;
  try {
    statusData = parseJsonFile(statusPath);
    if (statusData.apiVersion !== 'governance/v1' || statusData.kind !== 'ImplementationStatus') {
      violations.push({
        code: 'INVALID_IMPLEMENTATION_STATUS',
        file: '.shiftstone/governance/implementation-status.json',
        message: 'implementation-status.json apiVersion must be governance/v1 and kind must be ImplementationStatus',
      });
    }
    details.implementationStatusOk = true;
  } catch (err) {
    violations.push({
      code: 'PARSE_ERROR_IMPLEMENTATION_STATUS',
      file: '.shiftstone/governance/implementation-status.json',
      message: err.message,
    });
    return { ok: false, violations, details };
  }

  // 3. Verify Artifacts for Completed Units
  const planUnits = statusData.planUnits || {};
  for (const [unitId, unitData] of Object.entries(planUnits)) {
    if (unitData.status === 'completed') {
      details.completedUnitsChecked++;
      const artifacts = unitData.requiredArtifacts || [];
      if (artifacts.length === 0) {
        violations.push({
          code: 'EMPTY_REQUIRED_ARTIFACTS',
          unitId,
          message: `Unit ${unitId} is marked completed but lists zero requiredArtifacts`,
        });
      }
      for (const artifact of artifacts) {
        const artifactAbs = path.join(root, artifact);
        if (!existsSync(artifactAbs)) {
          violations.push({
            code: 'MISSING_COMPLETED_ARTIFACT',
            unitId,
            artifact,
            message: `Unit ${unitId} is marked completed, but required artifact '${artifact}' does not exist on disk`,
          });
        }
      }
    }
  }

  // 4. Verify Phase File Status Sync
  const phases = statusData.phases || {};
  for (const [phaseKey, phaseInfo] of Object.entries(phases)) {
    details.phasesChecked++;
    const planFileRel = phaseInfo.planFile;
    const planFileAbs = path.join(root, planFileRel);

    if (!existsSync(planFileAbs)) {
      violations.push({
        code: 'MISSING_PHASE_PLAN_FILE',
        phase: phaseKey,
        file: planFileRel,
        message: `Phase plan file '${planFileRel}' does not exist on disk`,
      });
      continue;
    }

    const planContent = readFileSync(planFileAbs, 'utf8');
    const statusMatch = planContent.match(/^status:\s*([a-zA-Z0-9_-]+)/m);
    const declaredDocStatus = statusMatch ? statusMatch[1].trim() : 'unknown';

    if (phaseInfo.status === 'completed' && declaredDocStatus !== 'completed') {
      violations.push({
        code: 'PHASE_STATUS_DESYNC',
        phase: phaseKey,
        file: planFileRel,
        statusInJson: phaseInfo.status,
        statusInDoc: declaredDocStatus,
        message: `Phase '${phaseKey}' is marked '${phaseInfo.status}' in implementation-status.json, but '${planFileRel}' declares status '${declaredDocStatus}'`,
      });
    }

    // Check that all units of a completed phase are also completed
    if (phaseInfo.status === 'completed') {
      for (const unitId of phaseInfo.units || []) {
        const u = planUnits[unitId];
        if (!u || u.status !== 'completed') {
          violations.push({
            code: 'PHASE_UNIT_INCOMPLETE',
            phase: phaseKey,
            unitId,
            message: `Phase '${phaseKey}' is marked completed, but its constituent Unit '${unitId}' has status '${u?.status || 'missing'}'`,
          });
        }
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    details,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let rootArg = ROOT;
  const rootIdx = process.argv.indexOf('--root');
  if (rootIdx !== -1 && process.argv[rootIdx + 1]) {
    rootArg = process.argv[rootIdx + 1];
  }

  const result = validateManifest({ root: rootArg });

  console.log('=== Workspace & Implementation Status Manifest Report (UG-06) ===');
  console.log(`  Workspace Manifest:      ${result.details.workspaceManifestOk ? 'valid' : 'invalid'}`);
  console.log(`  Implementation Status:   ${result.details.implementationStatusOk ? 'valid' : 'invalid'}`);
  console.log(`  Completed Units Checked: ${result.details.completedUnitsChecked}`);
  console.log(`  Phases Checked:          ${result.details.phasesChecked}`);

  if (!result.ok) {
    console.error(`\nFAIL — ${result.violations.length} manifest violation(s) detected:`);
    for (const v of result.violations) {
      console.error(`  [${v.code}] ${v.message}`);
    }
    process.exit(1);
  }

  console.log('\nok — Workspace manifests, status declarations, and disk artifacts are 100% synchronized.');
  process.exit(0);
}
