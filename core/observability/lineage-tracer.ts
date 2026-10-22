/**
 * Lineage / semantic-debug tracer (amendment C10) — ICM 05/08: walk the
 * relative-link graph backward from a deliverable to its stage outputs and
 * sources, git-diff the per-stage files, and report the FIRST divergent stage
 * (where drift entered the pipeline) plus the suspect CONTEXT.md line (the
 * contract instruction that allowed it).
 *
 * Severity (risk table): whitespace-only diffs are `formatting` and never
 * count as divergence — only `content` and `structural` drift is reported.
 *
 *   node core/scripts/lineage-tracer.js <deliverable> [--root <path>] [--base <ref>]
 */

import { spawnSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseFrontmatter } from '../governance/stage-seal.ts';
import { parseContextContract } from '../harness/stage-deps.ts';

export type Severity = 'clean' | 'formatting' | 'content' | 'structural';

export interface LineageNode {
  /** Workspace-relative file path (`/`-separated). */
  file: string;
  /** Nearest ancestor stage folder (CONTEXT.md), if any. */
  stage: string | null;
  /** Relative references that led here (one per parent edge). */
  via: string[];
}

export interface Divergence {
  file: string;
  stage: string | null;
  severity: Exclude<Severity, 'clean'>;
  added: number;
  removed: number;
}

export interface SuspectLine {
  /** CONTEXT.md of the divergent stage. */
  file: string;
  /** 1-based line number. */
  line: number;
  text: string;
  section: 'Inputs' | 'Outputs';
}

export interface LineageReport {
  deliverable: string;
  base_ref: string;
  /** Backward walk: deliverable → stage outputs → sources (BFS order). */
  chain: LineageNode[];
  /** Lineage stages in pipeline order (folder-name ascending). */
  stages: string[];
  divergences: Divergence[];
  /** First stage (pipeline order) whose files drifted — the entry point. */
  first_divergent_stage: string | null;
  suspect: SuspectLine | null;
  /** No content/structural divergence (formatting-only diffs are clean). */
  clean: boolean;
  notes: string[];
}

const MAX_DEPTH = 15;

/* ------------------------------------------------------------------ */
/* Lineage walk (relative links + OKF input citations)                 */
/* ------------------------------------------------------------------ */

function extractRefs(markdown: string): string[] {
  const refs: string[] = [];
  const text = markdown.replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^(https?:|mailto:|\/\/|\/)/.test(target) || target.includes('{{')) continue;
    refs.push(target);
  }
  const { data, present } = parseFrontmatter(markdown);
  if (present && data !== null) {
    const inputs = data['inputs'];
    if (Array.isArray(inputs)) refs.push(...inputs.filter((i): i is string => typeof i === 'string'));
    else if (typeof inputs === 'string') refs.push(inputs);
  }
  return [...new Set(refs)];
}

/** Nearest ancestor of `file` (bounded by root) holding a CONTEXT.md. */
async function stageOf(root: string, file: string): Promise<string | null> {
  let dir = path.dirname(path.resolve(root, file));
  for (let i = 0; i < MAX_DEPTH; i += 1) {
    const rel = path.relative(root, dir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    const info = await stat(path.join(dir, 'CONTEXT.md')).catch(() => null);
    if (info?.isFile()) return rel.split(path.sep).join('/');
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export async function walkLineage(root: string, deliverable: string): Promise<LineageNode[]> {
  const absRoot = path.resolve(root);
  const start = path.resolve(absRoot, deliverable);
  const seen = new Map<string, LineageNode>();
  const queue: { abs: string; via: string[]; depth: number }[] = [{ abs: start, via: [], depth: 0 }];

  while (queue.length > 0) {
    const { abs, via, depth } = queue.shift()!;
    const rel = path.relative(absRoot, abs).split(path.sep).join('/');
    if (seen.has(rel) || rel.startsWith('..')) continue;
    if (depth > MAX_DEPTH) continue;
    const raw = await readFile(abs, 'utf8').catch(() => null);
    if (raw === null) continue;
    seen.set(rel, { file: rel, stage: await stageOf(absRoot, rel), via });
    for (const ref of extractRefs(raw)) {
      const target = path.resolve(path.dirname(abs), ref);
      const info = await stat(target).catch(() => null);
      if (info?.isFile()) queue.push({ abs: target, via: [rel], depth: depth + 1 });
    }
  }
  return [...seen.values()];
}

/* ------------------------------------------------------------------ */
/* git diff per stage                                                  */
/* ------------------------------------------------------------------ */

function gitDiff(root: string, files: string[], baseRef: string): { ok: boolean; output: string } {
  if (files.length === 0) return { ok: true, output: '' };
  const res = spawnSync('git', ['diff', '--unified=1', baseRef, '--', ...files], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
  });
  if (res.error || res.status === 128) return { ok: false, output: '' };
  return { ok: true, output: res.stdout };
}

function classifySeverity(lines: string[]): { severity: Exclude<Severity, 'clean'>; added: number; removed: number } {
  const allAdded: string[] = [];
  const allRemoved: string[] = [];
  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) continue;
    if (line.startsWith('+')) allAdded.push(line.slice(1));
    else if (line.startsWith('-')) allRemoved.push(line.slice(1));
  }
  const added = allAdded.length;
  const removed = allRemoved.length;
  if (added === 0 && removed === 0) return { severity: 'formatting', added, removed };

  const normalize = (list: string[]): string[] =>
    list
      .map((l) => l.replace(/\s+/g, ' ').trim())
      .filter((l) => l.length > 0)
      .sort();
  const formattingOnly =
    added > 0 && removed > 0 && JSON.stringify(normalize(allAdded)) === JSON.stringify(normalize(allRemoved));
  if (formattingOnly) return { severity: 'formatting', added, removed };

  const structuralPattern = /(^|\s)#{1,6}\s|\[[^\]]*\]\([^)]+\)|\s->\s|^-{3,}\s*$/;
  const structural = [...allAdded, ...allRemoved].some((l) => structuralPattern.test(l));
  return { severity: structural ? 'structural' : 'content', added, removed };
}

