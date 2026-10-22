---
type: chapter
timestamp: 2026-09-06T01:31:34.036Z
---
# 01 — Architecture Overview

## System Architecture

{{PROJECT_NAME}} is architected around **React Router 8** in framework mode running natively on the **Cloudflare Workers** edge runtime (V8 isolates) paired with **Supabase** and **Cloudflare R2**:

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

---

## Technical Stack Reference

| Layer | Technology | Specification / Version |
|---|---|---|
| Framework | React Router | 8.3+ (Framework mode with automatic typegen) |
| UI Library | React | 19.2+ (ESM-only) |
| Runtime | Cloudflare Workers | V8 Isolates (`nodejs_compat` enabled) |
| Database & Auth | Supabase | PostgreSQL 15+, `@supabase/ssr` 0.12+ |
| Styling | Tailwind CSS | v4 (`@theme` CSS-first, `@tailwindcss/vite`) |
| Component Primitives | shadcn/ui | New York style adapted with `~/` alias |
| Object Storage | Cloudflare R2 | S3-compatible API via `@aws-sdk/client-s3` |
| Build System | Vite | 8+ with `@cloudflare/vite-plugin` |
| Package Manager | {{PACKAGE_MANAGER}} | Monorepo workspaces (`onlyBuiltDependencies: ["esbuild", "workerd"]`) |

---

## Architectural Distinctions from Next.js

| Architectural Area | Next.js Architecture | React Router 8 + Cloudflare Architecture |
|---|---|---|
| Session Management | Global `proxy.ts` / Next middleware | Per-route `supabaseMiddleware` with automatic cookie serialization |
| Context Propagation | Server components / prop drilling | Type-safe `createContext` from `react-router` |
| Route Declarations | File-system based `app/` conventions | Explicit configuration in `app/routes.ts` (`index`, `route`, `layout`, `prefix`) |
| Typing | Next.js dynamic params | Typegen `./+types/<route>` (`Route.LoaderArgs`, `Route.ActionArgs`) |
| Font Delivery | `next/font/google` | Self-hosted Inter font in `public/fonts/` (no external CDNs) |
| Theme Provider | `next-themes` npm package | Zero-dependency `app/lib/theme.ts` + inline `<ThemeScript />` |
| Cookie Handling | `next/headers` cookies() | `@supabase/ssr` `parseCookieHeader` & `serializeCookieHeader` |
| Background Jobs | Vercel Cron or external webhooks | Cloudflare Scheduled Workers (`scheduled()` handler in `workers/app.ts`) |

---

## Monorepo Layout Structure (Dual-Repo Architecture)

The repository operates as a **Dual-Repo Monorepo** ({{MONOREPO_OR_SINGLE}}):
- **Root Workspace Git Repository (`.`)**: Tracks all architecture documentation (`docs/bible/`), task backlogs (`docs/backlog/`), AI rules (`.agent/`, `.claude/`), and the workspace's specialist skills (`.agents/skills/`). Root `.gitignore` explicitly ignores `/apps/web/`.
- **Nested Web App Git Repository (`{{APP_PATH}}/`)**: Operates as an independent Git repository tracking the full-stack React Router 8 application (`app/`, `workers/`, `wrangler.jsonc`, `package.json`).
- **Unified Local Tooling**: `pnpm-workspace.yaml` enables local script orchestration (`pnpm dev`, `pnpm build`, `pnpm test`) across both repositories seamlessly.
- **On-Demand Publishing**: Both repositories are staged locally during initialization (zero network pushes), and published to GitHub on explicit developer command via `/push`.
- **Shared Packages (`packages/*`)**: Reserved for cross-cutting domain utilities or shared UI primitives when scaling.

---

## Edge Execution & Memory Constraints

Cloudflare Workers operate with a strict **128MB memory ceiling**:
- **Never buffer full response bodies** in memory (`await response.text()` or `await response.arrayBuffer()`).
- **Stream large payloads** using web standard `ReadableStream`.
- Direct large file uploads (> 10MB) to Cloudflare R2 using presigned URLs rather than routing the binary stream through the Worker.
