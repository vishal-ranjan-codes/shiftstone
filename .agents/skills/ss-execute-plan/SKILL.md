---
name: ss-execute-plan
description: Execute approved implementation plans unit-by-unit with bounded context (<= 4,500 tokens), Red-First TDD, Two-Stage Review, verbose gate diagnostics, and Governor fast-path handoffs.
type: skill
timestamp: 2026-10-30T14:30:00.000Z
version: 2.4.0
pack: core
---

# ss-execute-plan — Machine-Verifiable Plan Execution & Lifecycle Engine

Orchestrates the deterministic, unit-by-unit execution of approved implementation plans (`docs/plans/<suite>/`) using the ShiftStone machine-verifiable CLI harness (`plan.js`), bounded context intake ($\le 4,500$ tokens), Red-First TDD, and Two-Stage Review.

---

## 1. Lifecycle Command Orchestration

Plan execution is driven strictly through the `.shiftstone/scripts/plan.js` CLI harness:

| Lifecycle Stage | Command | Purpose & Bounded Guardrail |
|---|---|---|
| **1. Resumption** | `node .shiftstone/scripts/plan.js resume <suite> --phase <ID>` | Verifies prerequisites, emits bounded reading packet (`readTargets` $\le 4,500$ tokens), and dictates turn mode (`implement` vs `remediate`). |
| **2. Preflight** | `node .shiftstone/scripts/agent-preflight.js --suite <suite> --phase <ID>` | Binds target file modifications to `phase.sourcePaths` and locks plan manifest digest in `.agent-preflight-receipt.json`. |
| **3. Begin** | `node .shiftstone/scripts/plan.js begin <suite> --phase <ID>` | Transitions phase state to in-flight and acquires CAS concurrency lock. |
| **4. Verify** | `node .shiftstone/scripts/plan.js verify <suite> --phase <ID>` | Executes declared check runners, validates evidence, and checks anti-gaming diff integrity. |
| **5. Checkpoint** | `node .shiftstone/scripts/plan.js checkpoint <suite> --phase <ID>` | Records intermediate work in progress and snapshots file digests into `.transaction.json`. |
| **6. Close** | `node .shiftstone/scripts/plan.js close <suite> --phase <ID> [--facts <F>]` | Records sealed handoff attempt (`plan-handoff/v1`), evaluates acceptance criteria, and transitions phase state. |
| **7. Status** | `node .shiftstone/scripts/plan.js status <suite>` | Emits ANSI/plain-text 4-axis projection dashboard of the plan suite. |
| **8. Orchestrate** | `node .shiftstone/scripts/plan.js orchestrate <suite>` | Deterministic DAG verification pipeline across manifest phases. |
| **9. Worker Spec** | `node .shiftstone/scripts/plan.js worker-spec <suite> --phase <ID> [--json]` | Synthesizes bounded Ephemeral Worker subagent invocation spec ($\le 4,500$ tokens). |

---

## Adaptive Autonomous Execution

Execution is **100% autonomous and zero-config**. The agent inspects the plan structure and applies the optimal engine without asking the user or developer to choose modes:

1. **Tier 2 (Multi-Phase Suite / Evaluated FIRST):**
   - Condition: Plan contains `plan-manifest.json` with `phases.length > 1` OR multiple `phase-*.md` files.
   - **Action:** Dispatches the **Autonomous Governor**. The parent AI agent acts as the Governor, ingesting only macro orientation artifacts (`README.md`, `status`), evaluating the topological DAG, generating worker specs via `plan.js worker-spec`, and dispatching fresh **Ephemeral Worker Subagents** per phase (`invoke_subagent`).
   - Context is completely wiped between phases to eliminate context rot. The presence of a `CONTEXT.md` in the directory does NOT alter this.
2. **Tier 1 (Single Stage Contract):**
   - Condition: ONLY if there is no multi-phase manifest and only a standalone `CONTEXT.md` ($\le 8$ units) exists.
   - **Action:** Dispatches as a **Single Focused Stage Worker**.
   - Executes units sequentially in a single clean context, preserving working memory across tightly coupled units without multi-agent spawning latency.
3. **Dynamic Diagnostic Isolation (Failure States):**
   - If a specific unit trips the 3-fix circuit breaker, the Governor isolates *only that failing unit* into a dedicated diagnosis subagent, preventing transcript pollution in the parent phase.


