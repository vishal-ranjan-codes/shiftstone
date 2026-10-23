---
cost_tracking: workflow-end
description: Refresh stale research documents — update pricing, versions, and outdated findings.
---

# /refresh-research — Refresh Research Workflow

> Use this workflow when research is stale, has TBD placeholders, or needs a periodic update.
> Only update what changed — don't rewrite sections that are still accurate.

---

## Freshness Windows

| Section Type | Window | Priority |
|---|---|---|
| Pricing / cost data | 30 days | 🔴 High |
| Model availability / new releases | 60 days | 🔴 High |
| API features / capabilities | 90 days | 🟡 Medium |
| Architecture / how it works | 180 days | 🟢 Low |
| Fundamental concepts | 365 days | 🟢 Low |

---

## Phase 1 — Identify What's Stale

1. Read `00-BRIEF.md` — check `Last Updated` date against freshness windows.
2. Read `04-CONCLUSION.md` — verify if the recommendation is still valid.
3. Scan `02-FINDINGS.md` for pricing tables, version numbers, and feature lists that may have changed.

---

## Phase 2 — Re-Research Only What Changed

4. Run targeted searches only for stale sections.
5. Note what changed.

---

## Phase 3 — Update

6. Add an update callout to modified sections: `> 🔄 Updated [YYYY-MM-DD]: [what changed]`.
7. If recommendation changes, update `04-CONCLUSION.md` and add rationale.
8. Update `00-BRIEF.md` `Last Updated` date.
9. Update `docs/research/README.md`.

---

## Post-Write Checkpoint

- [ ] Only stale sections modified
- [ ] `04-CONCLUSION.md` reflects updated state
- [ ] `docs/research/README.md` updated with fresh timestamp

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js refresh-research --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
