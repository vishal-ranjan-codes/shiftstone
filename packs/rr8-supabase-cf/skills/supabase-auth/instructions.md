
# Supabase Authentication Skill

> Load this skill when configuring auth methods, writing auth components, or implementing sign-in/sign-up flows.

---

## 1. Multi-Method Authentication Architecture

The framework supports 4 authentication methods configured centrally in `app/lib/auth/config.ts`:

| # | Method | Sign-In | Sign-Up | Default State |
|---|--------|---------|---------|---------------|
| 1 | Email + Password | Yes | Yes | **ON - Primary** |
| 2 | Email OTP (6-digit code) | Yes | Yes | **ON - Secondary** |
| 3 | Magic Link (email redirect) | Yes | Yes | Off (Toggleable) |
| 4 | Google OAuth | Yes | Yes | Off (Toggleable) |

```typescript
// app/lib/auth/config.ts
export interface AuthConfig {
  methods: {
    emailPassword: boolean;
    emailOtp: boolean;
    magicLink: boolean;
    google: boolean;
  };
  defaultMethod: "email-password" | "email-otp" | "magic-link" | "google";
  passwordMinLength: number;
}

export const authConfig: AuthConfig = {
  methods: {
    emailPassword: true,   // Primary: Email + Password
    emailOtp: true,        // Secondary: Email OTP (input-otp)
    magicLink: false,      // Enable for passwordless magic link
    google: false,         // Enable for Google OAuth
  },
  defaultMethod: "email-password",
  passwordMinLength: 8,
};
```

---

## 2. Supabase Auth Providers Wrapper (`app/lib/auth/providers.ts`)

Encapsulate Supabase auth calls cleanly:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

// 1. Email + Password
export async function signInWithPassword(supabase: SupabaseClient, email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(supabase: SupabaseClient, email: string, password: string, metadata?: Record<string, any>) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

// 2. Email OTP (signInWithOtp without emailRedirectTo triggers a 6-digit code)
export async function sendEmailOtp(supabase: SupabaseClient, email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
}

export async function verifyEmailOtp(supabase: SupabaseClient, email: string, token: string) {
  return supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
}

// 3. Magic Link
export async function signInWithMagicLink(supabase: SupabaseClient, email: string, redirectTo: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
}

// 4. Google OAuth
export async function signInWithGoogle(supabase: SupabaseClient, redirectTo: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
```

---

## 3. Auth Callback Route (`app/routes/auth.callback.ts`)

Handles OAuth redirects and email verification links:

```typescript
import { redirect } from "react-router";
import type { Route } from "./+types/auth.callback";
import { supabaseContext } from "~/lib/supabase/context";

export async function loader({ request, context }: Route.LoaderArgs) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = context.get(supabaseContext);
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirect(next);
      }
    }
  }

  // Return user to an error page or sign-in with message
  return redirect("/sign-in?error=auth-callback-failed");
}
```

---

## 4. Auth Verification & Role Rules

- **`getClaims()` vs `getUser()`**:
  - In `supabaseMiddleware`: Call `await supabase.auth.getClaims()`. It verifies the JWT locally using JWKS without a network round-trip.
  - In `authMiddleware`: Call `await supabase.auth.getUser()`. It verifies the user's active status against the Supabase database.
  - NEVER call `supabase.auth.getSession()` on the server for authorization decisions.
- **Role Assignment**:
  - Sign-up routes ONLY create standard `user` accounts.
  - `admin` role is NEVER available on public forms. It must be manually granted via database update or admin RPC.
