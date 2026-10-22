# ss-plan — Procedural Authoring Guide & Contract Verification

Universal implementation plan authoring workflow for the ShiftStone AI-Native Workspace Framework. Modeled on `zeefse/zee-plan`, `superpowers/writing-plans`, and `compound-engineering/ce-plan`.

---

## Iron Law

1. **Physical Disk Output Only:** Every implementation plan, stage contract (`CONTEXT.md`), and plan unit MUST be written directly to `docs/plans/<suite-name>/`. Never output plans to temporary IDE brain artifacts.
2. **Zero-Placeholder Law:** The tokens `TODO`, `TBD`, `implement later`, `similar to Unit` are strictly forbidden. Every unit must declare exact target file paths, complete acceptance criteria, concrete test scenarios, and a real verification command.
3. **Machine-Relative Paths Only:** All declared file paths must be relative to the repository root. Machine-absolute paths (`C:\`, `/Users/`) are rejected immediately.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll put the plan in a quick temporary chat artifact first."* | **Forbidden.** Plans written outside `docs/plans/` do not persist across agent sessions and break harness tracking. Write to `docs/plans/<suite-name>/`. |
| *"I can use TBD for acceptance criteria and fill them in during execution."* | **Forbidden.** Zero-Placeholder Law. Every unit must have complete `AC-U*-*` criteria before execution begins. |
| *"The plan depends on a superseded ADR, but only a small part."* | **Forbidden.** `validate-stage-contracts.js` blocks any input with `status: superseded`. Upgrade to the active decision. |

---

## 2. Step 1: Compounding Context & Decision Retrieval

Before writing a single line of a plan:
1. **Query Prior Learning Records:** Scan `docs/reports/learning/` (or run `node core/scripts/validate-learning.js --list`) for relevant patterns, past regressions, or hard-won insights related to the task domain.
2. **Inline Active Architectural Decisions:** Check `docs/decisions/` and `docs/bible/DECISIONS.md`. Identify all accepted ADRs governing the task.
   - Any invariant mandated by an active ADR must be explicitly inlined into the plan's Acceptance Criteria.
   - Verify that no referenced input file carries `status: superseded`, `status: deprecated`, `status: rejected`, or `status: withdrawn`.

---

## 3. Step 2: Sizing Triage (Tier 1 vs. Tier 2)

Determine whether the requested task is **Tier 1** or **Tier 2**:

| Property | Tier 1 (Atomic Stage) | Tier 2 (Multi-Phase Suite) |
|---|---|---|
| **Unit Count** | 1 to 8 units | 9 or more units |
| **Directory Structure** | `docs/plans/<plan-id>/CONTEXT.md` | `docs/plans/<suite-name>/README.md` + `phase-<N>-*.md` |
| **Line Budget** | `CONTEXT.md` ≤ 400 lines | `README.md` ≤ 150 lines, each `phase-*.md` ≤ 500 lines |
| **Stage Contract** | Single inline `stage-contract/v1` frontmatter | Each phase has its own contract or units map |

Refer to [resources/phase-decomposition-guide.md](./resources/phase-decomposition-guide.md) for detailed structural breakdown.

---

## 4. Step 3: Authoring Stage Contracts (`stage-contract/v1`)

Every stage contract (`CONTEXT.md`) must open with structured YAML frontmatter satisfying `core/governance/schemas/stage-contract.schema.json`:

```yaml
---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: <plan-id>
title: <Descriptive Stage Title>
status: planned
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: docs/bible/01-architecture/architecture-overview.md
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: apps/web/src/feature.ts
    artifactType: code
verificationLevels:
  - L1
  - L2
exitCriteria:
  - id: EC-01
    level: L1
    command: pnpm -C core test
    expected: exit 0
---
```

### The Undeclared Input Protocol (`amend-and-reload`)
If a Maker agent requires an input file not listed in `inputs[]`:
1. **Halt execution immediately.** Never silently read undeclared source or documentation files.
2. Amend `CONTEXT.md` to add the input path with `role` and `requiredStatus`.
3. Re-run `node core/scripts/validate-stage-contracts.js`.
4. Reload the stage context and continue.

---

## 5. Step 4: Authoring Granular Plan Units (`plan-unit/v1`)

Each Plan Unit (`U1`, `U2`, ...) specifies an atomic, testable increments of work:

```markdown
### Unit `U1` — <Unit Title> (<Requirement IDs>)
- **Layer:** <core | pack | core+pack>
- **Depends On:** ["<prior-unit-id>"]
- **Requirement IDs:** ["UG-01"]
- **Target Files:**
  - `path/to/target-file.ts`
  - `path/to/test-file.test.ts`
- **Acceptance Criteria:**
  - `AC-U1-01` (`UG-01`): Concrete observable behavior 1 (minimum 10 characters).
  - `AC-U1-02` (`UG-01`): Concrete observable behavior 2.
- **Test Scenarios:**
  - `TS-U1-01` (`L1`): Automated test description and assertion.
- **Verification Command:** `node core/scripts/validate-example.js`
- **Confidence Score:** `0.95`
```

### Hard Invariants for Plan Units:
1. **Unit ID Format:** `U1` through `U999`.
2. **Acyclic DAG:** `dependsOn` must form a directed acyclic graph. Self-dependencies and circular dependencies (`U1 -> U2 -> U1`) fail validation immediately.
3. **100% Traceability:** Every requirement ID listed in `requirementIds` must be referenced by at least one `AC-U*-*` criterion.
4. **Verification Command:** Must be non-empty and runnable from the workspace root or via package manager.
5. **Confidence Score:** Must be a float between `0.8` and `1.0`.

---

## 6. Step 5: Self-Verification & Validation Pipeline

Before concluding the authoring session, run the validation toolchain:

```bash
# 1. Validate stage contracts
node core/scripts/validate-stage-contracts.js

# 2. Validate plan units & dependency DAG
node core/scripts/validate-plan-units.js

# 3. Validate context line/byte budgets
node core/scripts/validate-context-budgets.js
```

If any check fails:
- Review the specific error code (`PLACEHOLDER_DETECTED`, `SUPERSEDED_INPUT_BLOCKED`, `UNMAPPED_REQUIREMENT_ID`, `CYCLIC_DEPENDENCY_DETECTED`).
- Amend the plan file on disk and re-run until all checks exit code `0`.

---

## Verification Ladder

- **L1 (Syntax & Parsing):** JSON schemas parse cleanly; frontmatter YAML is well-formed.
- **L2 (Unit Validation):** `node core/scripts/validate-stage-contracts.js` and `node core/scripts/validate-plan-units.js` pass with 0 errors.
- **L3 (Budget Gate):** `node core/scripts/validate-context-budgets.js` verifies plan file line and byte ceilings.
- **L4 (Checker Review):** Independent checker verifies acyclic dependency graph, requirement mapping, and lack of placeholders.
- **L5 (Human Gate):** Human developer signs off on stage boundaries and unit scope.

---

## Terminal States

- `success`: All stage contracts and plan units authored, validated cleanly, and verified on disk.
- `blocked`: Missing required input documents or referenced architectural decisions are superseded without replacement.
- `escalated`: Ambiguous requirements or conflicting ADR constraints requiring human clarification.
