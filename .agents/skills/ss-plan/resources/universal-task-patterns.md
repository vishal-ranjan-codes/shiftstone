# Universal Task Patterns & Decomposition Blueprints

Common recurring implementation patterns in the ShiftStone AI-Native Workspace Framework. Use these archetypes when sizing and decomposing tasks into Plan Units (`plan-unit/v1`).

---

## Pattern 1: Core Script & Validator Addition

Use when creating new governance scripts, gates, or verification tools in `core/scripts/`.

### Canonical Decomposition:
1. **Unit A — JSON Schema & Contract Definition (`core/governance/schemas/`):**
   - Define machine-readable Draft 2020-12 schema.
   - Author template or example fixture.
   - Verification: Schema parses cleanly with valid JSON.
2. **Unit B — Validator Implementation (`core/scripts/<name>.js`):**
   - Implement CLI argument parsing (`--root`, `--strict`, target files).
   - Implement parsing and invariant enforcement rules.
   - Export callable validation functions for programmatic and test consumption.
   - Verification: Runs standalone against live repository.
3. **Unit C — Automated Test Suite (`core/scripts/__tests__/<name>.test.ts`):**
   - Author Vitest tests covering valid baseline, deliberate defect fixtures, and edge cases.
   - Verification: `pnpm -C core test` exits 0.
4. **Unit D — Framework Manifest & Toolchain Registration:**
   - Register validator in `core/governance/workspace-manifest.json` and `implementation-status.json`.
   - Update `package.json` validation script if appropriate.

---

## Pattern 2: First-Party Skill Authoring (`.agents/skills/ss-<name>/`)

Use when introducing a new tech-agnostic core skill into the ShiftStone framework.

### Canonical Decomposition:
1. **Unit A — 3-Tier Skill Artifacts:**
   - Author `SKILL.md` (≤ 180 lines) with valid frontmatter, Iron Law, Red Flags & Rationalization Defense, Verification Ladder, and Terminal States.
   - Author `instructions.md` (≤ 450 lines) with step-by-step procedural workflows.
   - Author `resources/` templates, checklists, and guides.
2. **Unit B — Catalog & Router Registration:**
   - Add skill entry to `core/context/skills-manifest.yaml`.
   - Refresh `AGENTS.md` skill index via `node core/scripts/generate-skills-manifest.js`.
   - Run `node core/scripts/setup-ide-junctions.js` to ensure multi-IDE symlinks resolve.
3. **Unit C — Budget & Completeness Verification:**
   - Verify line and byte ceilings with `node core/scripts/validate-context-budgets.js`.
   - Verify 8-Pillar structure with `node core/scripts/validate-skills-completeness.js`.

---

## Pattern 3: Application Feature / Route Implementation

Use when building an end-to-end feature inside an application package (e.g. `apps/web/`).

### Canonical Decomposition:
1. **Unit A — Data Contracts & Types:**
   - Define database migrations, Zod schemas, or API interfaces.
2. **Unit B — Business Logic & Data Loading:**
   - Implement loaders, queries, and service functions.
   - Author unit tests with Vitest.
3. **Unit C — UI Components & User Flow:**
   - Build accessible components adhering to design tokens.
   - Implement client actions and mutation handlers.
4. **Unit D — End-to-End Verification & Bible Sync:**
   - Author Playwright test scenario.
   - Update relevant chapter in `docs/bible/`.

---

## Pattern 4: Refactoring & Architecture Migration

Use when restructuring core engine components or decomposing legacy modules.

### Canonical Decomposition:
1. **Unit A — Baseline Invariant Tests:**
   - Capture current behavior and test coverage before touching code.
2. **Unit B — Decoupled Implementation:**
   - Implement new architecture behind clean boundary interfaces.
3. **Unit C — Deprecation & Decommissioning:**
   - Switch active consumers to new architecture.
   - Safely remove legacy files and clean up test fixtures.
4. **Unit D — Parity & Regression Run:**
   - Run full test suite (`pnpm -C core test`) to guarantee zero regression.
