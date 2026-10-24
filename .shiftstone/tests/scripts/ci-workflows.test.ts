import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

// DEC-013 moved the engine into the `.shiftstone/` dotfolder; workflows left behind
// `working-directory: core` and therefore aborted before running a single gate.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// The parent lab nests the child framework as a sibling repo; the child distribution
// has no `frameworks/` subtree, so it only guards its own three workflows.
const NESTED_CHILD_ROOT = path.join(REPO_ROOT, 'frameworks', 'shiftstone');
const HAS_NESTED_CHILD = existsSync(NESTED_CHILD_ROOT);

const WORKFLOW_NAMES = ['parity-check.yml', 'validate-packs.yml', 'evals-in-ci.yml'];

function workflowsIn(root: string, label: string) {
  return WORKFLOW_NAMES.map((name) => ({
    label: `${label}/${name}`,
    file: path.join(root, '.github', 'workflows', name),
    root,
    rootLabel: label,
  }));
}

const WORKFLOWS = [
  ...workflowsIn(REPO_ROOT, 'repository root'),
  ...(HAS_NESTED_CHILD ? workflowsIn(NESTED_CHILD_ROOT, 'frameworks/shiftstone') : []),
];

type Step = { name?: string; run?: string; 'working-directory'?: string; uses?: string };

function stepsOf(doc: unknown): Step[] {
  const jobs = (doc as { jobs?: Record<string, { steps?: Step[] }> })?.jobs ?? {};
  return Object.values(jobs).flatMap((job) => job?.steps ?? []);
}

/** Relative paths a `run:` block touches, e.g. `.shiftstone/scripts/x.js` or `-C .shiftstone`. */
function referencedPaths(run: string): string[] {
  const found = new Set<string>();
  for (const match of run.matchAll(/\.shiftstone\/[A-Za-z0-9._/-]+/g)) {
    found.add(match[0].replace(/[./-]+$/, ''));
  }
  for (const match of run.matchAll(/(?:pnpm|npm)\s+(?:-C|--dir)\s+(\S+)/g)) {
    found.add(match[1].replace(/[./-]+$/, ''));
  }
  return [...found];
}

describe('CI workflows resolve against directories that exist (REQ-01 / audit W4)', () => {
  it('parses every workflow this repository ships', () => {
    expect(WORKFLOWS).toHaveLength(HAS_NESTED_CHILD ? 6 : 3);
    for (const wf of WORKFLOWS) {
      expect(existsSync(wf.file), `${wf.label}: workflow file missing`).toBe(true);
      const doc = parseYaml(readFileSync(wf.file, 'utf8'));
      expect(doc?.jobs, `${wf.label}: no jobs block`).toBeTruthy();
      expect(stepsOf(doc).length, `${wf.label}: no steps`).toBeGreaterThan(0);
    }
  });

  it('contains zero `working-directory: core` directives', () => {
    for (const wf of WORKFLOWS) {
      const raw = readFileSync(wf.file, 'utf8');
      expect(raw, `${wf.label}: still references the removed core/ directory`).not.toMatch(
        /working-directory:\s*core\s*$/m,
      );
      for (const step of stepsOf(parseYaml(raw))) {
        expect(step['working-directory'], `${wf.label}: step "${step.name}" runs in core/`).not.toBe('core');
      }
    }
  });

  it('names only existing directories in every working-directory value', () => {
    for (const wf of WORKFLOWS) {
      for (const step of stepsOf(parseYaml(readFileSync(wf.file, 'utf8')))) {
        const dir = step['working-directory'];
        if (!dir) continue;
        const abs = path.resolve(wf.root, dir);
        expect(existsSync(abs), `${wf.label}: working-directory "${dir}" does not exist under ${wf.rootLabel}`).toBe(
          true,
        );
      }
    }
  });

  it('installs harness dependencies via a form that resolves on disk', () => {
    for (const wf of WORKFLOWS) {
      const steps = stepsOf(parseYaml(readFileSync(wf.file, 'utf8')));
      const install = steps.find((s) => s.run?.includes('install --frozen-lockfile'));
      expect(install, `${wf.label}: no frozen-lockfile install step`).toBeTruthy();

      const dir = install?.['working-directory'];
      const run = install?.run ?? '';
      const rootForm = !dir && run.includes('pnpm -C .shiftstone install --frozen-lockfile');
      const scopedForm = dir === '.shiftstone' && run.includes('pnpm install --frozen-lockfile');
      expect(
        rootForm || scopedForm,
        `${wf.label}: install step must run "pnpm -C .shiftstone install --frozen-lockfile" at the root ` +
          `or "pnpm install --frozen-lockfile" with working-directory .shiftstone (got dir=${dir ?? 'none'})`,
      ).toBe(true);
      expect(existsSync(path.resolve(wf.root, '.shiftstone')), `${wf.label}: .shiftstone/ missing`).toBe(true);
    }
  });

  it('references only existing paths from every run step', () => {
    for (const wf of WORKFLOWS) {
      for (const step of stepsOf(parseYaml(readFileSync(wf.file, 'utf8')))) {
        if (!step.run) continue;
        for (const rel of referencedPaths(step.run)) {
          expect(
            existsSync(path.resolve(wf.root, rel)),
            `${wf.label}: step "${step.name}" references "${rel}", which does not exist under ${wf.rootLabel}`,
          ).toBe(true);
        }
      }
    }
  });
});
