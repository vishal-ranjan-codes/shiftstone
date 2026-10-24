---
title: "Backlog Map of Content"
status: "active"
type: "overview"
tags: ["backlog", "moc", "roadmap"]
lastUpdated: "2026-09-05"
component: "core"
---

# Backlog Map of Content (MOC)

This Map of Content serves as the single source of truth for the {{PROJECT_NAME}} roadmap and task hierarchy. Tasks are broken down into granular, small-scoped files to prevent AI context overload.

> [!NOTE]
> **AI-First Integration**: You can manage this backlog entirely through the AI chat using natural language. See the **[[HOW-TO-USE|AI-First Backlog Guide]]** for commands and developer workflows.

---

## Active Phase: Phase 1 — Foundation & Auth Setup 🚀
*Current Focus: Project configuration, Supabase SSR middleware, Database modeling/RLS, and Route Guards.*

| Phase | Sub-Phase Backlog File | Unresolved Tasks | Status |
|---|---|---|---|
| **Phase 1.1** | [[Phase 1 - Foundation & Auth Setup/1.1-workspace-setup\|1.1 Workspace Setup]] | 0 | ✅ Completed |
| **Phase 1.2** | [[Phase 1 - Foundation & Auth Setup/1.2-supabase-database\|1.2 Supabase Database]] | 3 | 📋 Planned |
| **Phase 1.3** | [[Phase 1 - Foundation & Auth Setup/1.3-supabase-auth-middleware\|1.3 Supabase Auth & Middleware]] | 3 | 📋 Planned |
| **Phase 1.4** | [[Phase 1 - Foundation & Auth Setup/1.4-route-guards-and-layouts\|1.4 Route Guards & Layouts]] | 3 | 📋 Planned |

---

## Future Roadmap 📂

### Phase 2: Core SaaS Features
*Route loaders, actions, RPC layers, Billing, and shared UI components.*
- [[Phase 2 - Core SaaS Features/2.1-domain-actions-loaders\|2.1 Domain Actions & Loaders]] 📁 *Planned*
- [[Phase 2 - Core SaaS Features/2.2-ui-components-themes\|2.2 UI Components & Themes]] 📁 *Planned*
- [[Phase 2 - Core SaaS Features/2.3-billing\|2.3 Billing & Subscriptions]] 📁 *Planned*

### Phase 3: Storage & Background Jobs
*Cloudflare R2 object storage, presigned upload/download URLs, and Cloudflare Cron Triggers.*
- [[Phase 3 - Storage & Background Jobs/3.1-r2-storage\|3.1 Cloudflare R2 Storage]] 📁 *Planned*
- [[Phase 3 - Storage & Background Jobs/3.2-cloudflare-cron-triggers\|3.2 Cloudflare Cron Triggers]] 📁 *Planned*

### Phase 4: Testing & Telemetry
*Vitest unit tests, Playwright E2E tests, Cloudflare Workers observability, and error logging.*
- [[Phase 4 - Testing & Telemetry/4.1-vitest-playwright\|4.1 Vitest & Playwright]] 📁 *Planned*
- [[Phase 4 - Testing & Telemetry/4.2-cloudflare-observability\|4.2 Observability & Telemetry]] 📁 *Planned*

### Phase 5: Launch & Polish
*SEO optimizations, responsive screen audits, design reviews, and Cloudflare production deploy.*
- [[Phase 5 - Launch & Polish/5.1-seo-metadata\|5.1 SEO & Metadata]] 📁 *Planned*
- [[Phase 5 - Launch & Polish/5.2-cloudflare-production-deploy\|5.2 Cloudflare Production Deployment]] 📁 *Planned*

---

## How to Work with this Backlog

### Adding Tasks & Ideas
- Format: `- [ ] **[Priority]** Task Description` (where Priority is `[P1]`, `[P2]`, or `[P3]`).

### Closing Tasks (loop-driven, task 6.4)
- `[ ]` → `[/]` when work starts (no ceremony).
- `[/]` → `[x]` **only** after `/ss-verify <task-id>` returns a Checker verdict ≥ 0.8, with the
  signature appended: `- [x] <task> — verified by <model-family> @ <score> (<date>)`.
- Unsigned closures fail `node .shiftstone/scripts/check-backlog-signoff.js --strict` in CI.

### AI Auto-Maintenance & Splitting Rules
- **Threshold limit**: No active backlog file should exceed **12 unresolved tasks**.
- If a backlog exceeds this limit, run `/ss-backlog-sync` to split into child sub-phases.
