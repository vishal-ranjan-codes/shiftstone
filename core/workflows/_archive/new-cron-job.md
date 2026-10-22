---
cost_tracking: workflow-end
description: Background/cron job creation workflow — design, implement, secure, register, and document a scheduled task.
---

# /new-cron-job — Background Job Workflow

> Use this workflow when adding a new scheduled or cron-driven background task.
> All jobs must be idempotent, concurrency-safe, and documented after creation.

---

## Phase 1 — Design

1. Load `.agents/skills/jobs/SKILL.md` if present — otherwise consult `docs/bible/01-architecture/` for the existing background-job patterns.

2. Read `{{BIBLE_PATH}}/01-architecture/architecture-overview.md` for existing workers and schedules.

3. Create a **cron_job_design.md artifact** containing:
   - **Name**: `snake_case` job name (e.g. `process_expired_tokens`)
   - **Schedule**: Cron expression (e.g. `0 * * * *`)
   - **Purpose**: What does this job do?
   - **Idempotency strategy**: How is it safe to run multiple times without duplicating effects?
   - **Concurrency lock**: e.g. a database advisory lock (`SELECT pg_advisory_xact_lock(...)`) or the platform's equivalent
   - **Worker location**: the pack-provided scheduler/worker location (see the active pack's scaffold and bible `01-architecture/`)

4. **⛔ STOP — Get explicit user approval on the cron_job_design.md artifact before implementing.**

---

## Phase 2 — Implement

5. Register the cron schedule in the pack's scheduler configuration (the runtime config file the active pack ships, e.g. a `crons` trigger array):
   ```text
   0 * * * *
   0 0 * * *
   ```

6. Implement the job handler in the pack-provided worker/scheduler entry, dispatching on the cron expression:
   ```typescript
   async function handleScheduledJob(schedule: string, context: JobContext) {
     switch (schedule) {
       case "0 * * * *":
         await processHourlyTasks(context);
         break;
       case "0 0 * * *":
         await processDailyTasks(context);
         break;
     }
   }
   ```

7. Use the workspace's admin/service data client to run database updates or RPCs with transactional safety.

---

## Phase 3 — Verify

8. Verify the worker/job compiles and builds:
   ```bash
   {{PACKAGE_MANAGER}} build
   ```

9. Test scheduled execution locally using the pack's documented local test command (see `docs/bible/02-setup-and-devops/`).

---

## Phase 4 — Document

10. Update `{{BIBLE_PATH}}/01-architecture/architecture-overview.md` with the new scheduled job entry.

11. Append to `{{BIBLE_PATH}}/CHANGELOG.md`.

---

## Post-Write Checkpoint

- [ ] Cron schedule registered in the pack's scheduler configuration
- [ ] Job handler implemented with idempotency guard in the pack's worker location
- [ ] Build passes with 0 errors
- [ ] `{{BIBLE_PATH}}/01-architecture/architecture-overview.md` updated
- [ ] `{{BIBLE_PATH}}/CHANGELOG.md` updated

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js new-cron-job --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