/** Split `git diff` output per changed file and classify each file's delta. */
export function parseDiffByFile(
  diff: string,
): { file: string; severity: Exclude<Severity, 'clean'>; added: number; removed: number }[] {
  const sections: { file: string; lines: string[] }[] = [];
  for (const line of diff.split(/\r?\n/)) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      sections.push({ file: header[2], lines: [] });
      continue;
    }
    if (sections.length > 0) sections[sections.length - 1].lines.push(line);
  }
  return sections.map((section) => ({ file: section.file, ...classifySeverity(section.lines) }));
}

/* ------------------------------------------------------------------ */
/* Suspect CONTEXT.md line                                             */
/* ------------------------------------------------------------------ */

async function findSuspectLine(
  root: string,
  stage: string,
  divergedFiles: string[],
  mode: 'Inputs' | 'Outputs',
): Promise<SuspectLine | null> {
  const contextFile = path.join(root, stage, 'CONTEXT.md');
  const raw = await readFile(contextFile, 'utf8').catch(() => null);
  if (raw === null) return null;
  const lines = raw.split(/\r?\n/);
  let section: 'Inputs' | 'Outputs' | null = null;
  const candidates = divergedFiles.map((f) => {
    const rel = path.relative(path.join(root, stage), path.join(root, f)).split(path.sep).join('/');
    return { rel, base: path.basename(f) };
  });
  let fallback: SuspectLine | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const heading = /^##\s+(.*)$/.exec(lines[i]);
    if (heading) {
      const name = heading[1].trim();
      section = name === 'Inputs' ? 'Inputs' : name === 'Outputs' ? 'Outputs' : null;
      continue;
    }
    if (section !== mode || !lines[i].trim().startsWith('-')) continue;
    const entry: SuspectLine = { file: `${stage}/CONTEXT.md`, line: i + 1, text: lines[i].trim(), section };
    for (const candidate of candidates) {
      if (lines[i].includes(candidate.rel) || lines[i].includes(candidate.base)) return entry;
    }
    fallback ??= entry;
  }
  return mode === 'Outputs' ? fallback : null;
}

/* ------------------------------------------------------------------ */
/* Main trace                                                          */
/* ------------------------------------------------------------------ */

export interface TraceOpts {
  root?: string;
  /** git ref to diff against (default HEAD — worktree vs last commit). */
  baseRef?: string;
}

