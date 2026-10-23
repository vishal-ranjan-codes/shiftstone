# ss-new-migration — Database Migration & Schema Evolution Guide

Procedure for designing, staging, applying, and documenting database schema changes under Level 5 human governance.

---

## Iron Law

1. **Stage Contract in `docs/plans/` Required:** Every migration design MUST be written as a Tier 1 Stage Contract in `docs/plans/<migration-slug>/CONTEXT.md`. Never output to temporary IDE brain artifacts.
2. **Level 5 Protected Action Gate (UG-23, UG-24):** ⛔ STOP — Any destructive schema change (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`) or RLS mutation (`ALTER POLICY`, `DROP POLICY`, `DISABLE ROW LEVEL SECURITY`) is a Level 5 protected action. It strictly requires an active, non-expired human approval artifact in `.shiftstone/governance/approvals/APR-*.json`. Missing approval halts immediately in terminal state `blocked`.
3. **Mandatory Row-Level Security:** Every newly created table MUST enable RLS (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`) and define explicit tenant-scoped policies.
4. **Mandatory Bible & Type Regeneration:** Every applied migration MUST regenerate database TypeScript types and update `docs/bible/03-database/schema-reference.md`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll output a migration_plan.md artifact in chat."* | **Forbidden.** Brain/chat artifacts are ephemeral. Write the migration contract to `docs/plans/<migration-slug>/CONTEXT.md`. |
| *"I'll enable RLS later after creating the seed data."* | **Forbidden.** Unprotected tables create immediate security vulnerabilities. Enable RLS in the same migration. |
| *"I don't need to regenerate types for a small column rename."* | **Forbidden.** Type drift causes compile errors and runtime mismatches. Run typegen immediately. |
| *"A destructive drop can proceed with informal chat confirmation."* | **Forbidden (Level 5 Gate).** A formal `protected-action-approval/v1` artifact in `.shiftstone/governance/approvals/APR-*.json` is required. |

---

## Migration Lifecycle

### Phase 1: Research & Contract Authoring
1. Read `docs/bible/03-database/schema-reference.md` and `migrations-and-seeding.md`.
2. Write a Tier 1 Stage Contract in `docs/plans/<migration-slug>/CONTEXT.md`:
   - Purpose and affected tables.
   - Idempotent SQL statements (`IF NOT EXISTS`, UUID primary keys, timestamp audit columns).
   - Tenant isolation & RLS policies.
   - RPC functions (`SECURITY DEFINER` with explicit `search_path`).
3. If migration contains destructive statements or RLS policy changes, verify that an active approval exists in `.shiftstone/governance/approvals/APR-*.json`:
   ```bash
   node .shiftstone/scripts/validate-protected-actions.js
   ```
4. **⛔ STOP — If required approval is absent, halt immediately with terminal state `blocked`.**

### Phase 2: Execute Migration
5. Create timestamped migration file in the pack's migrations directory (e.g. `migrations/YYYYMMDDHHMMSS_<description>.sql`).
6. Apply migration using the pack migration command (e.g. `npm run db:migrate`).
7. Regenerate database types using the pack typegen command (e.g. `npm run db:types`).

### Phase 3: Document & Verify
8. Update `docs/bible/03-database/schema-reference.md` with new schema definitions.
9. Append change summary to `docs/bible/CHANGELOG.md`.
10. Run typecheck and tests to confirm zero regressions.

---

## Verification Ladder

- **L1 (Syntax):** SQL syntax valid; migration filename follows timestamp convention.
- **L2 (Typecheck):** Regenerated TypeScript types compile with 0 errors (`pnpm typecheck`).
- **L3 (RLS Verification):** Every new table has active RLS and verified policy coverage.
- **L4 (Bible Parity):** `docs/bible/03-database/schema-reference.md` matches active schema.
- **L5 (Level 5 Human Approval):** Human signs Stage Contract and provides `protected-action-approval/v1` for protected actions.

---

## Terminal States

- `success`: Migration applied, types regenerated, Bible documentation updated.
- `blocked`: Migration failed to apply, RLS policies missing, or missing/expired Level 5 human approval artifact (mechanical halt).
- `escalated`: Ambiguous data model requirement or architectural schema trade-off requiring human developer direction (judgment-based).
