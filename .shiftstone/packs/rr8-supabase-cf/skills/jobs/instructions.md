
# Cloudflare Scheduled Workers & Cron Jobs Skill

> Load this skill when designing, implementing, or debugging background tasks and scheduled workers in {{PROJECT_NAME}}.

---

## 1. Cloudflare Scheduled Architecture

In {{PROJECT_NAME}}, background jobs execute as **Cloudflare Scheduled Workers**:

```
Cloudflare Cron Triggers (wrangler.jsonc)
             │
             ▼
      workers/app.ts
             │
             ├─► scheduled(controller, env, ctx)
             │       │
             │       ├─► ctx.waitUntil(handleCronJob(...))
             │       │
             │       ├─► Hourly Tasks (e.g. 0 * * * *)
             │       └─► Daily Tasks (e.g. 0 0 * * *)
             │
             ▼
Supabase Database (PostgreSQL via Admin Client)
             │
             └─► Advisory Lock (Concurrency Guard)
```

---

## 2. Configuration (`wrangler.jsonc`)

Register cron schedules inside `{{APP_PATH}}/wrangler.jsonc`:

```jsonc
{
  "triggers": {
    "crons": [
      "0 * * * *",   // Every hour
      "0 0 * * *"    // Daily at midnight UTC
    ]
  }
}
```

---

## 3. Worker Implementation (`workers/app.ts`)

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

export default {
  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(handleCronJob(controller, env));
  },
} satisfies ExportedHandler<CloudflareEnv>;

async function handleCronJob(controller: ScheduledController, env: CloudflareEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.log("[Cron] Supabase credentials not configured, skipping");
    return;
  }

  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (controller.cron) {
      case "0 * * * *":
        await processHourlyTasks(supabase);
        break;
      case "0 0 * * *":
        await processDailyTasks(supabase);
        break;
    }
  } catch (error) {
    console.error("[Cron] Execution error:", error);
  }
}
```

---

## 4. Idempotency & Concurrency Guards

All background workers MUST be safe to run multiple times without unintended side-effects:

1. **State Check**: Before modifying data, check if the task has already been processed (`status != 'processed'`).
2. **Database Advisory Lock**: For critical sections, acquire an advisory lock to prevent concurrent worker instances:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('job_' || job_id));
   ```
3. **Database Constraints**: Use unique constraints (e.g. `UNIQUE (resource_id, billing_period)`) to prevent duplicate records.

---

## 5. Local Testing

Test scheduled triggers locally without waiting for the clock:
```bash
npx wrangler dev --test-scheduled
```
Then trigger the schedule via HTTP curl:
```bash
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```
