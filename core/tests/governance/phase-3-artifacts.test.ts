import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function read(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), 'utf8');
}

/**
 * Phase 3 doc-only exit criteria (tasks 3.5, 3.9, 3.10, 3.11) — the rule and
 * workflow artifacts must stay present and keep their operative sections.
 */
describe('Phase 3 workflow artifacts', () => {
  it('B4 — tests+evals-before-code rule is present in the skill, static rule and loop step 0', async () => {
    const skill = await read('.agents/skills/ss-new-feature/instructions.md');
    expect(skill).toMatch(/Red-First TDD Invariant/);
    const rule = await read('core/static-rules/verification.md');
    expect(rule).toMatch(/Tests and evals before code \(red first\)/);
    const spec = await read('docs/loops/new-feature-loop/spec.md');
    expect(spec).toMatch(/Red first: write the failing test or eval/);
  });

  it('B8 — /ss-review produces findings grouped by checklist category', async () => {
    const skill = await read('.agents/skills/ss-review/instructions.md');
    expect(skill).toMatch(/Mandatory Category Grouping/);
    const checklist = await read('.agents/skills/ss-review/resources/review-checklist.md');
    expect(checklist).toMatch(/activation: on-demand/);
    for (const heading of [
      /## 1\. Hallucinated dependencies/,
      /## 2\. Inadequate error handling/,
      /## 3\. Subtle correctness/,
    ]) {
      expect(checklist).toMatch(heading);
    }
  });

  it('B9 — /ss-lesson requires human approval before appending and budget-checks first', async () => {
    const skill = await read('.agents/skills/ss-lesson/instructions.md');
    expect(skill).toMatch(/Human Approval Gate/);
    expect(skill).toMatch(/Await explicit approval before saving/);
    expect(skill).toMatch(/validate-learning\.js/);
  });

  it('B10 — MODE.md declares the engagement modes and the static rule points at it', async () => {
    const mode = await read('docs/bible/MODE.md');
    expect(mode).toMatch(/^---\ntype: /); // OKF frontmatter
    for (const m of ['`vibe`', '`structured`', '`agentic`']) expect(mode).toContain(m);
    expect(mode).toMatch(/\*\*Fallback:\*\*/);
    const global = await read('core/static-rules/global.md');
    expect(global).toMatch(/docs\/bible\/MODE\.md/);
  });

  it('B1/B6/B7 — evals CI gate, git pre-commit hook and model routing are wired', async () => {
    const ci = await read('.github/workflows/evals-in-ci.yml');
    expect(ci).toMatch(/evals\/run\.js --strict/);
    const gitHook = await read('core/harness/hooks/git-hooks/pre-commit');
    expect(gitHook).toMatch(/core\/harness\/hooks\/pre-commit\.js/);
    const verify = await read('.agents/skills/ss-verify/instructions.md');
    expect(verify).toMatch(/core\/context\/model-routing\.yaml/);
  });
});
