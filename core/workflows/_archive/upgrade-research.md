---
cost_tracking: workflow-end
description: Migrate legacy research folders to the numbered template structure.
---

# /upgrade-research — Upgrade Research Workflow

> Use this workflow when legacy research folders need migrating to the 8-file numbered structure.
> Target structure: `00-BRIEF.md` through `06-SOURCES.md` + `EXPERIMENTS.md`.

---

## Content Redistribution Map

| Old File / Section | New File |
|---|---|
| README title + metadata | `00-BRIEF.md` |
| README summary paragraphs | `02-FINDINGS.md` |
| README core concepts | `02-FINDINGS.md` |
| README use cases / limitations | `01-SUMMARY.md` |
| README comparison table | `03-COMPARISON.md` |
| README implementation | `05-IMPLEMENTATION.md` |
| README key takeaways | `04-CONCLUSION.md` |
| References & links | `06-SOURCES.md` |

---

## Phase 1 — Read & Map

1. Read all existing files in the legacy folder.
2. Map content to the 8-file numbered template files.

---

## Phase 2 — Create & Migrate

3. Create the new files using `docs/research/_template/`.
4. Ensure `04-CONCLUSION.md` has a clear, actionable recommendation.
5. Update `docs/research/README.md`.

---

## Post-Write Checkpoint

- [ ] All old content migrated
- [ ] `04-CONCLUSION.md` clearly states recommendation
- [ ] `docs/research/README.md` updated

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js upgrade-research --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
