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

### Step 2: Deterministic Test & Linter Execution
- Run compiler, linter, and test suites fresh:
  ```bash
  pnpm typecheck && pnpm lint && pnpm test
  ```
- If any check fails, halt immediately: state is `blocked`.

### Step 3: Boundary & Anti-Gaming Regression Check
- Inspect diff for anti-gaming violations:
  - Confirm no deleted test files or reduced assertion counts.
  - Confirm no test bypass modifiers (`.skip`, `.only`, `test.todo`).
  - Confirm no suppressed compiler warnings (`@ts-ignore`, `eslint-disable`).

### Step 4: Disjoint Checker Subagent Evaluation
- Spawn a Checker subagent using [resources/checker-prompt.md](./resources/checker-prompt.md).
- Model selection resolves via `core/context/model-routing.yaml` (task-class advisory tiers with maker-disjoint Checker family).
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
   node core/scripts/validate-release-evidence.js
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
