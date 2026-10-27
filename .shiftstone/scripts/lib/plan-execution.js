import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveRepoPath, validateSchema } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { projectPhase, phaseScopes, phaseEnvironmentKeys, policyInputs } from './plan-state.js';
import { snapshot, sha256, definitionHash, preservationInventory, dirtyPaths } from './plan-source.js';
import { loadHandoffs, resumePhase } from './plan-resume.js';
import { savePhaseState } from './plan-storage.js';

export function findPhase(manifest, phaseId) {
  const norm = (phaseId || '').toLowerCase().replace(/^phase-?/, 'p');
  return (manifest?.phases || []).find(
    (p) =>
      p.phaseId === phaseId ||
      p.phaseId.toLowerCase() === norm ||
      p.phaseId.toLowerCase() === (phaseId || '').toLowerCase()
  );
}

/**
 * Initializes phase execution, taking entry snapshot and preservation baseline.
 */
export function beginPhase(root, suite, phaseId, options = {}) {
  const plan = validatePlan(root, suite);
  if (plan.status !== 'valid') {
    return { error: 'Invalid plan', diagnostics: plan.diagnostics, exitCode: 1 };
  }
  const phase = findPhase(plan.manifest, phaseId);
  if (!phase) {
    return { error: `Phase ${phaseId} not found in manifest`, exitCode: 1 };
  }

  // Verify prerequisites using resumePhase
  const resume = resumePhase(root, suite, phaseId, { mode: 'implement', ...options });
  if (!resume.ready) {
    return {
      error: `Phase ${phaseId} cannot begin: prerequisites unmet`,
      diagnostics: resume.diagnostics,
      exitCode: 2,
    };
  }

  const { handoffs } = loadHandoffs(root, plan);
  if (handoffs.has(phaseId)) {
    return { error: `Phase ${phaseId} already has recorded attempts; use checkpoint or resume`, exitCode: 1 };
  }

  const entrySnapshot = snapshot(root, phaseScopes(phase), phaseEnvironmentKeys(phase), options.environment || {});
  const dirty = dirtyPaths(root);
  const preservation = dirty.map((item) => ({
    path: item.path,
    state: item.state,
    origin: 'pre-existing',
    action: 'preserve',
    reason: 'Pre-existing work observed at begin.',
    entrySha256: entrySnapshot.files.find((f) => f.path === item.path)?.worktreeSha256 || null,
    exitSha256: null,
  }));

  const actor = options.actor
    ? { id: options.actor.split(':')[0], role: options.actor.split(':')[1] || 'maker' }
    : { id: 'maker', role: 'maker' };
  const definitionSha256 = definitionHash(root, suite, phase, plan.units, policyInputs(root));

  const handoff = {
    schema: 'plan-handoff/v1',
    suiteId: plan.manifest.suiteId,
    phaseId,
    attempt: 1,
    previousRef: null,
    definitionSha256,
    recordedAt: new Date().toISOString(),
    actor,
    event: 'checkpoint',
    implementation: 'in-progress',
    terminalState: 'pending',
    summary: `Begin execution of phase ${phaseId}`,
    changes: [],
    deviations: [],
    materialContext: [],
    issues: [],
    entrySnapshot,
    exitSnapshot: structuredClone(entrySnapshot),
    checks: phase.checks.map((c) => ({
      checkId: c.id,
      result: 'not-run',
      observedAt: null,
      sourceDigest: null,
      environmentDigest: null,
      exitCode: null,
      evidenceRefs: [],
      reason: 'Not run yet.',
    })),
    reviewRefs: [],
    approvalRefs: [],
    reviewRequest: null,
    next: {
      phaseId: null,
      entryConditions: [],
      firstAction: 'Implement active units.',
    },
    preservation,
  };

  const validationErrors = validateSchema(handoff, 'plan-handoff/v1');
  if (validationErrors.length) {
    return { error: `Handoff validation failed: ${validationErrors.join('; ')}`, exitCode: 1 };
  }

  const handoffPath = `${suite}/output/handoffs/${phaseId}/attempt-001.json`;
  const handoffContent = JSON.stringify(handoff, null, 2) + '\n';
  const handoffRef = { path: handoffPath, sha256: sha256(Buffer.from(handoffContent)) };
  const today = new Date().toISOString().slice(0, 10);
  const logEntry = `| ${today} | ${phaseId} begin | Entry snapshot and preservation inventory recorded. | [Handoff](handoffs/${phaseId}/attempt-001.json) |`;

  try {
    savePhaseState(root, suite, {
      handoff,
      handoffRef,
      expectedRevision: options.expectedRevision,
      logEntry,
      options,
    });
    return { success: true, handoff, handoffRef, exitCode: 0 };
  } catch (err) {
    return { error: err.message, exitCode: err.exitCode || 1 };
  }
}

