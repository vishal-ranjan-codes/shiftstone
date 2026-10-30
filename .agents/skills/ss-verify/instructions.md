# ss-verify — Mandatory Outer Gate & Checker Protocol

Procedure for running the 5-Step Verification Gate and spawning a disjoint Checker subagent to seal completed backlog items.

---

## Iron Law

1. **Maker ≠ Checker Invariant:** The agent verifying work MUST operate in a fresh, disjoint context. An agent must NEVER self-approve its own implementation turn.
2. **Two-Gate Approval Standard (LOCK-03):** To mark a task complete (`[x]`), the review must pass BOTH gates:
   - **Gate A (Zero-Tolerance Invariant):** Zero unresolved `critical` or `high` findings (`confidence >= 0.8`), and `hallucination` score must be 2/2.
   - **Gate B (Calibrated Quality Gate):** Weighted `normalizedScore >= 80` (`0.8 / 1.0`).
3. **Mandatory Strict Mode on Irreversible Actions:** Invoking `/ss-push`, `/ss-deploy`, or destructive migrations requires `--strict` mode (frontier model tier on a different model family).
4. **Physical Disk Output Only:** Verification evidence is attached directly to the task in `docs/backlog/` or recorded in `docs/reports/`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The test passed in my previous turn, so I can mark it [x] directly."* | **Forbidden.** Step 1 requires fresh evidence gathering without relying on cached assumptions or maker memory. |
| *"The score is 78/100, which is close enough to 80."* | **Forbidden (Gate B).** 80 is a hard floor. A score below 80 is a refusal (`blocked`), not a negotiation. |
| *"I don't need to run lint or typecheck because Vitest passed."* | **Forbidden.** Step 2 mandates deterministic L1/L2 checks across compiler, linter, and tests. |
| *"Release bundle can be emitted without running full workspace validation."* | **Forbidden.** Production releases mandate cumulative `validate:workspace` and `validate-release-evidence.js`. |

---

## The 5-Step Gate Function

### Step 1: Fresh Evidence Gathering
- Assemble the complete evidence package without maker self-assessment:
  - Task specification and acceptance criteria from `docs/backlog/`.
  - Full `git diff` of modified files.
  - Declared Bible chapters and ADRs touched.

### Step 2: Deterministic Test & Linter Execution (Application-First Contract)
- Determine target test boundary by evaluating the change set:
  1. **Identify Change Scope:** Inspect the files modified in the diff.
  2. **Select Deterministic Verification Command:**
     - **Case A — Application Changes:** If the diff touches application paths (e.g. `apps/**`, `workers/**`, `src/**`) and no files under `.shiftstone/**`:
       Execute the application commands declared in root `package.json`:
       ```bash
       npm run typecheck && npm run lint && npm test
       ```
       *(Note: `npm test` targets the application test boundary `{{APP_PATH}}`. A broken route, loader, or auth guard in the app fails here deterministically).*
     - **Case B — Engine Changes:** If the diff touches `.shiftstone/**`:
       Execute the engine test suites:
       ```bash
       npm run typecheck:engine && npm run lint:engine && npm run test:engine
       ```
     - **Case C — Full Monorepo / Day 0 / Ambiguous:** If the diff touches both or no application directory exists yet:
       Execute both application and engine suites.
- If any deterministic command exits non-zero, halt immediately: state is `blocked`.

#### Worked Example: Audit Finding F7 Scenario
In audit finding F7, a developer introduces a syntax or type error into a dashboard route module (`apps/web/src/routes/dashboard.tsx`).
1. Step 1 gathers the diff touching `apps/web/src/routes/dashboard.tsx`.
2. Step 2 evaluates the diff scope: touches `apps/**`, zero changes in `.shiftstone/**` $\rightarrow$ Case A applies.
3. Step 2 executes `npm test` (or `npm run typecheck`).
4. Result: `apps/web` test runner fails with exit code 1 due to the broken dashboard route.
5. Verification halts immediately with state `blocked`. The task transition to `[x]` is deterministically rejected, even though all 505 engine tests in `npm run test:engine` are green.

### Step 3: Boundary & Anti-Gaming Regression Check
- Inspect diff for anti-gaming violations:
  - Confirm no deleted test files or reduced assertion counts.
  - Confirm no test bypass modifiers (`.skip`, `.only`, `test.todo`).
  - Confirm no suppressed compiler warnings (`@ts-ignore`, `eslint-disable`).

### Step 4: Disjoint Checker Subagent Evaluation
- Spawn a Checker subagent using [resources/checker-prompt.md](./resources/checker-prompt.md).
- Model selection resolves via `.shiftstone/context/model-routing.yaml` (task-class advisory tiers with maker-disjoint Checker family).
- **Evaluation Lens Resolution (LOCK-B5):**
  - **For Application-Scoped Diffs:** The Checker briefing focuses on application domain contracts (route loaders, form actions, database migrations, auth guards, active-pack stack invariants resolved from the active pack's checker lenses).
  - **For Engine-Scoped Diffs (`.shiftstone/**`):** The Checker briefing focuses on OS-harness invariants, budget ceilings, and framework-level regression gates.
- Checker evaluates the 5 Universal Dimensions (`task_success`, `tool_use_quality`, `trajectory_compliance`, `hallucination`, `response_quality`).
- Compute normalized score and evaluate Gate A and Gate B.

### Step 5: Gated State Transition
- **If Approved:** Mark backlog item `[/]` $\rightarrow$ `[x]` with signature:
  `[x] <task> — verified by <model-family> @ <score> (<date>)`
- **If Rejected:** Mark state `blocked`, report exact rubric gaps, and hand off to maker for remediation.

---

## Release Verification Gate & Evidence Bundling

When verifying a production release bundle (`docs/reports/release-evidence/REL-vX.Y.Z.json`):
1. Execute full workspace validation pipeline:
   ```bash
   npm run validate:workspace
   ```
2. Validate release certification bundle:
   ```bash
   node .shiftstone/scripts/validate-release-evidence.js
   ```
   Requires:
   - Green L1 (typecheck/lint), L1.5 (anti-gaming), L2 (tests), L3 (build/smoke).
   - L4 Checker report with verdict `APPROVED` (`status: "APPROVED"`).
   - L5 human approval artifact (`APR-YYYYMMDD-XXX.json`) signed by verified human identity.
   - Trials summary: 3 harness trials + 6 factory trials passed.
   - Zero open critical bugs in `docs/bugs/open-bugs.md`.

---

## Verification Ladder

- **L1 (Deterministic):** Typecheck, lint, and unit test suites exit 0.
- **L2 (Anti-Gaming):** Diff contains zero suppression flags or assertion drops.
- **L3 (Documentation):** Bible contracts and CHANGELOG updated.
- **L4 (Checker Verdict):** Checker subagent returns Gate A = true and Gate B score $\ge 80$.
- **L5 (Signed Evidence):** Backlog item updated with verifiable signature; for releases, validated `release-evidence/v1` bundle.

---

## Terminal States

- `success`: Task verified, score $\ge 80$, backlog updated to `[x]`.
- `blocked`: Checker score $< 80$, L1 check failed, missing Level 5 human approval, or superseded stage contract; execution refused.
- `escalated`: Disputed rubric scoring or ambiguous requirement requiring human developer architectural judgment (non-mechanical).
