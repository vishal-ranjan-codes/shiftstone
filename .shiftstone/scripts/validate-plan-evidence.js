#!/usr/bin/env node
import fs from 'node:fs';
import { validatePlans } from './validate-plans.js';
import { validateSchema, resolveRepoPath } from './lib/plan-schema.js';
import { digest, readEvidence, sha256 } from './lib/plan-source.js';

export function validateSuiteEvidence(root, plan, options = {}) {
  const diagnostics = [...plan.diagnostics];
  const phases = [];
  const handoffs = new Map();
  const note = (code, file, message) => diagnostics.push({ code, path: file, message });

  if (plan.status !== 'valid') {
    return { suite: plan.suite, status: plan.status, phases, diagnostics };
  }

  const statePath = `${plan.suite}/output/state.json`;
  let state = null;
  try {
    const stateResolved = resolveRepoPath(root, statePath);
    if (fs.existsSync(stateResolved)) {
      state = JSON.parse(fs.readFileSync(stateResolved, 'utf8'));
      const schemaErrors = validateSchema(state, 'plan-state/v1', statePath);
      schemaErrors.forEach((msg) => note('STATE_SCHEMA', statePath, msg));
      if (diagnostics.length) return { suite: plan.suite, status: 'invalid', phases, diagnostics };

      if (state.suiteId !== plan.manifest.suiteId) {
        note('STATE_IDENTITY', statePath, 'State belongs to another suite');
      }

      for (const selected of state.phases || []) {
        if (!selected.selectedHandoffRef) continue;
        let ref = selected.selectedHandoffRef;
        let expectedAttempt = null;
        const visited = new Set();
        for (let depth = 0; ref && depth < 1000; depth++) {
          if (visited.has(ref.path)) throw new Error(`Handoff reference cycle: ${ref.path}`);
          visited.add(ref.path);
          const raw = readEvidence(root, ref);
          const record = JSON.parse(raw);
          const errors = validateSchema(record, 'plan-handoff/v1', ref.path);
          if (errors.length) throw new Error(errors.join('; '));
          if (record.suiteId !== plan.manifest.suiteId || record.phaseId !== selected.phaseId) {
            throw new Error(`Wrong handoff identity: ${ref.path}`);
          }
          if (
            ref.path !==
            `${plan.suite}/output/handoffs/${record.phaseId}/attempt-${String(record.attempt).padStart(3, '0')}.json`
          ) {
            throw new Error(`Unexpected handoff attempt path: ${ref.path}`);
          }
          if (expectedAttempt !== null && record.attempt !== expectedAttempt) {
            throw new Error(`Broken attempt chain: ${ref.path}`);
          }
          if ((record.attempt === 1) !== (record.previousRef === null)) {
            throw new Error(`Attempt/previousRef mismatch: ${ref.path}`);
          }
          if (depth === 0) handoffs.set(selected.phaseId, record);
          expectedAttempt = record.attempt - 1;
          ref = record.previousRef;
          if (depth === 999 && ref) throw new Error('Handoff chain exceeds bounded validation limit');
        }
      }
    }

    const readmePath = `${plan.suite}/README.md`;
    const readmeFull = resolveRepoPath(root, readmePath);
    if (fs.existsSync(readmeFull)) {
      const readme = fs.readFileSync(readmeFull, 'utf8');
      const starts = readme.match(/<!-- plan-status:start -->/g) || [];
      const ends = readme.match(/<!-- plan-status:end -->/g) || [];
      const match = readme.match(/<!-- plan-status:start -->([\s\S]*?)<!-- plan-status:end -->/);
      if (starts.length !== ends.length || starts.length > 1 || (starts.length && !match)) {
        note('README_MARKERS', readmePath, 'Malformed generated status markers');
      }
    }

    const fatal = diagnostics.filter(
      (d) => !['STALE_CHECK', 'STALE_PHASE_SOURCE', 'REVIEW_STALE', 'STALE_DEFINITION'].includes(d.code)
    );
    return {
      suite: plan.suite,
      status: fatal.length ? 'invalid' : state ? 'valid' : 'planned',
      phases,
      diagnostics,
    };
  } catch (failure) {
    note('EVIDENCE_INPUT', plan.suite, failure.message);
    return { suite: plan.suite, status: 'invalid', phases, diagnostics };
  }
}

export function validatePlanEvidence(target = 'docs/plans', root = process.cwd(), options = {}) {
  const plans = validatePlans(target, root);
  const suites = plans.suites.map((plan) => validateSuiteEvidence(root, plan, options));
  return {
    target,
    suites,
    errors: [
      ...plans.errors,
      ...suites.flatMap((suite) =>
        suite.diagnostics
          .filter(
            (d) => !['STALE_CHECK', 'STALE_PHASE_SOURCE', 'REVIEW_STALE', 'STALE_DEFINITION'].includes(d.code)
          )
          .map((d) => `${d.path}: ${d.code}: ${d.message}`)
      ),
    ],
  };
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('validate-plan-evidence.js') || process.argv[1].includes('validate-plan-evidence'))
) {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith('--')) || 'docs/plans';
  const result = validatePlanEvidence(target, process.cwd());
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const suite of result.suites) {
      console.log(`${suite.suite}: ${suite.status}`);
    }
    console.log(
      `Evidence suites=${result.suites.length}; errors=${result.errors.length}`
    );
    result.errors.forEach((err) => console.error(err));
  }
  process.exitCode = result.errors.length ? 1 : 0;
}
