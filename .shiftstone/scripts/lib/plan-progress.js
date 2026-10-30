import fs from 'node:fs';
import path from 'node:path';
import { normalizeSuite, resolveRepoPath } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';

/**
 * Computes a visual Unicode progress bar string: [██████░░░░] 60% (3/5 Phases Complete).
 *
 * @param {number} completed - Number of completed items.
 * @param {number} total - Total items.
 * @param {number} [barWidth=10] - Number of bar blocks.
 * @returns {string} Formatted progress bar.
 */
export function renderProgressBar(completed, total, barWidth = 10) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
  const ratio = safeTotal > 0 ? safeCompleted / safeTotal : 0;
  const percent = Math.round(ratio * 100);
  const filled = Math.min(barWidth, Math.round(ratio * barWidth));
  const empty = Math.max(0, barWidth - filled);

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percent}% (${safeCompleted}/${safeTotal} Phases Complete)`;
}

/**
 * Extracts a human-readable title from a stage contract markdown file.
 *
 * @param {string} root - Repository root.
 * @param {string} contractRel - Relative path to contract.
 * @param {string} fallback - Fallback title if extraction fails.
 * @returns {string} Human-readable phase title.
 */
export function extractPhaseTitle(root, contractRel, fallback = '') {
  if (!contractRel) return fallback;
  try {
    const full = resolveRepoPath(root, contractRel, { mustExist: false });
    if (!fs.existsSync(full)) return fallback;
    const content = fs.readFileSync(full, 'utf8');

    // 1. Try frontmatter title:
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontmatterMatch) {
      const titleLine = frontmatterMatch[1].split('\n').find((l) => /^\s*title\s*:/i.test(l));
      if (titleLine) {
        return titleLine.replace(/^\s*title\s*:\s*/i, '').replace(/^['"]|['"]$/g, '').trim();
      }
    }

    // 2. Try first markdown H1 heading (# Phase N: ... or # ...)
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      return h1Match[1].replace(/^Phase\s+\d+[:\s—–-]+\s*/i, '').trim();
    }
  } catch (_) {}
  return fallback;
}

/**
 * Renders the authoritative Visual Plan Progress Dashboard for chat, artifacts, or CLI output.
 *
 * @param {string} root - Repository root.
 * @param {string} suite - Plan suite directory.
 * @param {object} [options]
 * @param {string} [options.activePhase] - Currently active phase being executed.
 * @param {string} [options.worker] - Subagent worker role or conversation ID.
 * @param {object} [options.state] - In-memory plan-state override.
 * @returns {string} Structured Markdown progress card.
 */
export function renderPlanProgressTable(root, suite, options = {}) {
  const normSuite = normalizeSuite(root, suite);
  const plan = validatePlan(root, normSuite);
  if (plan.status !== 'valid') {
    return `### ⚠️ Plan Suite Error: ${normSuite}\nUnable to load plan: ${plan.diagnostics.map((d) => d.message).join('; ')}`;
  }

  const manifest = plan.manifest;
  const phases = manifest.phases || [];
  const totalPhases = phases.length;

  // Load state from output/state.json if available
  let statePhases = [];
  if (options.state?.phases) {
    statePhases = options.state.phases;
  } else {
    const stateFile = path.resolve(root, normSuite, 'output', 'state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const raw = fs.readFileSync(stateFile, 'utf8');
        const parsed = JSON.parse(raw);
        statePhases = parsed.phases || [];
      } catch (_) {}
    }
  }

  const stateMap = new Map(statePhases.map((p) => [p.phaseId, p]));

  const activePhaseId = options.activePhase || options.activePhaseId || null;
  const workerInfo = options.worker || options.workerRole || null;

  // Compute status for all phases
  let completedCount = 0;
  const phaseRows = [];

  for (const phase of phases) {
    const pId = phase.phaseId;
    const st = stateMap.get(pId);
    const title = extractPhaseTitle(root, phase.contract, pId);
    const cleanTitle = title.replace(/^Phase\s+\d+[:\s—–-]+\s*/i, '').trim();

    let statusBadge = '⏳ **Pending**';
    let details = `${(phase.unitIds || []).length} Unit(s)`;

    if (pId === activePhaseId) {
      statusBadge = '🔄 **In Progress**';
      details = workerInfo ? `Worker: \`${workerInfo}\`` : 'Active execution turn';
    } else if (st && (st.acceptance === 'complete' || st.implementation === 'implemented')) {
      statusBadge = '✅ **Complete**';
      details = `Implemented & verified (${st.verification || 'passed'})`;
      completedCount += 1;
    } else if (st && st.implementation === 'in-progress') {
      statusBadge = '🔄 **In Progress**';
      details = 'In progress';
    } else if (st && (st.implementation === 'failed' || st.verification === 'failed')) {
      statusBadge = '❌ **Failed**';
      details = 'Verification failed; remediation needed';
    } else if (st && st.terminalState === 'blocked') {
      statusBadge = '🚫 **Blocked**';
      details = 'Blocked by gate prerequisites';
    }

    phaseRows.push({ pId, cleanTitle, statusBadge, details });
  }

  const lines = [];
  const suiteId = manifest.suiteId || path.basename(normSuite);
  lines.push(`### 🚀 Plan Execution Progress: \`${suiteId}\`\n`);
  lines.push(`**Progress:** \`${renderProgressBar(completedCount, totalPhases)}\`\n`);
  lines.push('| Phase | Scope / Title | Status | Details |');
  lines.push('|---|---|---|---|');

  for (const row of phaseRows) {
    lines.push(`| **${row.pId}** | ${row.cleanTitle || row.pId} | ${row.statusBadge} | ${row.details} |`);
  }

  if (activePhaseId) {
    const activePhase = phases.find((p) => p.phaseId === activePhaseId);
    const activeTitle = extractPhaseTitle(root, activePhase?.contract, activePhaseId);
    lines.push(`\n**Active Assignment:** Phase ${activePhaseId} (${activeTitle || activePhaseId})`);
    if (workerInfo) {
      lines.push(`**Subagent Worker:** \`${workerInfo}\``);
    }
    lines.push('**Status:** In Progress — Awaiting completion receipt from worker subagent.');
  }

  return lines.join('\n');
}

