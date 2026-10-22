# ss-diagnose — Systematic Debugging & 3-Fix Breaker Guide

Procedure for isolating, reproducing, and fixing elusive bugs, compiler errors, and runtime failures without thrashing.

---

## Iron Law

1. **Root-Cause Hypothesis First:** NEVER touch code without formulating and stating an explicit root-cause hypothesis backed by evidence (stack traces, logs, or type diagnostics). No random code edits.
2. **Minimal Reproduction Required:** Before fixing any non-trivial bug, reproduce it with the minimal failing test or command.
3. **The 3-Fix Circuit Breaker:** If 3 consecutive attempted fixes fail to resolve the problem:
   - **HALT IMMEDIATELY.**
   - Roll back all attempted code mutations (`git checkout`).
   - Transition to terminal state `escalated` and explain the diagnostic findings to the human developer.
4. **Physical Disk Edits Only:** Apply fixes directly to target files. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll try changing this line to see if it fixes it."* | **Forbidden (Guess-and-Check).** Random modifications introduce compounding bugs. Formulate a hypothesis first. |
| *"Fix #3 failed, but I have a 4th idea."* | **Forbidden (3-Fix Breaker).** 3 failed fixes prove the working mental model is flawed. Halt, rollback, and re-assess. |
| *"I'll just catch the exception and return null."* | **Forbidden (Symptom Masking).** Masking runtime errors hides the underlying structural defect. Fix the root cause. |

---

## 4-Phase Systematic Debugging Protocol

### Phase 1: Investigate & Formulate Hypothesis
1. Run diagnostics:
   ```bash
   pnpm typecheck || pnpm test
   ```
2. Inspect exact error messages, stack traces, and line numbers.
3. Identify relevant code paths and recent diffs.
4. Formulate explicit hypothesis: *"The failure occurs because [X] expects [Y] but receives [Z] when [Condition] happens."*

### Phase 2: Minimal Reproduction
1. Create a minimal reproduction test case or command that reliably reproduces the exact error.
2. Confirm the test fails with the matching diagnostic.

### Phase 3: Targeted Fix Implementation
1. Apply the single most direct, minimal fix to address the hypothesized root cause.
2. Do not refactor unrelated code during the fix turn.

### Phase 4: Verification & Circuit Breaker Tracking
1. Re-run reproduction test and workspace test suites:
   ```bash
   pnpm typecheck && pnpm test
   ```
2. **Outcome Evaluation:**
   - If green $\rightarrow$ succeed, clean up scratch tests, and document in `CHANGELOG.md`.
   - If red and attempts $< 3$ $\rightarrow$ record failed attempt, refine hypothesis, try targeted fix #2 or #3.
   - If red on attempt 3 $\rightarrow$ **TRIGGER 3-FIX CIRCUIT BREAKER**. Run `git checkout .`, halt, and escalate.

---

## Verification Ladder

- **L1 (Syntax):** Diagnostic output clearly identifies error location.
- **L2 (Reproduction):** Minimal test proves bug existence.
- **L3 (Fix Verification):** Reproduction test and full suite pass green.
- **L4 (Anti-Regression):** `git diff` confirms zero collateral damage to unrelated code.
- **L5 (Human Escalation):** If circuit breaker trips, structured report delivered to human.

---

## Terminal States

- `success`: Root cause resolved, verified with green tests, zero regressions.
- `no_op`: Reported issue cannot be reproduced or was already resolved.
- `escalated`: 3-fix circuit breaker triggered; requires human architectural insight.
