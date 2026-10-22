# ss-execute-plan — Unit Execution & Two-Stage Review Guide

Step-by-step orchestrator for executing atomic Plan Units (`U*`) from approved implementation plans.

---

## Iron Law

1. **Approved Plan Required:** NEVER execute code without an existing, validated implementation plan in `docs/plans/<suite>/`.
2. **One Unit Per Turn:** Execute exactly one Plan Unit `U*` at a time. Never merge multiple units into a single execution turn.
3. **Red-First TDD Invariant:** Every unit modifying behavior MUST implement failing test scenario(s) `TS-U*-*` and observe them fail BEFORE implementing production code.
4. **Bounded Context Ceiling:** Keep execution trajectories focused and bounded under 4,500 tokens per unit turn.
5. **Two-Stage Review Before Sealing:** Every completed unit MUST pass Two-Stage Review (Stage 1: Spec Compliance Review, Stage 2: Code Quality Review) before advancing.
6. **Physical Disk Output Only:** All code and test files are written to declared target files on disk. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"Units U1 and U2 are small, I'll execute them together."* | **Forbidden.** Unit bundling destroys traceability, inflates context, and makes rollbacks complex. Execute one unit at a time. |
| *"I'll write the code first and the tests afterward."* | **Forbidden.** Code written before tests lacks pushback proof and risks testing the implementation rather than requirements. Red first. |
| *"I don't need a review for a trivial unit."* | **Forbidden.** Even small units can introduce subtle regressions, hallucinated imports, or missed acceptance criteria. |

---

## Execution Modes & Lifecycle

Supports two execution modes:
- **Mode A: Inline TDD Mode (Default)** — Current agent executes the unit directly, enforcing the Red-First cycle.
- **Mode B: Subagent-Per-Unit Mode** — Spawns an isolated `self` subagent using [resources/implementer-prompt.md](./resources/implementer-prompt.md) with clean memory.

### Step 1: Pre-Flight Gate Check
Before modifying any file, run the pre-flight gate:
```bash
node core/scripts/agent-preflight.js --target "<targetFiles>" --verify-cmd "<verificationCommand>"
```

### Step 2: Red Turn (Write Failing Test)
- Implement test scenarios (`TS-U*-*`) in declared test files.
- Run test command. Confirm tests fail with expected assertion failures.

### Step 3: Green Turn (Implement Code)
- Implement minimal code in declared `targetFiles` to satisfy acceptance criteria (`AC-U*-*`).
- Run verification command. Confirm all tests pass green.

### Step 4: Two-Stage Review Gate
1. **Stage 1 — Spec Compliance Review:**
   - Audit diff against unit's `acceptanceCriteria` and `targetFiles`.
   - Confirm zero out-of-scope mutations.
2. **Stage 2 — Code Quality Review (`/ss-review`):**
   - Check hallucinated imports, error handling, edge cases.

### Step 5: Seal Unit & Advance
- Mark unit completed in `docs/plans/<suite>/...` and `core/governance/implementation-status.json`.
- Advance to next unit in the DAG.

---

## Verification Ladder

- **L1 (Pre-Flight):** Valid receipt emitted by `agent-preflight.js`.
- **L2 (Unit Tests):** Declared unit verification command exits 0.
- **L3 (Spec Audit):** All `AC-U*-*` criteria verified against test assertions.
- **L4 (Code Review):** Zero blocker or major findings in code review pass.
- **L5 (Human Sign-off):** Milestone demo or final suite verification.

---

## Terminal States

- `success`: All plan units executed, tested, reviewed, and sealed.
- `blocked`: Pre-flight gate fails or tests fail to turn green after 3 attempts.
- `escalated`: Discrepancy between plan specification and codebase reality.