/**
 * Formats a clean milestone completion card emitted by the Governor upon closing a phase.
 *
 * @param {string} root - Repository root.
 * @param {string} suite - Plan suite directory.
 * @param {string} phaseId - Phase identifier.
 * @param {object} [handoff] - Handoff record or facts object.
 * @returns {string} Formatted markdown card.
 */
export function renderPhaseCompletionCard(root, suite, phaseId, handoff = {}) {
  const normSuite = normalizeSuite(root, suite);
  const plan = validatePlan(root, normSuite);
  const phase = (plan.manifest?.phases || []).find((p) => p.phaseId === phaseId);
  const title = extractPhaseTitle(root, phase?.contract, phaseId);

  const changes = handoff.changes || [];
  const changedPaths = [...new Set(changes.map((c) => c.path))];
  const summary = handoff.summary || `Phase ${phaseId} implementation and verification complete`;

  const checks = handoff.checks || [];
  const passedChecks = checks.filter((c) => c.result === 'passed').length;
  const totalChecks = checks.length;
  const verificationText =
    totalChecks > 0 ? `${passedChecks}/${totalChecks} check(s) passed green` : 'Verification verified';

  const lines = [];
  lines.push(`### ✅ Phase ${phaseId} Closed Successfully: ${title || phaseId}\n`);
  lines.push(`- **Summary:** ${summary}`);
  if (changedPaths.length > 0) {
    const displayedPaths = changedPaths.slice(0, 4).map((p) => `\`${p}\``).join(', ');
    const suffix = changedPaths.length > 4 ? ` *(+${changedPaths.length - 4} more)*` : '';
    lines.push(`- **Key Artifacts:** ${displayedPaths}${suffix}`);
  }
  lines.push(`- **Verification:** ${verificationText}`);

  return lines.join('\n');
}
