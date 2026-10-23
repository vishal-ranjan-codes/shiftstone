---
cost_tracking: workflow-end
description: Perform an auto-maintenance sweep across all task backlogs, check task limits, and split overloaded phases.
---

# /backlog-sync — Backlog Status Synchronizer

Use this workflow to sync task priorities, clean up completed items based on commits, and split overloaded sub-phase files inside the {{PROJECT_NAME}} workspace.

---

## Phase 1: Scan Backlogs & Task Limits

1. Scan the `docs/backlog/` directory recursively.
2. Read all sub-phase backlog files that have `status: active` or `status: planned`.
3. For each file, count the number of unresolved tasks (lines starting with `- [ ]` or `- [/]`).

---

## Phase 2: Overload Analysis & Split Planning

1. If any backlog file contains **more than 12 unresolved tasks**:
   - Flag it as **overloaded**.
   - Analyze the task list and group them into logical subsets.
   - Draft a proposed split structure (e.g. splitting `1.2-database-schema` into `1.2.1-db-connection` and `1.2.2-db-rls-setup`).
2. Present the proposed split structure to the user for confirmation.

---

## Phase 3: Execute Splits & MOC Update

For each approved split:
1. Create the new child backlog files under the correct phase folder.
2. Populate the child files with standard backlog frontmatter header and their assigned subset of tasks.
3. Move the original backlog file to completed status (`status: completed`).
4. Update the Map of Content (`docs/backlog/MOC.md`) to point to the new files and update task counts.

---

## Phase 4: Git Sync (outer-gated closures)

1. Scan recent commits containing references to task/bug IDs.
2. Cross-reference the code to ensure completion. Candidates found this way are
   **not** closed directly — git evidence is a proposal, not a verdict:
   - Route each candidate through `/verify <task-id>` (task 6.4).
   - Mark `[x]` only with the Checker signature:
     `- [x] <task> — verified by <model-family> @ <score> (<date>)`
   - A verdict < 0.8 leaves the task `[/]`; report the gaps instead.
3. Log the verified closures to `docs/bible/CHANGELOG.md` (via a `log.md` row — `_config/conventions.md`).

> `node .shiftstone/scripts/check-backlog-signoff.js --strict` (parity/CI) rejects any
> `[x]` written without a signature, so this phase cannot shortcut the gate.

---

## Post-Write Checkpoint

- [ ] Overloaded backlog files successfully split
- [ ] Map of Content (`MOC.md`) updated with new links
- [ ] No source code files modified (backlog-sync is docs-only)
- [ ] Log entry added: `docs: sync backlog — split {phase}` in `docs/bible/CHANGELOG.md`

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js backlog-sync --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
