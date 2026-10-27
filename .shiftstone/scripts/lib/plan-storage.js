import fs from 'node:fs';
import path from 'node:path';
import { resolveRepoPath, validateSchema } from './plan-schema.js';
import { validatePlan } from './plan-graph.js';
import { projectPhase, renderStatusTable } from './plan-state.js';
import { loadHandoffs } from './plan-resume.js';
import { digest } from './plan-source.js';

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // Process exists but lacks permissions
  }
}

/**
 * Executes a callback holding an exclusive lock on the suite.
 */
export function withLock(root, suite, callback) {
  const outputDir = resolveRepoPath(root, `${suite}/output`, { mustExist: false });
  fs.mkdirSync(outputDir, { recursive: true });
  const lockPath = path.join(outputDir, '.lock');

  let fd = null;
  const now = Date.now();
  try {
    fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, time: now }) + '\n');
  } catch (err) {
    if (err.code === 'EEXIST') {
      try {
        const info = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        if (now - (info.time || 0) > 30000 && info.pid && !isProcessAlive(info.pid)) {
          // Stale lock from dead process
          try {
            fs.unlinkSync(lockPath);
          } catch (_) {}
          fd = fs.openSync(lockPath, 'wx');
          fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, time: now }) + '\n');
        } else {
          const contentionErr = new Error(`Lock contention on suite: ${suite}`);
          contentionErr.code = 'LOCK_CONTENTION';
          contentionErr.exitCode = 3;
          throw contentionErr;
        }
      } catch (inner) {
        if (inner.code === 'LOCK_CONTENTION') throw inner;
        const contentionErr = new Error(`Lock contention on suite: ${suite}`);
        contentionErr.code = 'LOCK_CONTENTION';
        contentionErr.exitCode = 3;
        throw contentionErr;
      }
    } else {
      throw err;
    }
  }

  try {
    return callback();
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (_) {}
      try {
        fs.unlinkSync(lockPath);
      } catch (_) {}
    }
  }
}

/**
 * Recovers interrupted writes from pending transaction journal.
 */
export function recoverJournal(root, suite) {
  const outputDir = resolveRepoPath(root, `${suite}/output`, { mustExist: false });
  const journalFiles = ['.transaction.json', 'journal.json'];

  for (const jFile of journalFiles) {
    const journalPath = path.join(outputDir, jFile);
    if (!fs.existsSync(journalPath)) continue;

    try {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      let allApplied = true;
      for (const item of journal.pendingWrites || []) {
        const full = resolveRepoPath(root, item.path, { mustExist: false });
        if (!fs.existsSync(full)) {
          allApplied = false;
          break;
        }
        const existing = fs.readFileSync(full, 'utf8');
        if (existing !== item.content) {
          allApplied = false;
          break;
        }
      }

      if (allApplied) {
        fs.unlinkSync(journalPath);
      } else {
        // Re-apply pending writes from journal
        for (const item of journal.pendingWrites || []) {
          const full = resolveRepoPath(root, item.path, { mustExist: false });
          fs.mkdirSync(path.dirname(full), { recursive: true });
          const temp = `${full}.tmp.${Date.now()}`;
          fs.writeFileSync(temp, item.content, 'utf8');
          fs.renameSync(temp, full);
        }
        fs.unlinkSync(journalPath);
      }
    } catch (err) {
      const recoveryErr = new Error(`Journal recovery failed: ${err.message}`);
      recoveryErr.code = 'JOURNAL_RECOVERY_FAILED';
      recoveryErr.exitCode = 3;
      throw recoveryErr;
    }
  }
}

/**
 * Commits writes atomically with a transaction journal.
 */
