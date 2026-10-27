import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPath } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { projectPhase, dependencyReady, policyInputs, renderStatusTable } from './plan-state.js';
import { readEvidence, digest, sha256 } from './plan-source.js';

/**
 * Loads recorded handoff attempts and references for a plan suite.
 */
export function loadHandoffs(root, plan) {
  const handoffs = new Map();
  const handoffRefs = new Map();
  const statePath = `${plan.suite}/output/state.json`;
  let state = null;

  if (fs.existsSync(resolveRepoPath(root, statePath, { mustExist: false }))) {
    try {
      state = JSON.parse(fs.readFileSync(resolveRepoPath(root, statePath), 'utf8'));
      for (const phase of state.phases || []) {
        if (phase.selectedHandoffRef) {
          try {
            const content = JSON.parse(readEvidence(root, phase.selectedHandoffRef));
            handoffs.set(phase.phaseId, content);
            handoffRefs.set(phase.phaseId, phase.selectedHandoffRef);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // If state was missing or some phase had no selected handoff in state, check filesystem
  for (const phase of plan.manifest?.phases || []) {
    if (!handoffs.has(phase.phaseId)) {
      const dir = `${plan.suite}/output/handoffs/${phase.phaseId}`;
      if (fs.existsSync(resolveRepoPath(root, dir, { mustExist: false }))) {
        try {
          const files = fs
            .readdirSync(resolveRepoPath(root, dir))
            .filter((f) => /^attempt-\d+\.json$/.test(f))
            .sort();
          if (files.length) {
            const latest = files[files.length - 1];
            const p = `${dir}/${latest}`;
            const bytes = fs.readFileSync(resolveRepoPath(root, p));
            const content = JSON.parse(bytes.toString('utf8'));
            const ref = { path: p, sha256: sha256(bytes) };
            handoffs.set(phase.phaseId, content);
            handoffRefs.set(phase.phaseId, ref);
          }
        } catch (_) {}
      }
    }
  }

  return { state, handoffs, handoffRefs };
}

/**
 * Evaluates phase resumption readiness, checks predecessor acceptance gates,
 * and synthesizes bounded readTargets packet and regression checklist.
 */
export function resumePhase(root, suite, phaseId, options = {}) {
  const plan = validatePlan(root, suite);
  const mode = options.mode === 'remediate' ? 'remediate' : 'implement';

  if (plan.status !== 'valid') {
    return {
      suiteId: plan.manifest?.suiteId || null,
      phaseId,
      mode,
      ready: false,
      statuses: null,
      diagnostics: plan.diagnostics,
      readTargets: [],
      regressionCheckIds: [],
      firstAction: 'Fix plan validation errors before proceeding.',
      exitCode: 1,
    };
  }

  const normTargetId = (phaseId || '').toLowerCase().replace(/^phase-?/, 'p');
  const phase = plan.manifest.phases.find(
    (p) =>
      p.phaseId === phaseId ||
      p.phaseId.toLowerCase() === normTargetId ||
      p.phaseId.toLowerCase() === (phaseId || '').toLowerCase()
  );
  if (!phase) {
    return {
      suiteId: plan.manifest.suiteId,
      phaseId,
      mode,
      ready: false,
      statuses: null,
      diagnostics: [{ code: 'UNKNOWN_PHASE', path: suite, message: `Phase ${phaseId} not found in manifest` }],
      readTargets: [],
      regressionCheckIds: [],
      firstAction: `Specify a declared phase ID in ${plan.manifest.phases.map((p) => p.phaseId).join(', ')}.`,
      exitCode: 1,
    };
  }

  const { state, handoffs, handoffRefs } = loadHandoffs(root, plan);
  const allIssues = [...handoffs.values()].flatMap((h) => h.issues || []);
  const phaseHandoff = handoffs.get(phase.phaseId) || null;
  const projected = projectPhase(root, plan, phase, phaseHandoff, { ...options, issues: allIssues });

  const staleDef = projected.diagnostics.some((d) => d.code === 'STALE_DEFINITION');
  const staleSource = projected.diagnostics.some((d) => d.code === 'STALE_PHASE_SOURCE');
  const freshness = !phaseHandoff ? 'unknown' : staleDef || staleSource ? 'stale' : 'fresh';

  const statuses = {
    implementation: projected.implementation,
    verification: projected.verification,
    review: projected.review,
    acceptance: projected.acceptance,
    freshness,
  };

  const diagnostics = [...projected.diagnostics];
  let prerequisitesMet = true;

  for (const dep of phase.dependsOn || []) {
    const predPhase = plan.manifest.phases.find((p) => p.phaseId === dep.phaseId);
    if (!predPhase) continue;
    const predHandoff = handoffs.get(dep.phaseId) || null;
    const predProjected = projectPhase(root, plan, predPhase, predHandoff, { ...options, issues: allIssues });
    const ready = dependencyReady(predProjected, dep, { blockingIssue: predProjected.blockingIssue });
    if (!ready) {
      prerequisitesMet = false;
      diagnostics.push({
        code: 'UNMET_PREDECESSOR',
        path: predPhase.contract,
        message: `Predecessor phase ${dep.phaseId} does not satisfy requires: ${dep.requires} (${dep.reason})`,
      });
    }
  }

  if (projected.blockingIssue) {
    diagnostics.push({
      code: 'BLOCKING_ISSUE',
      path: suite,
      message: `Phase ${phaseId} is blocked by an active issue`,
    });
  }

  const ready = mode === 'remediate' ? true : prerequisitesMet && !projected.blockingIssue;
  const exitCode = mode === 'remediate' ? 0 : ready ? 0 : 2;

  // Synthesize deterministic readTargets
  const readTargetsSet = new Set();
  const readmePath = `${suite}/README.md`;
  if (fs.existsSync(resolveRepoPath(root, readmePath, { mustExist: false }))) {
    readTargetsSet.add(readmePath);
  }
  if (phase.contract && fs.existsSync(resolveRepoPath(root, phase.contract, { mustExist: false }))) {
    readTargetsSet.add(phase.contract);
  }

  for (const unit of plan.units || []) {
    if (phase.unitIds.includes(unit.record?.unitId)) {
      readTargetsSet.add(unit.path);
      for (const input of unit.record?.allowedInputs || []) {
        try {
          resolveRepoPath(root, input, { mustExist: true });
          readTargetsSet.add(input);
        } catch (_) {}
      }
    }
  }

  for (const dep of phase.dependsOn || []) {
    const ref = handoffRefs.get(dep.phaseId);
    if (ref && fs.existsSync(resolveRepoPath(root, ref.path, { mustExist: false }))) {
      readTargetsSet.add(ref.path);
    }
    const predHandoff = handoffs.get(dep.phaseId);
    if (predHandoff) {
      for (const r of predHandoff.reviewRefs || []) {
        if (fs.existsSync(resolveRepoPath(root, r.path, { mustExist: false }))) readTargetsSet.add(r.path);
      }
    }
  }

  if (phaseHandoff) {
    for (const r of phaseHandoff.reviewRefs || []) {
      if (fs.existsSync(resolveRepoPath(root, r.path, { mustExist: false }))) readTargetsSet.add(r.path);
    }
  }

  for (const policy of policyInputs(root)) {
    readTargetsSet.add(policy);
  }

  for (const src of phase.sourcePaths || []) {
    try {
      resolveRepoPath(root, src);
      readTargetsSet.add(src);
    } catch (_) {}
  }

  for (const chk of phase.checks || []) {
    for (const src of chk.sourcePaths || []) {
      try {
        resolveRepoPath(root, src);
        readTargetsSet.add(src);
      } catch (_) {}
    }
  }

  const readTargets = [...readTargetsSet].sort();
  const regressionCheckIds = (phase.checks || [])
    .filter((c) => c.regressionFor && c.regressionFor.length > 0)
    .map((c) => c.id);

  let firstAction;
  if (mode === 'remediate') {
    const failedChecks = (phase.checks || [])
      .filter((c) => {
        const res = phaseHandoff?.checks?.find((ch) => ch.checkId === c.id);
        return res && res.result === 'failed';
      })
      .map((c) => c.id);
    firstAction = failedChecks.length
      ? `Remediate failing check(s) [${failedChecks.join(', ')}] in phase ${phaseId}.`
      : `Inspect declared readTargets and remediate pending gates for ${phaseId}.`;
  } else if (!ready) {
    firstAction = `Resolve unmet prerequisite(s) in predecessor phase(s) or blocking issues before implementing ${phaseId}.`;
  } else {
    firstAction = `Inspect declared readTargets, review predecessor handoff, and begin implementation of ${phaseId}.`;
  }

  return {
    suiteId: plan.manifest.suiteId,
    phaseId: phase.phaseId,
    mode,
    ready,
    statuses,
    diagnostics,
    readTargets,
    regressionCheckIds,
    firstAction,
    exitCode,
  };
}

/**
 * Returns complete suite-wide status, rendered table, and diagnostic issues.
 */
export function suiteStatus(root, suite, options = {}) {
  const plan = validatePlan(root, suite);
  if (plan.status !== 'valid') {
    return {
      suite: plan.suite,
      status: plan.status,
      phases: [],
      diagnostics: plan.diagnostics,
      exitCode: 1,
    };
  }

  const { state, handoffs } = loadHandoffs(root, plan);
  const allIssues = [...handoffs.values()].flatMap((h) => h.issues || []);
  const phases = plan.manifest.phases.map((phase) => {
    return projectPhase(root, plan, phase, handoffs.get(phase.phaseId) || null, { ...options, issues: allIssues });
  });

  const diagnostics = phases.flatMap((p) => p.diagnostics);
  const statusTable = renderStatusTable(phases);
  const definitionSha256 = digest(
    phases
      .map((p) => ({ phaseId: p.phaseId, definitionSha256: p.definitionSha256 }))
      .sort((a, b) => a.phaseId.localeCompare(b.phaseId))
  );

  const fatal = diagnostics.filter(
    (d) => !['STALE_CHECK', 'STALE_PHASE_SOURCE', 'REVIEW_STALE', 'STALE_DEFINITION'].includes(d.code)
  );

  return {
    suiteId: plan.manifest.suiteId,
    suite,
    status: fatal.length ? 'invalid' : state ? 'valid' : 'planned',
    phases,
    statusTable,
    diagnostics,
    definitionSha256,
    exitCode: 0,
  };
}
