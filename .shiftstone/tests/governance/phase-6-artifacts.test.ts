import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { validateStage } from '../../governance/stage-seal.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

async function read(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), 'utf8');
}

/**
 * Phase 6 doc-only exit criteria (tasks 6.3, 6.4, 6.6, 6.7, 6.10) — the
 * workflows, rules and templates must keep their operative sections. The
 * scripted gates (6.2/6.4/6.6/6.9) have their own test files.
 */
describe('Phase 6 workflow artifacts', () => {
  it('6.3 — /ss-sync-bible detects drift mechanically and blocks doc edits behind a Checker', async () => {
    const skill = await read('.agents/skills/ss-sync-bible/instructions.md');
    expect(skill).toMatch(/bible-sync\.js --report/); // 6.1 re-confirmed: 3-way diff detection
    expect(skill).toMatch(/Outer-Gate Checker Sign-Off/);
    expect(skill).toMatch(/disjoint Checker/);
    expect(skill).toMatch(/0\.8/);
    expect(skill).toMatch(/blocked/i);
    expect(skill).toMatch(/compile-changelog\.js/); // 6.9 phase lives in the same skill
    expect(skill).toMatch(/reports\/sync/);
  });

  it('6.4 — backlog closes only via /ss-verify with a signature, in guide, MOC and skill', async () => {
    const howTo = await read('docs/backlog/HOW-TO-USE.md');
    expect(howTo).toMatch(/\/ss-verify <task-id>/);
    expect(howTo).toMatch(/verified by <model-family> @ <score>/);
    expect(howTo).toMatch(/check-backlog-signoff\.js/);
    const moc = await read('docs/backlog/MOC.md');
    expect(moc).toMatch(/only\*\* after `\/ss-verify/);
    const backlogSync = await read('.agents/skills/ss-backlog-sync/instructions.md');
    expect(backlogSync).toMatch(/not mark `\[x\]` directly/i);
    expect(backlogSync).toMatch(/Route candidate closures through `\/ss-verify/);
  });

  it('6.6 — CODEOWNERS, the ownership table, the PR checklist and the dispatch row all exist', async () => {
    const owners = await read('CODEOWNERS');
    for (const path_ of ['/AGENTS.md', '/.shiftstone/static-rules/', '/evals/', '/.agents/skills/']) {
      expect(owners, `CODEOWNERS missing ${path_}`).toContain(path_);
    }
    expect(owners).toMatch(/@vishal-ranjan-codes/);

    const readme = await read('README.md');
    expect(readme).toMatch(/## 🛡️ Harness Ownership/);
    expect(readme).toMatch(/check-harness-ownership\.js/);

    const rule = await read('.shiftstone/static-rules/governance.md');
    expect(rule).toMatch(/activation: on-demand/);
    expect(rule).toMatch(/Pull request with checklist/);
    expect(rule).toMatch(/Solo degrade/);

    const global = await read('.shiftstone/static-rules/global.md');
    expect(global).toMatch(/\| Harness changes .* \| `\.shiftstone\/static-rules\/governance\.md` \|/);
  });

  it('6.7 — every knowledge bundle carries a log.md and the convention is declared in _config', async () => {
    const packLog = existsSync(path.join(REPO_ROOT, '.shiftstone', 'packs', 'log.md'))
      ? '.shiftstone/packs/log.md'
      : 'packs/log.md';
    for (const rel of ['docs/bible/log.md', packLog, '.agents/skills/log.md']) {
      const log = await read(rel);
      expect(log).toContain('type: log');
      expect(log).toContain('timestamp:');
      expect(log).toContain('| Date | Scope | Change | Kind | Compiled |');
    }
    const convention = await read('_config/conventions.md');
    expect(convention).toMatch(/Knowledge-Bundle Logs/);
    expect(convention).toMatch(/Append only/);
    expect(convention).toMatch(/compile-changelog\.js/);
  });

  it('6.7 exit criterion — every bundle has index.md + log.md, and the skills-bundle files are tracked', async () => {
    const packBundle = existsSync(path.join(REPO_ROOT, '.shiftstone', 'packs')) ? '.shiftstone/packs' : 'packs';
    for (const bundle of ['docs/bible', packBundle, '.agents/skills']) {
      const index = await read(`${bundle}/index.md`);
      expect(index, `${bundle}/index.md`).toContain('type: index');
      await read(`${bundle}/log.md`);
    }
    // /.agents/skills/* would otherwise swallow the new core skill and bundle records
    const gitignore = await read('.gitignore');
    expect(gitignore).toMatch(/!\/\.agents\/skills\/ss-\*\//);
    expect(gitignore).toMatch(/!\/\.agents\/skills\/log\.md/);
    expect(gitignore).toMatch(/!\/\.agents\/skills\/index\.md/);
  });

  it('6.3/6.9 — registries and always-on rules agree with the outer gate and the log convention', async () => {
    // the command registry in README sells /ss-sync-bible as outer-gated, like /ss-verify
    const readme = await read('README.md');
    expect(readme).toMatch(/`\/ss-sync-bible`.*Checker sign-off ≥ 80/);

    // the Two-Gear boundary (always-on) includes doc edits
    const verification = await read('.shiftstone/static-rules/verification.md');
    expect(verification).toMatch(/`\/ss-sync-bible` doc edits clear the same ≥ 0\.8 Checker gate/);

    // the bible rules route shipped-change entries through log.md + the compiler
    const bibleRules = await read('.shiftstone/path-scoped-rules/bible-rules.md');
    expect(bibleRules).toMatch(/\| Any shipped feature or bug fix \| `log\.md` row → compiled into `CHANGELOG\.md`/);
    expect(bibleRules).toMatch(/recorded as an append-only `log\.md` row/);

    // applying a sync in ss-sync-bible skill mentions compile-changelog.js
    const syncBible = await read('.agents/skills/ss-sync-bible/instructions.md');
    expect(syncBible).toMatch(/compile-changelog\.js/);
  });

  it('6.10 — the stage template and /new-feature carry U-shaped effort annotations with both human gates', async () => {
    const template = await read('.shiftstone/governance/stage-contract-template.md');
    expect(template).toMatch(/^effort: AUTOMATED$/m);
    expect(template).toMatch(/## Human Effort/);
    for (const band of ['DIRECTION', 'AUTOMATED', 'ALIGNMENT']) expect(template).toContain(band);
    expect(template).toMatch(/U-shape|U-shaped/);

    const skill = await read('.agents/skills/ss-new-feature/instructions.md');
    expect(skill).toMatch(/Human Gate 1 \(Spec Approval\)|HUMAN GATE 1/i);
    expect(skill).toMatch(/HUMAN GATE 2/);
    expect(skill).toMatch(/Effort: DIRECTION/);
    expect(skill).toMatch(/Effort: AUTOMATED/);
    expect(skill).toMatch(/Effort: ALIGNMENT/);

    const spec = await read('docs/loops/new-feature-loop/spec.md');
    expect(spec).toMatch(/- "approve spec"/); // first-stage gate
    expect(spec).toMatch(/- "mark the backlog task as \[x\]"/); // last-stage gate
  });

  it('6.10 — a stage copied from the annotated template still seals (extra section is safe)', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'phase6-seal-'));
    const stageDir = path.join(root, '01-direction');
    await mkdir(path.join(stageDir, 'output'), { recursive: true });
    await writeFile(path.join(stageDir, 'CONTEXT.md'), await read('.shiftstone/governance/stage-contract-template.md'), 'utf8');
    await writeFile(
      path.join(stageDir, 'output', 'deliverable.md'),
      '---\ntype: stage-output\ntimestamp: 2026-10-16T00:00:00.000Z\ninputs:\n  - ../../notes.md\n---\n\n# Deliverable\n',
      'utf8',
    );
    const report = await validateStage(stageDir);
    expect(report.problems).toEqual([]);
    expect(report.sealed).toBe(true);
  });
});
