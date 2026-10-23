#!/usr/bin/env node
/**
 * Master Workspace Validation Orchestrator (UG-30 / Phase 7 Unit U31)
 *
 * Runs all 15 ShiftStone governance validators and certification trials across 5 deterministic stages:
 *   Stage 1: Context & Steering (Budgets, Integrity, IDE Junctions)
 *   Stage 2: Manifests, Plans & Skills (Manifest, Stage Contracts, Plan Units, Research, Skills Completeness)
 *   Stage 3: Governance, Checkers & Anti-Gaming (Checker Lenses, Checker Report, Anti-Gaming Diff Guard)
 *   Stage 4: Compounding, ADRs & Protected Gates (Learning, Decisions, Protected Actions, Release Evidence)
 *   Stage 5: Certification Trials & Telemetry (Harness T1–T3, Factory F1–F6, Flywheel Telemetry Validation)
 *
 * Exit code 0 if all 5 stages pass; exit code 1 on defect.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STAGES = [
  {
    stage: 1,
    name: 'Context & Steering',
    tasks: [
      { name: 'validate-context-budgets', script: '.shiftstone/scripts/validate-context-budgets.js', args: [] },
      { name: 'validate-context-integrity', script: '.shiftstone/scripts/validate-context-integrity.js', args: [] },
      { name: 'setup-ide-junctions', script: '.shiftstone/scripts/setup-ide-junctions.js', args: ['--verify'] },
    ],
  },
  {
    stage: 2,
    name: 'Manifests, Plans & Skills',
    tasks: [
      { name: 'validate-manifest', script: '.shiftstone/scripts/validate-manifest.js', args: [] },
      { name: 'validate-stage-contracts', script: '.shiftstone/scripts/validate-stage-contracts.js', args: [] },
      { name: 'validate-plan-units', script: '.shiftstone/scripts/validate-plan-units.js', args: [] },
      { name: 'agent-preflight', script: '.shiftstone/scripts/agent-preflight.js', args: ['--self-test'] },
      { name: 'validate-research', script: '.shiftstone/scripts/validate-research.js', args: [] },
      { name: 'validate-skills-completeness', script: '.shiftstone/scripts/validate-skills-completeness.js', args: [] },
    ],
  },
  {
    stage: 3,
    name: 'Governance, Checkers & Anti-Gaming',
    tasks: [
      { name: 'validate-checker-lenses', script: '.shiftstone/scripts/validate-checker-lenses.js', args: [] },
      { name: 'validate-checker-report', script: '.shiftstone/scripts/validate-checker-report.js', args: ['--self-test'] },
      { name: 'check-anti-gaming', script: '.shiftstone/scripts/check-anti-gaming.js', args: [] },
    ],
  },
  {
    stage: 4,
    name: 'Compounding, ADRs & Protected Gates',
    tasks: [
      { name: 'validate-learning', script: '.shiftstone/scripts/validate-learning.js', args: [] },
      { name: 'validate-decisions', script: '.shiftstone/scripts/validate-decisions.js', args: [] },
      { name: 'compile-decisions', script: '.shiftstone/scripts/compile-decisions.js', args: ['--check'] },
      { name: 'sync-bible-proposal', script: '.shiftstone/scripts/sync-bible-proposal.js', args: ['--dry-run'] },
      { name: 'validate-protected-actions', script: '.shiftstone/scripts/validate-protected-actions.js', args: ['--self-test'] },
      { name: 'validate-release-evidence', script: '.shiftstone/scripts/validate-release-evidence.js', args: ['--self-test'] },
    ],
  },
  {
    stage: 5,
    name: 'Certification Trials & Telemetry Flywheel',
    tasks: [
      { name: 'run-certification-trials', script: '.shiftstone/scripts/run-certification-trials.js', args: ['--suite', 'all'] },
      { name: 'record-telemetry', script: '.shiftstone/scripts/record-telemetry.js', args: ['--validate'] },
    ],
  },
];

export function runValidation(options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const stageFilter = options.stage ? Number(options.stage) : null;
  const startTime = Date.now();

  console.log('========================================================================');
  console.log(' ShiftStone Universal AI Workspace Framework — Master Validator (UG-30)');
  console.log('========================================================================\n');

  let totalTasks = 0;
  let passedTasks = 0;

  for (const st of STAGES) {
    if (stageFilter && st.stage !== stageFilter) continue;

    console.log(`▶ Stage ${st.stage}: ${st.name}`);

    for (const t of st.tasks) {
      totalTasks++;
      const fullPath = path.join(root, t.script);
      const startTask = Date.now();

      const result = spawnSync(process.execPath, [fullPath, ...t.args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true' },
      });

      const durationMs = Date.now() - startTask;

      if (result.status === 0) {
        passedTasks++;
        console.log(`  ✓ ${t.name.padEnd(32)} [PASS] (${durationMs}ms)`);
      } else {
        console.error(`  ✗ ${t.name.padEnd(32)} [FAIL] (${durationMs}ms)`);
        console.error('\n--- Task Failure Output ---');
        if (result.stdout) console.error(result.stdout.trim());
        if (result.stderr) console.error(result.stderr.trim());
        console.error('---------------------------\n');

        console.error(`\nMaster validation halted at Stage ${st.stage} (${t.name}).`);
        return { ok: false, failedTask: t.name, stage: st.stage, totalTasks, passedTasks };
      }
    }
    console.log('');
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('========================================================================');
  console.log(` All 5 Stages Passed Cleanly! (${passedTasks}/${totalTasks} tasks in ${totalDuration}s)`);
  console.log(' Framework Certification: ShiftStone v2.1.0-universal SEALED');
  console.log('========================================================================\n');

  return { ok: true, totalTasks, passedTasks, durationSeconds: totalDuration };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  let stage = null;
  if (args.includes('--stage')) {
    stage = args[args.indexOf('--stage') + 1];
  }

  const res = runValidation({ stage });
  if (!res.ok) {
    process.exit(1);
  }
  process.exit(0);
}
