# ss-execute-plan — Unit Execution & Machine-Verifiable Plan Lifecycle Guide

Step-by-step orchestrator for executing atomic Plan Units (`U*`) and phases from approved implementation plans using the ShiftStone machine-verifiable CLI harness.

---

## Iron Laws

1. **Approved Plan Required:** NEVER execute code without an existing, validated implementation plan suite in `docs/plans/<suite>/` containing `plan-manifest.json` and stage contracts.
2. **Bounded Reading Intake & Orientation Hierarchy:** Always follow the strict file-reading hierarchy. The Governor reads only macro artifacts (`README.md` / `plan.js status`); the Ephemeral Worker reads only micro phase targets (`phase-<N>.md` + `readTargets`). Reading all phase files upfront or ad-hoc crawling is **STRICTLY FORBIDDEN**.
3. **One Unit Per Turn:** Execute exactly one Plan Unit `U*` / Phase at a time. Never bundle multiple units or phases into a single execution turn.
4. **Preflight Gate Invariant:** Run `agent-preflight.js --suite <suite> --phase <ID>` before touching files. Target files must match `phase.sourcePaths`.
5. **Red-First TDD Invariant:** Author automated test scenarios (`TS-U*-*`) and observe them fail BEFORE writing production code.
6. **Anti-Gaming Invariant:** Never modify, comment out, skip, or weaken existing test assertions or checks referenced in `plan-manifest.json` to manufacture artificial green passes.
7. **Strict Close Gate:** Advancing to downstream units or phases is **STRICTLY PROHIBITED** if `plan.js close` exits code 2 (unmet criteria or unverified regression checks).
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

## Adaptive Autonomous Execution Lifecycle

Execution is **100% autonomous and zero-config**. The agent automatically detects the plan architecture and executes it without asking the user or developer to select an execution strategy:

### Step 0: Automated Plan Architecture Triage
Before beginning execution, inspect the target plan directory:
1. **Tier 2 (Multi-Phase Suite / Evaluated FIRST):**
   - Check if `plan-manifest.json` exists with `phases.length > 1` OR if multiple `phase-*.md` files exist.
   - **Verdict:** Unconditionally **Tier 2 Multi-Phase Suite**.
   - **Action:** Dispatch the **Autonomous Governor**. The parent AI agent acts as the Governor. It manages the topological DAG, synthesizes ephemeral worker specs via `node .shiftstone/scripts/plan.js worker-spec <suite> --phase <ID> --json`, and spawns fresh **Ephemeral Worker Subagents** per phase (`invoke_subagent`). Context is completely wiped between phases to eliminate context rot.
   - *Invariant:* The presence of a `CONTEXT.md` in the directory does NOT alter this.
2. **Tier 1 (Single Stage Contract):**
   - ONLY if there is **NO multi-phase manifest** and only a standalone `CONTEXT.md` ($\le 8$ units) exists.
   - **Verdict:** Tier 1 Single Stage Contract.
   - **Action:** Dispatch as a **Single Focused Stage Worker**. Executes units sequentially in a single clean context, retaining immediate working memory across tightly coupled units.
3. **Dynamic Diagnostic Isolation:**
   - If an individual unit trips the 3-fix circuit breaker, dynamically spawn an isolated subagent via [resources/implementer-prompt.md](./resources/implementer-prompt.md) to diagnose and fix only that unit.

### Plan Orientation Hierarchy & File Reading Order

> [!IMPORTANT]
> **Strict Triage Intake Gate:** During Step 0 triage, **NEVER** read `CONTEXT.md` or `phase-*.md` files into context. Only inspect file existence and phase count in `plan-manifest.json`.

To prevent context bloat and orientation blind spots, agents MUST follow the strict file-reading hierarchy:

| Role | Step 1 (Macro Orientation) | Step 2 (Execution Scope) | Step 3 (Technical Baseline) | What to NEVER Read |
|---|---|---|---|---|
| **Tier 2 Autonomous Governor** | `docs/plans/<suite>/README.md` (Executive Summary + Phase DAG) | `plan.js status <suite>` (Identify active/next phase) | `plan.js worker-spec <suite> --phase <ID>` (Synthesize worker payload) | `phase-*.md` files, `CONTEXT.md` (Workers ingest these; reading into Governor causes context bloat) |
| **Tier 1 Stage Worker** (Only if Tier 1 triaged) | `docs/plans/<id>/CONTEXT.md` (Sections 1–4: Inputs, Outputs, Units) | Target source files declared in `inputs` | Relevant Bible SSOT chapter (if referenced) | Unrelated workspace files |
| **Ephemeral Worker Subagent** | `phase-<N>-<slug>.md` (Acceptance criteria `AC-*`, tests `TS-*`) | Predecessor handoff receipt (`output/state.json` if $N > 1$) | Declared `readTargets` from `plan.js resume` | Other phase files (`phase-<N+1>.md`), full backlog, unrelated docs |

### Step 1: Phase Resumption & Context Intake
At the start of every execution turn/phase, invoke the resumption engine:
```bash
node .shiftstone/scripts/plan.js resume <suite> --phase <ID>
```
1. **Validate Prerequisites:** Check whether prior phases are complete. If prerequisites are pending, halt or execute prerequisite phases first.
2. **Evaluate Turn Mode:**
   - If `turnMode` is `implement`: Proceed with new implementation.
   - If `turnMode` is `remediate`: Scope work strictly to addressing failed checks or review findings from prior attempts.
