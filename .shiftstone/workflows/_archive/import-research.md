---
cost_tracking: workflow-end
description: Import raw notes, web clips, or documents into the docs/research/ numbered template structure.
---

# /import-research — Import Research Workflow

> Use this workflow when you have raw notes, web clips, or external documents to organize into the research system.
> Read all source files before creating anything. Never duplicate an existing topic folder.

---

## Phase 1 — Read Sources

1. Read all source files provided.
2. Identify distinct topics across all files.
3. Check `docs/research/README.md` for existing folders — update rather than duplicate.

---

## Phase 2 — Plan

4. Present a plan to the user:
   - Topics to create or update
   - Destination folders
   - **⛔ STOP — Get user confirmation before creating folders.**

---

## Phase 3 — Create

5. For each topic, create the folder structure using `docs/research/_template/`.
6. Distribute content into `01-SUMMARY.md`, `02-FINDINGS.md`, `03-COMPARISON.md`, `05-IMPLEMENTATION.md`, `06-SOURCES.md`.
7. Write `04-CONCLUSION.md`.
8. Update `docs/research/README.md`.

---

## Post-Write Checkpoint

- [ ] All source files read before folder creation
- [ ] No duplicate folders created
- [ ] `04-CONCLUSION.md` written with actionable takeaway
- [ ] `docs/research/README.md` master index updated

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js import-research --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
