/**
 * SkillsLoader — progressive disclosure with budget enforcement
 * (blueprint §6.4) plus ICM scoped stage loading (amendment C2).
 *
 * Tier 1 (getManifest)  — names + descriptions, always visible
 * Tier 2 (getInstructions) — instructions.md on task/path/explicit match,
 *                            dependencies pulled and topologically ordered,
 *                            dynamic_max_tokens budget enforced
 * Tier 3 (getResource)  — resources/ only when instructions reference them
 *
 * The loader NEVER crawls directories: matching runs off the manifest, stage
 * loading runs off the declared CONTEXT.md Inputs list (C2 — "avoid
 * arbitrary directory crawls"), and directory/glob inputs are refused.
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { resolveSkillDir } from './skill-paths.ts';

export interface ManifestSkill {
  name: string;
  pack?: string;
  tier: 'always-load' | 'path-scoped' | 'manual-load';
  paths?: string[];
  tokenCost: number;
  depends_on?: string[];
  description: string;
  tags?: string[];
}

export interface SkillsManifest {
  apiVersion: string;
  kind: string;
  metadata: { generated: string; coreVersion: string; activePacks: string[] };
  spec: {
    budget: { static_max_lines: number; dynamic_max_tokens: number };
    skills: ManifestSkill[];
  };
}

export interface ContextBudget {
  static_max_lines: number;
  dynamic_max_tokens: number;
  stage_min_tokens: number;
  stage_max_tokens: number;
}

export interface Trigger {
  activeFile?: string;
  keywords?: string[];
  explicit?: string[];
}

export interface LoadedSkill {
  name: string;
  tokens: number;
  file: string;
  text: string;
}

export interface InstructionBundle {
  loaded: LoadedSkill[];
  skipped: { name: string; reason: string }[];
  totalTokens: number;
}

export interface StageInput {
  layer: string;
  kind: 'Reference' | 'Working';
  path: string;
  text: string;
  tokens: number;
}

export interface StageBundle {
  inputs: StageInput[];
  totalTokens: number;
  warnings: string[];
}

export class ManifestValidationError extends Error {
  errors: string[];
  constructor(errors: string[]) {
    super(`skills-manifest invalid:\n  - ${errors.join('\n  - ')}`);
    this.name = 'ManifestValidationError';
    this.errors = errors;
  }
}

export class SkillsBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillsBudgetError';
  }
}

export class StageCrawlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StageCrawlError';
  }
}

export class StageBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StageBudgetError';
  }
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Minimal glob matching: `**` (any depth), `*` (within a segment), `?`. */
export function matchGlob(pattern: string, file: string): boolean {
  const pat = pattern.replace(/\\/g, '/');
  const target = file.replace(/\\/g, '/');
  let re = '';
  for (let i = 0; i < pat.length; i += 1) {
    const c = pat[i];
    if (c === '*') {
      if (pat[i + 1] === '*') {
        if (pat[i + 2] === '/') {
          re += '(?:[^/]+/)*';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\/'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`).test(target);
}

export function validateManifest(input: unknown): SkillsManifest {
  const errors: string[] = [];
  const manifest = input as Partial<SkillsManifest> | null;
  if (!manifest || typeof manifest !== 'object') {
    throw new ManifestValidationError(['manifest is not an object']);
  }
  if (manifest.apiVersion !== 'context/v1') errors.push(`apiVersion must be "context/v1" (got ${String(manifest.apiVersion)})`);
  if (manifest.kind !== 'SkillsManifest') errors.push(`kind must be "SkillsManifest" (got ${String(manifest.kind)})`);
  const spec = manifest.spec as SkillsManifest['spec'] | undefined;
  if (!spec || typeof spec !== 'object') {
    errors.push('spec missing');
    throw new ManifestValidationError(errors);
  }
  const budget = spec.budget;
  if (!budget || typeof budget.dynamic_max_tokens !== 'number' || typeof budget.static_max_lines !== 'number') {
    errors.push('spec.budget must declare static_max_lines and dynamic_max_tokens');
  }
  if (!Array.isArray(spec.skills) || spec.skills.length === 0) {
    errors.push('spec.skills must be a non-empty array');
    throw new ManifestValidationError(errors);
  }
  const seen = new Set<string>();
  for (const skill of spec.skills) {
    if (!skill || typeof skill.name !== 'string' || skill.name.length === 0) {
      errors.push('every skill needs a name');
      continue;
    }
    if (seen.has(skill.name)) errors.push(`duplicate skill name: ${skill.name}`);
    seen.add(skill.name);
    if (!['always-load', 'path-scoped', 'manual-load'].includes(skill.tier)) {
      errors.push(`${skill.name}: tier must be always-load|path-scoped|manual-load`);
    }
    if (typeof skill.tokenCost !== 'number' || skill.tokenCost < 0) {
      errors.push(`${skill.name}: tokenCost must be a number >= 0`);
    }
    if (typeof skill.description !== 'string' || skill.description.length === 0) {
      errors.push(`${skill.name}: description required (Tier 1)`);
    }
    if (skill.tier === 'path-scoped' && (!Array.isArray(skill.paths) || skill.paths.length === 0)) {
      errors.push(`${skill.name}: path-scoped skill needs paths`);
    }
  }
  for (const skill of spec.skills) {
    for (const dep of skill.depends_on ?? []) {
      if (!seen.has(dep)) errors.push(`${skill.name}: depends_on unknown skill "${dep}"`);
    }
  }
  if (errors.length > 0) throw new ManifestValidationError(errors);
  return manifest as SkillsManifest;
}

export class SkillsLoader {
  manifest: SkillsManifest;
  budget: ContextBudget;
  root: string;
  skillsRoot: string;

  constructor(manifest: SkillsManifest, budget: ContextBudget, opts?: { root?: string }) {
    this.manifest = manifest;
    this.budget = budget;
    this.root = opts?.root ?? process.cwd();
    this.skillsRoot = path.join(this.root, '.agents', 'skills');
  }

  static async fromFiles(opts?: { root?: string }): Promise<SkillsLoader> {
    const root = opts?.root ?? process.cwd();
    const manifestRaw = parseYaml(
      await readFile(path.join(root, 'core', 'context', 'skills-manifest.yaml'), 'utf8'),
    );
    const manifest = validateManifest(manifestRaw);
    const budget = JSON.parse(
      await readFile(path.join(root, 'core', 'context', 'token-budget.json'), 'utf8'),
    ) as ContextBudget;
    return new SkillsLoader(manifest, budget, { root });
  }

  /** Tier 1 — always-visible manifest view (blueprint §6.4). */
  getManifest(): { name: string; description: string; tags: string[]; tokenCost: number }[] {
    return this.manifest.spec.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      tags: skill.tags ?? [],
      tokenCost: skill.tokenCost,
    }));
  }

  private byName(name: string): ManifestSkill | undefined {
    return this.manifest.spec.skills.find((skill) => skill.name === name);
  }

  /**
   * Skill content location: .agents/skills (core skills and materialized
   * pack junctions), falling back to the tracked pack source for fresh
   * clones where junctions do not exist yet (task 4.2).
   */
  private skillDir(name: string): string {
    return resolveSkillDir(this.root, name) ?? path.join(this.skillsRoot, name);
  }

  /**
   * Tier rules: always-load always matches; manual-load on explicit
   * invocation; path-scoped when the active file matches a path or a keyword
   * matches name/tags/description. Dependencies of matched skills are pulled
   * transitively (blueprint §6.4 "respect depends_on").
   */
  matchSkills(trigger: Trigger): { matched: ManifestSkill[]; missingDeps: string[] } {
    const matched = new Map<string, ManifestSkill>();
    const missingDeps: string[] = [];
    const keywords = (trigger.keywords ?? []).map((k) => k.toLowerCase());
    const activeFile = trigger.activeFile?.replace(/\\/g, '/');

    const wanted: string[] = [];
    for (const skill of this.manifest.spec.skills) {
      if (skill.tier === 'always-load') {
        wanted.push(skill.name);
      } else if (skill.tier === 'manual-load') {
        if (trigger.explicit?.includes(skill.name)) wanted.push(skill.name);
      } else {
        const pathHit =
          activeFile !== undefined &&
          (skill.paths ?? []).some((p) => matchGlob(p, activeFile));
        const keywordHit = keywords.some(
          (k) =>
            skill.name.toLowerCase().includes(k) ||
            (skill.tags ?? []).some((t) => t.toLowerCase().includes(k)) ||
            skill.description.toLowerCase().includes(k),
        );
        if (pathHit || keywordHit) wanted.push(skill.name);
      }
    }

    const pull = (name: string): void => {
      const skill = this.byName(name);
      if (!skill) {
        missingDeps.push(name);
        return;
      }
      if (matched.has(name)) return;
      matched.set(name, skill);
      for (const dep of skill.depends_on ?? []) pull(dep);
    };
    for (const name of wanted) pull(name);

    return { matched: [...matched.values()], missingDeps };
  }

  /** Kahn topological sort: dependencies load before dependents. */
  topoSort(skills: ManifestSkill[]): ManifestSkill[] {
    const names = new Set(skills.map((s) => s.name));
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const skill of skills) {
      const deps = (skill.depends_on ?? []).filter((d) => names.has(d));
      indegree.set(skill.name, deps.length);
      for (const dep of deps) {
        dependents.set(dep, [...(dependents.get(dep) ?? []), skill.name]);
      }
    }
    const queue = skills.filter((s) => (indegree.get(s.name) ?? 0) === 0).map((s) => s.name);
    const ordered: ManifestSkill[] = [];
    while (queue.length > 0) {
      const name = queue.shift() as string;
      const skill = skills.find((s) => s.name === name) as ManifestSkill;
      ordered.push(skill);
      for (const dependent of dependents.get(name) ?? []) {
        const next = (indegree.get(dependent) ?? 0) - 1;
        indegree.set(dependent, next);
        if (next === 0) queue.push(dependent);
      }
    }
    if (ordered.length !== skills.length) {
      const cyclic = skills.filter((s) => !ordered.includes(s)).map((s) => s.name);
      throw new SkillsBudgetError(`depends_on cycle involving: ${cyclic.join(', ')}`);
    }
    return ordered;
  }

  /**
   * Tier 2 — load instructions within dynamic_max_tokens.
   * Hard-rejects an over-budget ALWAYS-LOAD set (never silently drop
   * mandatory skills); optional skills over budget are reported as skipped.
   */
  async getInstructions(trigger: Trigger): Promise<InstructionBundle> {
    const { matched, missingDeps } = this.matchSkills(trigger);
    const ordered = this.topoSort(matched);
    const loaded: LoadedSkill[] = [];
    const skipped: { name: string; reason: string }[] = missingDeps.map((name) => ({
      name,
      reason: 'unknown dependency',
    }));

    const mandatory = ordered.filter((s) => s.tier === 'always-load');
    const mandatoryCost = mandatory.reduce((sum, s) => sum + s.tokenCost, 0);
    if (mandatoryCost > this.budget.dynamic_max_tokens) {
      throw new SkillsBudgetError(
        `always-load skills need ${mandatoryCost} tokens but dynamic budget is ${this.budget.dynamic_max_tokens} — reduce always-load skills or raise the budget`,
      );
    }

    let totalTokens = 0;
    for (const skill of ordered) {
      if (skill.tier === 'always-load') {
        // mandatory: must fit (checked above)
      } else if (totalTokens + skill.tokenCost > this.budget.dynamic_max_tokens) {
        skipped.push({ name: skill.name, reason: `over budget (${skill.tokenCost} tokens, ${totalTokens} loaded)` });
        continue;
      }
      const file = path.join(this.skillDir(skill.name), 'instructions.md');
      try {
        const text = await readFile(file, 'utf8');
        loaded.push({ name: skill.name, tokens: skill.tokenCost, file, text });
        totalTokens += skill.tokenCost;
      } catch {
        skipped.push({ name: skill.name, reason: 'instructions.md missing' });
      }
    }
    return { loaded, skipped, totalTokens };
  }

  /** Tier 3 — a single resource, guarded against escaping the skill folder. */
  async getResource(skillName: string, resourcePath: string): Promise<string> {
    const skillDir = path.resolve(this.skillDir(skillName), 'resources');
    // Backslash is a separator on Windows but a legal filename char on POSIX;
    // normalize so `..\..\x.md` traversal is detected on every platform.
    const resolved = path.resolve(skillDir, resourcePath.replace(/\\/g, '/'));
    if (!resolved.startsWith(skillDir + path.sep)) {
      throw new StageCrawlError(`resource path escapes skill folder: ${resourcePath}`);
    }
    return readFile(resolved, 'utf8');
  }

  /** OKF index-first access (C5): read a directory's index.md, never crawl. */
  async getIndex(dir: string): Promise<string | null> {
    try {
      return await readFile(path.join(dir, 'index.md'), 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * C2 — scoped stage loading: parse `## Inputs` from a CONTEXT.md and load
   * ONLY the declared files. Refuses directory or glob inputs (crawl attempt)
   * and refuses stage loads outside the 2K–8K token budget.
   */
  async loadStageInputs(contextMdPath: string): Promise<StageBundle> {
    const contextMd = await readFile(contextMdPath, 'utf8');
    const lines = contextMd.split(/\r?\n/);
    let inInputs = false;
    const inputLines: string[] = [];
    for (const line of lines) {
      const heading = /^##\s+(.*)$/.exec(line);
      if (heading) {
        if (inInputs) break;
        if (heading[1].trim() === 'Inputs') inInputs = true;
        continue;
      }
      if (inInputs) inputLines.push(line);
    }
    if (!inInputs) {
      throw new StageCrawlError(`${contextMdPath}: no "## Inputs" section — stage contract incomplete`);
    }
    const inputBlock = inputLines.join('\n');
    const baseDir = path.dirname(path.resolve(contextMdPath));
    const warnings: string[] = [];
    const inputs: StageInput[] = [];
    const inputRegex = /^\s*-\s*Layer\s+([0-4])\s*\((Reference|Working)\)\s*:\s*(\S+)\s*$/gm;
    let match = inputRegex.exec(inputBlock);
    let totalTokens = 0;
    while (match !== null) {
      const [, layer, kind, relPath] = match;
      if (relPath.includes('*')) {
        throw new StageCrawlError(
          `stage input "${relPath}" is a glob — only concrete relative files may be declared (no crawls)`,
        );
      }
      const abs = path.resolve(baseDir, relPath);
      const info = await stat(abs).catch(() => null);
      if (info === null) {
        throw new StageCrawlError(`stage input not found: ${relPath}`);
      }
      if (info.isDirectory()) {
        throw new StageCrawlError(
          `stage input "${relPath}" is a directory — directory crawls are refused; declare concrete files`,
        );
      }
      const text = await readFile(abs, 'utf8');
      const tokens = estimateTokens(text);
      totalTokens += tokens;
      inputs.push({ layer: `Layer ${layer}`, kind: kind as 'Reference' | 'Working', path: relPath, text, tokens });
      match = inputRegex.exec(inputBlock);
    }
    if (inputs.length === 0) {
      throw new StageCrawlError(`${contextMdPath}: "## Inputs" declares no files`);
    }
    if (totalTokens > this.budget.stage_max_tokens) {
      throw new StageBudgetError(
        `stage inputs need ${totalTokens} tokens but the stage budget caps at ${this.budget.stage_max_tokens} — split the stage`,
      );
    }
    if (totalTokens < this.budget.stage_min_tokens) {
      warnings.push(
        `stage inputs total ${totalTokens} tokens — below the ${this.budget.stage_min_tokens}-token floor; the stage contract may be incomplete`,
      );
    }
    return { inputs, totalTokens, warnings };
  }
}
