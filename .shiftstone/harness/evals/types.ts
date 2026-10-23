/**
 * Evals infrastructure types — blueprint §9.1 Phase 3, amendment B1.
 *
 * Tests verify deterministic parts; evals verify non-deterministic parts
 * (trajectory, tool use, quality). A suite is a labeled dataset of cases
 * (evals/<name>/cases.jsonl) scored by kind; results append to evals/runs.jsonl.
 */

export type EvalCaseKind = 'exact' | 'contains' | 'regex' | 'command' | 'trajectory' | 'rubric';

export interface EvalCase {
  id: string;
  kind: EvalCaseKind;
  /** exact/contains/regex: the observed value to score. */
  input?: string;
  /** exact/contains/regex: the expected value or pattern. */
  expected?: string;
  /** command: shell command; exit code decides (exit_code, default 0). */
  command?: string;
  exit_code?: number;
  /** Failure-clustering label used by quality-flywheel-loop (B5). */
  cluster?: string;
  tags?: string[];
  /** trajectory: the recorded tool-call sequence (B3). */
  trajectory?: { tool: string; command?: string; args?: string[]; ok?: boolean }[];
  /** trajectory: checks the agent claims it ran — each must appear in the trajectory. */
  claimed_checks?: string[];
}

export interface SuiteConfig {
  name?: string;
  description?: string;
  /** Fraction of scorable cases that must pass (default 1.0). */
  min_pass_rate?: number;
}

export interface CaseOutcome {
  suite: string;
  case_id: string;
  kind: EvalCaseKind;
  passed: boolean;
  skipped: boolean;
  cluster?: string;
  detail: string;
  duration_ms: number;
}

export interface SuiteOutcome {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pass_rate: number;
  min_pass_rate: number;
  ok: boolean;
  cases: CaseOutcome[];
}

export interface EvalRunReport {
  timestamp: string;
  suites: SuiteOutcome[];
  ok: boolean;
  results_file: string;
}
