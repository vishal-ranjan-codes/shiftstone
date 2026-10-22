
# Cloudflare D1 Serverless SQL Skill

> Load this skill when integrating Cloudflare D1 edge database alongside Supabase for ultra-low-latency edge caching or local edge storage.

---

## 1. D1 Overview

Cloudflare D1 is a serverless relational SQLite database running on the Cloudflare edge network with automatic read replication.

### Integration with Supabase:
- **Supabase**: Primary Source of Truth (PostgreSQL, Auth, RLS, Realtime).
- **D1**: Edge read replica / cache for high-frequency low-latency queries (e.g. edge geolocations, token lookups, redirect tables).

---

## 2. Configuration (`wrangler.jsonc`)

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "edge_cache_db",
      "database_id": "your-d1-database-id"
    }
  ]
}
```

---

## 3. Querying D1 via Prepared Statements

```typescript
export async function getCachedToken(db: D1Database, tokenHash: string) {
  const result = await db
    .prepare("SELECT user_id, expires_at FROM token_cache WHERE hash = ?1")
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  return result;
}
```

---

## 4. Best Practices & Rules

- **Always use Prepared Statements**: Bind parameters using `.bind(...)` to avoid SQL injection vulnerabilities.
- **Batching**: Use `db.batch([stmt1, stmt2])` to execute multiple queries in a single network round-trip.
