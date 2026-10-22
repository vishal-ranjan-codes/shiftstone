
# Supabase Migrations Skill

> Load this skill when creating database migrations, seeding tables, running CLI commands, or syncing schema definitions.

---

## 1. Migration File Structure

Supabase migrations live in `supabase/migrations/<timestamp>_<migration_name>.sql`.

### Naming Convention
- Timestamp prefix: `YYYYMMDDHHMMSS` (e.g. `20260906120000_create_items_table.sql`).
- Descriptive snake_case action name: `create_items_table`, `add_status_to_orders`, `update_profiles_rls`.

---

## 2. Supabase CLI Workflow

### A. Create a New Migration File
```bash
npx supabase migration new create_items_table
```
This creates a blank SQL file in `supabase/migrations/`.

### B. Run Migrations Locally
```bash
npx supabase db reset
# Or push pending migrations:
npx supabase migration up
```

### C. Push Migrations to Remote / Staging
```bash
npx supabase db push
```

### D. Generate TypeScript Types
Whenever the schema changes, update TypeScript types immediately:
```bash
# In monorepo:
pnpm supabase:types
# Which executes:
# npx supabase gen types typescript local > app/types/database.types.ts
```

---

## 3. Database Seeding (`supabase/seed.sql`)

Provide reproducible test data in `supabase/seed.sql`:

```sql
-- Clean previous test data
TRUNCATE public.items CASCADE;

-- Insert test profiles (assuming auth users exist)
INSERT INTO public.items (id, name, description, price, user_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Test Item 1', 'Description for item 1', 29.99, '00000000-0000-0000-0000-000000000000'),
  ('a0000000-0000-0000-0000-000000000002', 'Test Item 2', 'Description for item 2', 49.99, '00000000-0000-0000-0000-000000000000');
```

---

## 4. Migration Plan Checklist

Before applying any migration, verify:
- [ ] Are primary keys `UUID PRIMARY KEY DEFAULT gen_random_uuid()`?
- [ ] Are `created_at` and `updated_at` timestamps included?
- [ ] Is RLS enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`?
- [ ] Are SELECT, INSERT, UPDATE, DELETE policies defined?
- [ ] Are foreign keys indexed?
- [ ] Are TypeScript types regenerated (`pnpm supabase:types`)?
- [ ] Is `docs/bible/03-database/schema-reference.md` updated with the new table definitions?
