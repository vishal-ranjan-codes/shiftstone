#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { resumePhase, suiteStatus } from './lib/plan-resume.js';
import { beginPhase, verifyCheck, checkpointPhase, closePhase } from './lib/plan-execution.js';
import { renderStatus } from './lib/plan-render.js';
import { adoptPlan } from './lib/plan-adoption.js';

export function parseArgs(argv) {
  const action = argv[2];
  let suite = null;
  const options = { mode: 'implement', json: false, check: false, write: false, dryRun: false };

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--check') {
      if (action === 'verify' && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        options.checkId = argv[++i];
      } else {
        options.check = true;
      }
    } else if (arg === '--check-id' && i + 1 < argv.length) {
      options.checkId = argv[++i];
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--phase' && i + 1 < argv.length) {
      options.phase = argv[++i];
    } else if (arg === '--mode' && i + 1 < argv.length) {
      options.mode = argv[++i];
    } else if (arg === '--facts' && i + 1 < argv.length) {
      options.facts = argv[++i];
    } else if (arg === '--expected-revision' && i + 1 < argv.length) {
      options.expectedRevision = Number(argv[++i]);
    } else if (arg === '--actor' && i + 1 < argv.length) {
      options.actor = argv[++i];
    } else if (arg === '--environment-file' && i + 1 < argv.length) {
      const envPath = argv[++i];
      try {
        options.environment = JSON.parse(fs.readFileSync(envPath, 'utf8'));
      } catch (e) {
        console.error(`Failed to read environment file: ${e.message}`);
        process.exit(1);
      }
    } else if (!arg.startsWith('--') && !suite) {
      suite = arg;
    }
  }

  return { action, suite, options };
}

export function printHelp() {
  console.log(`Usage: node .shiftstone/scripts/plan.js <action> <suite> [options]

Actions:
  status                                Show all axes, freshness, gaps, and suggested next action
  resume --phase <ID>                   Validate prerequisites and emit bounded reading packet
  begin --phase <ID>                    Record entry snapshot and preservation inventory
  verify --phase <ID> --check <ID>      Run manifest automated check and capture raw output
  checkpoint --phase <ID> --facts <F>   Append immutable handoff attempt and atomically refresh state
  close --phase <ID> --facts <F>        Verify strict acceptance gate and close phase
  render [--check|--write]              Compare or update managed README status spans
  adopt [--dry-run|--write]             Propose or apply an opt-in manifest/state migration without changing source or historical reports
`);
}

