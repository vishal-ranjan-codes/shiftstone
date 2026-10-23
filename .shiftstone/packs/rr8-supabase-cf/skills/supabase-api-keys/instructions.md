
# Supabase 2025/2026 API Keys Standard Skill

> Load this skill when configuring Supabase credentials, handling environment variables, or creating clients.

---

## 1. The 2025/2026 Key Standard

Supabase has transitioned away from legacy JWT-based `anon` and `service_role` keys to a modern, opaque key format:

| Legacy Key | Modern Key | Format | Context | Privileges |
|---|---|---|---|---|
| `anon` | **Publishable Key** | `sb_publishable_...` | Browser & SSR | Respects RLS; public |
| `service_role` | **Secret Key** | `sb_secret_...` | Server / Workers ONLY | Bypasses RLS; strictly confidential |

---

## 2. Key Differences from Legacy JWTs

1. **Not JWTs**: Modern publishable and secret keys are NOT signed JWT tokens. They cannot be decoded as JWT payloads and cannot be passed in `Authorization: Bearer <key>`.
2. **Header Transmission**: Modern keys are sent in the `apikey` header:
   ```http
   apikey: sb_publishable_1234567890abcdef
   ```
3. **Browser Protection**: If a secret key (`sb_secret_...`) is used from a browser (detected via standard browser User-Agent headers), Supabase automatically rejects the request with `401 Unauthorized`.
4. **Deprecation Timeline**: Legacy JWT `anon` and `service_role` keys are scheduled for sunset by late 2026. All new projects must adopt `sb_publishable_` and `sb_secret_`.

---

## 3. Environment Variable Naming

```bash
# In .dev.vars (local) or Cloudflare Workers dashboard (production)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."
```

*(Note: For backward compatibility with older libraries, `SUPABASE_SERVICE_ROLE_KEY` is treated as an alias for `SUPABASE_SECRET_KEY`).*

---

## 4. Client Usage Patterns

### In Browser & SSR:
Always use `SUPABASE_PUBLISHABLE_KEY`:
```typescript
import { createServerClient } from "@supabase/ssr";

const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  cookies: { ... }
});
```

### In Server Admin / Background Workers:
Only use `SUPABASE_SECRET_KEY` in secure edge workers or admin endpoints:
```typescript
import { createClient } from "@supabase/supabase-js";

// ⚠️ Never bundle this in client-side code!
const adminSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

---

## 5. Security Rules

- **NEVER** expose `SUPABASE_SECRET_KEY` in `window.env` or send it to the browser.
- **NEVER** commit live keys to git repositories.
- Use `app/middleware/supabase.ts` graceful degradation so the application does not crash if keys are temporarily missing in preview environments.
