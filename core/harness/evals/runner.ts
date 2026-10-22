/**
 * Eval runner (B1) — discovers labeled suites under evals/<name>/cases.jsonl,
 * scores every case, aggregates against the suite's min_pass_rate, and appends
 * per-case results to evals/runs.jsonl (the clustering input for B5).
 *
 *   node core/harness/evals/run.js               all suites, warn mode
 *   node core/harness/evals/run.js --suite X      one suite
 *   node core/harness/evals/run.js --strict       CI mode: exit 1 on regression
 */

import { execSync } from 'node:child_process';
import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { scoreCase, type ExecProbe, type ScoreOutcome } from './scoring.ts';
import { scoreTrajectory } from './trajectory/scorer.ts';
import type {
  CaseOutcome,
  EvalCase,
  EvalRunReport,
  SuiteConfig,
  SuiteOutcome,
} from './types.ts';

export const EVALS_DIR = 'evals';
export const CASES_FILE = 'cases.jsonl';
export const SUITE_CONFIG_FILE = 'suite.json';
export const RESULTS_FILE = 'runs.jsonl';

function defaultExec(root: string): ExecProbe {
  return (command: string) => {
    try {
      const stdout = execSync(command, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120_000,
        windowsHide: true,
      });
      return { exitCode: 0, stdout: stdout ?? '', stderr: '' };
    } catch (error) {
      const err = error as { status?: number; stdout?: string; stderr?: string; message?: string };
      return {
        exitCode: typeof err.status === 'number' ? err.status : 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? '',
      };
    }
  };
}

/** Suite directories: evals/<name>/cases.jsonl, skipping `_`-prefixed templates. */
export async function discoverSuites(root: string): Promise<string[]> {
  const base = path.join(root, EVALS_DIR);
  try {
    const entries = await readdir(base, { withFileTypes: true });
    const suites: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
      try {
        await readFile(path.join(base, entry.name, CASES_FILE));
        suites.push(entry.name);
      } catch {
        // no cases.jsonl — not a suite
      }
    }
    return suites.sort();
  } catch {
    return [];
  }
}

export async function loadSuite(
  root: string,
  name: string,
): Promise<{ cases: EvalCase[]; config: SuiteConfig }> {
  const suiteDir = path.join(root, EVALS_DIR, name);
  const raw = await readFile(path.join(suiteDir, CASES_FILE), 'utf8');
  const cases: EvalCase[] = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `${name}/${CASES_FILE}:${i + 1}: invalid JSON — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const c = parsed as EvalCase;
    if (!c.id || !c.kind) {
      throw new Error(`${name}/${CASES_FILE}:${i + 1}: every case needs "id" and "kind"`);
    }
    cases.push(c);
  }
  let config: SuiteConfig = {};
  try {
    config = JSON.parse(await readFile(path.join(suiteDir, SUITE_CONFIG_FILE), 'utf8')) as SuiteConfig;
  } catch {
    // suite.json is optional
  }
  return { cases, config };
}

function aggregate(name: string, cases: CaseOutcome[], config: SuiteConfig): SuiteOutcome {
  const scorable = cases.filter((c) => !c.skipped);
  const passed = scorable.filter((c) => c.passed).length;
  const failed = scorable.length - passed;
  const skipped = cases.length - scorable.length;
  const passRate = scorable.length === 0 ? 1 : passed / scorable.length;
  const minPassRate = config.min_pass_rate ?? 1;
  return {
    name,
    total: cases.length,
    passed,
    failed,
    skipped,
    pass_rate: passRate,
    min_pass_rate: minPassRate,
    ok: passRate >= minPassRate,
    cases,
  };
}

export interface RunEvalsOptions {
  root?: string;
  /** Subset of suite names; omitted = every discovered suite. */
  suites?: string[];
  exec?: ExecProbe;
  resultsFile?: string;
}

/** Default per-kind scorer; trajectory cases use the B3 trajectory scorer. */
export function scoreEvalCase(evalCase: EvalCase, exec: ExecProbe): ScoreOutcome {
  if (evalCase.kind === 'trajectory') {
    const score = scoreTrajectory({
      trace: evalCase.trajectory,
      claimed_checks: evalCase.claimed_checks,
    });
    return { passed: score.passed, detail: score.detail };
  }
  return scoreCase(evalCase, exec);
}

export async function runEvals(opts: RunEvalsOptions = {}): Promise<EvalRunReport> {
  const root = opts.root ?? process.cwd();
  const exec = opts.exec ?? defaultExec(root);
  const names = opts.suites?.length ? opts.suites : await discoverSuites(root);
  const timestamp = new Date().toISOString();
  const resultsFile = opts.resultsFile ?? path.join(root, EVALS_DIR, RESULTS_FILE);

  const suites: SuiteOutcome[] = [];
  for (const name of names) {
    const { cases, config } = await loadSuite(root, name);
    const outcomes: CaseOutcome[] = [];
    for (const evalCase of cases) {
      const started = Date.now();
      const scored = scoreEvalCase(evalCase, exec);
      outcomes.push({
        suite: name,
        case_id: evalCase.id,
        kind: evalCase.kind,
        passed: scored.passed,
        skipped: scored.skipped === true,
        cluster: evalCase.cluster,
        detail: scored.detail,
        duration_ms: Date.now() - started,
      });
    }
    suites.push(aggregate(name, outcomes, config));
  }

  await mkdir(path.dirname(resultsFile), { recursive: true });
  for (const suite of suites) {
    for (const c of suite.cases) {
      await appendFile(
        resultsFile,
        `${JSON.stringify({ timestamp, ...c })}\n`,
        'utf8',
      );
    }
  }

  return {
    timestamp,
    suites,
    ok: suites.every((s) => s.ok),
    results_file: resultsFile,
  };
}

/** Latest outcome per (suite, case_id) from a results file — flywheel input (B5). */
export async function latestOutcomes(
  resultsFile: string,
): Promise<Map<string, CaseOutcome & { timestamp: string }>> {
  const latest = new Map<string, CaseOutcome & { timestamp: string }>();
  let raw: string;
  try {
    raw = await readFile(resultsFile, 'utf8');
  } catch {
    return latest;
  }
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as CaseOutcome & { timestamp: string };
      latest.set(`${row.suite}::${row.case_id}`, row);
    } catch {
      // tolerate a torn append line
    }
  }
  return latest;
}
