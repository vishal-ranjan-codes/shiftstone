
# React Router 8 Typegen Skill

> Load this skill when configuring route typing, importing `./+types/<route>`, or troubleshooting typecheck and build errors.

---

## 1. The Typegen Pipeline

React Router 8 analyzes your `app/routes.ts` file and automatically generates type definition files inside `.react-router/types/app/routes/+types/<filename>.d.ts`.

In your route modules, import the virtual `Route` namespace from `./+types/<route-filename>`:

```typescript
// In app/routes/dashboard-home.tsx:
import type { Route } from "./+types/dashboard-home";
```

This namespace provides strictly typed arguments and props:
- `Route.LoaderArgs`: Contains typed `params`, `request`, and `context`.
- `Route.ActionArgs`: Contains typed `params`, `request`, and `context`.
- `Route.ComponentProps`: Contains typed `loaderData`, `actionData`, `params`, and `matches`.
- `Route.ErrorBoundaryProps`: Contains typed `error` and `params`.
- `Route.MiddlewareFunction`: Type for middleware applied to this specific route.

---

## 2. Standard Route Module Structure

```typescript
import type { Route } from "./+types/user-profile";

export const middleware: Route.MiddlewareFunction[] = [
  // typed route middleware
];

export async function loader({ params, context }: Route.LoaderArgs) {
  // params.userId is strongly typed based on route definition
  return { userId: params.userId, loadedAt: Date.now() };
}

export async function action({ request, params }: Route.ActionArgs) {
  return { updated: true };
}

export default function UserProfilePage({ loaderData, actionData }: Route.ComponentProps) {
  // loaderData is inferred: { userId: string; loadedAt: number }
  return <div>User: {loaderData.userId}</div>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <div>Error loading profile</div>;
}
```

---

## 3. Resolving Typegen Drift

When a new route is created or paths change in `app/routes.ts`, TypeScript might complain that `./+types/...` does not exist.

### Command to Regenerate Types
Run:
```bash
# Within apps/web/
pnpm typecheck
# Which executes:
# react-router typegen && tsc
```

### TypeScript Path Configuration
Ensure `tsconfig.json` has the `.react-router/types` include:
```json
{
  "include": [
    "app/**/*",
    ".react-router/types/**/*"
  ]
}
```

---

## 4. Best Practices & Rules

- **Never create manual type interfaces** for `loaderData` when `Route.ComponentProps` is available.
- **Always run `react-router typegen`** before `tsc` during CI/CD and pre-commit checks.
- **Path parameters are derived from `routes.ts`**: If `route("items/:itemId", ...)` is specified, `params.itemId` will be typed as `string | undefined`.
