/**
 * Stage dependency engine (amendment C9) — Make-style incremental re-runs.
 *
 * A "stage" is an ICM stage folder (`<stage>/CONTEXT.md` + `output/`) or an
 * inline stage declaration in a loop spec. The engine:
 *   - builds a dependency graph (declared `depends_on` + file-derived edges:
 *     an input living inside another stage's folder),
 *   - fingerprints declared Inputs by content (sha256, never metadata),
 *   - skips stages whose fingerprints are unchanged since the last clean run,
 *   - reruns downstream stages when an upstream output changes (cascade),
 *   - honors a per-stage `force_rerun` escape flag (hash-miss escape hatch).
 *
 * LoopRunner uses planIncremental()/recordStageState() as its pre-execution
 * no-op gate; runStages() drives a full stage pipeline.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseFrontmatter } from '../governance/stage-seal.ts';

export interface StageDefinition {
  /** Stable id: stage folder (relative, `/`-separated) or spec-declared name. */
  id: string;
  /** Absolute input paths (files or directories — dirs hash every file inside). */
  inputs: string[];
  /** Absolute output paths the stage produces (optional for check-only stages). */
  outputs: string[];
  /** Explicit upstream stage ids. */
  depends_on: string[];
  /** Escape flag: run at least once even when hashes are clean (remove after). */
  force_rerun: boolean;
  /** Stage folder (discovered stages) — enables file-derived dependency edges. */
  dir?: string;
}

export interface StageStateEntry {
  input_hash: string;
  output_hash: string | null;
  completed: boolean;
  last_run?: string;
}

export interface StageDepsState {
  version: 1;
  recorded_at?: string;
  stages: Record<string, StageStateEntry>;
}

export interface StageDecision {
  id: string;
  action: 'run' | 'skip';
  reason: string;
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.loops', 'dist', 'build', 'coverage', '.react-router', '.wrangler']);
const MAX_DISCOVERY_DEPTH = 12;

/* ------------------------------------------------------------------ */
/* Contract parsing                                                    */
/* ------------------------------------------------------------------ */

export interface ContextContract {
  inputs: string[];
  outputs: string[];
  force_rerun: boolean;
}

function sectionLines(markdown: string, section: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      if (inside) break;
      if (heading[1].trim() === section) inside = true;
      continue;
    }
    if (inside) out.push(line);
  }
  return inside ? out : [];
}

/**
 * Parse a CONTEXT.md stage contract (C1/C8). Input paths are stage-relative
 * (skills-loader convention: resolved against the stage folder); output
 * targets are declared `name -> target`.
 */
export function parseContextContract(markdown: string): ContextContract {
  const force =
    (parseFrontmatter(markdown).data?.['force_rerun'] as boolean | undefined) === true;

  const inputs: string[] = [];
  const inputRegexes = [
    /^\s*-\s*Layer\s+[0-4]\s*\((?:Reference|Working)\)\s*:\s*(\S+)\s*$/,
    /^\s*-\s+(?!Layer\b)(\S+)\s*$/,
  ];
  for (const line of sectionLines(markdown, 'Inputs')) {
    for (const regex of inputRegexes) {
      const match = regex.exec(line);
      if (match) {
        inputs.push(match[1]);
        break;
      }
    }
  }

  const outputs: string[] = [];
  for (const line of sectionLines(markdown, 'Outputs')) {
    const bullet = /^\s*-\s+(.+?)\s*->\s*(\S+)\s*$/.exec(line);
    if (bullet) {
      outputs.push(bullet[2]);
      continue;
    }
    const plain = /^\s*-\s+(\S+)\s*$/.exec(line);
    if (plain && plain[1].startsWith('output/')) outputs.push(plain[1]);
  }

  return { inputs, outputs, force_rerun: force };
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

async function walkForContexts(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DISCOVERY_DEPTH) return [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...(await walkForContexts(path.join(root, entry.name), depth + 1)));
    } else if (entry.name === 'CONTEXT.md') {
      found.push(root);
    }
  }
  return found;
}

/** Discover every stage folder (CONTEXT.md) under root. */
export async function discoverStages(root: string): Promise<StageDefinition[]> {
  const absRoot = path.resolve(root);
  const dirs = await walkForContexts(absRoot);
  const stages: StageDefinition[] = [];
  for (const dir of dirs.sort()) {
    const markdown = await readFile(path.join(dir, 'CONTEXT.md'), 'utf8').catch(() => '');
    const contract = parseContextContract(markdown);
    stages.push({
      id: path.relative(absRoot, dir).split(path.sep).join('/'),
      inputs: contract.inputs.map((p) => path.resolve(dir, p)),
      outputs: contract.outputs.map((p) => path.resolve(dir, p)),
      depends_on: [],
      force_rerun: contract.force_rerun,
      dir,
    });
  }
  return stages;
}

