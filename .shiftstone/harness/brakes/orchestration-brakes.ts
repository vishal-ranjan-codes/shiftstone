import type { BrakeAttemptOptions, BrakeAttemptResult } from '../loop-runner/types.js';

export interface OrchestrationBrakesOptions {
  maxRetries?: number;
}

export class OrchestrationBrakes {
  readonly maxRetries: number;
  private readonly attempts = new Map<string, Array<{
    attempt: number;
    exitCode: number;
    diffHash?: string;
    timestamp: string;
  }>>();

  constructor(options: OrchestrationBrakesOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
  }

  recordAttempt(phaseId: string, options: BrakeAttemptOptions): BrakeAttemptResult {
    const history = this.attempts.get(phaseId) || [];
    const attemptNum = history.length + 1;
    const currentEntry = {
      attempt: attemptNum,
      exitCode: options.exitCode,
      diffHash: options.diffHash,
      timestamp: new Date().toISOString(),
    };
    history.push(currentEntry);
    this.attempts.set(phaseId, history);

    // If exit code is 0, success; no retry needed
    if (options.exitCode === 0) {
      return { shouldRetry: false };
    }

    // AC-U6-02: Detect zero-progress loops (stagnation)
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      if (options.diffHash && prev.diffHash && options.diffHash === prev.diffHash) {
        return {
          shouldRetry: false,
          trippedReason: 'STAGNATION_DETECTED',
          error: `Zero-progress detected: consecutive attempts for phase "${phaseId}" produced identical diff hash "${options.diffHash}"`,
          diagnostics: {
            phaseId,
            attempts: attemptNum,
            lastDiffHash: options.diffHash,
            history: [...history],
          },
        };
      }
    }

    // AC-U6-03: Enforce hard ceiling of maxRetries (default 3 retries, so > maxRetries trips)
    if (attemptNum > this.maxRetries) {
      return {
        shouldRetry: false,
        trippedReason: 'CIRCUIT_BREAKER_TRIPPED',
        error: `Circuit breaker tripped for phase "${phaseId}": exceeded maximum retry limit of ${this.maxRetries} attempts`,
        diagnostics: {
          phaseId,
          attempts: attemptNum,
          lastDiffHash: options.diffHash,
          history: [...history],
        },
      };
    }

    // AC-U6-01: Transition phase into remediate mode and trigger retry
    return {
      shouldRetry: true,
      nextMode: 'remediate',
    };
  }

  getAttempts(phaseId: string) {
    return this.attempts.get(phaseId) || [];
  }

  reset(phaseId?: string) {
    if (phaseId) {
      this.attempts.delete(phaseId);
    } else {
      this.attempts.clear();
    }
  }
}
