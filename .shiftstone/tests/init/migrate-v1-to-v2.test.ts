import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { buildPlan, detectState, run } from '../../migrate-v1-to-v2.js';

type MigrationResult = { code: number; lines: string[]; plan: any; reportPath?: string };

/** run() narrows its return type on error paths; tests always want the full shape. */
function migrate(options: Parameters<typeof run>[0]): MigrationResult {
  return run(options) as unknown as MigrationResult;
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const CLI = path.join(REPO_ROOT, '.shiftstone', 'migrate-v1-to-v2.js');

function tempDir(prefix: string): string {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

/** Minimal v1.x workspace: bible + flat skills + legacy rules, no core/, no packs/. */
function makeV1Workspace(): string {
  const root = tempDir('migrate-v1-');
  const write = (rel: string, content: string) => {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  };
  write('AGENTS.md', '# Workspace\nReact Router 8 + Supabase project.\n');
  write('docs/bible/01-architecture/architecture-overview.md', '# Architecture\n');
  write('docs/bible/DECISIONS.md', '# ADRs\nKEEP-ME-DECISION\n');
  write('docs/backlog/MOC.md', '# Backlog\nKEEP-ME-BACKLOG\n');
  write('apps/web/package.json', '{ "name": "keep-me-app" }\n');
  write('.agent/rules/structure.md', 'v1 rule\n');
  write('.agents/skills/react-router-routing/SKILL.md', '# react-router-routing\n');
  write('.agents/skills/supabase-auth/SKILL.md', '# supabase-auth\n');
  write('.agents/skills/my-custom-skill/SKILL.md', '# my-custom-skill\nKEEP-ME-SKILL\n');
  return root;
}

/** Minimal v2 framework source: rr8 pack (partial skills) + harness skeleton. */
function makeFramework(options?: { skills?: string[] }): string {
  const fw = tempDir('migrate-fw-');
  const skills = options?.skills ?? [];
  const write = (rel: string, content: string) => {
    const abs = path.join(fw, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content, 'utf8');
  };
  cpSync(path.join(REPO_ROOT, 'packs', '_schema.json'), path.join(fw, 'packs', '_schema.json'));
  cpSync(
    path.join(REPO_ROOT, 'packs', 'rr8-supabase-cf', 'manifest.yaml'),
    path.join(fw, 'packs', 'rr8-supabase-cf', 'manifest.yaml'),
  );
  write('packs/rr8-supabase-cf/skills/stack/SKILL.md', '# stack (pack-shipped)\n');
  for (const skill of skills) {
    write(`packs/rr8-supabase-cf/skills/${skill}/SKILL.md`, '# shipped by framework pack\n');
  }
  write('.shiftstone/harness/loop-runner/runner.ts', 'export const runner = "harness-skeleton";\n');
  write('.shiftstone/context/skills-manifest.yaml', 'spec: {}\n');
  write('.github/workflows/parity-check.yml', 'name: parity-check\n');
  return fw;
}

function walk(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

describe('7.7 — migrate-v1-to-v2 detection (step 1)', () => {
  it('flags a v1 workspace with its markers', () => {
    const root = makeV1Workspace();
    const state = detectState(root);
    expect(state.isV1).toBe(true);
    expect(state.alreadyMigrated).toBe(false);
    expect(state.bibleChapters).toEqual(['01-architecture']);
    expect(state.backlog).toBe(true);
    expect(state.decisions).toBe(true);
    expect(state.apps).toEqual(['web']);
    expect(state.v1RuleFolders).toContain('.agent/rules');
    expect(state.skillNames).toEqual(['my-custom-skill', 'react-router-routing', 'supabase-auth']);
  });

  it('recognises an already-migrated v2 workspace', () => {
    const state = detectState(REPO_ROOT);
    expect(state.isV1).toBe(false);
    expect(state.alreadyMigrated).toBe(true);

    const result = migrate({ root: REPO_ROOT, framework: REPO_ROOT });
    expect(result.code).toBe(0);
    expect(result.lines.join('\n')).toMatch(/already a v2\.0 workspace/);
  });
});

describe('7.7 — dry-run (default mode)', () => {
  it('plans the migration, suggests rr8-supabase-cf, and writes nothing', () => {
    const root = makeV1Workspace();
    const fw = makeFramework();
    const before = walk(root);

    const result = migrate({ root, framework: fw });

    expect(result.code).toBe(0);
    expect(result.plan.suggestion.pack).toBe('rr8-supabase-cf');
    expect(result.plan.suggestion.tokens.join(' ')).toMatch(/react-router|supabase/);
    expect(result.plan.registry).toMatch(/create \(activePacks: \[rr8-supabase-cf\]\)/);
    expect(result.plan.moves.map((m: { skill: string }) => m.skill)).toEqual([
      'react-router-routing',
      'supabase-auth',
    ]);
    expect(result.plan.preservedSkills).toEqual(['my-custom-skill']);
    expect(result.reportPath).toBeUndefined();
    expect(walk(root)).toEqual(before); // nothing written
    expect(result.lines.join('\n')).toMatch(/DRY RUN/);
  });

  it('exits 0 via the CLI on a v1 workspace', () => {
    const root = makeV1Workspace();
    const proc = spawnSync(process.execPath, [CLI, `--root=${root}`, `--framework=${makeFramework()}`], {
      encoding: 'utf8',
    });
    expect(proc.status).toBe(0);
    expect(proc.stdout).toMatch(/DRY RUN/);
    expect(proc.stdout).toMatch(/--apply/);
  });

  it('rejects an unknown --archetype override', () => {
    const result = migrate({ root: makeV1Workspace(), framework: makeFramework(), archetypeOverride: 'nope-pack' });
    expect(result.code).toBe(1);
    expect(result.lines.join('\n')).toMatch(/not found/);
  });
});

describe('7.7 — apply mode (steps 3–6)', () => {
  it('adds the harness, writes the registry, moves rr8 skills, preserves everything else, emits the report', () => {
    const root = makeV1Workspace();
    const fw = makeFramework();
    const backlogBefore = readFileSync(path.join(root, 'docs', 'backlog', 'MOC.md'), 'utf8');
    const appBefore = readFileSync(path.join(root, 'apps', 'web', 'package.json'), 'utf8');
    const customBefore = readFileSync(path.join(root, '.agents', 'skills', 'my-custom-skill', 'SKILL.md'), 'utf8');

    const result = migrate({ root, framework: fw, apply: true });

    expect(result.code).toBe(0);
    // 4. harness added (loop runner + verifier ladder tree present)
    expect(existsSync(path.join(root, '.shiftstone', 'harness', 'loop-runner', 'runner.ts'))).toBe(true);
    expect(existsSync(path.join(root, '.github', 'workflows', 'parity-check.yml'))).toBe(true);
    // 2. registry created with the suggested archetype
    const registry = readFileSync(path.join(root, 'packs', '_registry.yaml'), 'utf8');
    expect(registry).toMatch(/activePacks:\n\s+- rr8-supabase-cf/);
    // 3. rr8-coupled skills relocated into the pack
    expect(existsSync(path.join(root, 'packs', 'rr8-supabase-cf', 'skills', 'react-router-routing', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(root, 'packs', 'rr8-supabase-cf', 'skills', 'supabase-auth', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(root, '.agents', 'skills', 'react-router-routing'))).toBe(false);
    // 5. preservation contract
    expect(readFileSync(path.join(root, 'docs', 'backlog', 'MOC.md'), 'utf8')).toBe(backlogBefore);
    expect(readFileSync(path.join(root, 'apps', 'web', 'package.json'), 'utf8')).toBe(appBefore);
    expect(readFileSync(path.join(root, '.agents', 'skills', 'my-custom-skill', 'SKILL.md'), 'utf8')).toBe(customBefore);
    expect(existsSync(path.join(root, '.agent', 'rules', 'structure.md'))).toBe(true); // never deleted
    // 6. migration report
    expect(result.reportPath).toBeDefined();
    const report = readFileSync(result.reportPath!, 'utf8');
    expect(report).toMatch(/^---\ntype: report\ntimestamp: \d{4}-\d{2}-\d{2}T/);
    expect(report).toMatch(/## Suggested archetype \(step 2\)/);
    expect(report).toMatch(/rr8-supabase-cf/);
    expect(report).toMatch(/KEEP-ME-BACKLOG|docs\/backlog\/\*\*/);
  });

  it('is idempotent: a second run reports already-migrated and writes nothing new', () => {
    const root = makeV1Workspace();
    const fw = makeFramework();
    migrate({ root, framework: fw, apply: true });
    const afterFirst = walk(root);

    const second = migrate({ root, framework: fw, apply: true });

    expect(second.code).toBe(0);
    expect(second.lines.join('\n')).toMatch(/already a v2\.0 workspace/);
    expect(walk(root)).toEqual(afterFirst);
  });

  it('leaves skills in place when the pack already ships them', () => {
    const root = makeV1Workspace();
    const fw = makeFramework({ skills: ['react-router-routing', 'supabase-auth'] });

    const result = migrate({ root, framework: fw, apply: true });

    expect(result.code).toBe(0);
    expect(existsSync(path.join(root, '.agents', 'skills', 'react-router-routing', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(root, '.agents', 'skills', 'supabase-auth', 'SKILL.md'))).toBe(true);
    expect(result.lines.join('\n')).toMatch(/0 skills? already shipped|left in place/);
  });

  it('--report writes the report without applying', () => {
    const root = makeV1Workspace();
    const fw = makeFramework();

    const result = migrate({ root, framework: fw, report: true });

    expect(result.code).toBe(0);
    expect(result.reportPath).toBeDefined();
    expect(readFileSync(result.reportPath!, 'utf8')).toMatch(/Mode:\*\* dry-run/);
    expect(existsSync(path.join(root, '.shiftstone', 'harness'))).toBe(false); // nothing applied
  });
});

describe('7.7 — buildPlan details', () => {
  it('follows v1 rule folders as manual follow-ups, never automatic deletion', () => {
    const plan = buildPlan({ root: makeV1Workspace(), framework: makeFramework() });
    expect(plan.followups.join('\n')).toMatch(/link-ide-folders\.js/);
    expect(plan.followups.join('\n')).toMatch(/never deletes your files/);
    expect(plan.followups.join('\n')).toMatch(/\/sync-bible/);
  });

  it('merges only framework paths that are not the workspace itself', () => {
    const plan = buildPlan({ root: REPO_ROOT, framework: REPO_ROOT });
    expect(plan.merge).toHaveLength(0);
  });
});
