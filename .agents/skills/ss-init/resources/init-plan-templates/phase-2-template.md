---
type: plan
title: Phase 2 — Application Domain Scaffolding & Living Brand Sync
status: planned
timestamp: {{TIMESTAMP}}
version: 1.0.0
owner: core
tags: [phase-2, app-scaffolding, sql-migrations, brand-theming, env-sync]
---

# Phase 2: Application Domain Scaffolding & Living Brand Sync

**Status:** `planned`  
**Depends on:** Phase 1 (`phase-1-product-prd-and-vision.md`)  
**Plan Units:** `U3`, `U4`, `U5`, `U6`  
**Acceptance Criteria:** `AC-U3-01`, `AC-U4-01`, `AC-U5-01`, `AC-U6-01`  

---

## 1. Objective & Scope

Materializes domain application scaffolding inside `apps/web/`. Synchronizes active brand OKLCH tokens into `apps/web/app/globals.css`, writes the initial PostgreSQL schema migration with full Row Level Security (RLS), generates TypeScript types, and synchronizes researched environment variables and package dependencies.

---

## 2. Inputs & Context Dependencies

| Input Path | Role / Requirement |
|---|---|
| `docs/plans/workspace-initialization/CONTEXT.md` | Provides brand tokens, entities, and researched service keys. |
| `docs/brand/brand-tokens.json` | Design tokens for theme variable injection. |
| `.shiftstone/init/app-scaffolder.js` | Scaffolding engine for migrations, types, env, and packages. |

### Active Brand Palette Tokens
- **Primary (Light):** `{{COLOR_PRIMARY}}`
- **Primary (Dark):** `{{COLOR_PRIMARY_DARK}}`
- **Surface (Light):** `{{COLOR_SURFACE_LIGHT}}`
- **Surface (Dark):** `{{COLOR_SURFACE_DARK}}`
- **Accent:** `{{COLOR_ACCENT}}`

---

## 3. Plan Units

### Unit `U3` — Starter Template Ingestion
- **Layer:** core
- **Target Files:**
  - `apps/web/package.json`
- **Mechanics:** Ingests the full-stack starter template cleanly into `apps/web/`.
- **Acceptance Criteria:** `AC-U3-01`: Starter files land in `apps/web/` with valid directory structure.

---

### Unit `U4` — Application Stylesheet Synchronization (`globals.css`)
- **Layer:** core
- **Target Files:**
  - `apps/web/app/globals.css`
- **Mechanics:** Injects `@theme` and `:root` OKLCH variables and purges legacy defaults (`#1877F2`).
- **Acceptance Criteria:** `AC-U4-01`: `globals.css` contains active project brand tokens with dark-mode support.

---

### Unit `U5` — Initial SQL Schema Migration & Typegen
- **Layer:** core
- **Target Files:**
  - `apps/web/supabase/migrations/`
  - `apps/web/app/types/database.types.ts`
- **Mechanics:** Writes timestamped migration SQL with tables, indexes, and RLS policies; generates TypeScript types.
- **Acceptance Criteria:** `AC-U5-01`: Valid PostgreSQL DDL generated with RLS enabled on all tables.

---

### Unit `U6` — Environment Variable & Package SDK Synchronization
- **Layer:** core
- **Target Files:**
  - `apps/web/.env.example`
  - `apps/web/package.json`
- **Mechanics:** Injects required service keys and adds researched SDK packages.
- **Acceptance Criteria:** `AC-U6-01`: `.env.example` contains all baseline and research keys; packages added to dependencies.

---

## 4. Verification & Outputs

- **Verification Command:** `pnpm -C .shiftstone vitest run tests/init/app-scaffolder.test.ts`
- **Expected Artifacts:** Fully configured application directory in `apps/web/` with migrations, types, and theme tokens.
