---
cost_tracking: workflow-end
description: Capture a bug in standardized format, log it to docs/bugs/open-bugs.md, and offer to fix immediately.
---

# /bug-report — Bug Capture Workflow

> Use this workflow whenever a bug is found — during development, during `/sync-bible`, or reported directly.
> Creates a persistent artifact and logs the bug to the open-bugs file.

---

## Phase 1 — Gather Details

1. Collect needed information:
   - **Title**: one-line description of the bug
   - **Severity**: Critical / High / Medium / Low
     - Critical = data loss, auth bypass, security failure
     - High = feature broken, no workaround
     - Medium = feature partially broken, workaround exists
     - Low = cosmetic, minor UX issue
   - **Role affected**: Public / User / Admin / API
   - **Steps to reproduce** (if known)
   - **Expected behavior** vs **Actual behavior**

---

## Phase 2 — Create Bug Artifact

2. Check `docs/bugs/open-bugs.md` for the last `BUG-XXX` number and increment by 1.

3. Create a **bug_report.md artifact** with:
   - Metadata (ID, Date, Severity, Role Affected)
   - Description
   - Steps to Reproduce
   - Expected vs Actual Behavior
   - Suspected Cause (file path, function, or route)
   - Proposed Fix

---

## Phase 3 — Log to open-bugs.md

4. Append a row to `docs/bugs/open-bugs.md`:
   ```markdown
   | BUG-[XXX] | [Title] | Open | [Severity] | [YYYY-MM-DD] |
   ```

---

## Phase 4 — Offer Immediate Fix

5. Ask the user:
   > "I've logged BUG-[XXX] in `docs/bugs/open-bugs.md`. Would you like me to fix this now?"
   - If yes → transition to fix mode, create an implementation plan, resolve, and update the bug status to `Fixed`.
   - If no → keep as `Open` in `docs/bugs/open-bugs.md`.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js bug-report --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