/**
 * Runs a configured automated check from manifest and captures evidence.
 */
export function verifyCheck(root, suite, phaseId, checkId, options = {}) {
  const plan = validatePlan(root, suite);
  if (plan.status !== 'valid') {
    return { error: 'Invalid plan', diagnostics: plan.diagnostics, exitCode: 1 };
  }
  const phase = findPhase(plan.manifest, phaseId);
  if (!phase) {
    return { error: `Phase ${phaseId} not found in manifest`, exitCode: 1 };
  }
  const check = phase.checks.find((c) => c.id === checkId);
  if (!check) {
    return { error: `Check ${checkId} not found in phase ${phaseId}`, exitCode: 1 };
  }
  if (check.kind !== 'automated') {
    return {
      error: `Check ${checkId} is manual (${check.procedure ? 'procedure' : 'review'}) and cannot be verified via runner`,
      exitCode: 1,
    };
  }
  if (!check.runner) {
    return { error: `Check ${checkId} has no runner configuration`, exitCode: 1 };
  }

  const before = snapshot(root, check.sourcePaths, check.environmentKeys, options.environment || {});

  let executable = check.runner.executable;
  if (process.platform === 'win32') {
    if (executable === 'npm') executable = 'npm.cmd';
    else if (executable === 'pnpm') executable = 'pnpm.cmd';
    else if (executable === 'npx') executable = 'npx.cmd';
  }
  const cwd = resolveRepoPath(root, check.runner.cwd || '.');
  const args = check.runner.args || [];

  const start = Date.now();
  let stdout = '';
  let stderr = '';
  let exitCode = null;
  let launchError = null;

  try {
    const res = spawnSync(executable, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024,
    });
    stdout = res.stdout || '';
    stderr = res.stderr || '';
    exitCode = res.status;
    if (res.error) launchError = res.error;
  } catch (err) {
    launchError = err;
  }
  const duration = Date.now() - start;

  const after = snapshot(root, check.sourcePaths, check.environmentKeys, options.environment || {});

  let result;
  let reason;
  if (before.scopeDigest !== after.scopeDigest || before.environmentDigest !== after.environmentDigest) {
    result = 'blocked';
    reason = 'Source or environment modified during verification run';
  } else if (launchError) {
    result = 'blocked';
    exitCode = null;
    reason = `Launch failure: ${launchError.message}`;
  } else if (exitCode === 0) {
    result = 'passed';
    reason = 'Verification passed with exit code 0';
  } else {
    result = 'failed';
    reason = `Verification failed with exit code ${exitCode}`;
  }

  const checksDir = resolveRepoPath(root, `${suite}/output/checks`, { mustExist: false });
  fs.mkdirSync(checksDir, { recursive: true });
  const rawFileName = `${checkId}-${Date.now()}.txt`;
  const rawPath = `${suite}/output/checks/${rawFileName}`;
  const rawFull = resolveRepoPath(root, rawPath, { mustExist: false });
  const rawContent =
    `=== Check: ${checkId} ===\n` +
    `Command: ${executable} ${args.join(' ')}\n` +
    `Exit Code: ${exitCode}\n` +
    `Duration: ${duration}ms\n` +
    `--- STDOUT ---\n${stdout}\n` +
    `--- STDERR ---\n${stderr}\n`;

  fs.writeFileSync(rawFull, rawContent, 'utf8');
  const evidenceRef = { path: rawPath, sha256: sha256(Buffer.from(rawContent)) };

  const checkResult = {
    checkId,
    result,
    observedAt: new Date().toISOString(),
    sourceDigest: after.scopeDigest,
    environmentDigest: after.environmentDigest,
    exitCode,
    evidenceRefs: [evidenceRef],
    reason,
  };

  return { success: true, checkResult, exitCode: 0 };
}

