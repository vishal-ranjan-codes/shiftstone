---
cost_tracking: workflow-end
description: Cloudflare Scheduled Worker creation workflow — design, implement, secure, register, and document a background cron task.
---

# /new-cron-job — Background Job Workflow

> Use this workflow when adding a new Cloudflare Scheduled Worker or cron task.
> All jobs must be idempotent, concurrency-safe, and documented after creation.

---

## Phase 1 — Design

1. Load `.agents/skills/jobs/SKILL.md` — understand the existing architecture and patterns.

2. Read `{{BIBLE_PATH}}/01-architecture/architecture-overview.md` for existing workers and schedules.

3. Create a **cron_job_design.md artifact** containing:
   - **Name**: `snake_case` job name (e.g. `process_expired_tokens`)
   - **Schedule**: Cron expression (e.g. `0 * * * *`)
   - **Purpose**: What does this job do?
   - **Idempotency strategy**: How is it safe to run multiple times without duplicating effects?
   - **Concurrency lock**: PostgreSQL advisory lock (`SELECT pg_advisory_xact_lock(...)`)
   - **Worker location**: Function in `{{APP_PATH}}/workers/app.ts` or imported domain job helper

4. **⛔ STOP — Get explicit user approval on the cron_job_design.md artifact before implementing.**

---

## Phase 2 — Implement

5. Register the cron trigger schedule in `{{APP_PATH}}/wrangler.jsonc`:
   ```jsonc
   "triggers": {
     "crons": [
       "0 * * * *",
       "0 0 * * *"
     ]
   }
   ```

6. Implement the job handler in `{{APP_PATH}}/workers/app.ts` inside the `scheduled()` hook:
   ```typescript
   async function handleCronJob(controller: ScheduledController, env: CloudflareEnv) {
     switch (controller.cron) {
       case "0 * * * *":
         await processHourlyTasks(env);
         break;
       case "0 0 * * *":
         await processDailyTasks(env);
         break;
     }
   }
   ```

7. Use the admin client (`createAdminClient`) to run database updates or RPCs with transactional safety.

---

## Phase 3 — Verify

8. Verify Cloudflare Worker compilation:
   ```bash
   {{PACKAGE_MANAGER}} build
   ```

9. Test scheduled execution locally using Wrangler:
   ```bash
   npx wrangler dev --test-scheduled
   ```

---

## Phase 4 — Document

10. Update `{{BIBLE_PATH}}/01-architecture/architecture-overview.md` with the new scheduled job entry.

11. Append to `{{BIBLE_PATH}}/CHANGELOG.md`.

---

## Post-Write Checkpoint

- [ ] Cron schedule added to `{{APP_PATH}}/wrangler.jsonc`
- [ ] Job handler implemented with idempotency guard in `{{APP_PATH}}/workers/app.ts`
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
