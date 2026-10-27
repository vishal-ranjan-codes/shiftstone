---
type: chapter-topic
title: "Route Guards & Token Verification"
chapter: "04-auth-and-rbac"
file: "route-guards.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "React Router middleware guards, JWT token verification, and graceful degradation."
---

# Auth & RBAC — Route Guards & Token Verification

## 1. Route Guarding Patterns

### User Authentication Guard (`authMiddleware`)
Applied to user dashboards and account routes:
```typescript
export const middleware: Route.MiddlewareFunction[] = [
  supabaseMiddleware,
  authMiddleware,
];
```

### Admin RBAC Guard (`adminMiddleware`)
Applied to `/admin` route trees:
- Verifies user is authenticated via `supabase.auth.getUser()`.
- Queries `profiles.role === 'admin'`.
- If unauthorized: silently redirects to `/dashboard` (hiding the existence of the admin route).

---

## 2. Token Verification & Best Practices

- `getClaims()`: Used in middleware for fast cryptographic token verification via cached JWKS. Does NOT make a network round-trip for valid tokens.
- `getUser()`: Used in `authMiddleware` when active authorization against the database is required.
- `getSession()`: **STRICTLY FORBIDDEN** for server-side authorization decisions because the session data is unverified and untrusted.

---

## 3. Graceful Degradation in Zero-Credential Environments

If Supabase credentials are missing (e.g. initial clone, public showcase preview):
- `supabaseMiddleware` stores `null` in `supabaseContext`.
- Public routes (`/`, `/about`, `/contact`, `/pricing`) render normally.
- Protected routes display a helpful configuration banner rather than throwing unhandled fatal 500 exceptions.
