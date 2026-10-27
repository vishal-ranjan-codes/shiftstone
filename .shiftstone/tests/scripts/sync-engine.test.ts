import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  computeEngineDiff,
  DEFAULT_CHILD_ROOT,
  isProtected,
  isTemplatedArea,
  PROTECTED_BOUNDARY_PATTERNS,
  renderForDirection,
  syncEngine,
  TEMPLATED_SYNC_AREAS,
  toLabIdentity,
  toPlaceholderForm,
  UNIVERSAL_SYNC_AREAS,
  unifiedDiff,
} from '../../scripts/sync-engine.js';

function makePair() {
  const parentTemp = mkdtempSync(path.join(tmpdir(), 'sync-parent-'));
  const childTemp = mkdtempSync(path.join(tmpdir(), 'sync-child-'));
  for (const root of [parentTemp, childTemp]) {
    mkdirSync(path.join(root, '.shiftstone', 'scripts'), { recursive: true });
    mkdirSync(path.join(root, '.shiftstone', 'static-rules'), { recursive: true });
    mkdirSync(path.join(root, '.shiftstone', 'path-scoped-rules'), { recursive: true });
  }
  return { parentTemp, childTemp, cleanup: () => {
    rmSync(parentTemp, { recursive: true, force: true });
    rmSync(childTemp, { recursive: true, force: true });
  } };
}

const write = (root: string, rel: string, body: string) => {
  const abs = path.join(root, '.shiftstone', rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, body, 'utf8');
};
const read = (root: string, rel: string) => readFileSync(path.join(root, '.shiftstone', rel), 'utf8');

describe('sync-engine.js — Bi-Directional Engine Synchronization (DEC-014)', () => {
  it('protects environment boundary files from sync overwrite', () => {
    expect(isProtected('.shiftstone/governance/workspace-manifest.json')).toBe(true);
    expect(isProtected('.shiftstone/governance/implementation-status.json')).toBe(true);
    expect(isProtected('.shiftstone/static-rules/product.md')).toBe(true);
    expect(isProtected('.shiftstone/static-rules/global.md')).toBe(true);
    expect(isProtected('package.json')).toBe(true);
    expect(isProtected('AGENTS.md')).toBe(true);
    expect(isProtected('docs/bible/01-architecture/architecture-overview.md')).toBe(true);

    // Universal engine files must NOT be protected
    expect(isProtected('.shiftstone/scripts/validate-workspace.js')).toBe(false);
    expect(isProtected('.shiftstone/harness/loop-runner/runner.ts')).toBe(false);
    expect(isProtected('.shiftstone/context/skills-loader.ts')).toBe(false);
  });

  it('protects the child-owned path-scoped rules that pack overlays compose at init', () => {
    // seed-governance.js applySurfaceOverlays() rewrites these from the active
    // pack's `path-rules/` overlay, so the child's committed copies are starter
    // templates — not universal engine content. Syncing them would overwrite
    // app-developer rules with lab engine rules.
    for (const name of ['code-quality.md', 'structure.md', 'ui-rules.md', 'workspace-init-rules.md']) {
      expect(isProtected(`.shiftstone/path-scoped-rules/${name}`), name).toBe(true);
    }
    // The universal, identity-token-only rules stay syncable.
    expect(isProtected('.shiftstone/path-scoped-rules/research-rules.md')).toBe(false);
    expect(isProtected('.shiftstone/static-rules/verification.md')).toBe(false);
    expect(isProtected('.shiftstone/static-rules/governance.md')).toBe(false);
    expect(isProtected('.shiftstone/static-rules/security.md')).toBe(false);
  });

  it('declares universal sync areas and protected boundary patterns', () => {
    expect(UNIVERSAL_SYNC_AREAS).toContain('scripts');
    expect(UNIVERSAL_SYNC_AREAS).toContain('harness');
    expect(UNIVERSAL_SYNC_AREAS).toContain('context');
    expect(UNIVERSAL_SYNC_AREAS).toContain('init');
    expect(UNIVERSAL_SYNC_AREAS).toContain('static-rules');
    expect(UNIVERSAL_SYNC_AREAS).toContain('path-scoped-rules');
    expect(UNIVERSAL_SYNC_AREAS).toContain('governance');
    expect(UNIVERSAL_SYNC_AREAS).toContain('schemas');
    expect(TEMPLATED_SYNC_AREAS).toEqual(['static-rules', 'path-scoped-rules']);
    expect(isTemplatedArea('static-rules/verification.md')).toBe(true);
    expect(isTemplatedArea('path-scoped-rules/research-rules.md')).toBe(true);
    expect(isTemplatedArea('scripts/validate-workspace.js')).toBe(false);
    expect(PROTECTED_BOUNDARY_PATTERNS.length).toBeGreaterThanOrEqual(10);
  });

  it('runs dry-run sync without modifying target files', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'scripts/shared.js', 'console.log("v2");\n');
      write(childTemp, 'scripts/shared.js', 'console.log("v1");\n');
      write(parentTemp, 'scripts/new-tool.js', 'console.log("new");\n');

      const dryRes = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', dryRun: true });
      expect(dryRes.ok).toBe(true);
      expect(dryRes.stats.created).toBe(1);
      expect(dryRes.stats.updated).toBe(1);
      expect(dryRes.stats.actionsApplied).toBe(0);
      expect(read(childTemp, 'scripts/shared.js')).toBe('console.log("v1");\n');
      expect(existsSync(path.join(childTemp, '.shiftstone', 'scripts', 'new-tool.js'))).toBe(false);

      const applyRes = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', dryRun: false });
      expect(applyRes.ok).toBe(true);
      expect(applyRes.stats.actionsApplied).toBe(2);
      expect(read(childTemp, 'scripts/shared.js')).toBe('console.log("v2");\n');
      expect(read(childTemp, 'scripts/new-tool.js')).toBe('console.log("new");\n');

      const checkRes = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', check: true });
      expect(checkRes.ok).toBe(true);
      expect(checkRes.stats.identical).toBe(2);
      expect(checkRes.stats.created).toBe(0);
      expect(checkRes.stats.updated).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('handles inward synchronization from framework to lab', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(childTemp, 'scripts/framework-fix.js', 'export const fix = 1;\n');

      const inwardRes = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'inward', dryRun: false });
      expect(inwardRes.ok).toBe(true);
      expect(inwardRes.stats.created).toBe(1);
      expect(read(parentTemp, 'scripts/framework-fix.js')).toBe('export const fix = 1;\n');
    } finally {
      cleanup();
    }
  });
});