/** Normalize an inline (spec-declared) stage: paths resolve against root. */
export function resolveStageDefinition(
  root: string,
  raw: { id: string; inputs: string[]; outputs?: string[]; depends_on?: string[]; force_rerun?: boolean },
): StageDefinition {
  const absRoot = path.resolve(root);
  return {
    id: raw.id,
    inputs: raw.inputs.map((p) => path.resolve(absRoot, p)),
    outputs: (raw.outputs ?? []).map((p) => path.resolve(absRoot, p)),
    depends_on: raw.depends_on ?? [],
    force_rerun: raw.force_rerun === true,
  };
}

/* ------------------------------------------------------------------ */
/* Hashing (content, never metadata — risk table)                      */
/* ------------------------------------------------------------------ */

async function listFiles(target: string): Promise<string[] | null> {
  const info = await stat(target).catch(() => null);
  if (info === null) return null;
  if (info.isFile()) return [target];
  if (!info.isDirectory()) return null;
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else {
        out.push(full);
      }
    }
  };
  await walk(target);
  return out;
}

/**
 * sha256 over the CONTENT of every declared path (files expand recursively).
 * Missing paths hash as `missing:<declared>` so presence flips the hash.
 */
export async function hashPaths(paths: string[]): Promise<string> {
  const hash = createHash('sha256');
  for (const declared of paths) {
    const files = await listFiles(declared);
    if (files === null) {
      hash.update(`missing:${declared}\n`);
      continue;
    }
    if (files.length === 0) {
      hash.update(`empty:${declared}\n`);
      continue;
    }
    for (const file of files) {
      const content = await readFile(file).catch(() => null);
      hash.update(`${declared}::${file}::`);
      hash.update(content === null ? 'unreadable' : createHash('sha256').update(content).digest('hex'));
      hash.update('\n');
    }
  }
  return hash.digest('hex');
}

/* ------------------------------------------------------------------ */
/* Graph                                                               */
/* ------------------------------------------------------------------ */

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Direct upstream ids: declared depends_on + inputs living inside another stage folder. */
export function upstreamOf(stage: StageDefinition, stages: StageDefinition[]): string[] {
  const upstream = new Set(stage.depends_on);
  for (const other of stages) {
    if (other.id === stage.id || !other.dir) continue;
    if (stage.inputs.some((input) => isInside(other.dir!, input))) upstream.add(other.id);
  }
  return [...upstream];
}

