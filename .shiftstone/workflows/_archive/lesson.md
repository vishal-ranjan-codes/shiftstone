---
cost_tracking: workflow-end
description: Turn an agent mistake into a reviewed static rule — propose, get explicit human approval, then append to .shiftstone/static-rules/global.md within the 200-line static budget.
---

# /lesson — Rule Accumulation

> Usage: `/lesson`
> "Start with 10 lines; add a rule every time the agent does something it
> shouldn't" (Osmani 06, individual rec #1). Mistake → proposed rule → human
> approval → appended rule. Nothing enters static context unreviewed.

---

## Phase 1 — Capture the Mistake

1. State, in one block: **what happened** (the exact action/omission), the
   **evidence** (file:line, command output, or transcript excerpt), **why it
   violated intent**, and the **cost** if repeated. No evidence, no rule.

---

## Phase 2 — Draft the Rule

2. Check for existing coverage first — grep `.shiftstone/static-rules/`,
   `.shiftstone/path-scoped-rules/` and `AGENTS.md`. If a rule already says it, the
   lesson is a *clarification*: merge it into the existing rule instead of
   adding a line (the anti-duplication mandate applies to rules too).
3. Draft the rule as **at most two lines**, imperative, with the failure it
   prevents named:

   ```markdown
   <N>. **<Rule in one sentence>.** <Why / what it prevents.>
   ```

---

## Phase 3 — Human Approval (mandatory gate)

4. **⛔ STOP — present the mistake and the drafted rule; append ONLY after
   explicit human approval.** No approval (or silence) → nothing is written;
   note the draft as declined and move on. The agent never approves its own rule.

---

## Phase 4 — Append + Budget Check

5. On approval, append the rule under `## Accumulated Lessons` in
   `.shiftstone/static-rules/global.md` (create the heading at the end of the file if
   it does not exist yet), prefixed with the date and source task:
   `- [YYYY-MM-DD] <rule> (source: <task-id>)`.
6. **Run the budget check BEFORE appending:**

   ```bash
   node .shiftstone/scripts/check-rule-budget.js
   ```

   - `ok` → append, then re-run the check and `pnpm parity` to confirm the
     200-line static budget still holds.
   - `warn` or `over` → **do not append.** Merge two existing lessons, compress
     a rule, or move detail into a path-scoped rule file; re-run until `ok`.
     The budget warning is the system working — static context is a scarce,
     always-paid resource.
7. If the rule is stack-specific or path-specific, append it to the matching
   `.shiftstone/path-scoped-rules/*.md` file instead (it loads on demand and is not
   counted against the Layer 0 budget).

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js lesson --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