export function commitTransaction(root, suite, { oldRevision, newRevision, handoffRef, pendingWrites }) {
  const outputDir = resolveRepoPath(root, `${suite}/output`, { mustExist: false });
  fs.mkdirSync(outputDir, { recursive: true });
  const journalPath = path.join(outputDir, '.transaction.json');
  const transactionId = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const journal = {
    transactionId,
    oldRevision,
    newRevision,
    handoffRef,
    pendingWrites,
  };

  const tempJournal = `${journalPath}.tmp.${Date.now()}`;
  fs.writeFileSync(tempJournal, JSON.stringify(journal, null, 2) + '\n', 'utf8');
  fs.renameSync(tempJournal, journalPath);

  for (const item of pendingWrites) {
    const full = resolveRepoPath(root, item.path, { mustExist: false });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    const tempFile = `${full}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tempFile, item.content, 'utf8');
    fs.renameSync(tempFile, full);
  }

  try {
    fs.unlinkSync(journalPath);
  } catch (_) {}
}

/**
 * Mutates plan state under CAS concurrency locking and atomic file renaming.
 * @param {string} root
 * @param {string} suite
 * @param {{ handoff: any, handoffRef: any, expectedRevision?: number | null, logEntry?: string | null, updateReadme?: boolean, options?: any }} params
 */
export function savePhaseState(
  root,
  suite,
  { handoff, handoffRef, expectedRevision = null, logEntry = null, updateReadme = true, options = {} }
) {
  return withLock(root, suite, () => {
    recoverJournal(root, suite);

    const statePath = `${suite}/output/state.json`;
    let currentRevision = 0;
    if (fs.existsSync(resolveRepoPath(root, statePath, { mustExist: false }))) {
      try {
        const existingState = JSON.parse(fs.readFileSync(resolveRepoPath(root, statePath), 'utf8'));
        currentRevision = existingState.revision || 0;
      } catch (_) {}
    }

    if (expectedRevision !== undefined && expectedRevision !== null) {
      if (Number(expectedRevision) !== currentRevision) {
        const casErr = new Error(
          `CAS mismatch: expected revision ${expectedRevision}, but current revision is ${currentRevision}`
        );
        casErr.code = 'CAS_MISMATCH';
        casErr.exitCode = 3;
        throw casErr;
      }
    }

    const plan = validatePlan(root, suite);
    if (plan.status !== 'valid') {
      const err = new Error(`Cannot save state for invalid plan: ${suite}`);
      err.exitCode = 1;
      throw err;
    }

    const { handoffs, handoffRefs } = loadHandoffs(root, plan);
    handoffs.set(handoff.phaseId, handoff);
    handoffRefs.set(handoff.phaseId, handoffRef);

    const allIssues = [...handoffs.values()].flatMap((h) => h.issues || []);
    const projectedPhases = plan.manifest.phases.map((p) => {
      return projectPhase(root, plan, p, handoffs.get(p.phaseId) || null, { ...options, issues: allIssues });
    });

    const newRevision = currentRevision + 1;
    const suiteDefinitionDigest = digest(
      projectedPhases
        .map((p) => ({ phaseId: p.phaseId, definitionSha256: p.definitionSha256 }))
        .sort((a, b) => a.phaseId.localeCompare(b.phaseId))
    );

    const newState = {
      schema: 'plan-state/v1',
      suiteId: plan.manifest.suiteId,
      revision: newRevision,
      definitionSha256: suiteDefinitionDigest,
      updatedAt: new Date().toISOString(),
      phases: projectedPhases.map((p) => ({
        phaseId: p.phaseId,
        selectedHandoffRef: handoffRefs.get(p.phaseId) || null,
        implementation: p.implementation,
        verification: p.verification,
        review: p.review,
        acceptance: p.acceptance,
      })),
    };

    const stateErrors = validateSchema(newState, 'plan-state/v1');
    if (stateErrors.length) {
      const err = new Error(`Generated state schema validation failed: ${stateErrors.join('; ')}`);
      err.exitCode = 1;
      throw err;
    }

    const pendingWrites = [
      {
        path: handoffRef.path,
        content: JSON.stringify(handoff, null, 2) + '\n',
      },
      {
        path: statePath,
        content: JSON.stringify(newState, null, 2) + '\n',
      },
    ];

    if (logEntry) {
      const logPath = `${suite}/output/log.md`;
      const fullLog = resolveRepoPath(root, logPath, { mustExist: false });
      let currentLog = '';
      if (fs.existsSync(fullLog)) {
        currentLog = fs.readFileSync(fullLog, 'utf8');
      } else {
        currentLog = `---\ntype: "log"\ntitle: "${plan.manifest.suiteId} Execution Log"\ncomponent: "workspace"\n---\n# Execution Log\n\n| Date | Phase | Observation | Evidence |\n|---|---|---|---|\n`;
      }
      const updatedLog = currentLog.trimEnd() + '\n' + logEntry.trim() + '\n';
      pendingWrites.push({
        path: logPath,
        content: updatedLog,
      });
    }

    if (updateReadme) {
      const readmePath = `${suite}/README.md`;
      const fullReadme = resolveRepoPath(root, readmePath, { mustExist: false });
      if (fs.existsSync(fullReadme)) {
        const readme = fs.readFileSync(fullReadme, 'utf8');
        if (/<!-- plan-status:start -->[\s\S]*?<!-- plan-status:end -->/.test(readme)) {
          const table = renderStatusTable(projectedPhases);
          const newReadme = readme.replace(
            /<!-- plan-status:start -->[\s\S]*?<!-- plan-status:end -->/,
            `<!-- plan-status:start -->\n${table}\n<!-- plan-status:end -->`
          );
          pendingWrites.push({
            path: readmePath,
            content: newReadme,
          });
        }
      }
    }

    commitTransaction(root, suite, {
      oldRevision: currentRevision,
      newRevision,
      handoffRef,
      pendingWrites,
    });

    return { state: newState, revision: newRevision };
  });
}