/** Topological order (upstreams first). Throws on a dependency cycle. */
export function topoSort(stages: StageDefinition[]): StageDefinition[] {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const order: StageDefinition[] = [];

  const visit = (stage: StageDefinition, trail: string[]): void => {
    if (visited.has(stage.id)) return;
    if (inStack.has(stage.id)) {
      throw new Error(`stage dependency cycle: ${[...trail, stage.id].join(' → ')}`);
    }
    inStack.add(stage.id);
    for (const upId of upstreamOf(stage, stages)) {
      const up = byId.get(upId);
      if (up) visit(up, [...trail, stage.id]);
    }
    inStack.delete(stage.id);
    visited.add(stage.id);
    order.push(stage);
  };

  for (const stage of stages) visit(stage, []);
  return order;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export async function loadStageState(statePath: string): Promise<StageDepsState> {
  try {
    const raw = JSON.parse(await readFile(statePath, 'utf8')) as StageDepsState;
    if (raw && raw.version === 1 && raw.stages) return raw;
  } catch {
    // missing/corrupt state ⇒ everything reruns
  }
  return { version: 1, stages: {} };
}

export async function saveStageState(statePath: string, state: StageDepsState): Promise<void> {
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
}

/** Fingerprint the current on-disk inputs/outputs and mark every stage completed. */
export async function recordStageState(
  stages: StageDefinition[],
  statePath: string,
): Promise<StageDepsState> {
  const state: StageDepsState = { version: 1, recorded_at: new Date().toISOString(), stages: {} };
  for (const stage of stages) {
    state.stages[stage.id] = {
      input_hash: await hashPaths(stage.inputs),
      output_hash: stage.outputs.length > 0 ? await hashPaths(stage.outputs) : null,
      completed: true,
      last_run: state.recorded_at,
    };
  }
  await saveStageState(statePath, state);
  return state;
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

export interface PlanOpts {
  root: string;
  stages: StageDefinition[];
  prev: StageDepsState;
  /** Force every stage to run once (CLI escape hatch). */
  force?: boolean;
}

/**
 * Decide run/skip per stage WITHOUT executing — conservative Make semantics:
 * a stage is fresh only when its own fingerprints are unchanged AND every
 * upstream stage is fresh. All-skip ⇒ the caller can exit `no_op`.
 */
export async function planIncremental(opts: PlanOpts): Promise<StageDecision[]> {
  const order = topoSort(opts.stages);
  const byId = new Map(opts.stages.map((s) => [s.id, s]));
  const decisions = new Map<string, StageDecision>();

  for (const stage of order) {
    const decide = async (): Promise<StageDecision> => {
      if (opts.force) return { id: stage.id, action: 'run', reason: 'force requested' };
      if (stage.force_rerun) return { id: stage.id, action: 'run', reason: 'force_rerun flag set' };
      const prev = opts.prev.stages[stage.id];
      if (!prev) return { id: stage.id, action: 'run', reason: 'no recorded fingerprint' };
      if (!prev.completed) return { id: stage.id, action: 'run', reason: 'previous run did not complete' };

      for (const upId of upstreamOf(stage, [...opts.stages])) {
        const up = byId.get(upId);
        const upDecision = up ? decisions.get(upId) : undefined;
        if (!up || upDecision?.action !== 'run') continue;
        // A forced upstream run is per-stage: downstream cascades only when
        // the forced stage's own outputs actually differ from its record.
        const forced =
          upDecision.reason === 'force requested' || upDecision.reason === 'force_rerun flag set';
        if (forced) {
          const upPrev = opts.prev.stages[up.id];
          const outputsClean =
            upPrev !== undefined &&
            upPrev.completed &&
            (up.outputs.length === 0 ||
              (upPrev.output_hash !== null && (await hashPaths(up.outputs)) === upPrev.output_hash));
          if (outputsClean) continue;
        }
        return { id: stage.id, action: 'run', reason: `upstream ${upId} not fresh (cascade)` };
      }

      const inputHash = await hashPaths(stage.inputs);
      if (inputHash !== prev.input_hash) {
        return { id: stage.id, action: 'run', reason: 'inputs changed' };
      }
      if (stage.outputs.length > 0 && prev.output_hash !== null) {
        const outputHash = await hashPaths(stage.outputs);
        if (outputHash !== prev.output_hash) {
          return { id: stage.id, action: 'run', reason: 'outputs modified since last run' };
        }
      }
      return { id: stage.id, action: 'skip', reason: 'inputs and upstream outputs unchanged' };
    };

    const decision = await decide();
    decisions.set(stage.id, decision);
  }

  return order.map((s) => decisions.get(s.id)!);
}

/* ------------------------------------------------------------------ */
/* Execution (precise cascade: upstream reruns only when its OUTPUTS   */
/* actually changed)                                                   */
/* ------------------------------------------------------------------ */

export interface RunStagesOpts extends Omit<PlanOpts, 'prev'> {
  statePath: string;
  force?: boolean;
  execute: (stage: StageDefinition) => Promise<void>;
}

export interface StageRunReport {
  decisions: StageDecision[];
  ran: string[];
  skipped: string[];
}

export async function runStages(opts: RunStagesOpts): Promise<StageRunReport> {
  const order = topoSort(opts.stages);
  const prev = await loadStageState(opts.statePath);
  const decisions: StageDecision[] = [];
  const ran: string[] = [];
  const skipped: string[] = [];
  /** Upstream ids whose output CONTENT changed during this pass. */
  const outputChanged = new Set<string>();

  for (const stage of order) {
    const prevEntry = prev.stages[stage.id];
    const inputHash = await hashPaths(stage.inputs);
    const outputHash = stage.outputs.length > 0 ? await hashPaths(stage.outputs) : null;
    const upstream = upstreamOf(stage, [...opts.stages]);
    const cascaded = upstream.filter((id) => outputChanged.has(id));

    let decision: StageDecision;
    if (opts.force) decision = { id: stage.id, action: 'run', reason: 'force requested' };
    else if (stage.force_rerun) decision = { id: stage.id, action: 'run', reason: 'force_rerun flag set' };
    else if (!prevEntry) decision = { id: stage.id, action: 'run', reason: 'no recorded fingerprint' };
    else if (!prevEntry.completed) decision = { id: stage.id, action: 'run', reason: 'previous run did not complete' };
    else if (cascaded.length > 0) decision = { id: stage.id, action: 'run', reason: `upstream ${cascaded[0]} output changed (cascade)` };
    else if (inputHash !== prevEntry.input_hash) decision = { id: stage.id, action: 'run', reason: 'inputs changed' };
    else if (outputHash !== null && prevEntry.output_hash !== null && outputHash !== prevEntry.output_hash) {
      decision = { id: stage.id, action: 'run', reason: 'outputs modified since last run' };
    } else decision = { id: stage.id, action: 'skip', reason: 'inputs and upstream outputs unchanged' };

    decisions.push(decision);

    if (decision.action === 'skip') {
      skipped.push(stage.id);
      continue;
    }

    await opts.execute(stage);
    ran.push(stage.id);

    const freshInput = await hashPaths(stage.inputs);
    const freshOutput = stage.outputs.length > 0 ? await hashPaths(stage.outputs) : null;
    const prevOut = prev.stages[stage.id]?.output_hash ?? null;
    if (freshOutput !== null && freshOutput !== prevOut) outputChanged.add(stage.id);
    prev.stages[stage.id] = {
      input_hash: freshInput,
      output_hash: freshOutput,
      completed: true,
      last_run: new Date().toISOString(),
    };
  }

  prev.recorded_at = new Date().toISOString();
  await saveStageState(opts.statePath, prev);
  return { decisions, ran, skipped };
}
