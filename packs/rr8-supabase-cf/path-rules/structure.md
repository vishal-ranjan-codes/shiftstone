---
activation: always
paths:
  - "apps/web/**/*"
  - "workers/**/*"
---

# {{PROJECT_NAME}} — Folder Structure Rules

## Hard Rules

- **NEVER write application code directly to the workspace root** (only docs, monorepo configuration, and workspace orchestration belong there).
- All application code strictly lives inside `{{APP_PATH}}/` (e.g. `apps/web/`).
- Enforce strict separation of concerns:
  - Route definitions in `app/routes.ts`
  - Route modules under `app/routes/`
  - Middleware functions under `app/middleware/` (supabase, auth, cors, rate-limit)
  - Supabase client & context helpers under `app/lib/`
  - Auth configuration & provider wrappers under `app/lib/auth/`
  - Cloudflare Worker handlers under `workers/app.ts`
  - UI primitives under `app/components/ui/`
  - Auth layouts & forms under `app/components/auth/`

---

## React Router 8 Route Tree (`app/routes.ts`)

```typescript
import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  // 1. Public Routes
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("design-system", "routes/design-system.tsx"),

  // 2. Auth Routes
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-up", "routes/sign-up.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  route("auth/callback", "routes/auth.callback.ts"),
  route("auth/verify-otp", "routes/auth.verify-otp.tsx"),

  // 3. User Dashboard Routes (Protected by authMiddleware)
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard-home.tsx"),
    route("dashboard/settings", "routes/dashboard-settings.tsx"),
  ]),

  // 4. Admin Dashboard Routes (Protected by adminMiddleware)
  layout("routes/admin-layout.tsx", [
    route("admin", "routes/admin-home.tsx"),
    route("admin/users", "routes/admin-users.tsx"),
  ]),

  // 5. API / Resource Routes
  ...prefix("api", [
    route("health", "routes/api.health.ts"),
    route("user", "routes/api.user.ts"),
    route("upload", "routes/api.upload.ts"),
    route("download/:key", "routes/api.download.$key.ts"),
    route("webhooks", "routes/api.webhooks.ts"),
  ]),
] satisfies RouteConfig;
```

---

## Detailed Directory Map

```
{{APP_PATH}}/
├── app/
│   ├── routes.ts                 ← Master route hierarchy
│   ├── root.tsx                  ← Document wrapper, fonts, theme script, providers
│   ├── globals.css               ← Tailwind CSS v4 @theme & semantic design tokens
│   ├── routes/                   ← Route modules (public, auth, dashboard, admin, API)
│   ├── middleware/               ← Route middleware (supabase, auth, cors, rate-limit)
│   ├── lib/
│   │   ├── auth/                 ← config.ts (4 methods), providers.ts, types.ts
│   │   ├── supabase/             ← client.ts, admin.ts, context.ts
│   │   ├── r2/                   ← client.ts (S3 client factory)
│   │   ├── theme.ts              ← Custom theme management replacing next-themes
│   │   ├── context.ts            ← userContext definition
│   │   ├── env.ts                ← Environment type declarations
│   │   └── utils.ts              ← cn() class merger
│   ├── components/
│   │   ├── ui/                   ← 45+ shadcn/ui components
│   │   ├── layout/               ← Header, Footer, Logo, MobileNav, ThemeToggle
│   │   └── auth/                 ← AuthLayout, MethodSelector, PasswordForm, EmailOtpForm, etc.
│   └── types/                    ← database.types.ts
├── workers/
│   └── app.ts                    ← Cloudflare Workers fetch & scheduled cron trigger
├── public/
│   └── fonts/                    ← Self-hosted Inter variable font
└── wrangler.jsonc                ← Cloudflare Workers config & cron schedules
```

---

## Monorepo Commands

| Task | Root Command | Inside `{{APP_PATH}}/` |
|---|---|---|
| Run Dev Server | `{{PACKAGE_MANAGER}} dev` | `pnpm dev` |
| Build Production | `{{PACKAGE_MANAGER}} build` | `pnpm build` |
| Lint Check | `{{PACKAGE_MANAGER}} lint` | `pnpm lint` |
| Type Check | `{{PACKAGE_MANAGER}} typecheck` | `pnpm typecheck` |
| Run Tests | `{{PACKAGE_MANAGER}} test` | `pnpm test` |
| E2E Tests | `{{PACKAGE_MANAGER}} test:e2e` | `pnpm test:e2e` |
| Deploy Cloudflare | `{{PACKAGE_MANAGER}} deploy` | `wrangler deploy` |
| Regenerate Supabase Types | `{{SUPABASE_TYPES_CMD}}` | `npx supabase gen types typescript local > app/types/database.types.ts` |
