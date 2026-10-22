
# Cloudflare Scheduled Workers (Cron) Skill

> Load this skill when adding background tasks, recurring cron jobs, data cleanup routines, or syncing tasks.

---

## 1. Registration in `wrangler.jsonc`

Configure schedules inside `triggers.crons` in `{{APP_PATH}}/wrangler.jsonc`:

```jsonc
{
  "triggers": {
    "crons": [
      "0 * * * *",      // Hourly at minute 0
      "0 0 * * *",      // Daily at midnight UTC
      "*/15 * * * *"    // Every 15 minutes
    ]
  }
}
```

---

## 2. Handler Implementation (`workers/app.ts`)

Implement the `scheduled` hook in the default exported object:

```typescript
export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return requestHandler(request);
  },

  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    console.log(`[Cron Trigger] Cron: ${controller.cron}, ScheduledTime: ${controller.scheduledTime}`);
    // Run asynchronously without blocking edge return
    ctx.waitUntil(handleCronJob(controller, env));
  },
} satisfies ExportedHandler<CloudflareEnv>;

async function handleCronJob(controller: ScheduledController, env: CloudflareEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    console.warn("[Cron] Supabase credentials not configured, skipping job.");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  switch (controller.cron) {
    case "0 * * * *":
      await runHourlySync(supabase);
      break;
    case "0 0 * * *":
      await runDailyCleanup(supabase);
      break;
    default:
      console.log(`Unhandled cron schedule: ${controller.cron}`);
  }
}
```

---

## 3. Idempotency & Database Advisory Locking

When multiple edge workers trigger simultaneously, use PostgreSQL advisory transaction locks to ensure single-instance execution:

```typescript
async function runHourlySync(supabase: any) {
  // Try to acquire lock
  const { data: lockAcquired } = await supabase.rpc("acquire_cron_lock", {
    job_name: "hourly_sync_items",
  });

  if (!lockAcquired) {
    console.log("[Cron] Another worker holds the lock. Exiting gracefully.");
    return;
  }

  try {
    // Perform idempotent sync operations in batches
    console.log("[Cron] Executing hourly sync...");
  } catch (err) {
    console.error("[Cron] Error during hourly sync:", err);
  }
}
```

---

## 4. Best Practices & Rules

- **ALWAYS use `ctx.waitUntil(...)`**: This ensures the Worker remains alive until asynchronous background promises settle.
- **Process in Batches**: Never query 50,000 rows at once in a Worker; process in chunks of 100 to 500 records using pagination.
- **Graceful Failure**: Catch exceptions inside `handleCronJob` so Worker runtime does not report unhandled rejections to Cloudflare telemetry.
