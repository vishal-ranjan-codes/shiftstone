#!/usr/bin/env node
/**
 * Continuous Quality Flywheel Telemetry & Trajectory Recorder (UG-27 / Phase 7 Unit U28)
 *
 * Enforces:
 *   1. trajectory/v1 schema validation for loop/trial provenance records.
 *   2. telemetry/v1 schema validation for flywheel JSONL records.
 *   3. Appends structured execution metrics to .logs/telemetry/flywheel.jsonl.
 *   4. --validate flag validates existing telemetry lines and schema self-tests.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const TELEMETRY_DIR = path.join(ROOT, '.logs', 'telemetry');
export const TELEMETRY_FILE = path.join(TELEMETRY_DIR, 'flywheel.jsonl');

export const VALID_TERMINAL_STATES = ['success', 'no_op', 'blocked', 'stalled', 'exhausted', 'failed'];
export const VALID_STEP_OUTCOMES = ['passed', 'failed', 'blocked', 'skipped', 'no_op'];

/**
 * Validates a trajectory/v1 record.
 */
export function validateTrajectory(record) {
  const violations = [];

  if (!record || typeof record !== 'object') {
    return {
      ok: false,
      violations: [{ code: 'INVALID_RECORD', message: 'Trajectory record must be a JSON object' }],
    };
  }

  if (record.schemaVersion !== 'trajectory/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion must be 'trajectory/v1', got '${record.schemaVersion}'`,
    });
  }

  if (!record.runId || typeof record.runId !== 'string' || record.runId.trim().length < 3) {
    violations.push({
      code: 'INVALID_RUN_ID',
      message: `runId must be a non-empty string (length >= 3), got '${record.runId}'`,
    });
  }

  if (!record.trialId || typeof record.trialId !== 'string' || record.trialId.trim().length < 2) {
    violations.push({
      code: 'INVALID_TRIAL_ID',
      message: `trialId must be a non-empty string (length >= 2), got '${record.trialId}'`,
    });
  }

  if (!record.timestamp || isNaN(Date.parse(record.timestamp))) {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      message: `timestamp must be valid ISO-8601 string, got '${record.timestamp}'`,
    });
  }

  if (!Array.isArray(record.steps)) {
    violations.push({
      code: 'MISSING_STEPS',
      message: 'steps must be an array',
    });
  } else {
    record.steps.forEach((step, idx) => {
      if (typeof step.stepIndex !== 'number' || step.stepIndex < 0) {
        violations.push({
          code: 'INVALID_STEP_INDEX',
          message: `steps[${idx}].stepIndex must be a non-negative integer`,
        });
      }
      if (!step.toolName || typeof step.toolName !== 'string') {
        violations.push({
          code: 'INVALID_TOOL_NAME',
          message: `steps[${idx}].toolName must be a non-empty string`,
        });
      }
      if (!VALID_STEP_OUTCOMES.includes(step.outcome)) {
        violations.push({
          code: 'INVALID_STEP_OUTCOME',
          message: `steps[${idx}].outcome must be one of ${VALID_STEP_OUTCOMES.join(', ')}, got '${step.outcome}'`,
        });
      }
      if (typeof step.tokensUsed !== 'number' || step.tokensUsed < 0) {
        violations.push({
          code: 'INVALID_STEP_TOKENS',
          message: `steps[${idx}].tokensUsed must be a non-negative number`,
        });
      }
    });
  }

  if (record.verificationLevel === undefined || record.verificationLevel === null) {
    violations.push({
      code: 'MISSING_VERIFICATION_LEVEL',
      message: 'verificationLevel is required',
    });
  }

  if (typeof record.tokensUsed !== 'number' || record.tokensUsed < 0) {
    violations.push({
      code: 'INVALID_TOKENS_USED',
      message: `tokensUsed must be a non-negative integer, got '${record.tokensUsed}'`,
    });
  }

  if (!VALID_TERMINAL_STATES.includes(record.terminalState)) {
    violations.push({
      code: 'INVALID_TERMINAL_STATE',
      message: `terminalState must be one of ${VALID_TERMINAL_STATES.join(', ')}, got '${record.terminalState}'`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Validates a telemetry/v1 record.
 */
export function validateTelemetry(record) {
  const violations = [];

  if (!record || typeof record !== 'object') {
    return {
      ok: false,
      violations: [{ code: 'INVALID_RECORD', message: 'Telemetry record must be a JSON object' }],
    };
  }

  if (record.schemaVersion !== 'telemetry/v1') {
    violations.push({
      code: 'INVALID_SCHEMA_VERSION',
      message: `schemaVersion must be 'telemetry/v1', got '${record.schemaVersion}'`,
    });
  }

  if (!record.timestamp || isNaN(Date.parse(record.timestamp))) {
    violations.push({
      code: 'INVALID_TIMESTAMP',
      message: `timestamp must be valid ISO-8601 string, got '${record.timestamp}'`,
    });
  }

  if (!record.runId || typeof record.runId !== 'string' || record.runId.trim().length < 3) {
    violations.push({
      code: 'INVALID_RUN_ID',
      message: `runId must be a non-empty string, got '${record.runId}'`,
    });
  }

  if (!record.pack || typeof record.pack !== 'string' || record.pack.trim().length < 1) {
    violations.push({
      code: 'INVALID_PACK',
      message: `pack must be a non-empty string, got '${record.pack}'`,
    });
  }

  if (!record.loopPattern || typeof record.loopPattern !== 'string' || record.loopPattern.trim().length < 1) {
    violations.push({
      code: 'INVALID_LOOP_PATTERN',
      message: `loopPattern must be a non-empty string, got '${record.loopPattern}'`,
    });
  }

  if (typeof record.iterations !== 'number' || record.iterations < 0 || !Number.isInteger(record.iterations)) {
    violations.push({
      code: 'INVALID_ITERATIONS',
      message: `iterations must be a non-negative integer, got '${record.iterations}'`,
    });
  }

  if (!VALID_TERMINAL_STATES.includes(record.terminalState)) {
    violations.push({
      code: 'INVALID_TERMINAL_STATE',
      message: `terminalState must be one of ${VALID_TERMINAL_STATES.join(', ')}, got '${record.terminalState}'`,
    });
  }

  if (record.brakeTriggered !== null && typeof record.brakeTriggered !== 'boolean' && typeof record.brakeTriggered !== 'string') {
    violations.push({
      code: 'INVALID_BRAKE_TRIGGERED',
      message: 'brakeTriggered must be a boolean, string, or null',
    });
  }

  if (record.checkerNormalizedScore !== undefined && record.checkerNormalizedScore !== null) {
    if (typeof record.checkerNormalizedScore !== 'number' || record.checkerNormalizedScore < 0 || record.checkerNormalizedScore > 100) {
      violations.push({
        code: 'INVALID_CHECKER_SCORE',
        message: `checkerNormalizedScore must be between 0 and 100, got '${record.checkerNormalizedScore}'`,
      });
    }
  }

  if (typeof record.totalTokens !== 'number' || record.totalTokens < 0) {
    violations.push({
      code: 'INVALID_TOTAL_TOKENS',
      message: `totalTokens must be a non-negative number, got '${record.totalTokens}'`,
    });
  }

  if (typeof record.costUsd !== 'number' || record.costUsd < 0) {
    violations.push({
      code: 'INVALID_COST_USD',
      message: `costUsd must be a non-negative number, got '${record.costUsd}'`,
    });
  }

  if (typeof record.durationMs !== 'number' || record.durationMs < 0) {
    violations.push({
      code: 'INVALID_DURATION_MS',
      message: `durationMs must be a non-negative number, got '${record.durationMs}'`,
    });
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}

/**
 * Appends a telemetry record to the JSONL flywheel file.
 */
export function recordTelemetry(entry, options = {}) {
  const filePath = options.filePath ?? TELEMETRY_FILE;
  const dirPath = path.dirname(filePath);

  const val = validateTelemetry(entry);
  if (!val.ok) {
    const errorMsg = `Telemetry validation failed: ${val.violations.map((v) => v.message).join('; ')}`;
    throw new Error(errorMsg);
  }

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  const line = JSON.stringify(entry) + '\n';
  appendFileSync(filePath, line, 'utf8');
  return { ok: true, line: entry };
}

/**
 * Validates the telemetry flywheel log file if present.
 */
export function validateTelemetryLog(filePath = TELEMETRY_FILE) {
  if (!existsSync(filePath)) {
    return { ok: true, totalLines: 0, validLines: 0, violations: [] };
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const violations = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line);
      const val = validateTelemetry(parsed);
      if (!val.ok) {
        violations.push({
          line: index + 1,
          violations: val.violations,
        });
      }
    } catch (e) {
      violations.push({
        line: index + 1,
        violations: [{ code: 'INVALID_JSON', message: e.message }],
      });
    }
  });

  return {
    ok: violations.length === 0,
    totalLines: lines.length,
    validLines: lines.length - violations.length,
    violations,
  };
}

/**
 * Runs self-test fixtures.
 */
export function runSelfTest() {
  const sampleTrajectory = {
    schemaVersion: 'trajectory/v1',
    runId: 'run-selftest-001',
    trialId: 'T1-context-gate',
    timestamp: new Date().toISOString(),
    verificationLevel: 2,
    tokensUsed: 1250,
    terminalState: 'success',
    steps: [
      {
        stepIndex: 0,
        toolName: 'validate-context-budgets',
        targetPath: 'AGENTS.md',
        verificationLevel: 1,
        outcome: 'passed',
        tokensUsed: 450,
      },
      {
        stepIndex: 1,
        toolName: 'validate-stage-contracts',
        targetPath: 'docs/plans/',
        verificationLevel: 2,
        outcome: 'passed',
        tokensUsed: 800,
      },
    ],
  };

  const sampleTelemetry = {
    schemaVersion: 'telemetry/v1',
    timestamp: new Date().toISOString(),
    runId: 'run-selftest-001',
    trialId: 'T1-context-gate',
    pack: 'core',
    loopPattern: 'A_define_done',
    iterations: 2,
    terminalState: 'success',
    brakeTriggered: null,
    checkerNormalizedScore: 92.5,
    totalTokens: 1250,
    costUsd: 0.00375,
    durationMs: 420,
  };

  const trajVal = validateTrajectory(sampleTrajectory);
  if (!trajVal.ok) {
    throw new Error(`Self-test failed for trajectory: ${JSON.stringify(trajVal.violations)}`);
  }

  const telVal = validateTelemetry(sampleTelemetry);
  if (!telVal.ok) {
    throw new Error(`Self-test failed for telemetry: ${JSON.stringify(telVal.violations)}`);
  }

  return { ok: true };
}

// CLI Execution
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const isValidate = args.includes('--validate') || args.includes('--self-test');

  try {
    // Run self-test
    runSelfTest();

    if (isValidate) {
      const logVal = validateTelemetryLog();
      if (!logVal.ok) {
        console.error(`=== Flywheel Telemetry Validation FAILED ===`);
        logVal.violations.forEach((v) => {
          console.error(`  Line ${v.line}: ${v.violations.map((vi) => vi.message).join('; ')}`);
        });
        process.exit(1);
      }

      console.log('=== Continuous Quality Flywheel Telemetry Report (UG-27) ===');
      console.log(`  Trajectory Schema:       trajectory/v1 (valid)`);
      console.log(`  Telemetry Schema:        telemetry/v1 (valid)`);
      console.log(`  Self-Test Fixtures:      passed`);
      console.log(`  Flywheel Log Records:    ${logVal.totalLines} lines verified`);
      console.log('\nok — Telemetry and trajectory governance schemas and flywheel logs are valid.');
      process.exit(0);
    }

    console.log('Use --validate or --self-test to validate telemetry schemas and logs.');
    process.exit(0);
  } catch (err) {
    console.error('Telemetry validation failed:', err.message);
    process.exit(1);
  }
}
