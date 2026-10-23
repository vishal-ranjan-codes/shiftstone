
# Cloudflare KV Storage Skill

> Load this skill when implementing edge caching, fast key-value lookups, rate limiting counters, or transient session data.

---

## 1. KV Overview

Cloudflare Workers KV is a global, low-latency, eventually consistent key-value data store.

### When to Use KV:
- Caching slow Supabase query responses (read-heavy, infrequent writes).
- Edge rate-limit counters and sliding window state.
- Feature flag toggles.
- API response caching with TTL.

---

## 2. Configuration (`wrangler.jsonc`)

Add the KV namespace binding in `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "CACHE_KV",
      "id": "your-kv-namespace-id",
      "preview_id": "your-preview-kv-namespace-id"
    }
  ]
}
```

---

## 3. Usage Pattern in Route Loaders / Middleware

Access the bound KV namespace via `context.cloudflare.env`:

```typescript
import type { Route } from "./+types/catalog";

export async function loader({ context }: Route.LoaderArgs) {
  const kv = context.cloudflare.env.CACHE_KV;
  const cacheKey = "catalog:featured-items";

  // 1. Check Edge Cache
  if (kv) {
    const cached = await kv.get(cacheKey, "json");
    if (cached) {
      return { items: cached, source: "kv-cache" };
    }
  }

  // 2. Query Database on Cache Miss
  const supabase = context.get(supabaseContext);
  const { data: items } = await supabase.from("items").select("*").eq("featured", true);

  // 3. Write to KV with 5-minute TTL (300 seconds)
  if (kv && items) {
    await kv.put(cacheKey, JSON.stringify(items), { expirationTtl: 300 });
  }

  return { items: items ?? [], source: "database" };
}
```

---

## 4. Best Practices & Rules

- **Eventually Consistent**: Changes written to KV may take up to 60 seconds to propagate globally. Do not use KV for transactional financial records or immediate-read-after-write operations.
- **Minimum TTL**: The minimum `expirationTtl` supported by Cloudflare KV is 60 seconds.
- **Key Length & Value Limits**: Keys up to 512 bytes; values up to 25MB.
