
# React Router 8 Routing Skill

> Load this skill when defining, organizing, or refactoring routes in `{{APP_PATH}}/app/routes.ts` or creating route modules.

---

## 1. Route Tree Architecture (`app/routes.ts`)

In React Router 8 (framework mode), the route hierarchy is configured centrally in `app/routes.ts` using helpers from `@react-router/dev/routes`.

```typescript
import {
  type RouteConfig,
  index,
  route,
  layout,
  prefix,
} from "@react-router/dev/routes";

export default [
  // 1. Root index route (/)
  index("routes/home.tsx"),

  // 2. Standalone public routes
  route("about", "routes/about.tsx"),
  route("contact", "routes/contact.tsx"),
  route("design-system", "routes/design-system.tsx"),

  // 3. Auth routes
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-up", "routes/sign-up.tsx"),
  route("sign-out", "routes/sign-out.tsx"),
  route("auth/callback", "routes/auth.callback.ts"),
  route("auth/verify-otp", "routes/auth.verify-otp.tsx"),

  // 4. Protected User Dashboard routes with layout wrapper
  layout("routes/dashboard-layout.tsx", [
    route("dashboard", "routes/dashboard-home.tsx"),
    route("dashboard/settings", "routes/dashboard-settings.tsx"),
    route("dashboard/items", "routes/dashboard-items.tsx"),
    route("dashboard/items/:id", "routes/dashboard-item-detail.tsx"),
  ]),

  // 5. Protected Admin routes with layout wrapper
  layout("routes/admin-layout.tsx", [
    route("admin", "routes/admin-home.tsx"),
    route("admin/users", "routes/admin-users.tsx"),
    route("admin/system", "routes/admin-system.tsx"),
  ]),

  // 6. Resource API routes (no UI default export)
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

## 2. Route Definition Types

| Helper | Usage | Example |
|---|---|---|
| `index(file)` | Default leaf route for the current path | `index("routes/home.tsx")` |
| `route(path, file, children?)` | Matches a specific URL segment | `route("items/:id", "routes/item.tsx")` |
| `layout(file, children)` | Visual/middleware layout wrapper without URL segment | `layout("routes/auth-layout.tsx", [...])` |
| `prefix(path, routes)` | Groups routes under a common URL prefix | `prefix("api", [...])` |

---

## 3. Dynamic Parameters & Splats

- **Named parameters**: `:id` or `:slug` $\rightarrow$ accessible via `params.id` in loaders, actions, and client hooks.
- **Optional parameters**: `:lang?` $\rightarrow$ matches with or without the segment.
- **Splat / Catch-all**: `*` $\rightarrow$ accessible via `params["*"]` for 404 handlers or dynamic path parsing.
- File naming convention: Match route file names descriptively (e.g. `routes/dashboard-item-detail.tsx` or `routes/api.download.$key.ts`).

---

## 4. Best Practices & Anti-Patterns

### ✅ DO
- Always use `satisfies RouteConfig` for type verification.
- Group authenticated features inside `layout(...)` blocks so layout-level middleware protects all child routes automatically.
- Keep route file names clean and lowercase kebab-case.

### ❌ DON'T
- Do NOT import from `react-router-dom` — package is removed in React Router 8; import from `react-router`.
- Do NOT declare routes inside `root.tsx` or JSX route definitions (`<Route>`) when running in framework mode.
- Do NOT place route files outside `app/routes/`.