/**
 * Appends an immutable handoff attempt and atomically refreshes state.
 */
export function checkpointPhase(root, suite, phaseId, factsPathOrObject, options = {}) {
  const plan = validatePlan(root, suite);
  if (plan.status !== 'valid') {
    return { error: 'Invalid plan', diagnostics: plan.diagnostics, exitCode: 1 };
  }
  const phase = findPhase(plan.manifest, phaseId);
  if (!phase) {
    return { error: `Phase ${phaseId} not found in manifest`, exitCode: 1 };
  }

  let facts;
  if (typeof factsPathOrObject === 'string') {
    const fullFacts = resolveRepoPath(root, factsPathOrObject, { mustExist: true });
    try {
      facts = JSON.parse(fs.readFileSync(fullFacts, 'utf8'));
    } catch (err) {
      return { error: `Malformed facts file: ${err.message}`, exitCode: 1 };
    }
  } else if (factsPathOrObject && typeof factsPathOrObject === 'object') {
    facts = factsPathOrObject;
  } else {
    facts = {};
  }

  const { handoffs, handoffRefs } = loadHandoffs(root, plan);
  const previousHandoff = handoffs.get(phaseId) || null;
  const previousRef = handoffRefs.get(phaseId) || null;
  const attempt = previousHandoff ? previousHandoff.attempt + 1 : 1;

  const actor =
    facts.actor ||
    (options.actor
      ? { id: options.actor.split(':')[0], role: options.actor.split(':')[1] || 'maker' }
      : { id: 'maker', role: 'maker' });

  // Self-issued review protection
  for (const ref of facts.reviewRefs || []) {
    try {
      const full = resolveRepoPath(root, ref.path, { mustExist: true });
      const report = JSON.parse(fs.readFileSync(full, 'utf8'));
      const reviewer = report.reviewerAgentId || report.reviewer;
      if (reviewer === actor.id) {
        return {
          error: `Self-issued review forbidden: reviewer "${reviewer}" cannot equal maker "${actor.id}"`,
          exitCode: 1,
        };
      }
    } catch (err) {
      if (err.message?.includes('Self-issued')) return { error: err.message, exitCode: 1 };
    }
  }

  const entrySnapshot = previousHandoff
    ? previousHandoff.entrySnapshot
    : snapshot(root, phaseScopes(phase), phaseEnvironmentKeys(phase), options.environment || {});
  const exitSnapshot = snapshot(root, phaseScopes(phase), phaseEnvironmentKeys(phase), options.environment || {}, {
    previousFiles: entrySnapshot.files,
  });

  const preservation = preservationInventory(root, entrySnapshot, exitSnapshot);
  if (facts.preservation && Array.isArray(facts.preservation)) {
    for (const item of facts.preservation) {
      const idx = preservation.findIndex((p) => p.path === item.path);
      if (idx !== -1) preservation[idx] = Object.assign(preservation[idx], item);
      else preservation.push(item);
    }
  }

  const definitionSha256 = definitionHash(root, suite, phase, plan.units, policyInputs(root));

  // Build checks array
  const checksMap = new Map();
  for (const c of phase.checks) {
    checksMap.set(c.id, {
      checkId: c.id,
      result: 'not-run',
      observedAt: null,
      sourceDigest: null,
      environmentDigest: null,
      exitCode: null,
      evidenceRefs: [],
      reason: 'Not run yet.',
    });
  }
  if (previousHandoff) {
    for (const c of previousHandoff.checks || []) checksMap.set(c.checkId, c);
  }
  if (facts.checks && Array.isArray(facts.checks)) {
    for (const c of facts.checks) {
      if (checksMap.has(c.checkId)) {
        checksMap.set(c.checkId, c);
      }
    }
  }

  const event = options.event || facts.event || 'checkpoint';
  const implementation =
    facts.implementation ||
    (event === 'close' ? 'implemented' : previousHandoff ? previousHandoff.implementation : 'in-progress');
  const terminalState =
    facts.terminalState || (event === 'close' ? 'success' : previousHandoff ? previousHandoff.terminalState : 'pending');

  const handoff = {
    schema: 'plan-handoff/v1',
    suiteId: plan.manifest.suiteId,
    phaseId,
    attempt,
    previousRef,
    definitionSha256,
    recordedAt: new Date().toISOString(),
    actor,
    event,
    implementation,
    terminalState,
    summary: facts.summary || `${event} for phase ${phaseId}`,
    changes: facts.changes || [],
    deviations: facts.deviations || [],
    materialContext: facts.materialContext || [],
    issues: facts.issues || [],
    entrySnapshot,
    exitSnapshot,
    checks: [...checksMap.values()],
    reviewRefs: facts.reviewRefs || [],
    approvalRefs: facts.approvalRefs || [],
    reviewRequest: facts.reviewRequest || null,
    next: facts.next || {
      phaseId: null,
      entryConditions: [],
      firstAction: 'Continue implementation.',
    },
    preservation,
  };

  const validationErrors = validateSchema(handoff, 'plan-handoff/v1');
  if (validationErrors.length) {
    return { error: `Handoff validation failed: ${validationErrors.join('; ')}`, exitCode: 1 };
  }

  // Strict acceptance gate enforcement on close
  if (event === 'close') {
    const allIssues = [
      ...[...handoffs.values()].filter((h) => h.phaseId !== phaseId),
      handoff,
    ].flatMap((h) => h.issues || []);
    const projected = projectPhase(root, plan, phase, handoff, { ...options, issues: allIssues });
    if (projected.acceptance !== 'complete') {
      return {
        error: `Close blocked: acceptance is open (${projected.diagnostics.map((d) => d.message).join('; ') || 'unmet verification or review gates'})`,
        projected,
        exitCode: 2,
      };
    }
    handoff.implementation = 'implemented';
    handoff.terminalState = 'success';
  }

  const attemptStr = String(attempt).padStart(3, '0');
  const handoffPath = `${suite}/output/handoffs/${phaseId}/attempt-${attemptStr}.json`;
  const handoffContent = JSON.stringify(handoff, null, 2) + '\n';
  const handoffRef = { path: handoffPath, sha256: sha256(Buffer.from(handoffContent)) };
  const today = new Date().toISOString().slice(0, 10);
  const logEntry = `| ${today} | ${phaseId} ${event} | ${handoff.summary} | [Handoff](handoffs/${phaseId}/attempt-${attemptStr}.json) |`;

  try {
    savePhaseState(root, suite, {
      handoff,
      handoffRef,
      expectedRevision: options.expectedRevision,
      logEntry,
      options,
    });
    return { success: true, handoff, handoffRef, exitCode: 0 };
  } catch (err) {
    return { error: err.message, exitCode: err.exitCode || 1 };
  }
}

/**
 * Validates strict acceptance gate and closes phase.
 */
export function closePhase(root, suite, phaseId, factsPathOrObject, options = {}) {
  return checkpointPhase(root, suite, phaseId, factsPathOrObject, { ...options, event: 'close' });
}
