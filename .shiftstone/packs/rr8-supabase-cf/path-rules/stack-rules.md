---
activation: always
paths:
  - "apps/web/**/*"
  - "workers/**/*"
---

# {{PROJECT_NAME}} — Stack Rules

## Supabase SSR & Multi-Method Auth

- **Middleware-First Auth**: Always use `@supabase/ssr` (0.12+) in `{{APP_PATH}}/app/middleware/supabase.ts`.
- In middleware, call `await supabase.auth.getClaims()` to validate JWTs locally via JWKS and automatically refresh session cookies before downstream route loaders or actions run.
- Set the request-scoped Supabase client in the React Router Context: `context.set(supabaseContext, supabase)`.
- In route loaders and actions, retrieve the client via: `const supabase = context.get(supabaseContext)`.
- **Auth Verification Standards**:
  - `getClaims()`: Used in middleware for fast cryptographic verification and session refresh.
  - `getUser()`: Used in `authMiddleware` when checking active user state against the database.
  - `getSession()`: **STRICTLY PROHIBITED** for server-side authorization decisions.
- **Graceful Degradation**:
  - If `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is not present, `supabaseMiddleware` stores `null` in `supabaseContext` and continues.
  - Public pages (`/`, `/about`, `/contact`, `/design-system`) MUST NOT throw fatal crashes when credentials are unset.
- **Multi-Method Auth Configuration (`app/lib/auth/config.ts`)**:
  - Supports 4 configurable auth methods: Email + Password (primary default), Email OTP (secondary default, 6-digit code via `input-otp`), Magic Link, Google OAuth.
  - Toggled via boolean flags in `authConfig.methods`.
- **User Roles & RBAC**:
  - Roles: `user` (default) and `admin`.
  - New sign-ups automatically receive `user` role via the `handle_new_user()` PostgreSQL trigger.
  - `admin` role is NEVER available on public sign-up forms; it must be assigned manually.
  - `adminMiddleware` validates `profiles.role === 'admin'`; if unauthorized, silently redirect to `/dashboard`.
- **Always Enable Row-Level Security (RLS)** on every table — NEVER bypass RLS from client components or regular route loaders.

### ⚠️ Supabase 2025/2026 API Keys Standard

- **Publishable Key (`SUPABASE_PUBLISHABLE_KEY`)**: Format `sb_publishable_...`. Transmitted via `apikey` header in the browser and SSR.
- **Secret Key (`SUPABASE_SECRET_KEY`)**: Format `sb_secret_...`. Server-side only (bypasses RLS) for background jobs and admin tasks.
- Legacy JWT-based `anon` and `service_role` keys are deprecated. New keys are NOT JWTs and cannot be used in `Authorization: Bearer` headers.

---

## React Router 8 Conventions

- **Framework Mode**: ESM-only, React 19+, Vite 8+, Node 22+.
- Route tree is explicitly declared in `{{APP_PATH}}/app/routes.ts` (`index`, `route`, `layout`, `prefix`).
- Always import typed route arguments from generated types:
  ```typescript
  import type { Route } from "./+types/<route-filename>";
  ```
- **Loaders**: Server-side data fetching for GET requests.
  ```typescript
  export async function loader({ request, params, context }: Route.LoaderArgs) { ... }
  ```
- **Actions**: Server-side mutations for POST/PUT/PATCH/DELETE requests.
  - ALWAYS validate incoming request payloads using Zod schemas.
  - Return structured responses:
    ```typescript
    export type ActionResult<T = unknown> = 
      | { success: true; data: T } 
      | { success: false; errors: Record<string, string[]> };
    ```
- **Resource Routes**: Routes that export a `loader` or `action` without a default React component (e.g. `api.health.ts`, `api.upload.ts`).
- **Error Boundaries**: Every layout and major route module should export an `ErrorBoundary` handling `isRouteErrorResponse(error)`.

---

## Cloudflare Edge Runtime

- All code executes in the Cloudflare Workers / Pages edge runtime (V8 isolates).
- Ensure `"compatibility_flags": ["nodejs_compat"]` is set in `wrangler.jsonc`.
- Avoid Node.js-only native modules (like `fs` or native binary addons) in application runtime code.
- **Memory Management (128MB Limit)**:
  - Never load large file buffers into memory. Use streaming responses.
- Environment variables and secrets are configured in `apps/web/.dev.vars` locally and via `wrangler secret put` for production.

---

## Cloudflare Scheduled Workers (Background Jobs)

- Scheduled jobs are registered under `triggers.crons` in `{{APP_PATH}}/wrangler.jsonc`.
- Handled in `{{APP_PATH}}/workers/app.ts` via the `scheduled(controller, env, ctx)` handler:
  ```typescript
  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(handleCronJob(controller, env));
  }
  ```
- All scheduled jobs MUST be idempotent. Use database advisory locks for concurrency safety:
  ```sql
  SELECT pg_advisory_xact_lock(hashtext('cron_' || job_name));
  ```

---

## Cloudflare R2 Object Storage

- Interfaced using AWS SDK S3 client (`@aws-sdk/client-s3`) configured with the Cloudflare R2 endpoint.
- File uploads: direct uploads for small files, presigned upload URLs via `getSignedUrl(...)` for files > 10MB.
- File downloads: presigned download URLs or streaming through `routes/api.download.$key.ts`.

---

## Frontend, Tailwind v4 & Design Tokens

- Tailwind CSS v4 CSS-first configuration (`@theme` in `app/globals.css`, no `tailwind.config.js`).
- Strict semantic design tokens (`theme-bg-color`, `theme-fg-color`, `theme-fc-heading`, `theme-fc-base`, `theme-fc-light`, `theme-border-color`, `theme-card-bg`).
- Self-hosted Inter font in `public/fonts/`.
- Custom `app/lib/theme.ts` replacing `next-themes` with inline `<ThemeScript />` in `root.tsx` to prevent FOUC.
