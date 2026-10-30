---
name: ss-plan
description: Creates, evolves, and structures implementation plans, ICM Stage Contracts (CONTEXT.md), and plan-manifest/v1 suites in docs/plans/. Associated with /ss-plan and /new-plan.
type: skill
timestamp: 2026-10-27T19:00:00.000Z
version: 2.3.0
pack: core
---

# ss-plan — Universal Implementation Plan & Lifecycle Suite Engine

Universal implementation plan and ICM Stage Contract authoring and lifecycle management engine for the ShiftStone AI-Native Workspace Framework. Operates under `/ss-plan` and `/new-plan`.

---

## 1. Operational Modes & Reference Routing

| Mode | Intent & Request | Operational Protocol | Controlling Reference |
|---|---|---|---|
| **Mode 1** | **New Plan Authoring** (`/ss-plan`, `/new-plan`) | 5-phase authoring: Intake → Bounded Research → Sizing → Detailed Scaffolding → Verification. | [stage-contract-template.md](./resources/stage-contract-template.md), [plan-manifest-template.json](./resources/plan-manifest-template.json), [plan-unit-template.json](./resources/plan-unit-template.json) |
| **Mode 2** | **Intent-Driven Plan Evolution** | Surgical edits preserving technical depth: Mode 1 (Validation fix), Mode 2 (Additive scope), Mode 3 (Corrective edit with Depth Parity). | [plan-evolution-protocol.md](./resources/plan-evolution-protocol.md) |
| **Mode 3** | **Phase Resumption** | Bounded reading packet synthesis (`readTargets` $\le 4,500$ tokens), predecessor completion gating (`implement` vs `remediate`). | [resume-protocol.md](./resources/resume-protocol.md) |
| **Mode 4** | **Execution Checkpoints & Close** | Immutable handoff attempts (`plan-handoff/v1`), in-flight mutation detection, CAS concurrency, strict acceptance gates. | [execution-handoff-protocol.md](./resources/execution-handoff-protocol.md), [lifecycle-contracts.md](./resources/lifecycle-contracts.md) |

---

## Iron Laws

1. **Physical Disk Output Only:** Plans, stage contracts, manifests, and units MUST be written physically to `docs/plans/<suite-name>/`. Outputting plans to temporary chat artifacts or scratchpads is **STRICTLY FORBIDDEN**.
2. **Zero-Placeholder Law:** `TODO`, `TBD`, `implement later`, and `similar to Unit` are forbidden. Every unit must declare exact target files, acceptance criteria, test scenarios, and a real verification command.
3. **Machine-Relative Paths Only:** All file references must be repository-relative (`.shiftstone/...`, `docs/...`, `apps/...`). Machine-absolute paths (`C:\`, `/Users/`) are strictly rejected.
4. **The Surgical Edit Rule:** When updating existing contracts, agents MUST use targeted edits (`edit_file`) for localized blocks. Blanket file overwrites of mature plans that cause LLM summary compression are prohibited.
5. **No Fabricated Execution Evidence:** `output/state.json` and handoff attempts are produced strictly during actual execution via `.shiftstone/scripts/plan.js`; they are never manufactured during plan authoring.

---

## Red Flags & Rationalization Defense

| Rationalization | Defense & Reality |
|---|---|
| *"The plan is small, I will just emit it as an IDE artifact or chat message"* | **Direct violation of the Iron Law.** Small plans use Tier 1 (`CONTEXT.md`). Chat artifacts vanish across sessions and break CI/tooling. |
| *"I'll put 'TODO' or 'TBD' in the plan units and flesh them out during execution"* | **Zero-Placeholder Law.** `validate-stage-contracts.js` and `validate-plan-units.js` reject placeholders upfront. |
| *"I can summarize existing detailed unit specs to fit line limits while fixing lint"* | **Intent Mode 1 Violation.** Mode 1 mandates zero technical mutation. Split into sub-phases (`phase-1a.md`, `phase-1b.md`) rather than compress depth. |
| *"I don't need to look up prior learning records or architectural decisions"* | **Compounding Context Invariant.** Always query `docs/reports/learning/` and `docs/decisions/` before authoring a plan. Prior regressions must not be repeated. |
| *"I can run tests or implement features while drafting the plan"* | **Separation of Concerns.** Planning is 100% read-only research, task sizing, and contract authoring. Execution runs via `ss-execute-plan`. |

---

## Verification Ladder

- **L1 (Lint & Schema):** `node .shiftstone/scripts/validate-stage-contracts.js`, `node .shiftstone/scripts/validate-plan-units.js`, and `node .shiftstone/scripts/validate-plans.js` exit 0 with zero violations.
- **L2 (Context & Budgets):** `node .shiftstone/scripts/validate-context-budgets.js` validates all plan files remain within line and byte ceilings.
- **L3 (DAG & Traceability):** Dependency graph across `dependsOn` is a proven acyclic DAG with 100% requirement coverage.
- **L4 (Checker Review):** Disjoint maker-checker review verifies plan against architecture overview and pack checker lenses.
- **L5 (Human Direction):** Human review and sign-off on scope, risk classes, and milestone sequencing.

---

## Terminal States

- **`success`:** Plan authored or evolved in `docs/plans/<suite-name>/`, passes all L1–L3 validators, zero placeholders, zero absolute paths, 100% traceable.
- **`blocked`:** Ambiguous requirements requiring human direction, missing Bible SSOT chapters, or active dependencies with `status: superseded`.
- **`no_op`:** Requested plan suite already exists, matches requirements, and requires no modification.

---

## Associated Slash Commands

- `/ss-plan`
- `/new-plan`

---

## Procedural Knowledge & Resources

- Procedural execution instructions: [instructions.md](./instructions.md)
- Phase decomposition guide: [phase-decomposition-guide.md](./resources/phase-decomposition-guide.md)
- Stage contract template: [stage-contract-template.md](./resources/stage-contract-template.md)
- Plan unit template: [plan-unit-template.json](./resources/plan-unit-template.json)
- Universal task patterns: [universal-task-patterns.md](./resources/universal-task-patterns.md)
- Bounded phase resumption protocol: [resume-protocol.md](./resources/resume-protocol.md)
- Intent-driven plan evolution protocol: [plan-evolution-protocol.md](./resources/plan-evolution-protocol.md)
- Lifecycle contracts & command reference: [lifecycle-contracts.md](./resources/lifecycle-contracts.md)
- Execution & outgoing handoff protocol: [execution-handoff-protocol.md](./resources/execution-handoff-protocol.md)
- Static plan manifest template: [plan-manifest-template.json](./resources/plan-manifest-template.json)
