#!/usr/bin/env node
import { discoverSuites } from './lib/plan-schema.js';
import { validatePlan } from './lib/plan-graph.js';

export function validatePlans(target = 'docs/plans', root = process.cwd()) {
  try {
    const suites = discoverSuites(root, target);
    if (!suites.length) return { target, suites: [], errors: [`${target}: no plan suites discovered`] };
    const results = suites.map((suite) => validatePlan(root, suite));
    return {
      target,
      suites: results,
      errors: results.flatMap((r) => r.diagnostics.map((d) => `${d.path}: ${d.code}: ${d.message}`)),
    };
  } catch (error) {
    return { target, suites: [], errors: [error.message] };
  }
}

if (process.argv[1] && (process.argv[1].endsWith('validate-plans.js') || process.argv[1].includes('validate-plans'))) {
  const args = process.argv.slice(2);
  const target = args.find((arg) => !arg.startsWith('--')) || 'docs/plans';
  const result = validatePlans(target, process.cwd());
  if (args.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const suite of result.suites) {
      console.log(`${suite.suite}: ${suite.status}; phases=${suite.phaseCount}, activeUnits=${suite.activeUnits}`);
    }
    console.log(
      `Plan suites discovered=${result.suites.length}; opted-in=${result.suites.filter((s) => s.manifest).length}; legacy/unverified=${result.suites.filter((s) => s.status === 'legacy/unverified').length}; errors=${result.errors.length}`
    );
    result.errors.forEach((error) => console.error(error));
  }
  process.exitCode = result.errors.length ? 1 : 0;
}
