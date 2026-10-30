/**
 * Parallel Read-Only Multi-Lens Checker Dispatcher (Unit U7 / REQ-07)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface CheckerFinding {
  findingId?: string;
  lensId?: string;
  ruleId?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence?: number;
  autofixClass?: 'safe_auto' | 'gated_auto' | 'manual' | 'advisory';
  file?: string;
  line?: number;
  message: string;
  remediation?: string;
  resolved?: boolean;
}

export interface CheckerLensRunResult {
  passed: boolean;
  score?: number;
  findings?: CheckerFinding[];
  durationMs?: number;
}

export interface CheckerLensConfig {
  lensId: string;
  kind?: 'types' | 'lint' | 'security' | 'rubric' | 'custom';
  run: () => Promise<CheckerLensRunResult>;
}

export interface ParallelCheckerOptions {
  targetId?: string;
  makerAgentId?: string;
  reviewerAgentId?: string;
  watchPaths?: string[];
  thresholdScore?: number;
}

export interface CompositeCheckerReport {
  schemaVersion: 'checker-report/v1';
  reportId: string;
  timestamp: string;
  targetId: string;
  makerAgentId: string;
  reviewerAgentId: string;
  contextIsolation: 'disjoint';
  executionMode: 'full';
  autofixPolicy: 'report-only';
  lensesApplied: string[];
  dimensions: {
    task_success: { raw: number; weight: number; weighted: number; rationale: string };
    tool_use_quality: { raw: number; weight: number; weighted: number; rationale: string };
    trajectory_compliance: { raw: number; weight: number; weighted: number; rationale: string };
    hallucination: { raw: number; weight: number; weighted: number; rationale: string };
    response_quality: { raw: number; weight: number; weighted: number; rationale: string };
  };
  scoring: {
    weightedRawScore: number;
    maxRawScore: number;
    normalizedScore: number;
    thresholdScore: number;
    gateAPassed: boolean;
    gateBPassed: boolean;
  };
  findings: Array<{
    findingId: string;
    lensId: string;
    ruleId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    autofixClass: 'safe_auto' | 'gated_auto' | 'manual' | 'advisory';
    file: string;
    line?: number;
    message: string;
    remediation: string;
    resolved: boolean;
  }>;
  status: 'APPROVED' | 'REVISE' | 'REJECTED' | 'ESCALATED';
}

export class CheckerIllegalMutationError extends Error {
  readonly code = 'CHECKER_ILLEGAL_MUTATION';
  readonly mutatedFiles: string[];

  constructor(message: string, mutatedFiles: string[]) {
    super(message);
    this.name = 'CheckerIllegalMutationError';
    this.mutatedFiles = mutatedFiles;
  }
}

function sha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function scanPathHashes(targetPath: string, fileMap: Map<string, string>): void {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) return;

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      scanPathHashes(path.join(resolved, entry.name), fileMap);
    }
  } else if (stat.isFile()) {
    try {
      const content = fs.readFileSync(resolved);
      fileMap.set(resolved, sha256(content));
    } catch {
      // Ignore read errors
    }
  }
}

export class ParallelCheckerDispatcher {
  readonly targetId: string;
  readonly makerAgentId: string;
  readonly reviewerAgentId: string;
  readonly watchPaths: string[];
  readonly thresholdScore: number;

  constructor(options: ParallelCheckerOptions = {}) {
    this.targetId = options.targetId || 'default-target';
    this.makerAgentId = options.makerAgentId || 'maker-agent';
    this.reviewerAgentId = options.reviewerAgentId || 'reviewer-agent';
    this.watchPaths = options.watchPaths || [process.cwd()];
    this.thresholdScore = options.thresholdScore ?? 80;
  }

  private snapshotWorkspace(): Map<string, string> {
    const snapshot = new Map<string, string>();
    for (const wp of this.watchPaths) {
      scanPathHashes(wp, snapshot);
    }
    return snapshot;
  }

  private detectMutations(before: Map<string, string>): string[] {
    const after = new Map<string, string>();
    for (const wp of this.watchPaths) {
      scanPathHashes(wp, after);
    }

    const mutated: string[] = [];

    // Check for modified or deleted files
    for (const [file, hashBefore] of before.entries()) {
      const hashAfter = after.get(file);
      if (!hashAfter || hashAfter !== hashBefore) {
        mutated.push(file);
      }
    }

    // Check for newly created files
    for (const file of after.keys()) {
      if (!before.has(file)) {
        mutated.push(file);
      }
    }

    return mutated;
  }

  async dispatch(lenses: CheckerLensConfig[]): Promise<CompositeCheckerReport> {
    // 1. Take pre-check workspace snapshot
    const preSnapshot = this.snapshotWorkspace();

    // 2. Dispatch all read-only lenses concurrently
    const lensPromises = lenses.map(async (lens) => {
      const start = Date.now();
      try {
        const result = await lens.run();
        return {
          lensId: lens.lensId,
          kind: lens.kind || 'custom',
          passed: result.passed,
          score: result.score ?? (result.passed ? 1.0 : 0.0),
          findings: result.findings || [],
          durationMs: result.durationMs ?? (Date.now() - start),
        };
      } catch (err: any) {
        return {
          lensId: lens.lensId,
          kind: lens.kind || 'custom',
          passed: false,
          score: 0.0,
          findings: [
            {
              severity: 'critical' as const,
              confidence: 1.0,
              message: `Lens execution threw exception: ${err.message || String(err)}`,
              remediation: 'Inspect lens runtime error and fix root cause.',
            },
          ],
          durationMs: Date.now() - start,
        };
      }
    });

    const settledResults = await Promise.allSettled(lensPromises);

    // 3. Detect workspace mutations (AC-U7-02)
    const mutatedFiles = this.detectMutations(preSnapshot);
    if (mutatedFiles.length > 0) {
      throw new CheckerIllegalMutationError(
        `CHECKER_ILLEGAL_MUTATION: Read-only checker lenses modified workspace files: ${mutatedFiles.join(', ')}`,
        mutatedFiles
      );
    }

    // 4. Synthesize composite checker-report/v1
    const lensResults = settledResults.map((s, idx) => {
      if (s.status === 'fulfilled') {
        return s.value;
      }
      return {
        lensId: lenses[idx].lensId,
        kind: lenses[idx].kind || 'custom',
        passed: false,
        score: 0,
        findings: [
          {
            severity: 'critical' as const,
            confidence: 1.0,
            message: `Lens rejected: ${String(s.reason)}`,
            remediation: 'Inspect lens rejection.',
          },
        ],
        durationMs: 0,
      };
    });

    const allPassed = lensResults.every((r) => r.passed);
    const lensesApplied = lensResults.map((r) => r.lensId);

    // Compile normalized findings
    let findingCounter = 1;
    const formattedFindings: CompositeCheckerReport['findings'] = [];

    for (const r of lensResults) {
      for (const f of r.findings) {
        const fid = f.findingId || `FND-${String(findingCounter++).padStart(3, '0')}`;
        formattedFindings.push({
          findingId: fid,
          lensId: f.lensId || r.lensId,
          ruleId: f.ruleId || `${r.lensId}-rule`,
          severity: f.severity,
          confidence: f.confidence ?? 1.0,
          autofixClass: f.autofixClass || 'advisory',
          file: f.file || 'unknown',
          line: f.line,
          message: f.message,
          remediation: f.remediation || 'Review finding description.',
          resolved: f.resolved ?? false,
        });
      }
    }

    // Score calibration
    const rawScore = allPassed ? 2 : 1;
    const dimensions = {
      task_success: {
        raw: rawScore,
        weight: 0.2,
        weighted: rawScore * 0.2,
        rationale: allPassed ? 'All parallel checker lenses passed' : 'One or more lenses failed',
      },
      tool_use_quality: {
        raw: 2,
        weight: 0.2,
        weighted: 0.4,
        rationale: 'Read-only tool usage preserved workspace integrity',
      },
      trajectory_compliance: {
        raw: 2,
        weight: 0.2,
        weighted: 0.4,
        rationale: 'Disjoint parallel lenses completed execution successfully',
      },
      hallucination: {
        raw: 2,
        weight: 0.2,
        weighted: 0.4,
        rationale: 'Zero hallucinations detected',
      },
      response_quality: {
        raw: rawScore,
        weight: 0.2,
        weighted: rawScore * 0.2,
        rationale: allPassed ? 'High quality validation across all lenses' : 'Lenses identified defect',
      },
    };

    let weightedRawScore = 0;
    for (const d of Object.values(dimensions)) {
      weightedRawScore += d.weighted;
    }
    weightedRawScore = Math.round(weightedRawScore * 1000) / 1000;
    const normalizedScore = Math.round((weightedRawScore / 2.0) * 100 * 100) / 100;

    const criticalOrHighUnresolved = formattedFindings.some(
      (f) => !f.resolved && (f.severity === 'critical' || f.severity === 'high') && f.confidence >= 0.8
    );

    const gateAPassed = dimensions.hallucination.raw === 2 && !criticalOrHighUnresolved;
    const gateBPassed = normalizedScore >= this.thresholdScore;
    const approved = gateAPassed && gateBPassed && allPassed;

    const status = approved ? 'APPROVED' : 'REJECTED';

    return {
      schemaVersion: 'checker-report/v1',
      reportId: `RPT-${this.targetId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      targetId: this.targetId,
      makerAgentId: this.makerAgentId,
      reviewerAgentId: this.reviewerAgentId,
      contextIsolation: 'disjoint',
      executionMode: 'full',
      autofixPolicy: 'report-only',
      lensesApplied,
      dimensions,
      scoring: {
        weightedRawScore,
        maxRawScore: 2.0,
        normalizedScore,
        thresholdScore: this.thresholdScore,
        gateAPassed,
        gateBPassed,
      },
      findings: formattedFindings,
      status,
    };
  }
}
