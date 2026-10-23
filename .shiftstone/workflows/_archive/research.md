---
cost_tracking: workflow-end
description: Research one or more technology topics using the numbered template and save persistent findings to docs/research/.
---

# /research — Research & Document Workflow

> Use this workflow when you need to make a technical decision backed by research.
> Research is saved to `docs/research/` so it persists across conversations.
> Always check `docs/research/README.md` first — supplement existing research rather than starting over.

---

## Phase 0 — Topic Analysis (multi-topic only)

**Run this phase only when 2 or more topics are provided. Skip to Phase 1 for a single topic.**

When the user types `/research topic-a topic-b topic-c`, classify the relationship:
- Same decision → Merge into one folder
- Same domain, distinct decisions → Sibling folders under a shared parent
- Unrelated domains → Independent folders, no shared parent

**⛔ STOP — Wait for user confirmation before creating any folders.**

---

## Phase 1 — Scope

1. Check `docs/research/README.md` — has this topic already been researched?
2. Define the research question and constraints (framework, runtime, data layer — the active pack's stack).
3. Create the topic folder: `docs/research/<topic-area>/<topic-slug>/`.
4. Write `00-BRIEF.md` first: "We are researching [topic] in order to decide [specific decision]."

---

## Phase 2 — Research

5. Search authoritative sources:
   - Official documentation, RFCs, release notes
   - Trusted practitioner blogs and engineering posts
   - Community benchmarks and issue trackers
   - Avoid generic SEO listicles

---

## Phase 3 — Document

6. Write `04-CONCLUSION.md` **first** — this is the direct recommendation.

7. Write remaining files in order:
   - `01-SUMMARY.md` — plain-language overview
   - `02-FINDINGS.md` — technical deep-dive per option
   - `03-COMPARISON.md` — scoring matrix and trade-offs
   - `05-IMPLEMENTATION.md` — working stack-specific code patterns for the active pack
   - `06-SOURCES.md` — all sources tiered by reliability

8. Update `docs/research/README.md` master index with the new topic.

9. If an architectural decision is adopted: add a new DEC-XXX entry to `docs/bible/DECISIONS.md`.

---

## Post-Write Checkpoint

- [ ] `00-BRIEF.md` has a clear one-sentence research question
- [ ] `04-CONCLUSION.md` directly answers the brief with a clear recommendation
- [ ] Required files exist: `00-BRIEF.md`, `01-SUMMARY.md`, `02-FINDINGS.md`, `03-COMPARISON.md`, `04-CONCLUSION.md`, `06-SOURCES.md`
- [ ] `docs/research/README.md` master index has a new row

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js research --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
