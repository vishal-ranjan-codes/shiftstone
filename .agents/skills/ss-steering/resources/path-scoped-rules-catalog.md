# Path-Scoped Rules Catalog

Path-scoped rules live in `.shiftstone/path-scoped-rules/*.md`. They inject localized guidelines dynamically based on modified file paths.

---

## 1. app-rules.md (`paths: apps/web/**`)

```markdown
---
type: path-scoped-rule
paths:
  - "apps/web/**"
---

# Web Application & Frontend Architecture Rules

- Framework: React Router 8 with Server-Side Rendering (SSR).
- Styling: Tailwind CSS v4 using semantic design tokens defined in docs/bible/07-frontend/design-tokens.md.
- Forms & Mutations: All state mutations must use typed actions and Zod validation schemas.
- Client Boundaries: Isolate client-only interactive components with explicit directives.
```

---

## 2. database-rules.md (`paths: supabase/migrations/**`)

```markdown
---
type: path-scoped-rule
paths:
  - "supabase/migrations/**"
  - "docs/bible/03-database/**"
---

# Database, RLS & Migration Invariants

- Schema Migrations: Numbered sequentially with timestamps (YYYYMMDDHHMMSS_name.sql).
- Row-Level Security: Mandatory on every public table. Always test with both authenticated and anon roles.
- Typegen: Execute `pnpm run supabase:types` immediately following schema modifications.
```

---

## 3. worker-rules.md (`paths: workers/**`)

```markdown
---
type: path-scoped-rule
paths:
  - "workers/**"
  - "wrangler.jsonc"
---

# Cloudflare Edge Workers & Scheduled Jobs Rules

- Runtime: WinterCG edge environment compliant. Use Web Crypto (`crypto.subtle`) exclusively.
- Cron Jobs: Idempotent execution using database advisory locks or KV deduplication.
- Queues & Retries: Exponential backoff with dead-letter queue routing on repeated failures.
```
