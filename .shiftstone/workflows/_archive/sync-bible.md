---
cost_tracking: workflow-end
description: Sync the development bible and backlog with the actual app — detect drift, surface misalignments, and apply updates behind a mandatory Checker sign-off.
---

# /sync-bible — Code ↔ Bible Alignment Sync (Outer-Gated)

> Run this workflow between features or at the end of a development session.
> Purpose: catch documentation drift, maintain SSOT integrity, and keep logs and changelogs accurate.
> **This workflow runs in the outer gear.** Every proposed edit to `{{BIBLE_PATH}}/` (or `docs/backlog/`) must clear a disjoint Checker sign-off (Phase 5) before it is applied — the maker never applies its own unverified doc edits (task 6.3).

---

## Phase 1 — Mechanical Drift Detection

1. Run the 3-way diff (the `bible-sync-loop` grounded check, task 6.1):
   ```sh
   node .shiftstone/scripts/bible-sync.js --report
   ```
   - Exit 0 → code, bible and decisions agree; keep only the backlog/log checks below.
   - Exit 1 → treat every `drift` item as a candidate update plan (ToC row, chapter index, ADR, or stale code reference). Missing bible core files (exit 78 on `--apply`) → **escalate** to a human, do not improvise the bible.

2. Check ToC freshness (generated from chapter frontmatter):
   ```sh
   node .shiftstone/governance/bible/index.js --check
   ```
   A stale ToC is fixed by running the generator — never by hand-editing the table.

3. Check pending log entries (C6):
   ```sh
   node .shiftstone/scripts/compile-changelog.js --check
   ```

4. Check every `- [ ]` / `- [/]` item in the active sub-phase backlog against the actual code in `{{APP_PATH}}/`:
   - If the code clearly exists → candidate to close via `/verify` (marking `[x]` without a Checker verdict is refused).
   - If an item is `- [x]` but code does not exist → flag as potential regression.

---

## Phase 2 — Bible Cross-Check (High-Drift Areas)

Compare the documented specifications in `{{BIBLE_PATH}}/` against the codebase:

5. **Schema & Migrations** — `{{BIBLE_PATH}}/03-database/`
   - Compare documented tables/columns to the SQL migration files.
   - Flag tables, columns, or types present in code but missing from bible (or vice versa).

6. **Routes & API Contracts** — `{{BIBLE_PATH}}/08-api-contracts/route-contracts.md`
   - Compare documented routes to the route entry point and route modules under `{{APP_PATH}}/`.
   - Flag route signature changes (loader data shape, action input validation, return types).

7. **Auth & Middleware** — `{{BIBLE_PATH}}/04-auth-and-rbac/auth-overview.md`
   - Check the auth middleware/hook handlers against the documented auth flow.

8. **Scheduled Workers** — `{{BIBLE_PATH}}/01-architecture/architecture-overview.md`
   - Compare documented background jobs against the scheduler configuration and worker handlers.

9. **External Integrations** — `{{BIBLE_PATH}}/06-integrations/external-services.md`
   - Check storage buckets, API keys, and third-party integrations against the app's env template and implementation code.

---

## Phase 3 — Propose Updates (maker)

10. Create a **sync receipt** at `docs/sync-reports/<ISO-8601>-bible-sync.md`
    (blueprint §10.16 — every sync emits a receipt; OKF frontmatter
    `type: sync-report`, `timestamp`, `inputs`) listing, for every drift item:
    - The proposed documentation edit (file + before/after)
    - The evidence (code path, commit, or command output) that justifies it
    - The `log.md` rows that will record the applied changes (one row per bundle touched:
      `docs/bible/log.md`, `packs/log.md`, `.agents/skills/log.md` — format in `_config/conventions.md`)

11. **⛔ STOP — no documentation file is edited yet.** The receipt is the proposal; Phase 5 decides it.

---

## Phase 4 — Compile Pending Log Entries

12. Run `node .shiftstone/scripts/compile-changelog.js`. This compiles any *previously approved*
    log entries that are still pending into `{{BIBLE_PATH}}/CHANGELOG.md` and stamps them
    (task 6.9). It never invents content — it only moves approved log rows into the changelog.

---

## Phase 5 — Outer Gate: Checker Sign-Off on Doc Edits (task 6.3)

13. Spawn a **Checker subagent in a fresh, disjoint context** — exactly as `/verify`
    Phase 2 defines (maker ≠ checker; routing from `.shiftstone/context/model-routing.yaml`).
    Give the Checker only: the sync receipt, the mechanical command outputs from Phase 1,
    and the diff evidence. Never the maker's confidence.

14. The Checker scores **0.0 – 1.0** against the doc-edit rubric:

    | Score | Meaning |
    |---|---|
    | 1.0 | Every edit is backed by code evidence; nothing outside the drift report is touched; log rows follow the declared format; no link/OKF regressions |
    | 0.5 – 0.8 | Evidence gaps or formatting issues (listed explicitly) |
    | < 0.5 | Invented claims, content edits beyond the drift report, or missing evidence |

    The Checker MUST return: `{ score, verdict: pass|fail, gaps: string[], reasoning }`.

15. **If score >= 0.8** → proceed to Phase 6 with exactly the approved edits.
    **If score < 0.8** → **BLOCKED**. Apply nothing. Report the gaps; the maker
    revises the receipt or the task escalates to a human. A low score is a
    refusal, not a negotiation.

---

## Phase 6 — Apply Approved Edits (maker)

16. Apply **only** the Checker-approved edits across `{{BIBLE_PATH}}/`, `docs/backlog/`,
    and the affected bundles.

17. Regenerate what is generated — never hand-edit:
    - `node .shiftstone/governance/bible/index.js` (ToC from chapter frontmatter)
    - `node .shiftstone/governance/index.js` (docs indexes)
    - `node .shiftstone/scripts/generate-skills-manifest.js` (only when a skill file changed — manifest and AGENTS.md index are generated)

18. Append one `log.md` row per applied change to each touched bundle log
    (`docs/bible/log.md`, `packs/log.md`, `.agents/skills/log.md`), leaving the
    `Compiled` cell empty (tasks 6.7 / 6.9).

---

## Phase 7 — Close the Loop

19. Re-run the gates; all must be green:
    ```sh
    node .shiftstone/scripts/bible-sync.js --check
    node .shiftstone/governance/bible/index.js --check
    node .shiftstone/governance/index.js --check
    node .shiftstone/scripts/compile-changelog.js
    node .shiftstone/scripts/check-link-integrity.js --strict
    ```

20. If this sync closed backlog items, each closure still needs its own `/verify <task-id>`
    verdict — this workflow never marks `[x]` itself.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js sync-bible --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
