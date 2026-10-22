---
type: chapter
timestamp: 2026-09-06T00:17:26.736Z
---
# 04 — Auth & Role-Based Access Control (RBAC)

## Supabase Auth & SSR Architecture

{{PROJECT_NAME}} implements a **middleware-first authentication pipeline** using `@supabase/ssr` (0.12+) and React Router 8 native middleware:

```
Incoming Request
       │
       ▼
app/middleware/supabase.ts
       │
       ├─► 1. Parse request cookies (parseCookieHeader)
       ├─► 2. Check credentials: if missing, store null (Graceful Degradation)
       ├─► 3. Create server client with SUPABASE_PUBLISHABLE_KEY
       ├─► 4. supabase.auth.getClaims() -> Validates JWT locally via JWKS & refreshes expired tokens
       ├─► 5. context.set(supabaseContext, supabase)
       │
       ▼
app/middleware/auth.ts (on protected routes)
       │
       ├─► 1. supabase.auth.getUser() -> Verify user status with Auth server
       ├─► 2. If unauthenticated -> throw redirect("/sign-in")
       └─► 3. context.set(userContext, user)
       │
       ▼
Route Loaders / Actions (Read from context.get(userContext) and context.get(supabaseContext))
       │
       ▼
Outgoing Response (app/middleware/supabase.ts appends serialized Set-Cookie headers)
```

---

## Multi-Method Authentication Architecture

{{PROJECT_NAME}} supports 4 authentication methods configured centrally in `app/lib/auth/config.ts`:

| # | Method | Sign-In | Sign-Up | Default State | Implementation |
|---|--------|---------|---------|---------------|----------------|
| 1 | **Email + Password** | Yes | Yes | **ON - Primary** | Standard password authentication (`signInWithPassword`) |
| 2 | **Email OTP** | Yes | Yes | **ON - Secondary** | 6-digit code sent to email (`input-otp` component, `verifyOtp`) |
| 3 | **Magic Link** | Yes | Yes | Off (Toggleable) | Passwordless email link (`signInWithOtp` with `emailRedirectTo`) |
| 4 | **Google OAuth** | Yes | Yes | Off (Toggleable) | OAuth 2.0 redirect via Supabase Auth |

### Configuration (`app/lib/auth/config.ts`):
```typescript
export const authConfig: AuthConfig = {
  methods: {
    emailPassword: true,   // Primary: Email + Password
    emailOtp: true,        // Secondary: Email OTP
    magicLink: false,      // Enable for passwordless magic link
    google: false,         // Enable for Google OAuth
  },
  defaultMethod: "email-password",
  passwordMinLength: 8,
};
```

To enable or disable any method, toggle the boolean flags in `authConfig.methods`. No other code changes are needed.

---

## Route Guarding Patterns

### 1. User Authentication Guard (`authMiddleware`)
Applied to user dashboards and account routes:
```typescript
export const middleware: Route.MiddlewareFunction[] = [
  supabaseMiddleware,
  authMiddleware,
];
```

### 2. Admin RBAC Guard (`adminMiddleware`)
Applied to `/admin` route trees:
- Verifies user is authenticated via `supabase.auth.getUser()`.
- Queries `profiles.role === 'admin'`.
- If unauthorized: silently redirects to `/dashboard` (hiding the existence of the admin route).

---

## User Roles & Assignment Rules

The system recognizes two roles stored in `public.profiles.role`:

| Role | Access Scope | How to Assign |
|---|---|---|
| `user` | `/dashboard/*` and public routes | **Automatic** on sign-up via the `handle_new_user()` database trigger |
| `admin` | `/admin/*`, `/dashboard/*`, and public routes | **Strictly Manual** — direct database update or admin RPC only |

Public sign-up forms NEVER permit users to choose or request the `admin` role.

---

## Token Verification & Best Practices

- `getClaims()`: Used in middleware for fast cryptographic token verification via cached JWKS. Does NOT make a network round-trip for valid tokens.
- `getUser()`: Used in `authMiddleware` when active authorization against the database is required.
- `getSession()`: **STRICTLY FORBIDDEN** for server-side authorization decisions because the session data is unverified and untrusted.
