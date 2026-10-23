---
cost_tracking: workflow-end
description: Database Schema Verification — ensure bible docs, migration files, and generated types are perfectly aligned.
---

# /schema-sync — Database Schema Verification

> Run after adding a new migration or when you suspect database drift.

---

## Phase 1 — Read Bible Documentation

1. Read `{{BIBLE_PATH}}/03-database/schema-reference.md`.
2. Extract all documented table names, column names, constraints, and data types to understand the *intended* schema.

---

## Phase 2 — Analyze Applied Migrations

3. Scan `{{APP_PATH}}/supabase/migrations/` in chronological order.
4. Traced `CREATE TABLE`, `ALTER TABLE`, `ADD COLUMN`, and `DROP` statements across the migration files to build the current "as-applied" schema.

---

## Phase 3 — Verify Generated Types

5. Read `{{APP_PATH}}/app/types/database.types.ts`.
6. Verify that the generated Supabase types match the "as-applied" schema from Phase 2.

---

## Phase 4 — Create Schema Sync Report Artifact

7. Create a **sync receipt** at `docs/reports/sync/<ISO-8601>-schema-sync.md` (blueprint §10.16) with a 3-way comparison table and actionable fixes.

### Report Format

```markdown
# Schema Sync Report — [Date]

## 3-Way Alignment Check

| Table / Entity | Bible Doc | Migrations | Types (`database.types.ts`) | Status |
|---|---|---|---|---|
| `profiles` | ✅ Documented | ✅ Exists | ✅ Generated | 🟢 Aligned |
| `items` | ❌ Missing | ✅ Exists | ✅ Generated | 🔴 Doc Outdated |
| `items.status` | ✅ `text` | ✅ `text` | ❌ Outdated | 🔴 Types Outdated |
| `invoices` | ✅ Documented | ❌ Missing | ❌ Missing | 🔴 Migration Missing |

## Actionable Fixes

### 1. Missing Migrations Detected
- Draft the SQL using the `/new-migration` workflow.

### 2. Outdated Types Detected
- Run: `{{SUPABASE_TYPES_CMD}}`

### 3. Outdated Documentation Detected
- Update `{{BIBLE_PATH}}/03-database/schema-reference.md`.
```

---

## Phase 5 — Offer to Apply Fixes

8. Ask the user: "Ready to apply the fixes? Let me know which ones to perform."
   - If User says "update docs" → Update `{{BIBLE_PATH}}/03-database/schema-reference.md`.
   - If User says "draft missing migrations" → transition to `/new-migration`.

---

## Post-Write Checkpoint

- [ ] All three sources checked: `schema-reference.md`, migration files, and `database.types.ts`
- [ ] Sync receipt created at `docs/reports/sync/<ISO-8601>-schema-sync.md` with 3-way alignment table
- [ ] Every misaligned row has a specific actionable fix listed

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js schema-sync --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
