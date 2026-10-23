
# Cloudflare Workers Edge Runtime Skill

> Load this skill when configuring Wrangler, managing edge environment variables, handling worker fetch events, or debugging edge execution limits.

---

## 1. Edge Runtime Architecture

{{PROJECT_NAME}} runs inside Cloudflare Workers using the V8 isolate model:
- **No Node.js OS Access**: Filesystem (`fs`), child processes, and native binary bindings are not available at runtime.
- **Node.js Compatibility**: Enabled via `"compatibility_flags": ["nodejs_compat"]` in `wrangler.jsonc`, providing standard streams, crypto, and buffer APIs.
- **Local Emulation**: `@cloudflare/vite-plugin` runs `workerd` inside the Vite dev server, accurately simulating the production environment.

---

## 2. Configuration (`wrangler.jsonc`)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "{{PROJECT_NAME_LOWER}}",
  "main": "./workers/app.ts",
  "compatibility_date": "2026-07-02",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "assets": {
    "directory": "./build/client"
  },
  "triggers": {
    "crons": [
      "0 * * * *", // Hourly
      "0 0 * * *"  // Daily midnight
    ]
  }
}
```

---

## 3. Worker Entrypoint (`workers/app.ts`)

```typescript
import { createRequestHandler } from "react-router";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

interface CloudflareEnv {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
    return requestHandler(request);
  },

  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(handleCronJob(controller, env));
  },
} satisfies ExportedHandler<CloudflareEnv>;
```

---

## 4. Edge Performance Rules

1. **Strict Memory Limits (128MB)**:
   - Never load large files or multi-megabyte datasets entirely into memory (`await response.text()` or `await response.arrayBuffer()`).
   - Use web standard `ReadableStream` and pipe through transformers.
2. **Global Variable Isolation**:
   - Variables declared in module scope persist across warm requests in the same isolate.
   - **NEVER** store user session data or request-specific context in global variables.
   - Initialize clients and configuration globally only if they are stateless and shared.
3. **CPU Execution Timeouts**:
   - Free tier: 50ms CPU time.
   - Paid Workers: Up to 30s.
   - Delegate long background tasks to `ctx.waitUntil(...)` or Cloudflare Queues.
