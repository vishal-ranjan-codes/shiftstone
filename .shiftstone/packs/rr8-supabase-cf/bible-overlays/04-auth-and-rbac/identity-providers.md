---
type: chapter-topic
title: "Identity Providers & Multi-Method Auth"
chapter: "04-auth-and-rbac"
file: "identity-providers.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Multi-Method Authentication Architecture (Email+Password, OTP, Magic Link, Google OAuth) and SSR client initialization."
---

# Auth & RBAC — Identity Providers & Multi-Method Auth

## 1. Supabase Auth & SSR Architecture

The application implements a **middleware-first authentication pipeline** using `@supabase/ssr` (0.12+) and React Router 8 native middleware:

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

## 2. Multi-Method Authentication Architecture

The system supports 4 authentication methods configured centrally in `app/lib/auth/config.ts`:

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
