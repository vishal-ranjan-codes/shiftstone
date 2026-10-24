import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  validateTrajectory,
  validateTelemetry,
  recordTelemetry,
  runSelfTest,
} from '../record-telemetry.js';
import { Tracer } from '../../observability/otel-tracer.ts';

describe('Unit U28: Trajectory & Telemetry Governance + Flywheel Recorder (UG-27)', () => {
  it('AC-U28-01 (UG-27): validates trajectory/v1 schema provenance records', () => {
    const validTrajectory = {
      schemaVersion: 'trajectory/v1',
      runId: 'run-test-12345',
      trialId: 'T1-context-gate',
      stageId: 'stage-preflight',
      pack: 'core',
      timestamp: new Date().toISOString(),
      verificationLevel: 2,
      tokensUsed: 1500,
      durationMs: 350,
      terminalState: 'success',
      status: 'passed',
      steps: [
        {
          stepIndex: 0,
          toolName: 'validate-context-budgets',
          targetPath: 'AGENTS.md',
          verificationLevel: 1,
          outcome: 'passed',
          tokensUsed: 600,
          durationMs: 120,
        },
        {
          stepIndex: 1,
          toolName: 'agent-preflight',
          targetPath: null,
          verificationLevel: 2,
          outcome: 'passed',
          tokensUsed: 900,
          durationMs: 230,
        },
      ],
    };

    const res = validateTrajectory(validTrajectory);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);

    // Negative case: missing steps and invalid terminal state
    const invalidTrajectory = {
      ...validTrajectory,
      schemaVersion: 'trajectory/v2',
      terminalState: 'unknown_state',
      steps: 'not-an-array',
    };
    const badRes = validateTrajectory(invalidTrajectory);
    expect(badRes.ok).toBe(false);
    expect(badRes.violations.some((v) => v.code === 'INVALID_SCHEMA_VERSION')).toBe(true);
    expect(badRes.violations.some((v) => v.code === 'INVALID_TERMINAL_STATE')).toBe(true);
  });

  it('AC-U28-02 (UG-27): validates telemetry/v1 schema flywheel records', () => {
    const validTelemetry = {
      schemaVersion: 'telemetry/v1',
      timestamp: new Date().toISOString(),
      runId: 'run-flywheel-001',
      trialId: 'F1-route-loader-action',
      pack: 'rr8-supabase-cf',
      loopPattern: 'B_act_without_breaking',
      iterations: 3,
      terminalState: 'success',
      brakeTriggered: null,
      checkerNormalizedScore: 88.5,
      totalTokens: 4200,
      costUsd: 0.0126,
      durationMs: 2150,
    };

    const res = validateTelemetry(validTelemetry);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);

    // Negative case: negative tokens or invalid checker score
    const invalidTelemetry = {
      ...validTelemetry,
      totalTokens: -10,
      checkerNormalizedScore: 120,
    };
    const badRes = validateTelemetry(invalidTelemetry);
    expect(badRes.ok).toBe(false);
    expect(badRes.violations.some((v) => v.code === 'INVALID_TOTAL_TOKENS')).toBe(true);
    expect(badRes.violations.some((v) => v.code === 'INVALID_CHECKER_SCORE')).toBe(true);
  });

  it('TS-U28-01 (L2): recordTelemetry successfully writes JSONL to disk', () => {
    const tempFile = path.join(tmpdir(), `test-flywheel-${randomUUID()}.jsonl`);
    try {
      const entry = {
        schemaVersion: 'telemetry/v1',
        timestamp: new Date().toISOString(),
        runId: 'run-disk-test-01',
        pack: 'core',
        loopPattern: 'A_define_done',
        iterations: 1,
        terminalState: 'success',
        brakeTriggered: null,
        totalTokens: 100,
        costUsd: 0.0003,
        durationMs: 50,
      };

      const result = recordTelemetry(entry, { filePath: tempFile });
      expect(result.ok).toBe(true);
      expect(existsSync(tempFile)).toBe(true);
    } finally {
      if (existsSync(tempFile)) unlinkSync(tempFile);
    }
  });

  it('bridges Tracer spans to trajectory and telemetry records', () => {
    const tracer = new Tracer('eval-tracer');
    const span1 = tracer.startSpan('pre-flight-check', {
      attributes: {
        toolName: 'agent-preflight.js',
        targetPath: '.shiftstone/packs/rr8-supabase-cf/preflight-matrix.yaml',
        verificationLevel: 1,
        tokensUsed: 500,
      },
    });
    span1.setStatus('OK');
    span1.end();

    const span2 = tracer.startSpan('checker-review', {
      attributes: {
        toolName: 'validate-checker-report.js',
        verificationLevel: 4,
        tokensUsed: 1200,
      },
    });
    span2.setStatus('OK');
    span2.end();

    const trajectory = tracer.toTrajectoryRecord({
      runId: 'run-bridge-001',
      trialId: 'T2-checker-gate',
      pack: 'core',
      terminalState: 'success',
    });

    const trajVal = validateTrajectory(trajectory);
    expect(trajVal.ok).toBe(true);
    expect(trajectory.steps).toHaveLength(2);
    expect(trajectory.tokensUsed).toBe(1700);

    const telemetry = tracer.toTelemetryRecord({
      runId: 'run-bridge-001',
      trialId: 'T2-checker-gate',
      pack: 'core',
      loopPattern: 'C_evaluate_and_steer',
      terminalState: 'success',
      checkerNormalizedScore: 95,
    });

    const telVal = validateTelemetry(telemetry);
    expect(telVal.ok).toBe(true);
    expect(telemetry.totalTokens).toBe(1700);
  });

  it('passes runSelfTest', () => {
    const res = runSelfTest();
    expect(res.ok).toBe(true);
  });
});