describe('sync-engine.js — templated governance rule parity (REQ-08 / audit W5)', () => {
  it('normalizes every lab identity token to the child placeholder form', () => {
    expect(toPlaceholderForm('# ShiftStone Engineering Hub — Verification Rules')).toBe('# {{PROJECT_NAME}} — Verification Rules');
    expect(toPlaceholderForm('# ShiftStone — Research Rules')).toBe('# {{PROJECT_NAME}} — Research Rules');
    expect(toPlaceholderForm('shiftstone-workspace/\n├── .shiftstone/')).toBe('{{PROJECT_NAME}}/\n├── .shiftstone/');
    // Longest token first: the hub name must not degrade to a bare-name substitution.
    expect(toPlaceholderForm('ShiftStone Engineering Hub')).toBe('{{PROJECT_NAME}}');
    expect(toPlaceholderForm('{{PROJECT_NAME}} — already a placeholder')).toBe('{{PROJECT_NAME}} — already a placeholder');
  });

  it('round-trips placeholder → lab identity without loss', () => {
    const lab = '# ShiftStone Engineering Hub — Security Rules (Layer 0, always on)\n\nBody line.\n';
    expect(toLabIdentity(toPlaceholderForm(lab))).toBe(lab);
    const child = '# {{PROJECT_NAME}} — Security Rules (Layer 0, always on)\n\nBody line.\n';
    expect(toPlaceholderForm(toLabIdentity(child))).toBe(child);
  });

  it('renders the placeholder form outward and the lab identity inward', () => {
    const lab = '# ShiftStone Engineering Hub — Governance\n';
    expect(renderForDirection(lab, 'outward')).toBe('# {{PROJECT_NAME}} — Governance\n');
    expect(renderForDirection('# {{PROJECT_NAME}} — Governance\n', 'inward'))
      .toBe('# ShiftStone Engineering Hub — Governance\n');
  });

  it('treats identity-only rule drift as identical so governance diffs on substance', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      const body = '— Verification Rules (Layer 0, always on)\n\n1. Inner gear verifies locally.\n';
      write(parentTemp, 'static-rules/verification.md', `# ShiftStone Engineering Hub ${body}`);
      write(childTemp, 'static-rules/verification.md', `# {{PROJECT_NAME}} ${body}`);

      const res = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', check: true });
      expect(res.ok).toBe(true);
      expect(res.stats.updated).toBe(0);
      expect(res.stats.created).toBe(0);
      expect(res.diff.identical).toContain('static-rules/verification.md');
    } finally {
      cleanup();
    }
  });

  it('reports substantive rule drift with a unified diff and writes nothing in dry-run', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'static-rules/security.md', '# ShiftStone Engineering Hub — Security Rules\n\n- New guard added in the lab.\n');
      write(childTemp, 'static-rules/security.md', '# {{PROJECT_NAME}} — Security Rules\n');

      const dry = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', dryRun: true });
      expect(dry.stats.updated).toBe(1);
      expect(dry.stats.actionsApplied).toBe(0);
      const item = dry.diff.updated.find((u) => u.rel === 'static-rules/security.md');
      expect(item?.templated).toBe(true);
      expect(item?.diff).toContain('--- ');
      expect(item?.diff).toContain('+++ ');
      expect(item?.diff).toContain('@@');
      expect(item?.diff).toContain('+');
      expect(item?.diff).toContain('New guard added in the lab.');
      // Dry-run must not touch the child.
      expect(read(childTemp, 'static-rules/security.md')).toBe('# {{PROJECT_NAME}} — Security Rules\n');
    } finally {
      cleanup();
    }
  });

  it('fails --check on synthetic rule drift and passes once the drift is applied', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'path-scoped-rules/research-rules.md', '# ShiftStone — Research Rules\n\n- Three receipts minimum.\n');
      write(childTemp, 'path-scoped-rules/research-rules.md', '# {{PROJECT_NAME}} — Research Rules\n\n- Stale child rule text.\n');

      const drifted = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', check: true });
      expect(drifted.ok).toBe(false);
      expect(drifted.stats.updated).toBe(1);

      const applied = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward' });
      expect(applied.ok).toBe(true);
      expect(applied.stats.actionsApplied).toBe(1);
      // Apply renders the child form — the lab identity must not leak outward.
      expect(read(childTemp, 'path-scoped-rules/research-rules.md')).toBe(
        '# {{PROJECT_NAME}} — Research Rules\n\n- Three receipts minimum.\n',
      );
      expect(read(childTemp, 'path-scoped-rules/research-rules.md')).not.toContain('ShiftStone');

      const clean = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', check: true });
      expect(clean.ok).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('renders the lab identity when a child rule fix propagates inward', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'static-rules/governance.md', '# ShiftStone Engineering Hub — Harness-as-Code Governance (B11)\n');
      write(childTemp, 'static-rules/governance.md', '# {{PROJECT_NAME}} — Harness-as-Code Governance (B11)\n\n- Child-hardened guard.\n');

      const res = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'inward' });
      expect(res.stats.actionsApplied).toBe(1);
      expect(read(parentTemp, 'static-rules/governance.md')).toBe(
        '# ShiftStone Engineering Hub — Harness-as-Code Governance (B11)\n\n- Child-hardened guard.\n',
      );
    } finally {
      cleanup();
    }
  });

  it('refuses to sync protected rule files even when named by an explicit --path filter', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'static-rules/product.md', '# ShiftStone Engineering Hub — Product Identity\n');
      write(childTemp, 'static-rules/product.md', '# {{PROJECT_NAME}} — Product Identity\n');
      write(parentTemp, 'path-scoped-rules/ui-rules.md', '# ShiftStone Engineering Hub — UI Rules (lab)\n');
      write(childTemp, 'path-scoped-rules/ui-rules.md', '# {{PROJECT_NAME}} — UI & Design System Rules (child)\n');

      for (const rel of ['static-rules/product.md', 'path-scoped-rules/ui-rules.md']) {
        const res = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', pathFilter: rel });
        expect(res.stats.actionsApplied, rel).toBe(0);
        expect(res.diff.protectedSkipped, rel).toContain(rel);
        expect(read(childTemp, rel), rel).toContain('{{PROJECT_NAME}}');
      }
    } finally {
      cleanup();
    }
  });

  it('produces a readable unified diff with context and hunk headers', () => {
    const a = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\nl8\nl9\nl10\n';
    const b = 'l1\nl2\nl3\nl4\nCHANGED\nl6\nl7\nl8\nl9\nl10\n';
    const diff = unifiedDiff(a, b, 'a/x.md', 'b/x.md');
    expect(diff.startsWith('--- a/x.md')).toBe(true);
    expect(diff).toContain('+++ b/x.md');
    expect(diff).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@$/m);
    expect(diff).toContain('-l5');
    expect(diff).toContain('+CHANGED');
    expect(diff).toContain(' l4');
    expect(unifiedDiff(a, a, 'a', 'b')).toBe('');
  });

  // Repo-aware: this file is itself a sync area, and the child distribution has
  // no nested `frameworks/shiftstone`, so there is no lab/child pair to compare.
  it.runIf(existsSync(DEFAULT_CHILD_ROOT))(
    'reports zero drift across the live lab/child rule areas with no identity leakage',
    () => {
      // Scoped to the two rule areas REQ-08 owns. Engine-wide parity is DEC-014's
      // `--check` gate, asserted separately at phase seal — other sync areas move
      // independently of this unit.
      for (const area of TEMPLATED_SYNC_AREAS) {
        const res = syncEngine({ direction: 'outward', check: true, pathFilter: area });
        expect(res.stats.errors, area).toEqual([]);
        expect(res.diff.updated.map((u) => u.rel), area).toEqual([]);
        expect(res.diff.created.map((c) => c.rel), area).toEqual([]);
        expect(res.ok, area).toBe(true);
        expect(res.diff.identical.length, area).toBeGreaterThan(0);
      }

      // AC-U8-04: the child's rule headings keep their placeholder form.
      for (const rel of ['static-rules/verification.md', 'static-rules/governance.md', 'static-rules/security.md']) {
        const childText = readFileSync(path.join(DEFAULT_CHILD_ROOT, '.shiftstone', rel), 'utf8');
        expect(childText, rel).toContain('{{PROJECT_NAME}}');
        expect(childText, rel).not.toContain('ShiftStone Engineering Hub');
      }
    },
  );

  it('TS-U13-01 / TS-U13-02 / TS-U13-03: verifies planning lifecycle toolchain is syncable without drift', () => {
    const { parentTemp, childTemp, cleanup } = makePair();
    try {
      write(parentTemp, 'scripts/plan.js', '// plan cli\n');
      write(parentTemp, 'scripts/lib/plan-schema.js', '// schema\n');
      write(parentTemp, 'governance/schemas/plan-manifest-v1.schema.json', '{"schema":"plan-manifest/v1"}\n');
      write(parentTemp, 'governance/schemas/plan-state-v1.schema.json', '{"schema":"plan-state/v1"}\n');
      write(parentTemp, 'governance/schemas/plan-handoff-v1.schema.json', '{"schema":"plan-handoff/v1"}\n');

      const dry = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', dryRun: true });
      expect(dry.ok).toBe(true);
      expect(dry.stats.created).toBe(5);

      const sync = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', dryRun: false });
      expect(sync.ok).toBe(true);
      expect(sync.stats.actionsApplied).toBe(5);

      const check = syncEngine({ parentRoot: parentTemp, childRoot: childTemp, direction: 'outward', check: true });
      expect(check.ok).toBe(true);
      expect(check.stats.identical).toBe(5);
    } finally {
      cleanup();
    }
  });
});

