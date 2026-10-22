---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Schema reference, access policies, and migration flows
---
# 03 — Database Schema Reference

This chapter is the SSOT for **the as-applied database schema**. The `/schema-sync` loop diffs code against this file, so every table that exists in the database must appear here and vice versa.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/03-database/` at init (schema reference, RLS policies, migrations and seeding).

## Primary Data Models

Document every table: purpose, columns with types and constraints, foreign keys, indexes, and the invariants the application relies on. Use one H3 per table.

### `<table>` (template)

- **Purpose**: what this table stores and who writes it.
- **Columns**: `id`, timestamps, tenant/owner key, payload columns.
- **Constraints**: primary key, unique keys, foreign keys, check constraints.
- **Indexes**: every index, with the query it serves.

## Schema Modification Guidelines

1. Every table has a UUID (or equivalent opaque) primary key and created/updated timestamps.
2. Schema changes ship as forward-only migration files with a sortable timestamp prefix — never hand-edited production state.
3. New tables ship with access control enabled from day one (see the RLS/access-policy chapter section).
4. Regenerate the application's typed schema bindings after every migration, using the project's documented type-generation command.
