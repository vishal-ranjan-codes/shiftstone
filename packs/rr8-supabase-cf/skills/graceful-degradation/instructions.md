
# Graceful Degradation Skill

> Load this skill when designing public pages, preview environments, or handling unconfigured third-party services.

---

## 1. Core Architectural Principle

{{PROJECT_NAME}} must remain fully functional as a website even when Supabase or Cloudflare credentials are unset:
- Public routes (`/`, `/about`, `/contact`, `/design-system`) MUST render normally.
- Only auth-dependent routes (`/sign-in`, `/dashboard`, `/admin`) should display a helpful setup banner or redirect.
- The dev server (`pnpm dev`) should NEVER throw fatal startup crashes due to missing environment variables.

---

## 2. Implementation in `supabaseMiddleware`

```typescript
// app/middleware/supabase.ts
export const supabaseMiddleware: MiddlewareFunction<Response> = async ({ context }, next) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    // 🛡️ Graceful Degradation: Store null and continue execution!
    context.set(supabaseContext, null);
    return next();
  }

  // Normal Supabase client initialization...
  return next();
};
```

---

## 3. Handling in Route Loaders

In routes that query Supabase, inspect the context client:

```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const supabase = context.get(supabaseContext);

  if (!supabase) {
    return {
      items: [],
      isDemoMode: true,
      message: "Supabase credentials are not configured yet. Showing demo data.",
    };
  }

  const { data: items } = await supabase.from("items").select("*");
  return { items: items ?? [], isDemoMode: false };
}
```

---

## 4. Best Practices & Rules

- **Never Throw on Root Loaders**: Do not throw fatal errors in `app/root.tsx` or public route loaders if credentials are missing.
- **Show Unconfigured Banners in Auth Pages**: On `/sign-in` and `/sign-up`, if `supabase` is null, display a clear, styled alert:
  > *"Supabase credentials are not configured. Please add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to your `.dev.vars` file."*
