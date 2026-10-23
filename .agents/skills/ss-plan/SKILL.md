---
name: ss-plan
description: Creates and structures implementation plans, ICM Stage Contracts (CONTEXT.md), and plan units in docs/plans/. Associated with /ss-plan and /new-plan.
type: skill
timestamp: 2026-10-21T00:00:00.000Z
version: 2.1.0
pack: core
---

# ss-plan — Universal Implementation Plan & Stage Contract Author

Universal implementation plan and ICM Stage Contract authoring engine for the ShiftStone AI-Native Workspace Framework. Operates under `/ss-plan` and `/new-plan`.

---

## Iron Law

Plans and stage contracts MUST be written physically to disk inside `docs/plans/<suite-name>/`.
Writing implementation plans to native IDE brain artifacts (such as `<appDataDir>/brain/`, `.gemini/antigravity/brain/`, `.claude/artifacts/`, chat memory, or scratchpads) is **STRICTLY FORBIDDEN**.
Any plan or stage contract not materialized in `docs/plans/<suite-name>/` does not exist in the ShiftStone OS and cannot be executed, traced, or verified.

---

## Red Flags & Rationalization Defense

| Rationalization | Defense & Reality |
|---|---|
| *"The plan is small, I will just emit it as an IDE artifact or chat message"* | **Direct violation of the Iron Law.** Small plans must use Tier 1 (single `CONTEXT.md` in `docs/plans/<plan-id>/`). IDE brain artifacts vanish across sessions and break CI/tooling. |
| *"I'll put 'TODO' or 'TBD' in the plan units and flesh them out during execution"* | **Zero-Placeholder Law.** `validate-stage-contracts.js` and `validate-plan-units.js` reject `TODO`, `TBD`, `implement later`, and `similar to Unit`. Every unit must be fully specified upfront. |
| *"I don't need to look up prior learning records or architectural decisions"* | **Compounding Context Invariant.** Always query `docs/reports/learning/` and `docs/decisions/` before authoring a plan. Prior failures must not be repeated. |
| *"I can use machine-absolute paths like C:\ or /Users/... in file references"* | **Machine-Absolute Path Violation.** Paths must always be workspace-relative. Machine-specific paths break CI and peer agent execution. |
| *"Requirement IDs can be informal or implicit"* | **100% Traceability Invariant.** Every `AC-U*-*` must map explicitly to a declared `requirementId` (`UG-*`, `REQ-*`). |

---

## Verification Ladder

- **L1 (Lint & Schema):** `node .shiftstone/scripts/validate-stage-contracts.js` and `node .shiftstone/scripts/validate-plan-units.js` exit 0 with zero violations.
- **L2 (Context & Budgets):** `node .shiftstone/scripts/validate-context-budgets.js` validates all plan files remain within line and byte ceilings.
- **L3 (DAG & Traceability):** Dependency graph across `dependsOn` is a proven acyclic DAG with 100% requirement coverage.
- **L4 (Checker Review):** Disjoint maker-checker review verifies plan against architecture overview and pack checker lenses.
- **L5 (Human Direction):** Human review and sign-off on scope, risk classes, and milestone sequencing.

---

## Terminal States

- **`success`:** Plan authored in `docs/plans/<suite-name>/`, passes all L1–L3 validators, zero placeholders, zero absolute paths, 100% traceable.
- **`blocked`:** Ambiguous requirements requiring human direction, missing Bible SSOT chapters, or active dependencies with `status: superseded`.
- **`no_op`:** Requested plan suite already exists, is completely up-to-date with current requirements, and requires no modification.

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
