import fs from 'node:fs';
import path from 'node:path';
import { validateSchema, resolveRepoPath } from './plan-schema.js';
import {
  snapshot,
  definitionHash,
  readEvidence,
  digest,
  sourceDigest,
  normalizedSourceFiles,
  sha256,
} from './plan-source.js';
import { validateCheckerReport } from '../validate-checker-report.js';
import { validateApproval, classifyProtectedAction } from '../validate-protected-actions.js';

export const POLICY_PATHS = [
  'AGENTS.md',
  '.shiftstone/static-rules/global.md',
  '.shiftstone/static-rules/governance.md',
  '.shiftstone/static-rules/product.md',
  '.shiftstone/static-rules/security.md',
  '.shiftstone/static-rules/verification.md',
];

export const policyInputs = (root) =>
  POLICY_PATHS.filter((file) => fs.existsSync(resolveRepoPath(root, file, { mustExist: false })));

export const phaseScopes = (phase) =>
  [...new Set([...phase.sourcePaths, ...phase.checks.flatMap((check) => check.sourcePaths || [])])].sort();

export const phaseEnvironmentKeys = (phase) =>
  [...new Set(phase.checks.flatMap((check) => check.environmentKeys || []))].sort();

export const renderStatusTable = (phases) =>
  [
    '| Phase | Implementation | Verification | Review | Acceptance |',
    '|---|---|---|---|---|',
    ...phases.map(
      (phase) =>
        `| ${phase.phaseId} | ${phase.implementation} | ${phase.verification} | ${phase.review} | ${phase.acceptance} |`
    ),
  ].join('\n');

/**
 * Projects the 4 orthogonal status axes from given input state.
 * @param {object} input
 * @returns {{ implementation: string, verification: string, review: string, acceptance: string }}
 */
export function projectionAxes(input) {
  const attempted = input.checks.some((check) => !['missing', 'not-run'].includes(check.result));
  const required = input.checks.filter((check) => check.required);
  const verification = !attempted
    ? 'not-run'
    : required.some((check) => check.result === 'failed')
      ? 'failed'
      : !input.definitionFresh || required.some((check) => check.result !== 'passed' || !check.fresh)
        ? 'pending'
        : 'passed';

  const mapped = {
    APPROVED: 'approved',
    pass: 'approved',
    REJECTED: 'rejected',
    fail: 'rejected',
    REVISE: 'rejected',
    blocked: 'blocked',
    ESCALATED: 'blocked',
  };

  const review =
    input.reviewVerdict === null || input.reviewVerdict === undefined
      ? input.reviewRequested
        ? 'pending'
        : 'not-requested'
      : !input.definitionFresh || !input.reviewFresh || !input.disjoint || !input.distinctActor
        ? 'pending'
        : mapped[input.reviewVerdict] || 'pending';

  const gatesPass =
    input.implementation === 'implemented' &&
    verification === 'passed' &&
    (!input.requiredReview || review === 'approved') &&
    (!input.humanApprovalRequired || input.humanApprovalValid) &&
    !input.blockingIssue;

  return {
    implementation: input.implementation,
    verification,
    review,
    acceptance: gatesPass ? 'complete' : 'open',
  };
}

/**
 * Checks if predecessor phase satisfies dependency requirement.
 */
export function dependencyReady(axes, dependency, { blockingIssue = false } = {}) {
  return (
    !blockingIssue &&
    axes.acceptance === 'complete' &&
    (dependency.requires === 'complete' ||
      (dependency.requires === 'implementation-verified' && Boolean(dependency.reason?.trim())))
  );
}

/**
 * Detects protected actions for changes.
 */
function isPathProtected(file) {
  try {
    return Boolean(classifyProtectedAction({ targetPath: file }));
  } catch (_) {
    return false;
  }
}

/**
 * Validates approval for protected action paths.
 */
