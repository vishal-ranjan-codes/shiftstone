---
type: chapter-topic
title: "System Context & Stack Reference"
chapter: "01-architecture"
file: "system-context.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "C4 Level 1 & Level 2 system context, technical stack reference, and architectural distinctions."
---

# Architecture — System Context & Stack Reference

## 1. Technical Stack Reference

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
| Package Manager | pnpm | Monorepo workspaces (`onlyBuiltDependencies: ["esbuild", "workerd"]`) |

## 2. Architectural Distinctions from Next.js

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
