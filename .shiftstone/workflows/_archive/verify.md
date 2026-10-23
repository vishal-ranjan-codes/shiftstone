---
cost_tracking: workflow-end
description: Mandatory outer-gate — spawn a disjoint Checker subagent to score completed work against a rubric; blocks [/] → [x] when the verdict is below 0.8.
---

# /verify — Mandatory Outer Gate

> Usage: `/verify <task-id> [--strict]`
> Spawns a Checker subagent to sign off on a backlog task before it is marked `[x]`.
> MANDATORY before `/push`, `/deploy`, `/new-migration`, and any irreversible action.
> Inner-gear exceptions (no /verify needed): `/diagnose`, `/nexus`, `/status`,
> `/backlog-sync`, `/research` — they are deterministic L1/L2 loops.

---

## Phase 1 — Assemble the Evidence Package

1. Locate the task in `docs/backlog/` and gather everything the Checker needs:
   - The task statement and its acceptance criteria
   - The diff / changed files (or PR link)
   - Verification output: typecheck, lint, test results (L1 evidence)
   - Docs/bible updates touched by the change

---

## Phase 2 — Spawn the Disjoint Checker

2. Spawn a **Checker subagent in a fresh, disjoint context** (maker ≠ checker —
   the Checker must NOT be the agent that produced the work).

   - **Model tier (routing policy):** read `.shiftstone/context/model-routing.yaml`
     first — the Checker runs the `review` class (fast tier) by default; use a
     `frontier` tier only for design/architecture-heavy verdicts. The map is
     advisory OpEx policy (fast for review/monitoring, frontier for design/impl).
   - **Default mode**: Checker runs on the current default model.
   - **`--strict` mode** (required for `/deploy`, `/push`, `/new-migration`):
     spawn the Checker on a **different model family** from the maker
     (e.g. maker = Claude, checker = GPT), frontier tier.

3. Give the Checker only: the evidence package, the rubric below, and the
   instruction to score — never the maker's confidence or self-assessment.

---

## Phase 3 — Rubric Scoring

4. The Checker scores **0.0 – 1.0** against the frozen rubric:

   | Score | Meaning |
   |---|---|
   | 1.0 | All L1 checks pass; matches the approved spec semantically; docs updated; no regressions; evidence attached |
   | 0.5 – 0.8 | Minor alignment issues (listed explicitly) |
   | < 0.5 | Scope creep, missing tests, doc drift, or unverified claims |

   The Checker MUST return: `{ score, verdict: pass|fail, gaps: string[], reasoning }`.

---

## Phase 4 — The Gate

5. **If score >= 0.8** → mark the backlog task `[/]` → `[x]`, appending the
   checker signature:
   `[x] <task> — verified by <model-family> @ <score> (<date>)`

6. **If score < 0.8** → **BLOCKED**. Do not mark `[x]`. Report the rubric gaps
   returned by the Checker; the maker retries or the task escalates to a human.
   A low score is a refusal, not a negotiation.

---

## Rules

- Never let the maker self-approve: spawning the Checker inside the maker's
  context voids the verdict.
- The threshold `0.8` is fixed (blueprint §7.4); it is not per-task tunable.
- Every `/verify` verdict is recorded on the task artifact so drift between
  maker claims and checker scores stays auditable.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js verify --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