export function runCli(argv = process.argv, root = process.cwd()) {
  const { action, suite, options } = parseArgs(argv);

  if (!action || action === '--help' || action === '-h') {
    printHelp();
    return 0;
  }

  if (!suite) {
    console.error('Error: suite path is required (e.g. docs/plans/sample)');
    return 1;
  }

  if (action === 'status') {
    const result = suiteStatus(root, suite, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Suite: ${result.suiteId || suite} (${suite}) — Status: ${result.status}\n`);
      if (result.statusTable) console.log(result.statusTable + '\n');
      if (result.diagnostics?.length) {
        console.log('Diagnostics:');
        result.diagnostics.forEach((d) => console.log(`  - [${d.code}] ${d.message}`));
      }
    }
    return result.exitCode;
  }

  if (action === 'resume') {
    if (!options.phase) {
      console.error('Error: --phase <ID> is required for resume');
      return 1;
    }
    const result = resumePhase(root, suite, options.phase, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(
        `Resume Phase ${result.phaseId} (${result.suiteId}) — Mode: ${result.mode} — Ready: ${result.ready}`
      );
      if (result.statuses) {
        console.log(
          `  Implementation: ${result.statuses.implementation} | Verification: ${result.statuses.verification} | Review: ${result.statuses.review} | Acceptance: ${result.statuses.acceptance} | Freshness: ${result.statuses.freshness}`
        );
      }
      if (result.readTargets?.length) {
        console.log('\nBounded readTargets:');
        result.readTargets.forEach((t) => console.log(`  - ${t}`));
      }
      if (result.regressionCheckIds?.length) {
        console.log('\nRegression checks to run:');
        result.regressionCheckIds.forEach((c) => console.log(`  - ${c}`));
      }
      if (result.firstAction) {
        console.log(`\nNext Action: ${result.firstAction}`);
      }
      if (result.diagnostics?.length) {
        console.log('\nDiagnostics:');
        result.diagnostics.forEach((d) => console.log(`  - [${d.code}] ${d.message}`));
      }
    }
    return result.exitCode;
  }

  if (action === 'begin') {
    if (!options.phase) {
      console.error('Error: --phase <ID> is required for begin');
      return 1;
    }
    const result = beginPhase(root, suite, options.phase, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.success) {
      console.log(`Phase ${options.phase} began successfully at attempt 1.`);
    } else {
      console.error(`Error: ${result.error}`);
      if (result.diagnostics?.length) {
        result.diagnostics.forEach((d) => console.error(`  - [${d.code}] ${d.message}`));
      }
    }
    return result.exitCode;
  }

  if (action === 'verify') {
    if (!options.phase) {
      console.error('Error: --phase <ID> is required for verify');
      return 1;
    }
    const checkId = options.checkId;
    if (!checkId) {
      console.error('Error: --check <ID> is required for verify');
      return 1;
    }
    const result = verifyCheck(root, suite, options.phase, checkId, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.success) {
      console.log(`Check ${checkId}: ${result.checkResult?.result} (${result.checkResult?.reason})`);
    } else {
      console.error(`Error: ${result.error}`);
    }
    return result.exitCode;
  }

  if (action === 'checkpoint') {
    if (!options.phase) {
      console.error('Error: --phase <ID> is required for checkpoint');
      return 1;
    }
    if (!options.facts) {
      console.error('Error: --facts <path> is required for checkpoint');
      return 1;
    }
    const result = checkpointPhase(root, suite, options.phase, options.facts, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.success) {
      console.log(`Phase ${options.phase} checkpoint attempt ${result.handoff?.attempt} recorded.`);
    } else {
      console.error(`Error: ${result.error}`);
    }
    return result.exitCode;
  }

  if (action === 'close') {
    if (!options.phase) {
      console.error('Error: --phase <ID> is required for close');
      return 1;
    }
    if (!options.facts) {
      console.error('Error: --facts <path> is required for close');
      return 1;
    }
    const result = closePhase(root, suite, options.phase, options.facts, options);
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.success) {
      console.log(`Phase ${options.phase} closed successfully.`);
    } else {
      console.error(`Error: ${result.error}`);
      if (result.projected?.diagnostics?.length) {
        result.projected.diagnostics.forEach((d) => console.error(`  - [${d.code}] ${d.message}`));
      }
    }
    return result.exitCode;
  }

  if (action === 'render') {
    const result = renderStatus(root, suite, {
      checkOnly: options.check,
      write: options.write,
      expectedRevision: options.expectedRevision,
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.matches !== undefined) {
      console.log(`Status table matches: ${result.matches}`);
      if (result.table) console.log('\n' + result.table);
    } else if (result.success) {
      console.log('Managed status table written to README.md');
      if (result.table) console.log('\n' + result.table);
    } else {
      console.error(`Error: ${result.error}`);
    }
    return result.exitCode;
  }

  if (action === 'adopt') {
    const result = adoptPlan(root, suite, {
      write: options.write,
      dryRun: options.dryRun,
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.success) {
      console.log(`Adoption completed for ${suite}:`);
      console.log(`  Manifest: ${result.manifestPath}`);
      console.log(`  State: ${result.statePath}`);
    } else if (result.eligible) {
      console.log(`Suite ${suite} is eligible for adoption.`);
    } else {
      console.error(`Adoption error: ${result.error || 'Conflicts detected'}`);
      if (result.conflicts?.length) {
        result.conflicts.forEach((c) => console.error(`  - ${c}`));
      }
    }
    return result.exitCode || 0;
  }

  console.error(`Error: unknown action "${action}"`);
  printHelp();
  return 1;
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('plan.js') || process.argv[1].replace(/\\/g, '/').endsWith('.shiftstone/scripts/plan.js'));

if (isDirectRun) {
  const exitCode = runCli(process.argv, process.cwd());
  process.exit(exitCode);
}