function checkApprovalCovers(approval, file, actorId) {
  try {
    const res = validateApproval(approval);
    if (!res.ok) return false;
    if (approval.status !== 'active' && approval.status !== 'consumed' && approval.status !== 'approved') return false;
    if (approval.approver === actorId) return false;
    const norm = file.replace(/\\/g, '/').replace(/^\.\//, '');
    return Boolean(
      approval.scopePaths?.some((sp) => {
        const spNorm = sp.replace(/\/$/, '');
        return norm === spNorm || norm.startsWith(`${spNorm}/`) || sp === '**' || sp === '.';
      })
    );
  } catch (_) {
    return false;
  }
}

/**
 * Projects a single phase's authoritative runtime status against disk/evidence.
 */
export function projectPhase(root, plan, phase, handoff, options = {}) {
  const diagnostics = [];
  const checks = [];
  const note = (code, message) =>
    diagnostics.push({ code, path: plan.suite, message: `${phase.phaseId}: ${message}` });

  const definitionSha256 = definitionHash(
    root,
    plan.suite,
    phase,
    plan.units,
    options.policyPaths || policyInputs(root)
  );

  const planned = {
    phaseId: phase.phaseId,
    implementation: 'planned',
    verification: 'not-run',
    review: 'not-requested',
    acceptance: 'open',
    checks,
    diagnostics,
    definitionSha256,
    selectedHandoffRef: null,
  };

  if (!handoff) return planned;

  const errors = validateSchema(handoff, 'plan-handoff/v1');
  if (errors.length) {
    errors.forEach((message) => note('HANDOFF_SCHEMA', message));
    return { ...planned, verification: 'pending' };
  }

  if (handoff.suiteId !== plan.manifest.suiteId || handoff.phaseId !== phase.phaseId) {
    note('HANDOFF_IDENTITY', 'Selected handoff belongs to another suite or phase');
  }

  const knownPhases = new Set(plan.manifest.phases.map((item) => item.phaseId));
  const scopes = phaseScopes(phase);
  const inside = (file) => scopes.some((scope) => scope === '.' || scope === file || file.startsWith(`${scope}/`));
  const phaseIds = (ids, label) =>
    ids.forEach((id) => {
      if (!knownPhases.has(id)) note('UNKNOWN_PHASE_REFERENCE', `${label}: ${id}`);
    });

  for (const change of handoff.changes || []) {
    resolveRepoPath(root, change.path);
    if (!inside(change.path)) note('CHANGE_SCOPE', `${change.path}: changed path outside declared phase/check union`);
    for (const id of change.unitIds || []) {
      if (!phase.unitIds.includes(id)) note('CHANGE_UNIT', `${change.path}: ${id} is not an active unit of this phase`);
    }
  }

  for (const [label, records] of [
    ['issues', handoff.issues || []],
    ['decisions', [...(handoff.deviations || []), ...(handoff.materialContext || [])]],
  ]) {
    if (new Set(records.map((r) => r.id)).size !== records.length) note('DUPLICATE_HANDOFF_ID', label);
    for (const record of records) phaseIds(record.blockingPhaseIds || record.downstreamPhaseIds || [], record.id);
  }

  if (handoff.next?.phaseId !== null && handoff.next?.phaseId !== undefined) {
    phaseIds([handoff.next.phaseId], 'next');
  }

  const preservationIds = new Set();
  for (const item of handoff.preservation || []) {
    resolveRepoPath(root, item.path);
    const key = `${item.path}\0${item.state}`;
    if (preservationIds.has(key)) note('DUPLICATE_PRESERVATION', item.path);
    preservationIds.add(key);
    if (!inside(item.path) && (item.entrySha256 !== null || item.exitSha256 !== null || item.action !== 'preserve')) {
      note('UNRELATED_PRESERVATION', `${item.path}: unrelated work requires preserve/null hashes`);
    }
  }

  const definitionFresh = handoff.definitionSha256 === definitionSha256;
  if (!definitionFresh) note('STALE_DEFINITION', 'Definition inputs changed since the selected handoff');

  const previousFiles = [...(handoff.entrySnapshot?.files || []), ...(handoff.exitSnapshot?.files || [])];
  const phaseSnapshot = snapshot(root, scopes, phaseEnvironmentKeys(phase), options.environment || {}, {
    previousFiles,
  });

  for (const record of [handoff.entrySnapshot, handoff.exitSnapshot]) {
    if (!record) continue;
    if (record.files.some((file) => !inside(file.path))) {
      note('SNAPSHOT_SCOPE', 'Recorded inventory contains unrelated paths');
      continue;
    }
    if (
      sourceDigest(root, record.scopePaths, record.files) !== record.scopeDigest ||
      digest(record.environment) !== record.environmentDigest
    ) {
      note('SNAPSHOT_DIGEST', 'Recorded source/environment digest is inconsistent');
    }
    if (
      new Set(record.files.map((file) => file.path)).size !== record.files.length ||
      record.files.map((file) => file.path).join('\n') !==
        record.files
          .map((file) => file.path)
          .sort()
          .join('\n')
    ) {
      note('SNAPSHOT_INVENTORY', 'Recorded file inventory must be unique and sorted');
    }
    if (JSON.stringify(record.scopePaths) !== JSON.stringify(scopes)) {
      note('SNAPSHOT_SCOPE', 'Phase snapshots must declare the complete sorted union of phase/check scopes');
    }
    if (JSON.stringify(record.environment.map((item) => item.key)) !== JSON.stringify(phaseEnvironmentKeys(phase))) {
      note('SNAPSHOT_ENVIRONMENT', 'Phase environment inventory differs from declared allowlisted keys');
    }
  }

  const sourceFresh =
    phaseSnapshot.scopeDigest === handoff.exitSnapshot?.scopeDigest &&
    phaseSnapshot.environmentDigest === handoff.exitSnapshot?.environmentDigest;
  if (!sourceFresh) note('STALE_PHASE_SOURCE', 'Phase source/index/environment changed');

  const observedChanges = new Set();
  if (
    handoff.entrySnapshot &&
    handoff.exitSnapshot &&
    [...handoff.entrySnapshot.files, ...handoff.exitSnapshot.files].every((file) => inside(file.path))
  ) {
    const before = new Map(normalizedSourceFiles(root, handoff.entrySnapshot.files).map((file) => [file.path, file]));
    const after = new Map(normalizedSourceFiles(root, handoff.exitSnapshot.files).map((file) => [file.path, file]));
    for (const file of new Set([...before.keys(), ...after.keys()])) {
      if (JSON.stringify(before.get(file)) !== JSON.stringify(after.get(file))) observedChanges.add(file);
    }
    for (const file of observedChanges) {
      if (!handoff.changes?.some((change) => change.path === file)) {
        note('UNDECLARED_CHANGE', `${file}: observed source/index change missing from the unit/reason ledger`);
      }
    }
  }

  const approvalPaths = [...new Set([...(handoff.changes || []).map((change) => change.path), ...observedChanges])];
  const humanGateRequired = phase.humanApprovalRequired || approvalPaths.some(isPathProtected);
  if (!approvalPaths.length) approvalPaths.push(...phase.sourcePaths);

  const verifyRefs = (refs) => {
    let valid = true;
    for (const ref of refs || []) {
      try {
        readEvidence(root, ref);
      } catch (failure) {
        valid = false;
        note('EVIDENCE', failure.message);
      }
    }
    return valid;
  };

  const reviewRecords = [];
  for (const reference of handoff.reviewRefs || []) {
    try {
      const report = JSON.parse(readEvidence(root, reference));
      const checkerRes = validateCheckerReport(report);
      const violations = [
        ...validateSchema(report, 'checker-report/v1'),
        ...(Array.isArray(checkerRes) ? checkerRes : (checkerRes.violations || [])).map(
          (item) => item.message || String(item)
        ),
      ];
      const bound = !report.evidence
        ? report.targetId === phase.phaseId
        : report.evidence?.planningSourceDigest === phaseSnapshot.scopeDigest &&
          report.evidence?.planningDefinitionSha256 === definitionSha256;
      const disjoint = report.contextIsolation === 'disjoint';
      const reviewer = report.reviewerAgentId || report.reviewer;
      const maker = report.makerAgentId || report.maker;
      const distinct = reviewer !== handoff.actor?.id && (!maker || maker === handoff.actor?.id);
      const acknowledged = report.evidence
        ? Boolean(
            report.evidence?.inspectedScopeAcknowledgement?.trim() && report.evidence?.invocationProvenance?.trim()
          )
        : true;
      if (violations.length || !disjoint || !distinct) {
        note('REVIEW_INVALID', `${reference.path}: independent identity and valid report required`);
      } else if (bound && !acknowledged) {
        note('REVIEW_INVALID', `${reference.path}: bound report requires scope acknowledgement and invocation provenance`);
      }
      if (!bound) note('REVIEW_STALE', `${reference.path}: missing or stale review binding; historical verdict preserved`);
      reviewRecords.push({
        report,
        fresh: !violations.length && disjoint && distinct && acknowledged && bound && definitionFresh && sourceFresh,
      });
    } catch (failure) {
      note('REVIEW_EVIDENCE', failure.message);
    }
  }

  const approvals = [];
  for (const reference of handoff.approvalRefs || []) {
    try {
      const approval = JSON.parse(readEvidence(root, reference));
      const errors = validateSchema(approval, 'protected-action/v1');
      const valid = errors.length === 0 && checkApprovalCovers(approval, approvalPaths[0] || '.', handoff.actor?.id);
      approvals.push({ approval, valid });
      if (errors.length) note('APPROVAL_INVALID', errors.join('; '));
    } catch (failure) {
      note('APPROVAL_EVIDENCE', failure.message);
    }
  }

  const approvalValid =
    !humanGateRequired ||
    (approvals.some((item) => item.valid) &&
      approvalPaths.every((file) => approvals.some((item) => item.valid && checkApprovalCovers(item.approval, file, handoff.actor?.id))));

  const seen = new Set();
  for (const observation of handoff.checks || []) {
    if (seen.has(observation.checkId)) note('DUPLICATE_RESULT', observation.checkId);
    seen.add(observation.checkId);
    if (!phase.checks.some((check) => check.id === observation.checkId)) {
      note('UNKNOWN_RESULT', observation.checkId);
    }
  }

  for (const check of phase.checks) {
    const result = handoff.checks?.find((item) => item.checkId === check.id);
    if (!result) {
      checks.push({ id: check.id, required: check.required, result: 'missing', fresh: false });
      continue;
    }
    let valid = verifyRefs(result.evidenceRefs);
    const current = snapshot(root, check.sourcePaths || [], check.environmentKeys || [], options.environment || {}, {
      previousFiles,
    });
    const fresh =
      definitionFresh &&
      result.sourceDigest === current.scopeDigest &&
      result.environmentDigest === current.environmentDigest &&
      current.environment.every((item) => item.valueSha256 !== null);

    if (result.result === 'passed') {
      if ((check.kind === 'automated' && result.exitCode !== 0) || (check.kind === 'manual' && result.exitCode !== null)) {
        valid = false;
        note('CHECK_EXIT', `${check.id}: invalid passing exit code for ${check.kind}`);
      }
      if (
        check.level === 4 &&
        !reviewRecords.some(
          (item) => item.fresh && ['APPROVED', 'pass'].includes(item.report.status || item.report.verdict)
        )
      ) {
        valid = false;
        note('CHECK_REVIEW', `${check.id}: actual bound independent report required`);
      }
      if (check.level === 5 && !approvalValid) {
        valid = false;
        note('CHECK_APPROVAL', `${check.id}: actual scoped human approval required`);
      }
      if (check.kind === 'manual' && check.level === 3 && !(check.environmentKeys || []).includes('served-assets-digest')) {
        valid = false;
        note('RUNTIME_IDENTITY', `${check.id}: runtime observation requires served asset/content identity`);
      }
    }
    if (result.result === 'failed' && check.kind === 'automated' && (result.exitCode === null || result.exitCode === 0)) {
      valid = false;
      note('CHECK_EXIT', `${check.id}: failed automated run requires actual nonzero exit`);
    }
    if (result.result !== 'not-run' && !fresh) note('STALE_CHECK', check.id);
    checks.push({ id: check.id, required: check.required, result: result.result, fresh: fresh && valid });
  }

  const issues = [...(handoff.issues || []), ...(options.issues || [])];
  issues.forEach((issue) => verifyRefs(issue.evidenceRefs));
  const blockingIssue = issues.some((issue) => issue.blockingPhaseIds?.includes(phase.phaseId));

  const freshReviews = reviewRecords.filter((item) => item.fresh);
  if (freshReviews.length > 1) {
    note('AMBIGUOUS_REVIEW', 'Choose one current independent report in the handoff; no timestamp-based selection');
  }
  const selectedReview = freshReviews.length === 1 ? freshReviews[0] : reviewRecords[0];
  const anyReview = (handoff.reviewRefs || []).length > 0;

  const axes = projectionAxes({
    implementation: handoff.implementation,
    checks,
    definitionFresh: definitionFresh && sourceFresh,
    requiredReview: phase.requiredReview,
    reviewVerdict: selectedReview?.report?.status || selectedReview?.report?.verdict || (anyReview ? 'blocked' : null),
    reviewRequested: handoff.reviewRequest !== null && handoff.reviewRequest !== undefined,
    reviewFresh: Boolean(selectedReview?.fresh) && freshReviews.length <= 1,
    disjoint: true,
    distinctActor: true,
    humanApprovalRequired: humanGateRequired,
    humanApprovalValid: approvalValid && definitionFresh && sourceFresh,
    blockingIssue,
  });

  if (diagnostics.some((item) => !['STALE_CHECK', 'STALE_PHASE_SOURCE', 'REVIEW_STALE', 'STALE_DEFINITION'].includes(item.code))) {
    axes.acceptance = 'open';
  }

  const handoffRef = options.handoffRef || {
    path: `${plan.suite}/output/handoffs/${phase.phaseId}/attempt-${String(handoff.attempt || 1).padStart(3, '0')}.json`,
    sha256: sha256(Buffer.from(JSON.stringify(handoff))),
  };

  return {
    phaseId: phase.phaseId,
    ...axes,
    checks,
    diagnostics,
    definitionSha256,
    sourceDigest: phaseSnapshot.scopeDigest,
    blockingIssue,
    selectedHandoffRef: handoffRef,
  };
}

/**
 * Projects derived runtime state from manifest, handoffs, and checker reports.
 * Can be called with in-memory records (unit tests) or suite context.
 *
 * @param {object} manifest - Valid plan-manifest/v1 object
 * @param {Array|Map|object} handoffs - Array or Map of handoff records
 * @param {Array|Map|object} [checkerReports] - Array or Map of checker report records
 * @param {object} [options] - Optional execution context { root, revision, updatedAt, definitionSha256, issues }
 * @returns {object} Conforming plan-state/v1 object
 */
export function deriveState(manifest, handoffs = [], checkerReports = [], options = {}) {
  const handoffList = Array.isArray(handoffs)
    ? handoffs
    : handoffs instanceof Map
      ? [...handoffs.values()]
      : Object.values(handoffs);

  const reportList = Array.isArray(checkerReports)
    ? checkerReports
    : checkerReports instanceof Map
      ? [...checkerReports.values()]
      : Object.values(checkerReports);

  const handoffMap = new Map();
  for (const h of handoffList) {
    if (h && h.phaseId) handoffMap.set(h.phaseId, h);
  }

  const allIssues = [
    ...handoffList.flatMap((h) => h.issues || []),
    ...(options.issues || []),
  ];

  const projectedPhases = [];

  for (const phase of manifest.phases || []) {
    const handoff = handoffMap.get(phase.phaseId);

    if (!handoff) {
      projectedPhases.push({
        phaseId: phase.phaseId,
        selectedHandoffRef: null,
        implementation: 'planned',
        verification: 'not-run',
        review: 'not-requested',
        acceptance: 'open',
      });
      continue;
    }

    // Evaluate in-memory or on-disk
    const attempted = (phase.checks || []).some((c) => {
      const res = handoff.checks?.find((ch) => ch.checkId === c.id);
      return res && !['missing', 'not-run'].includes(res.result);
    });

    const requiredChecks = (phase.checks || []).filter((c) => c.required);
    const anyFailed = requiredChecks.some((c) => {
      const res = handoff.checks?.find((ch) => ch.checkId === c.id);
      return !res || res.result === 'failed';
    });

    const allPassedAndFresh =
      requiredChecks.length > 0 &&
      requiredChecks.every((c) => {
        const res = handoff.checks?.find((ch) => ch.checkId === c.id);
        return res && res.result === 'passed' && res.fresh !== false;
      });

    const verification = !attempted
      ? 'not-run'
      : anyFailed
        ? 'failed'
        : allPassedAndFresh
          ? 'passed'
          : 'pending';

    // Review assessment
    const relevantReports = reportList.filter(
      (r) =>
        r &&
        (r.targetId === phase.phaseId ||
          r.targetId === manifest.suiteId ||
          (handoff.reviewRefs && handoff.reviewRefs.some((ref) => ref.path && ref.path.includes(r.reportId || ''))))
    );

    let review = phase.requiredReview ? 'pending' : 'not-requested';
    if (handoff.reviewRequest) review = 'pending';

    const validReviews = relevantReports.filter((r) => {
      const reviewer = r.reviewerAgentId || r.reviewer;
      const maker = r.makerAgentId || r.maker;
      const disjoint = r.contextIsolation === 'disjoint';
      const distinct = reviewer && reviewer !== handoff.actor?.id && (!maker || maker === handoff.actor?.id);
      return disjoint && distinct;
    });

    if (validReviews.length > 0) {
      const selected = validReviews[0];
      const verdict = selected.status || selected.verdict;
      if (verdict === 'APPROVED' || verdict === 'pass') {
        const scorePass = selected.scoring ? selected.scoring.normalizedScore >= (selected.scoring.thresholdScore ?? 80) : true;
        review = scorePass ? 'approved' : 'rejected';
      } else if (verdict === 'REJECTED' || verdict === 'fail' || verdict === 'REVISE') {
        review = 'rejected';
      } else if (verdict === 'ESCALATED' || verdict === 'blocked') {
        review = 'blocked';
      } else {
        review = 'pending';
      }
    } else if (relevantReports.length > 0) {
      // Had reports but none were valid/disjoint/distinct
      review = 'pending';
    }

    const blockingIssue = allIssues.some((issue) => issue.blockingPhaseIds?.includes(phase.phaseId));
    const humanApprovalValid = !phase.humanApprovalRequired || (handoff.approvalRefs && handoff.approvalRefs.length > 0);

    const implementation = handoff.implementation || 'in-progress';
    const acceptance =
      implementation === 'implemented' &&
      verification === 'passed' &&
      (!phase.requiredReview || review === 'approved') &&
      humanApprovalValid &&
      !blockingIssue
        ? 'complete'
        : 'open';

    const handoffPath =
      handoff.path ||
      handoff.handoffRef?.path ||
      `docs/plans/${manifest.suiteId}/output/handoffs/${phase.phaseId}/attempt-${String(handoff.attempt || 1).padStart(3, '0')}.json`;
    const handoffSha =
      handoff.sha256 ||
      handoff.handoffRef?.sha256 ||
      sha256(Buffer.from(JSON.stringify(handoff)));

    const selectedHandoffRef =
      implementation === 'planned' && acceptance === 'open'
        ? null
        : {
            path: handoffPath,
            sha256: handoffSha,
          };

    projectedPhases.push({
      phaseId: phase.phaseId,
      selectedHandoffRef,
      implementation,
      verification,
      review,
      acceptance,
    });
  }

  const definitionSha256 =
    options.definitionSha256 ||
    digest(
      projectedPhases
        .map((p) => ({ phaseId: p.phaseId, implementation: p.implementation }))
        .sort((a, b) => a.phaseId.localeCompare(b.phaseId))
    );

  const state = {
    schema: 'plan-state/v1',
    suiteId: manifest.suiteId,
    revision: options.revision !== undefined ? options.revision : 1,
    definitionSha256,
    updatedAt: options.updatedAt || new Date().toISOString(),
    phases: projectedPhases,
  };

  return state;
}
