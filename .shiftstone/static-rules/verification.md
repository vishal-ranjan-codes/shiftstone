---
activation: always
---

# {{PROJECT_NAME}} — Verification Rules (Layer 0, always on)

The Two-Gear Verification boundary, enforced by `/ss-verify` and the loop harness.

1. **Inner gear (~80% of work):** routine edits verify locally with L1/L2 checks (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm parity`). Run before wrapping up.
2. **Outer gear (mandatory):** tasks move `[/]` → `[x]` only with Checker score ≥ 80 (`/ss-verify`). `/ss-push`, `/ss-deploy`, `/ss-new-migration`, and `/ss-sync-bible` doc edits clear the same ≥ 0.8 Checker gate and require outer gate sign-off first.
3. **Maker ≠ Checker.** Checker subagent runs in a disjoint context; the agent producing work never approves it. `--strict` uses an alternate model family.
4. **Protected Actions & Terminal States:** Level 5 actions (destructive migrations, RLS changes, secrets, deploys) require `protected-action-approval/v1` in `.shiftstone/governance/approvals/`. Missing approval or superseded input halts as `blocked` (mechanical); architectural trade-offs halt as `escalated` (judgment).
5. **Loops verify every turn.** Specs declare true ladder level (L1–L5) with grounded checks, budget brakes, and terminal states.
6. **Evidence over confidence.** Unverified claims without command output, test result, or checker verdict are refused.
7. **Tests and evals before code (red first)** — enforced mechanically by the red-before proof (A1): a check that never failed pre-mutation is refused.
