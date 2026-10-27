---
type: chapter-topic
title: "Runtime Topology & Monorepo Layout"
chapter: "01-architecture"
file: "topology.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Edge-native runtime topology, Cloudflare Workers, Supabase client/server distribution, and dual-repo monorepo layout."
---

# Architecture — Runtime Topology & Monorepo Layout

## 1. Runtime Topology

The application is architected around **React Router 8** in framework mode running natively on the **Cloudflare Workers** edge runtime (V8 isolates) paired with **Supabase** and **Cloudflare R2**:

```
Browser (Hydrated React 19 SPA)
         │
         ▼
Cloudflare Workers Edge Runtime
(React Router 8 Server Build via virtual:react-router/server-build)
         │
         ├─► 1. React Router Middleware Pipeline (Hierarchical Policy Tree)
         │       ├─► Root: supabaseMiddleware (local getClaims() JWKS check, cookie refresh)
         │       ├─► Guard: authMiddleware (redirect to /sign-in if unauthenticated)
         │       └─► RBAC: adminMiddleware (silent redirect if profiles.role !== 'admin')
         │
         ├─► 2. Route Loaders & Actions
         │       ├─► Receives context.get(supabaseContext) and context.get(userContext)
         │       ├─► Zod payload validation on all mutations
         │       └─► Standardized ActionResult<T> responses
         │
         ├─► 3. Database Layer (Supabase PostgreSQL)
         │       ├─► 2025/2026 API Keys Standard (sb_publishable_..., sb_secret_...)
         │       ├─► Strict Row-Level Security (RLS) on all tables
         │       └─► Realtime subscriptions via WebSockets
         │
         └─► 4. Cloudflare Platform Bindings
                 ├─► R2 Object Storage via AWS SDK S3 client (Zero Egress Fees)
                 ├─► KV Storage (Edge Caching & Rate Limiting)
                 ├─► Cron Triggers (Scheduled background jobs in workers/app.ts)
                 └─► Queues (Asynchronous message processing)
```

## 2. Dual-Repo Monorepo Layout

The repository operates as a **Dual-Repo Monorepo**:
- **Root Workspace Git Repository (`.`)**: Tracks all architecture documentation (`docs/bible/`), task backlogs (`docs/backlog/`), AI rules (`.agent/`, `.claude/`), and workspace specialist skills (`.agents/skills/`). Root `.gitignore` explicitly ignores `/apps/web/`.
- **Nested Web App Git Repository (`apps/web/`)**: Operates as an independent Git repository tracking the full-stack React Router 8 application (`app/`, `workers/`, `wrangler.jsonc`, `package.json`).
- **Unified Local Tooling**: `pnpm-workspace.yaml` enables local script orchestration (`pnpm dev`, `pnpm build`, `pnpm test`) across both repositories seamlessly.
- **On-Demand Publishing**: Both repositories are staged locally during initialization (zero network pushes), and published to GitHub on explicit developer command via `/push`.
