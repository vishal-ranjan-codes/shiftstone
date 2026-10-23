---
type: document
timestamp: 2026-10-14T00:00:00.000Z
---

# lessons.md — curated loop memory format (task 5.5)

> The runtime copy of this file lives at `.loops/<loop>/lessons.md`
> (gitignored). This template is the canonical **format**: copy the skeleton
> below when a loop's `memory.location` needs lessons, and keep it curated —
> `memory.curated: true` is enforced by the A11 checklist.

## Lesson block format

Every lesson is a level-2 heading `## L-<NNN> — <title>` followed by
metadata bullets and a free-text body:

```markdown
## L-001 — Never trust a green typecheck without the error count

- added_at: 2026-10-14T09:00:00.000Z
- cac_usd: 1.25
- evidence: none
- source_run: 6f9619ff-8b86-d011-b42d-00c04fc964ff

Re-run the count after every fix; a passing run with an unchanged count is a
stale cache, not a fix.
```

| Field | Meaning |
|---|---|
| `added_at` | ISO-8601 moment the lesson was recorded. Runs **after** this timestamp form its observation window. |
| `cac_usd` | Cost per Accepted Change (USD) when the lesson was recorded — the baseline the lesson must improve on. |
| `evidence` | `none`, or a comma-separated list of `run:<run_id>` entries where the lesson demonstrably helped (a rework avoided, a refusal triggered). |
| `source_run` | The `run_id` that produced the lesson (see `.loops/<loop>/runs.jsonl`). |

## Curation rules (task 5.6)

`node .shiftstone/scripts/curate-memory.js <loop-id> [--n <runs>] [--dry-run]`
(`.shiftstone/harness/memory/curate.ts`) prunes evidence-free lessons when the loop
does not improve:

1. `evidence` contains any `run:` entry → **kept** (the lesson has proof).
2. Fewer than `--n` runs (default 5) since `added_at` → **kept** (not enough data).
3. CAC improved below `cac_usd` since `added_at` → **kept** (the lesson is working).
4. Otherwise → **dropped**: a lesson with no evidence that never moved CAC is
   dead weight in the context budget.

Dropped lessons are reported with their reason; `--dry-run` prints the verdict
without rewriting the file.

## Skeleton (copy into `.loops/<loop>/lessons.md`)

```markdown
# Lessons — <loop-id>

<!-- One "## L-NNN — title" block per lesson. See format above. -->
```