export async function traceLineage(deliverable: string, opts?: TraceOpts): Promise<LineageReport> {
  const root = path.resolve(opts?.root ?? process.cwd());
  const baseRef = opts?.baseRef ?? 'HEAD';
  const absDeliverable = path.resolve(root, deliverable);
  const info = await stat(absDeliverable).catch(() => null);
  if (!info?.isFile()) throw new Error(`deliverable not found: ${deliverable}`);

  const chain = await walkLineage(root, deliverable);
  const notes: string[] = [];

  const stageIds = [...new Set(chain.map((n) => n.stage).filter((s): s is string => s !== null))].sort();

  // Per-stage diffs (lineage files only), plus source files outside any stage.
  const divergences: Divergence[] = [];
  const byStage = new Map<string, LineageNode[]>();
  const sources: LineageNode[] = [];
  for (const node of chain) {
    if (node.stage === null) sources.push(node);
    else {
      const bucket = byStage.get(node.stage) ?? [];
      bucket.push(node);
      byStage.set(node.stage, bucket);
    }
  }

  let gitAvailable = true;
  const diffFiles = (stage: string | null, nodes: LineageNode[]): Divergence[] => {
    const files = nodes.map((n) => n.file);
    const { ok, output } = gitDiff(root, files, baseRef);
    if (!ok) {
      gitAvailable = false;
      return [];
    }
    if (!output.trim()) return [];
    const wanted = new Set(files);
    return parseDiffByFile(output)
      .filter((d) => wanted.has(d.file))
      .map((d) => ({ file: d.file, stage, severity: d.severity, added: d.added, removed: d.removed }));
  };

  for (const stage of stageIds) divergences.push(...diffFiles(stage, byStage.get(stage) ?? []));
  if (sources.length > 0) divergences.push(...diffFiles(null, sources));
  if (!gitAvailable) notes.push(`git diff against "${baseRef}" failed — is this a git worktree?`);

  const realDivergences = divergences.filter((d) => d.severity !== 'formatting');

  // First divergent stage in pipeline order (where drift entered).
  let firstStage: string | null = null;
  let firstFiles: string[] = [];
  for (const stage of stageIds) {
    const files = realDivergences.filter((d) => d.stage === stage).map((d) => d.file);
    if (files.length > 0) {
      firstStage = stage;
      firstFiles = files;
      break;
    }
  }

  let suspect: SuspectLine | null = null;
  if (firstStage !== null) {
    const stageId = firstStage;
    const contract = parseContextContract(await readFile(path.join(root, stageId, 'CONTEXT.md'), 'utf8'));
    // contract outputs are stage-relative — normalize to workspace-relative
    const outputs = new Set(
      contract.outputs.map((p) => path.join(stageId, p).split(path.sep).join('/')),
    );
    const outputDrift = firstFiles.filter((f) => outputs.has(f));
    suspect = outputDrift.length > 0
      ? await findSuspectLine(root, stageId, outputDrift, 'Outputs')
      : await findSuspectLine(root, stageId, firstFiles, 'Inputs');
  } else if (realDivergences.some((d) => d.stage === null)) {
    // Source drift with untouched outputs: the stage that DECLARES the
    // drifted source as an Input is the entry point that failed to rebuild.
    const driftedSources = realDivergences.filter((d) => d.stage === null).map((d) => d.file);
    for (const stage of stageIds) {
      const contextRaw = await readFile(path.join(root, stage, 'CONTEXT.md'), 'utf8').catch(() => '');
      const hit = driftedSources.find((src) => {
        const rel = path.relative(path.join(root, stage), path.join(root, src)).split(path.sep).join('/');
        return contextRaw.includes(rel) || contextRaw.includes(src);
      });
      if (hit) {
        firstStage = stage;
        suspect = await findSuspectLine(root, stage, [hit], 'Inputs');
        notes.push(`source ${hit} drifted; stage ${stage} declares it as an input`);
        break;
      }
    }
  }

  return {
    deliverable: path.relative(root, absDeliverable).split(path.sep).join('/'),
    base_ref: baseRef,
    chain,
    stages: stageIds,
    divergences,
    first_divergent_stage: firstStage,
    suspect,
    clean: realDivergences.length === 0,
    notes,
  };
}

export function renderLineage(report: LineageReport): string {
  const head = report.clean
    ? `${report.deliverable}: CLEAN (base ${report.base_ref}, ${report.chain.length} node(s) in lineage)`
    : `${report.deliverable}: DRIFT — entry ${report.first_divergent_stage ?? 'unknown stage'} (base ${report.base_ref})`;
  const lines = [head];
  for (const note of report.notes) lines.push(`  note: ${note}`);
  if (report.suspect) {
    lines.push(
      `  suspect: ${report.suspect.file}:${report.suspect.line} [${report.suspect.section}] ${report.suspect.text}`,
    );
  }
  for (const d of report.divergences) {
    lines.push(`  ${d.severity.padEnd(10)} ${d.file}${d.stage ? ` (stage ${d.stage})` : ''} +${d.added}/-${d.removed}`);
  }
  return lines.join('\n');
}
