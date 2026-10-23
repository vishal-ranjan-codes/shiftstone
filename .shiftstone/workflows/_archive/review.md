---
cost_tracking: workflow-end
description: AI first-pass code review against the tuned checklist — findings grouped by category (hallucinated dependencies, error handling, subtle correctness) before the change reaches human review.
---

# /review — AI First-Pass Review

> Usage: `/review [<commit|file|branch>]` (default: uncommitted changes vs. main)
> The AI reviews FIRST so human review starts from a filtered, categorized
> findings list. This never replaces the human review or the `/verify` outer gate.

---

## Phase 1 — Assemble the Diff

1. Collect the change under review (staged/unstaged diff, a commit range, or
   named files) plus the bible/contract sections the change touches.
2. If the change alters behavior, also collect the test/eval diff — a behavior
   change without a test/eval change is itself a finding (B4).

---

## Phase 2 — Checklist Pass

3. Read `.shiftstone/static-rules/review-checklist.md` (loaded on demand) and work
   each of its three categories **in order**, one focused pass per category:
   - **Hallucinated dependencies** — verify every import/package/API against
     `package.json`, the filesystem, and the docs. Never take an import on faith.
   - **Inadequate error handling** — trace every awaited call that can fail and
     every boundary input; confirm handling, cleanup and validation exist.
   - **Subtle correctness** — logic, async hazards, weakened tests, contract
     drift between code and `docs/bible/`.

---

## Phase 3 — Findings by Category

4. Report **grouped by checklist category**, never as a flat dump:

   ```markdown
   ## Hallucinated dependencies
   - [blocker] app/routes.ts:42 — imports `zod-extra` (not in package.json)
   ## Inadequate error handling
   - [major] app/utils/upload.ts:18 — R2 put failure swallowed by empty catch
   ## Subtle correctness
   - [minor] app/hooks/useSession.ts:7 — unawaited refresh() can race logout
   ```

   Every finding carries `file:line`, severity (`blocker|major|minor`) and a
   concrete fix direction. "Looks good" with zero findings requires stating
   which lines were checked per category — an empty report is not evidence.

---

## Phase 4 — Verdict

5. **Any `blocker`** → verdict **changes requested**; do not proceed to human
   review until blockers are fixed and `/review` is re-run.
6. **Only `major`/`minor`** → verdict **passes with findings**; attach the
   grouped report for the human reviewer and fix `major`s in the same change.
7. Reviewer signature on the artifact: `/review <scope> — <verdict> —
   <N blocker/M major/m minor> (<date>)`.

---

## Rules

- Review the diff, not the author: never wave through your own change without
  the checklist pass — the maker never signs off on their own work.
- A finding needs evidence (line, snippet, or command output); "this feels
  risky" is logged as a note, not a finding.
- `/review` is the first pass; `/verify` (Checker subagent) remains the
  mandatory outer gate before `[x]`, `/push`, or `/deploy`.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js review --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
