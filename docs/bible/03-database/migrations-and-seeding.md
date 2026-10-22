---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
---
# 03 — Database Migrations and Seeding

This chapter is the SSOT for **how schema changes and seed data travel** from a developer's machine to production.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/03-database/migrations-and-seeding.md` at init.

## Migration Management

- **File naming**: sortable timestamp prefix plus a descriptive slug (e.g. `YYYYMMDDHHMMSS_description.sql`) so chronological order is the file order.
- **Applying migrations**: the exact command that pushes local migrations to a target environment, and which environment each command touches.
- **Type regeneration**: after every applied migration, regenerate the application's typed schema bindings with the project's documented command.

## Seeding

Document the command that resets a local database to schema + seed data, what the seed data contains, and the rule that **production is never seeded** with development fixtures.
