---
cost_tracking: workflow-end
description: Audit roadmap and backlog progress against the codebase and generate a status_report.md artifact ready to continue building.
---

# /status — Development Status Audit

> Use this workflow at the start of any development session, or any time you need to understand
> where development stands and what to build next.

---

## Phase 1 — Scan Backlog & Roadmap

1. Read `docs/backlog/MOC.md` to get the phase roadmap summary and active phase pointer.

2. For each phase directory in `docs/backlog/`:
   - Inspect the sub-phase backlog markdown files.
   - Count completed `[x]` vs unresolved `[ ]` tasks.
   - Note the status (Completed, In Progress, Planned).

---

## Phase 2 — Identify Active Phase

3. The **ACTIVE phase** is the first phase where unresolved tasks remain.

4. Within the active phase, group all remaining `[ ]` tasks by:
   - **Backend & Database**: migrations, RLS policies, RPC functions, Supabase types
   - **Routes & Middleware**: route modules in `{{APP_PATH}}/app/routes/`, loaders, actions, middleware
   - **UI & Components**: layout zones, shadcn components, responsive forms
   - **Background Jobs & Storage**: Cloudflare scheduled workers, R2 storage routes

---

## Phase 3 — Cross-Check Codebase (Active Phase Only)

5. For each deliverable in the active backlog, verify whether code exists on disk:
   - **Routes**: check `{{APP_PATH}}/app/routes/` and entries in `{{APP_PATH}}/app/routes.ts`
   - **Middleware**: check `{{APP_PATH}}/app/middleware/`
   - **Supabase**: check `{{APP_PATH}}/app/lib/supabase/` and `{{APP_PATH}}/supabase/migrations/`
   - **Workers**: check `{{APP_PATH}}/workers/app.ts` and `{{APP_PATH}}/wrangler.jsonc`

6. Identify confirmed gaps (planned tasks missing implementation) and undocumented code (code added without backlog tracking).

---

## Phase 4 — Generate Status Report Artifact

7. Create a **status_report.md artifact** with:
   - Phase overview table with progress percentages
   - Active phase deep-dive
   - Confirmed gaps and recommended next immediate task
   - Overall health summary (typecheck & test status)

---

## Phase 5 — Loop Health Dashboard (CAC)

8. Run the loop-health dashboard (task 5.4):

   ```sh
   node core/scripts/status-dashboard.js
   ```

9. Include the rendered report verbatim in the status artifact. It shows:
   - **Cost per Accepted Change** (headline metric) per loop / archetype / ISO week
   - **First-pass success rate** and **token burn rate** (Osmani 05)
   - **Terminal-state histogram** across all five named states + `error`
   - **Oversight modes** (A8) and ladder level per loop

10. Flag as unhealthy: any loop whose CAC renders `null (burn without output)`, any `stalled`/`exhausted` streak, and any first-pass rate below 50%.

---

## Post-Audit Recommendation

Suggest the exact slash command to run next (e.g. `/new-feature` to implement the top active task).

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js status --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
