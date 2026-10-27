---
type: chapter-topic
title: "Database Migrations & Seeding"
chapter: "03-database"
file: "migrations.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Supabase migration conventions, sequential timestamping, local database resets, and type regeneration."
---

# Database — Migrations & Seeding

## 1. Migration Management

Database schema changes are tracked using standard Supabase CLI migration scripts located in `apps/web/supabase/migrations/`.

### Migration File Naming
Timestamped format: `YYYYMMDDHHMMSS_description.sql`.
Example: `20260905120000_create_profiles_table.sql`.

### Applying Migrations
To push local migrations to your connected Supabase database:
```bash
npx supabase db push
```

### Type Regeneration
Whenever migrations are applied, regenerate TypeScript types immediately:
```bash
pnpm --filter @<project>/web supabase:types
```
This updates `apps/web/app/types/database.types.ts`.

---

## 2. Seeding Local Development

Local development data is seeded via `apps/web/supabase/seed.sql`:
```bash
npx supabase db reset
```
This resets the local database, applies all migrations in chronological order, and seeds test data.