3. **Ingest `readTargets` in Prescribed Order:** The resumption engine synthesizes a bounded packet ($\le 4,500$ tokens). Ingest strictly in this order:
   - a. The active phase specification (`phase-<N>-<slug>.md`).
   - b. Predecessor handoff receipt (if $N > 1$).
   - c. Relevant Bible SSOT chapter / ADR (declared in `inputs`).
   - d. Existing target interface files declared in `sourcePaths`.
   Do not explore, crawl, or read unlisted files.

### Step 2: Preflight Gate & Anti-Gaming Binding
Before modifying or creating any file, run the preflight verification gate:
```bash
node .shiftstone/scripts/agent-preflight.js --suite <suite> --phase <ID> --target "<targetFiles>"
```
- Validates that declared `targetFiles` fall within `phase.sourcePaths`.
- Locks the SHA-256 digest of `plan-manifest.json` into `.agent-preflight-receipt.json`.
- Runs anti-gaming checks to verify test assertions in referenced test suites remain intact.

### Step 3: Begin Execution
Transition the phase into active execution:
```bash
node .shiftstone/scripts/plan.js begin <suite> --phase <ID>
```
- Marks phase state as in-flight and acquires CAS concurrency lock.

### Step 4: Red Turn (Write Failing Test Scenario)
1. Author automated test scenario(s) (`TS-U*-*`) in the declared test file(s).
2. Execute the test command (e.g., `pnpm -C .shiftstone vitest run <testPath>`).
3. **Confirm Red Failure:** Observe the test fail with the expected assertion error. If the test passes immediately without code changes, the test is invalid or redundant.

### Step 5: Green Turn (Implement Minimal Production Code)
1. Implement minimal production code in declared `targetFiles` to satisfy acceptance criteria (`AC-U*-*`).
2. Run the verification command:
```bash
node .shiftstone/scripts/plan.js verify <suite> --phase <ID>
```
3. Confirm all unit tests and manifest checks pass green.
4. **Worker Completion Hand-off:** When executing as an Ephemeral Worker Subagent, provide the completion report (modified files, passing test outputs) and return to the Governor. Do NOT run `plan.js close`—per the Maker-Checker split, the Governor must perform the independent review and execute the phase close.

### Step 6: Two-Stage Review Gate (Governor / Checker)
Before sealing the phase, the Governor (or a spawned Checker subagent) performs Two-Stage Review:
1. **Stage 1 — Spec Compliance Review:**
   - Verify every requirement (`AC-U*-*`) is covered by production code and validated by a test scenario.
   - Verify git diff contains zero out-of-scope mutations.
2. **Stage 2 — Code Quality Review (`/ss-review`):**
   - Check error handling, edge cases, hallucinated dependencies, and typing.
   - Generate checker report conforming to `checker-report/v1`.

### Step 7: Intermediate Checkpoint (Optional)
If executing a large multi-step unit or pausing mid-phase:
```bash
node .shiftstone/scripts/plan.js checkpoint <suite> --phase <ID>
```
- Snapshots file hashes and writes intermediate progress to `.transaction.json`.

### Step 8: Governor Fast-Path Phase Handoff & Visual Progress Reporting (< 15 seconds)
When the Ephemeral Worker Subagent completes its phase execution and reports back:
The Governor executes the deterministic **3-Step Fast-Path Loop**:

1. **Fact Check:** Ingest `output/<phase>-facts.json` (or inspect the worker's completion summary).
2. **Phase Close & Milestone Completion Card:** Run `node .shiftstone/scripts/plan.js close <suite> --phase <ID> --facts <path>`.
   - On success, display the **Phase Milestone Completion Card** (`renderPhaseCompletionCard`) highlighting key artifacts, summary, and verification status.
   - If acceptance is blocked (exit code 2), inspect the explicit diagnostics breakdown emitted by `plan.js close`.
   - Never write ad-hoc Node scripts to reverse-engineer state; read the diagnostic output directly.
   - For legitimate protected actions (e.g. database migrations), `plan.js close` automatically resolves and binds active approvals in `.shiftstone/governance/approvals/` (or via `--approval <ID>`).
   - Development Bible updates adhering to Hard Rule 4 are standard TDD and do NOT require human approvals.
3. **Dispatch Next Phase & Visual Progress Dashboard:** If subsequent phases remain:
   - Run `node .shiftstone/scripts/plan.js worker-spec <suite> --phase <NEXT_ID> --json`.
   - Display the **Visual Plan Progress Dashboard** (`node .shiftstone/scripts/plan.js progress <suite> --active <NEXT_ID> --worker <WorkerRole>`) featuring the Unicode progress bar (`[██████░░░░] 60%`), complete phase status table (`✅ Complete`, `🔄 In Progress`, `⏳ Pending`), and active worker assignment.
   - Invoke the next ephemeral subagent via `invoke_subagent`.

**Governor Invariant:** The Governor MUST NEVER re-execute unit test suites that the worker already verified green, and MUST NEVER inspect deep implementation source code. Doing so causes token bloat, latency, and context pollution. Always output the Visual Progress Dashboard upon dispatching subagents so the user has full real-time visibility into mission progress.

- **CRITICAL PROHIBITION GATE:** If `plan.js close` exits with **code 2**, advancing to downstream units is **STRICTLY PROHIBITED**. The agent must:
  1. Inspect the reported violations or missing criteria.
  2. Transition to `remediate` turn mode.
  3. Resolve defects and re-run `plan.js verify` and `plan.js close` until code 0 is achieved.

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
