import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPath, walk, validateSchema } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { snapshot, sha256, digest } from './plan-source.js';
import { projectPhase, renderStatusTable, phaseScopes, phaseEnvironmentKeys } from './plan-state.js';
import { withLock } from './plan-storage.js';

/**
 * Discovers and plans migration/adoption of an existing plan suite to the verifiable lifecycle.
 */
export function planAdoption(root, suite, options = {}) {
  const normSuite = suite.replace(/\\/g, '/').replace(/\/$/, '');
  const manifestPath = `${normSuite}/plan-manifest.json`;
  const statePath = `${normSuite}/output/state.json`;
  const fullManifest = resolveRepoPath(root, manifestPath, { mustExist: false });

  if (fs.existsSync(fullManifest)) {
    return {
      success: true,
      alreadyAdopted: true,
      suite: normSuite,
      manifestPath,
      statePath,
      exitCode: 0,
    };
  }

  const conflicts = [];
  const addedFiles = [];
  const modifiedFiles = [];

  const readmePath = `${normSuite}/README.md`;
  const fullReadme = resolveRepoPath(root, readmePath, { mustExist: false });
  if (!fs.existsSync(fullReadme)) {
    conflicts.push(`Missing README.md in plan suite ${normSuite}`);
  }

  // Scan phase contract files in suite
  const allFiles = walk(root, normSuite, (file) => file.endsWith('.md') && !file.endsWith('README.md'));
  const phaseFiles = allFiles
    .filter((f) => /phase-\d+/i.test(f) || /^\d+[-_]phase/i.test(path.basename(f)))
    .sort();

  if (phaseFiles.length === 0) {
    conflicts.push(`No recognizable phase contract markdown files found in ${normSuite}`);
  }

  // Scan unit files
  const unitDir = `${normSuite}/plan-units`;
  const unitFiles = fs.existsSync(resolveRepoPath(root, unitDir, { mustExist: false }))
    ? walk(root, unitDir, (file) => file.endsWith('.json')).sort()
    : [];
  const suiteId = path.basename(normSuite);

  const phases = phaseFiles.map((contractFile, idx) => {
    const phaseNum = idx + 1;
    const phaseId = `P${phaseNum}`;
    const pUnitFiles = unitFiles.filter((u) => {
      try {
        const uRec = JSON.parse(fs.readFileSync(resolveRepoPath(root, u), 'utf8'));
        return uRec.phaseId === `phase-${phaseNum}` || uRec.phaseId === phaseId;
      } catch (_) {
        return false;
      }
    });

    const unitIds = pUnitFiles.length
      ? pUnitFiles.map((u) => path.basename(u, '.json'))
      : [`U${phaseNum}`];

    return {
      phaseId,
      contract: contractFile,
      unitIds,
      dependsOn:
        phaseNum > 1
          ? [
              {
                phaseId: `P${phaseNum - 1}`,
                requires: 'complete',
                reason: `Phase ${phaseNum} builds upon Phase ${phaseNum - 1}.`,
              },
            ]
          : [],
      sourcePaths: [normSuite],
      checks: [
        {
          id: `p${phaseNum}-verification`,
          acceptanceIds: [`acc-p${phaseNum}-baseline`],
          level: 1,
          kind: 'automated',
          required: true,
          regressionFor: phaseNum > 1 ? [`P${phaseNum - 1}`] : [],
          sourcePaths: [normSuite],
          environmentKeys: ['node-version'],
          runner: {
            executable: 'node',
            args: ['--version'],
            cwd: '.',
          },
        },
      ],
      requiredReview: true,
      humanApprovalRequired: false,
      recovery: {
        retry: 'Inspect failure and repair scoped files.',
        rollback: 'Revert uncommitted modifications.',
      },
    };
  });

  const manifest = {
    schema: 'plan-manifest/v1',
    suiteId,
    definitionRevision: 1,
    phases,
  };

  const manifestErrors = validateSchema(manifest, 'plan-manifest/v1');
  if (manifestErrors.length) {
    conflicts.push(`Generated manifest schema errors: ${manifestErrors.join('; ')}`);
  }

  if (!options.write) {
    return {
      suite: normSuite,
      eligible: conflicts.length === 0,
      conflicts,
      proposedManifest: manifest,
      addedFiles: [manifestPath, statePath],
      modifiedFiles: [readmePath],
      exitCode: conflicts.length === 0 ? 0 : 1,
    };
  }

  if (conflicts.length > 0) {
    const err = new Error(`Cannot adopt suite due to conflicts: ${conflicts.join('; ')}`);
    err.exitCode = 1;
    throw err;
  }

  return withLock(root, normSuite, () => {
    // 1. Write manifest
    fs.mkdirSync(path.dirname(fullManifest), { recursive: true });
    fs.writeFileSync(fullManifest, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    addedFiles.push(manifestPath);

    // 2. Write initial state
    const projectedPhases = manifest.phases.map((p) => ({
      phaseId: p.phaseId,
      selectedHandoffRef: null,
      implementation: 'planned',
      verification: 'not-run',
      review: 'not-requested',
      acceptance: 'open',
    }));

    const definitionSha256 = digest(
      projectedPhases
        .map((p) => ({ phaseId: p.phaseId, implementation: p.implementation }))
        .sort((a, b) => a.phaseId.localeCompare(b.phaseId))
    );

    const state = {
      schema: 'plan-state/v1',
      suiteId,
      revision: 0,
      definitionSha256,
      updatedAt: new Date().toISOString(),
      phases: projectedPhases,
    };

    const fullStatePath = resolveRepoPath(root, statePath, { mustExist: false });
    fs.mkdirSync(path.dirname(fullStatePath), { recursive: true });
    fs.writeFileSync(fullStatePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    addedFiles.push(statePath);

    // 3. Update README managed status span
    if (fs.existsSync(fullReadme)) {
      const readmeContent = fs.readFileSync(fullReadme, 'utf8');
      const table = renderStatusTable(projectedPhases);
      let updatedReadme;
      if (readmeContent.includes('<!-- plan-status:start -->')) {
        updatedReadme = readmeContent.replace(
          /<!-- plan-status:start -->[\s\S]*?<!-- plan-status:end -->/,
          `<!-- plan-status:start -->\n${table}\n<!-- plan-status:end -->`
        );
      } else {
        updatedReadme = readmeContent.trimEnd() + `\n\n<!-- plan-status:start -->\n${table}\n<!-- plan-status:end -->\n`;
      }
      fs.writeFileSync(fullReadme, updatedReadme, 'utf8');
      modifiedFiles.push(readmePath);
    }

    return {
      success: true,
      alreadyAdopted: false,
      suite: normSuite,
      manifestPath,
      statePath,
      addedFiles,
      modifiedFiles,
      exitCode: 0,
    };
  });
}

/**
 * CLI wrapper for adoption proposal or execution.
 */
export function adoptPlan(root, suite, options = {}) {
  try {
    const proposal = planAdoption(root, suite, options);
    if (!proposal.eligible && proposal.conflicts?.length > 0) {
      return {
        error: `Cannot adopt suite due to conflicts: ${proposal.conflicts.length} conflict(s) found`,
        exitCode: 1,
        conflicts: proposal.conflicts,
      };
    }
    return proposal;
  } catch (err) {
    return {
      error: err.message,
      exitCode: err.exitCode || 1,
      conflicts: [err.message],
    };
  }
}
