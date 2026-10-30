/**
 * Plan Orchestrate CLI Command (Unit U11 / REQ-11)
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeSuite } from './plan-schema.js';
import { verifyCheck } from './plan-execution.js';

export function createVerificationDispatcher(root, suite, manifest) {
  const normSuite = normalizeSuite(root, suite);
  return async (phaseId) => {
    const phase = (manifest.phases || []).find((p) => p.phaseId === phaseId);
    if (!phase) {
      return { phaseId, exitCode: 1, status: 'blocked', error: `Phase ${phaseId} not found in manifest` };
    }
    const checks = phase.checks || [];
    if (checks.length === 0) {
      return { phaseId, exitCode: 0, status: 'success' };
    }
    for (const check of checks) {
      if (check.kind !== 'automated') continue;
      try {
        const res = verifyCheck(root, normSuite, phaseId, check.id);
        if (!res.success || res.checkResult?.result !== 'passed') {
          return {
            phaseId,
            exitCode: 2,
            status: 'blocked',
            error: `Check ${check.id} failed: ${res.checkResult?.reason || res.error || 'Verification check unmet'}`,
          };
        }
      } catch (err) {
        return {
          phaseId,
          exitCode: 2,
          status: 'blocked',
          error: `Check ${check.id} execution error: ${err.message}`,
        };
      }
    }
    return { phaseId, exitCode: 0, status: 'success' };
  };
}

export class PlanGovernorJs {
  constructor({ root, suite, manifest, dispatcher, maxRetries = 3 }) {
    this.root = root || process.cwd();
    this.suite = suite || '';
    this.manifest = manifest;
    this.dispatcher = dispatcher || createVerificationDispatcher(this.root, this.suite, this.manifest);
    this.maxRetries = maxRetries;
  }

  resolvePhasesDAG() {
    const phases = this.manifest.phases || [];
    const phaseMap = new Map(phases.map((p) => [p.phaseId, p]));
    const inDegree = new Map(phases.map((p) => [p.phaseId, 0]));
    const adj = new Map(phases.map((p) => [p.phaseId, []]));

    for (const p of phases) {
      for (const d of p.dependsOn || []) {
        const depId = typeof d === 'string' ? d : d.phaseId;
        if (adj.has(depId)) {
          adj.get(depId).push(p.phaseId);
          inDegree.set(p.phaseId, (inDegree.get(p.phaseId) || 0) + 1);
        }
      }
    }

    const queue = phases.filter((p) => inDegree.get(p.phaseId) === 0).map((p) => p.phaseId);
    const sorted = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      sorted.push(phaseMap.get(curr));
      for (const next of adj.get(curr) || []) {
        inDegree.set(next, inDegree.get(next) - 1);
        if (inDegree.get(next) === 0) {
          queue.push(next);
        }
      }
    }

    if (sorted.length < phases.length) {
      return phases;
    }
    return sorted;
  }

  async run() {
    const sortedPhases = this.resolvePhasesDAG();
    const executedOrder = [];
    const phaseResults = {};

    let governorStatus = 'running';
    let terminalState = 'success';

    for (const phase of sortedPhases) {
      const phaseId = phase.phaseId;
      executedOrder.push(phaseId);

      let attempts = 0;
      let phaseCompleted = false;
      let lastDiffHash = null;

      while (!phaseCompleted) {
        attempts++;
        const mode = attempts > 1 ? 'remediate' : 'implement';

        const dispatchResult = await this.dispatcher(phaseId, {
          mode,
          suite: this.suite,
        });

        if (dispatchResult.exitCode === 0 && dispatchResult.status === 'success') {
          phaseResults[phaseId] = {
            phaseId,
            status: 'success',
            exitCode: 0,
            turns: attempts,
          };
          phaseCompleted = true;
        } else if (dispatchResult.status === 'blocked') {
          governorStatus = 'blocked';
          terminalState = 'blocked';
          phaseResults[phaseId] = {
            phaseId,
            status: 'blocked',
            exitCode: dispatchResult.exitCode || 2,
            error: dispatchResult.error || `Phase ${phaseId} execution blocked`,
            turns: attempts,
          };
          return {
            suiteId: this.manifest.suiteId || this.suite,
            status: governorStatus,
            terminalState,
            executedPhases: executedOrder,
            phaseResults,
          };
        } else {
          // Check stagnation & circuit breaker
          if (dispatchResult.diffHash && dispatchResult.diffHash === lastDiffHash) {
            governorStatus = 'stalled';
            terminalState = 'stalled';
            phaseResults[phaseId] = {
              phaseId,
              status: 'stalled',
              exitCode: dispatchResult.exitCode || 1,
              error: 'STAGNATION_DETECTED: Identical diff hash across consecutive attempts',
              turns: attempts,
            };
            return {
              suiteId: this.manifest.suiteId || this.suite,
              status: governorStatus,
              terminalState,
              executedPhases: executedOrder,
              phaseResults,
            };
          }
          lastDiffHash = dispatchResult.diffHash || null;

          if (attempts >= this.maxRetries) {
            governorStatus = 'failed';
            terminalState = 'exhausted';
            phaseResults[phaseId] = {
              phaseId,
              status: 'failed',
              exitCode: dispatchResult.exitCode || 1,
              error: 'CIRCUIT_BREAKER_TRIPPED: Maximum retries exceeded',
              turns: attempts,
            };
            return {
              suiteId: this.manifest.suiteId || this.suite,
              status: governorStatus,
              terminalState,
              executedPhases: executedOrder,
              phaseResults,
            };
          }
        }
      }
    }

    governorStatus = 'completed';
    terminalState = 'success';

    return {
      suiteId: this.manifest.suiteId || this.suite,
      status: governorStatus,
      terminalState,
      executedPhases: executedOrder,
      phaseResults,
    };
  }
}

export async function runOrchestrate(root, suite, options = {}) {
  const normSuite = normalizeSuite(root, suite);
  const suiteDir = path.isAbsolute(normSuite) ? normSuite : path.join(root, normSuite);
  const manifestPath = path.join(suiteDir, 'plan-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return {
      success: false,
      status: 'failed',
      exitCode: 1,
      error: `Manifest not found at ${manifestPath}`,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      exitCode: 1,
      error: `Malformed manifest at ${manifestPath}: ${err.message}`,
    };
  }

  let effectiveManifest = manifest;
  if (options.phase) {
    const targetPhase = (manifest.phases || []).find((p) => p.phaseId === options.phase);
    if (!targetPhase) {
      return {
        success: false,
        status: 'failed',
        exitCode: 1,
        error: `Phase ${options.phase} not found in manifest`,
      };
    }
    effectiveManifest = {
      ...manifest,
      phases: [targetPhase],
    };
  }

  try {
    const governor =
      options.governor ||
      new PlanGovernorJs({
        root,
        suite,
        manifest: effectiveManifest,
        dispatcher: options.dispatcher,
        maxRetries: options.maxRetries ?? 3,
      });

    const summary = await governor.run();

    let exitCode = 0;
    if (summary.status === 'blocked' || summary.terminalState === 'blocked') {
      exitCode = 2;
    } else if (
      summary.status === 'failed' ||
      summary.status === 'stalled' ||
      summary.terminalState === 'error' ||
      summary.terminalState === 'stalled' ||
      summary.terminalState === 'exhausted'
    ) {
      exitCode = 1;
    } else if (summary.status === 'completed' || summary.terminalState === 'success') {
      exitCode = 0;
    }

    const lines = [
      `Suite: ${summary.suiteId || suite} — Orchestration Status: ${summary.status} (exit ${exitCode})`,
      '',
      '| Phase | Status | Turns | Exit Code |',
      '|---|---|---|---|',
    ];
    for (const [pid, res] of Object.entries(summary.phaseResults || {})) {
      lines.push(`| ${pid} | ${res.status} | ${res.turns || 1} | ${res.exitCode} |`);
    }

    return {
      success: exitCode === 0,
      status: summary.status,
      terminalState: summary.terminalState,
      exitCode,
      summary,
      summaryTable: lines.join('\n'),
    };
  } catch (err) {
    return {
      success: false,
      status: 'failed',
      exitCode: 1,
      error: `Governor execution failed: ${err.message || String(err)}`,
    };
  }
}