---

## Iron Laws

1. **Approved Plan Required:** NEVER execute code without an existing, validated implementation plan in `docs/plans/<suite>/` with a valid `plan-manifest.json` and stage contracts.
2. **Bounded Reading Intake & Orientation Hierarchy:** Always follow the strict file-reading hierarchy. The Governor reads only macro artifacts (`README.md` / `plan.js status`); the Ephemeral Worker reads only micro phase targets (`phase-<N>.md` + `readTargets`). Reading all phase files upfront or ad-hoc crawling is **STRICTLY FORBIDDEN**.
3. **One Unit Per Turn:** Execute exactly one Plan Unit `U*` / Phase at a time. Never bundle multiple units or phases into a single turn.
4. **Preflight Gate Invariant:** Run `agent-preflight.js --suite <suite> --phase <ID>` before touching files. Never modify files outside declared `sourcePaths`.
5. **Red-First TDD Invariant:** Author automated test scenarios (`TS-U*-*`) and observe them fail BEFORE writing production code.
6. **Anti-Gaming Invariant:** Never modify, skip, or weaken existing test assertions or checks referenced in `plan-manifest.json` to manufacture artificial green passes.
7. **Strict Close Gate:** Advancing to downstream phases is **STRICTLY PROHIBITED** if `plan.js close` exits code 2 (unmet criteria or unverified regression checks).
8. **Physical Disk Output Only:** All source code and test files are written directly to repository paths. Outputting code to temporary IDE brain artifacts is forbidden.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"Units U1 and U2 are small, I'll execute them together."* | **Forbidden.** Unit bundling destroys traceability, inflates context, and makes rollbacks complex. Execute one unit at a time. |
| *"I'll write the code first and the tests afterward."* | **Forbidden.** Code written before tests lacks pushback proof and risks testing implementation details rather than requirements. Red first. |
| *"I don't need to run plan.js resume, I already know what files to read."* | **Forbidden.** `plan.js resume` enforces prerequisite checks, evaluates remediation state, and bounds context under 4,500 tokens. |
| *"I should read all phase-*.md files to get complete project context before starting Phase 1."* | **Forbidden (Governor Context Bloat).** Reading future phases floods the context window with premature implementation details. Read only `README.md` and the active phase's bounded `readTargets`. |
| *"The check failed with exit code 2, but it's minor so I'll mark the phase done."* | **Forbidden.** Exit code 2 indicates unmet acceptance criteria. Advancing past exit code 2 is strictly prohibited. |
| *"I can tweak the test assertion so the verification script passes green."* | **Anti-Gaming Violation.** Modifying assertions in existing tests triggers the anti-gaming circuit breaker. Fix the production code. |

---

## Verification Ladder

- **L1 (Pre-Flight & Resumption):** `plan.js resume` confirms dependencies ready; `agent-preflight.js` emits valid receipt.
- **L2 (Red-First TDD):** New test scenario (`TS-U*-*`) fails on baseline, turns green with implementation; unit verification command exits 0.
- **L3 (Plan Verification):** `plan.js verify <suite> --phase <ID>` passes all declared manifest checks and evidence validations.
- **L4 (Two-Stage Review):** Stage 1 (Spec Compliance Review against `AC-U*-*`) and Stage 2 (Code Quality Review via `/ss-review`) pass cleanly.
- **L5 (Phase Close & Gate):** `plan.js close <suite> --phase <ID>` exits code 0, sealing immutable handoff and advancing state.

---

## Terminal States

- **`success`:** Plan unit/phase executed, tests green, Two-Stage Review passed, and `plan.js close` exited code 0.
- **`remediate`:** Prior checks or reviews failed; turn is strictly scoped to addressing flagged remediation defects.
- **`blocked`:** Preflight gate fails, prerequisite phases uncompleted, or `plan.js close` exits code 2 after 3 remediation cycles.
- **`escalated`:** Irreconcilable conflict between plan specification and codebase reality; halted for human direction.

---

## Associated Slash Commands

- `/ss-execute-plan`
- `/ss-work`

---

## Procedural Knowledge & Resources

- Step-by-step execution guide: [instructions.md](./instructions.md)
- Implementer subagent prompt: [resources/implementer-prompt.md](./resources/implementer-prompt.md)
- Governor subagent prompt: [resources/governor-prompt.md](./resources/governor-prompt.md)
