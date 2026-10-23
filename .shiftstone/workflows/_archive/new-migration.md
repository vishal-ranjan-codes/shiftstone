---
cost_tracking: workflow-end
description: Database schema migration workflow — read existing schema, write SQL, get user approval, deploy, update docs.
---

# /new-migration — Database Migration Workflow

> Use this workflow for ANY database schema change: new tables, new columns, modified RLS policies, new RPC functions.
> This workflow gates on user approval before touching the production database.

---

## Phase 1 — Research

1. Read `{{BIBLE_PATH}}/03-database/schema-reference.md` to understand existing schema and naming conventions.

2. Read `{{BIBLE_PATH}}/03-database/migrations-and-seeding.md` to understand:
   - Migration file naming convention
   - What migrations already exist
   - Seeding patterns needed

3. If this migration changes RLS policies: read `{{BIBLE_PATH}}/03-database/rls-policies.md`.

4. If this migration changes auth-related tables: read `{{BIBLE_PATH}}/04-auth-and-rbac/auth-overview.md`.

---

## Phase 2 — Write SQL

5. Create a **migration_plan.md artifact** containing:
   - **Purpose**: what this migration achieves
   - **Tables affected**: list of tables being created or modified
   - **Complete SQL**:
     - Table naming: `snake_case`, pluralized
     - Always add `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
     - Always add `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`
     - Always add RLS: `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`
     - Always define basic RLS policies after enabling RLS
     - RPC functions: named `[verb]_[noun]`, use `SECURITY DEFINER` with explicit `search_path`
   - **RLS policies being added** (summary)
   - **RPC functions being added or modified** (summary)

6. **⛔ STOP — Get explicit user approval on the migration_plan.md artifact before deploying.**

---

## Phase 3 — Deploy

7. Place the migration file in the pack's migrations directory with timestamp prefix:
   ```
   {{APP_PATH}}/migrations/YYYYMMDDHHMMSS_description.sql
   ```

8. Deploy the migration with the pack's migration command (see `docs/bible/03-database/migrations-and-seeding.md` for the exact command).

9. Regenerate generated database types if the stack provides a type-generation command (see the active pack's docs).

---

## Phase 4 — Document

10. Update `{{BIBLE_PATH}}/03-database/schema-reference.md` with new tables/columns.

11. Update `{{BIBLE_PATH}}/03-database/migrations-and-seeding.md` with new migration entry.

12. If RLS policies changed: update `{{BIBLE_PATH}}/03-database/rls-policies.md`.

13. Append to `{{BIBLE_PATH}}/CHANGELOG.md`.

---

## Post-Write Checkpoint

Before marking this workflow complete, verify each item:

- [ ] Migration SQL file exists in the pack's migrations directory with a timestamp prefix
- [ ] Migration command completed with no errors
- [ ] Generated database types regenerated (where the stack provides them)
- [ ] `{{BIBLE_PATH}}/03-database/schema-reference.md` updated with new tables/columns
- [ ] `{{BIBLE_PATH}}/CHANGELOG.md` has a new entry

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js new-migration --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
