---
type: chapter
timestamp: 2026-09-05T14:49:52.140Z
---
# 03 — Database Migrations and Seeding

## Migration Management

Database schema changes are tracked using standard Supabase CLI migration scripts located in `{{APP_PATH}}/supabase/migrations/`.

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
{{SUPABASE_TYPES_CMD}}
```
This updates `{{APP_PATH}}/app/types/database.types.ts`.

---

## Seeding

Local development data is seeded via `{{APP_PATH}}/supabase/seed.sql`:
```bash
npx supabase db reset
```
This resets the local database, applies all migrations in order, and seeds initial data.
