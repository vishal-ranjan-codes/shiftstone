# ss-loop-author — Loop Specification Authoring & Hardening Guide

Interview guide and anti-bypass hardening rules for creating automation loops in `docs/loops/<loop-id>/spec.md`.

---

## Iron Law

1. **Golden Rule Triage:** Never create a loop unless `feedback(t)` changes `action(t+1)`. If the next turn does not change based on dynamic check output, emit a one-shot prompt, not a loop.
2. **Named Skills Only:** A loop must compose named, tested workspace skills. Never wrap a raw model in `while true`.
3. **Hard Ceiling Invariant:** Every loop must declare explicit iteration, token, and barren-turn bounds (`max_iterations <= 10`, `max_barren_turns <= 2`).
4. **Physical Disk Output Only:** Output loop specs directly to `docs/loops/<loop-id>/spec.md`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"This loop is just running a command periodically, no check needed."* | **Forbidden (A10).** That is a scheduled cron job, not a feedback loop. |
| *"The maker agent can review its own output at L4."* | **Forbidden (Anti #2).** L4 evaluation requires disjoint maker-checker context isolation. |
| *"We can allow 50 iterations so it keeps trying until it works."* | **Forbidden (Anti #5).** Unattended runaway risk. Maximum iterations capped at 10. |

---

## The 7-Question Interview Protocol

Execute one question at a time via `ask_question`:
1. **Goal + Type:** What does "done" mean? Is success `verifiable`, `judged`, or `mixed`?
2. **Concrete Check:** Which test command, linter, or assertion proves a turn succeeded?
3. **Trigger:** `manual`, `scheduled` (5-field cron), or `event` (path or git hook)? (Requires A7 sandbox).
4. **Stop States:** Name the conditions for `no_op`, `blocked`, `stalled`, and `exhausted`.
5. **Named Skills:** Which existing workspace skills will this loop execute?
6. **State Storage:** Confirm state lives at `.loops/<loop-id>/state.json`.
7. **Guardrails & Gates:** Enforce `max_iterations <= 10` and human gates on irreversible actions (`push`, `deploy`).

---

## Verification Ladder

- **L1 (Syntax):** YAML frontmatter parses cleanly without syntax errors.
- **L2 (Harness Refusal Gate):** `node core/harness/cli.js validate <loop-id>` exits 0.
- **L3 (Budget Gate):** Spec line count $\le 200$ lines.
- **L4 (Checker Review):** Disjoint check verifies all 5 terminal states and named skill references.
- **L5 (Dry Run):** `node core/harness/cli.js run <loop-id>` executes first turn cleanly.

---

## Terminal States

- `success`: Loop specification validated and saved to `docs/loops/<loop-id>/spec.md`.
- `blocked`: Task is not loopable under Macedo §8 triage.
- `escalated`: Disputed terminal state definitions or missing verification command.
