---
type: chapter-topic
title: "Route Hierarchy & Layout Architecture"
chapter: "07-frontend"
file: "route-hierarchy.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "React Router 8 nested route hierarchy (routes.ts), layout wrappers, and boundary encapsulation."
---

# Frontend — Route Hierarchy & Layout Architecture

## 1. Route Configuration Map (`app/routes.ts`)

React Router 8 defines routes programmatically rather than via file-system guesswork:

```typescript
import { type RouteConfig, index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  // Public marketing views
  layout("routes/_public.tsx", [
    index("routes/home.tsx"),
    route("about", "routes/about.tsx"),
    route("pricing", "routes/pricing.tsx"),
  ]),

  // Auth flow views
  layout("routes/_auth.tsx", [
    route("sign-in", "routes/auth/sign-in.tsx"),
    route("sign-up", "routes/auth/sign-up.tsx"),
    route("callback", "routes/auth/callback.tsx"),
  ]),

  // Protected application dashboard
  layout("routes/_app.tsx", [
    ...prefix("dashboard", [
      index("routes/dashboard/index.tsx"),
      route("settings", "routes/dashboard/settings.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
```

## 2. Layout Boundaries & Suspense

- Each layout module provides a consistent header/nav and isolates its children in an `Outlet`.
- Boundary isolation: uncaught errors in child routes render inside the parent layout's `ErrorBoundary` without unmounting global navigation.
