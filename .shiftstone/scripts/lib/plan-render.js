import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPath } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { projectPhase, renderStatusTable } from './plan-state.js';
import { loadHandoffs } from './plan-resume.js';

/**
 * Updates or verifies managed status table span in suite README.md.
 */
export function renderStatus(root, suite, options = {}) {
  const plan = validatePlan(root, suite);
  if (plan.status !== 'valid') {
    return { error: 'Invalid plan', diagnostics: plan.diagnostics, exitCode: 1 };
  }
  const readmePath = `${suite}/README.md`;
  const fullReadme = resolveRepoPath(root, readmePath, { mustExist: false });
  if (!fs.existsSync(fullReadme)) {
    return { error: `README not found: ${readmePath}`, exitCode: 1 };
  }
  const readme = fs.readFileSync(fullReadme, 'utf8');
  const starts = readme.match(/<!-- plan-status:start -->/g) || [];
  const ends = readme.match(/<!-- plan-status:end -->/g) || [];
  const match = readme.match(/<!-- plan-status:start -->([\s\S]*?)<!-- plan-status:end -->/);
  if (starts.length !== 1 || ends.length !== 1 || !match) {
    return {
      error: 'Malformed or missing generated status markers (<!-- plan-status:start --> / <!-- plan-status:end -->)',
      exitCode: 1,
    };
  }

  const { handoffs } = loadHandoffs(root, plan);
  const allIssues = [...handoffs.values()].flatMap((h) => h.issues || []);
  const phases = plan.manifest.phases.map((phase) => {
    return projectPhase(root, plan, phase, handoffs.get(phase.phaseId) || null, { ...options, issues: allIssues });
  });
  const table = renderStatusTable(phases);
  const currentContent = match[1].trim().replace(/\r\n/g, '\n');
  const expectedContent = table.trim().replace(/\r\n/g, '\n');

  if (options.checkOnly) {
    const matches = currentContent === expectedContent;
    return {
      matches,
      current: currentContent,
      expected: expectedContent,
      exitCode: matches ? 0 : 1,
    };
  }

  if (options.write) {
    const statePath = `${suite}/output/state.json`;
    if (options.expectedRevision !== undefined && options.expectedRevision !== null) {
      let currentRevision = 0;
      if (fs.existsSync(resolveRepoPath(root, statePath, { mustExist: false }))) {
        try {
          const state = JSON.parse(fs.readFileSync(resolveRepoPath(root, statePath), 'utf8'));
          currentRevision = state.revision || 0;
        } catch (_) {}
      }
      if (Number(options.expectedRevision) !== currentRevision) {
        return {
          error: `CAS mismatch: expected revision ${options.expectedRevision}, but current revision is ${currentRevision}`,
          exitCode: 3,
        };
      }
    }
    const newReadme = readme.replace(
      /<!-- plan-status:start -->[\s\S]*?<!-- plan-status:end -->/,
      `<!-- plan-status:start -->\n${table}\n<!-- plan-status:end -->`
    );
    const tempFile = `${fullReadme}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, newReadme, 'utf8');
    fs.renameSync(tempFile, fullReadme);
    return { success: true, table, exitCode: 0 };
  }

  return { table, matches: currentContent === expectedContent, exitCode: 0 };
}
