# ss-plan — Procedural Authoring Guide & Contract Verification

Universal implementation plan authoring, intent-driven evolution, and lifecycle management workflow for the ShiftStone AI-Native Workspace Framework. Modeled on ICM Layers 1–5, `zeefse/zee-plan`, and `compound-engineering/ce-plan`.

---

## Iron Laws

1. **Physical Disk Output Only:** Every implementation plan, stage contract (`CONTEXT.md` / `phase-*.md`), manifest (`plan-manifest.json`), and unit (`plan-units/U*.json`) MUST be written directly to `docs/plans/<suite-name>/`. Never output plans to temporary chat artifacts or scratchpads.
2. **Zero-Placeholder Law:** The tokens `TODO`, `TBD`, `implement later`, `similar to Unit` are strictly forbidden. Every unit must declare exact target file paths, complete acceptance criteria, concrete test scenarios, and a real verification command.
3. **Machine-Relative Paths Only:** All declared file paths must be relative to the repository root. Machine-absolute paths (`C:\`, `/Users/`) are rejected immediately.
4. **The Surgical Edit Rule (Targeted Edits over Blanket Replacement):** When modifying an existing contract or suite, agents MUST use targeted patch tools (`edit_file`) for localized block edits. Blanket file overwrites of mature plans that lead to LLM summarization are strictly prohibited.
5. **No Technical Compression for Line Budgets:** Sizing ceilings ($\le 500$ lines per phase contract) trigger **Phase Decomposition** (splitting into sub-phases like `phase-1a.md` and `phase-1b.md`), NEVER **Summary Compression**.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll put the plan in a quick temporary chat artifact first."* | **Forbidden.** Plans written outside `docs/plans/` do not persist across agent sessions and break harness tracking. Write to `docs/plans/<suite-name>/`. |
| *"I can use TBD for acceptance criteria and fill them in during execution."* | **Forbidden.** Zero-Placeholder Law. Every unit must have complete `AC-U*-*` criteria before execution begins. |
| *"I'll summarize this 50-line unit spec to fix a missing heading validation error."* | **Forbidden.** Intent Mode 1 mandates zero technical mutation. Append the missing heading without altering unit specifications. |
| *"The user asked to add a new requirement, so I'll rewrite the whole file from memory."* | **Forbidden.** Surgical Edit Rule. Add new units alongside existing ones using `edit_file`; never clobber existing technical detail. |
| *"The plan depends on a superseded ADR, but only a small part."* | **Forbidden.** `validate-stage-contracts.js` blocks any input with `status: superseded`. Upgrade to the active decision. |

---

## 1. Intent-Driven Plan Evolution (Plan Maintenance & Refactoring)

When modifying or refactoring an existing implementation plan suite, classify the edit into one of three **Intent Modes**:

### Mode 1: Structural & Validation Fixes
- **Triggers**: Running `validate-stage-contracts.js`, fixing broken markdown links, adding missing required headings (`Outputs`, `Verification`, `Durable Memory`, `Human Checkpoint`), or formatting tables.
- **Allowed Actions**: Append or insert missing structural headings, tables, or frontmatter keys.
- **Strict Invariants**:
  - **Zero Technical Content Mutation**: Existing problem analyses, data schemas, and unit specifications are frozen.
  - Agents must NEVER summarize, condense, or delete technical content to satisfy a validator or line guideline.

### Mode 2: Additive Scope & Audit Updates
- **Triggers**: User requests: *"update the plan with your new audit findings"*, *"add tasks for X"*, *"include these improvements"*.
- **Allowed Actions**: Add new units (`Un+1`), add new acceptance criteria, or enrich existing units with missing parameters.
- **Strict Invariants**:
  - **Strict Preservation**: Existing units and problem breakdowns must be fully retained in their complete technical depth.
  - Newly audited tasks must be written with the exact same level of granular detail (Target Files, Schemas, Mechanics, Edge Cases) as previously authored tasks.

### Mode 3: Corrective Refactoring & Explicit Deletion
- **Triggers**: User requests: *"remove task 2"*, *"that root cause is wrong, change the approach to Y"*, *"re-architect Phase 1"*, or newly discovered facts invalidate an existing approach.
- **Allowed Actions**: Delete, replace, or re-architect units as explicitly instructed.
- **Strict Invariants**:
  - **Depth Parity Invariant**: When replacing or re-architecting a unit, the replacement MUST maintain equal or greater technical depth (Target Files, Schemas, Mechanics, Verification).
  - Deleting or replacing a detailed unit spec must NEVER result in a degraded, superficial 2-line bullet summary.

---

## 2. Five-Phase Authoring Workflow (New Plans)

```
Intake & Retrieval → Sizing Triage → Detailed Blueprint → Manifest Scaffolding → Self-Verification
```

### Step 1: Compounding Context & Decision Retrieval
1. **Query Prior Learning Records:** Scan `docs/reports/learning/` (or run `node .shiftstone/scripts/validate-learning.js --list`) for relevant patterns, past regressions, or hard-won insights related to the task domain.
2. **Inline Active Architectural Decisions:** Check `docs/decisions/` and `docs/bible/DECISIONS.md`. Identify all accepted ADRs governing the task.
   - Any invariant mandated by an active ADR must be explicitly inlined into the plan's Acceptance Criteria.
   - Verify that no referenced input file carries `status: superseded`, `status: deprecated`, `status: rejected`, or `status: withdrawn`.

### Step 2: Sizing Triage (Tier 1 vs. Tier 2)
Determine whether the requested task is **Tier 1** or **Tier 2**:

| Property | Tier 1 (Atomic Stage) | Tier 2 (Multi-Phase Suite) |
|---|---|---|
| **Unit Count** | 1 to 8 units | 9 or more units |
| **Directory Structure** | `docs/plans/<plan-id>/CONTEXT.md` | `docs/plans/<suite-name>/README.md` + `phase-<N>-*.md` |
| **Line Budget** | `CONTEXT.md` ≤ 400 lines | `README.md` ≤ 150 lines, each `phase-*.md` ≤ 500 lines |
| **Stage Contract** | Single inline `stage-contract/v1` frontmatter | Each phase has its own contract or units map |
| **Manifest** | Optional `plan-manifest.json` | Required `plan-manifest.json` |

Refer to [resources/phase-decomposition-guide.md](./resources/phase-decomposition-guide.md) for detailed structural breakdown.

### Step 3: Authoring Stage Contracts (`stage-contract/v1`)
Every stage contract (`CONTEXT.md` or `phase-*.md`) must satisfy `.shiftstone/governance/schemas/stage-contract.schema.json` and include:
- `# Inputs` table ($\le 8$ rows with workspace-relative paths).
- `# Process` step table mapping each unit to implementation mechanics.
- `#### Unit U<n>: <Title>` detailed specifications with Target Files, Step-by-Step Mechanics, and Schemas.
- `# Outputs` destination table with unit traces.
- `# Verification` declaring verification commands and levels.
- `# Durable Memory`, `# Human Checkpoint`, `# Blocked Conditions`, `# Failure Conditions`, and `# Bounded Loading & Terminal State`.

### Step 4: Authoring Granular Plan Units (`plan-unit/v1`)
Each Plan Unit (`U1`, `U2`, ...) specifies an atomic, testable increment of work in `docs/plans/<suite-name>/plan-units/U<n>.json`:
- `unitId`: `U1` through `U999`.
- `dependsOn`: Acyclic directed graph.
- `requirementIds`: 100% mapped to acceptance criteria.
- `targetFiles`: Workspace-relative paths.
- `acceptanceCriteria`: Minimum 10 characters per criterion.
- `testScenarios`: Complete scenario, level (L1/L2), and assertions.
- `verificationCommand`: Executable command exiting 0.
- `confidenceScore`: Float between `0.8` and `1.0`.

### Step 5: Manifest Declaration (`plan-manifest/v1`)
For Tier 2 suites and opted-in Tier 1 plans, author `docs/plans/<suite-name>/plan-manifest.json` using [plan-manifest-template.json](./resources/plan-manifest-template.json):
- Declare phase DAG dependencies in `phase.dependsOn` (`requires: "complete" | "implementation-verified"`).
- Declare source paths and check runners with exact `cwd`, `executable`, and `args`.
- Declare `recovery` retry and rollback procedures.

---

## 3. Resumption & Execution Handoff Protocols

- **Resuming a Phase:** Follow [resume-protocol.md](./resources/resume-protocol.md). Run `node .shiftstone/scripts/plan.js resume <suite> --phase <ID>` before beginning work. Respect returned `readTargets` to avoid context blowout.
- **Executing a Phase:** Follow [execution-handoff-protocol.md](./resources/execution-handoff-protocol.md) and [lifecycle-contracts.md](./resources/lifecycle-contracts.md). Run `begin` to baseline preservation, `verify` to record test evidence, and `checkpoint` or `close` to update state.

---

## 4. Self-Verification Pipeline

Before concluding an authoring or evolution session, run the full validation toolchain:

```bash
# 1. Validate stage contracts
node .shiftstone/scripts/validate-stage-contracts.js

# 2. Validate plan units & dependency DAG
node .shiftstone/scripts/validate-plan-units.js

# 3. Validate plan manifests and graph
node .shiftstone/scripts/validate-plans.js

# 4. Validate context line/byte budgets
node .shiftstone/scripts/validate-context-budgets.js
```

If any check fails:
- Review the error diagnostic code.
- Apply surgical edits to the affected files and re-verify until all tools exit code `0`.

---

## Verification Ladder

- **L1 (Syntax & Parsing):** JSON schemas parse cleanly; frontmatter YAML is well-formed; manifest validates under Draft 2020-12.
- **L2 (Unit & Contract Validation):** `validate-stage-contracts.js`, `validate-plan-units.js`, and `validate-plans.js` pass with 0 errors.
- **L3 (Budget Gate):** `validate-context-budgets.js` verifies plan file line and byte ceilings.
- **L4 (Checker Review):** Independent checker verifies acyclic dependency graph, requirement mapping, and lack of placeholders.
- **L5 (Human Gate):** Human developer signs off on stage boundaries and unit scope.

---

## Terminal States

- `success`: All stage contracts, plan units, and manifest authored or evolved, validated cleanly, and verified on disk.
- `blocked`: Missing required input documents or referenced architectural decisions are superseded without replacement.
- `escalated`: Ambiguous requirements or conflicting ADR constraints requiring human clarification.
