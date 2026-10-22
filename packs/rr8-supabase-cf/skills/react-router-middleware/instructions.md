
# React Router 8 Middleware Skill

> Load this skill when writing or debugging route middleware, injecting request-scoped context, or manipulating HTTP headers/cookies.

---

## 1. Native Middleware Architecture

React Router 8 includes first-class native middleware support. Middleware runs sequentially from root/parent to child routes before loaders or actions execute.

```
Request: /dashboard/settings
     │
     ▼
Root Middleware (supabaseMiddleware)
  ├─ Validates JWT locally via getClaims()
  ├─ Injects SupabaseClient into context.set(supabaseContext, supabase)
  └─ Calls next()
     │
     ▼
Layout Middleware (authMiddleware)
  ├─ Reads context.get(supabaseContext)
  ├─ Calls supabase.auth.getUser()
  ├─ If unauthenticated: throws redirect("/sign-in") (stops execution!)
  ├─ Injects User into context.set(userContext, user)
  └─ Calls next()
     │
     ▼
Route Loader ({ context }: Route.LoaderArgs)
  ├─ const user = context.get(userContext);
  └─ Executes safely with guaranteed authenticated user
     │
     ▼
Response Processing (supabaseMiddleware writes pending Set-Cookie headers)
```

---

## 2. Defining Type-Safe Context

Use `createContext` from `react-router` to define context keys:

```typescript
// app/lib/context.ts
import { createContext } from "react-router";
import type { User } from "@supabase/supabase-js";

export const userContext = createContext<User | null>(null);
```

```typescript
// app/lib/supabase/context.ts
import { createContext } from "react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

export const supabaseContext = createContext<SupabaseClient<Database> | null>(null);
```

---

## 3. Writing Middleware Functions

### Pattern A: Session Refresh & Cookie Interception (`supabaseMiddleware`)
```typescript
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { MiddlewareFunction } from "react-router";
import { supabaseContext } from "~/lib/supabase/context";

export const supabaseMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    context.set(supabaseContext, null); // Graceful degradation
    return next();
  }

  const pendingCookies: Array<{ name: string; value: string; options: any }> = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet, headers) {
        pendingCookies.push(...cookiesToSet);
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  // Local JWT claim check and token refresh
  await supabase.auth.getClaims();

  // Store client in context
  context.set(supabaseContext, supabase);

  // Execute downstream chain
  const response = await next();

  // Append new cookies to outgoing response
  for (const { name, value, options } of pendingCookies) {
    response.headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value);
  }

  return response;
};
```

### Pattern B: Route Guarding (`authMiddleware`)
```typescript
import { redirect } from "react-router";
import type { MiddlewareFunction } from "react-router";
import { supabaseContext } from "~/lib/supabase/context";
import { userContext } from "~/lib/context";

export const authMiddleware: MiddlewareFunction<Response> = async ({ context }) => {
  const supabase = context.get(supabaseContext);
  if (!supabase) throw redirect("/sign-in");

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw redirect("/sign-in");

  context.set(userContext, user);
};
```

---

## 4. Applying Middleware to Routes

Export a `middleware` array in the route module:

```typescript
import type { Route } from "./+types/dashboard-home";
import { supabaseMiddleware } from "~/middleware/supabase";
import { authMiddleware } from "~/middleware/auth";

export const middleware: Route.MiddlewareFunction[] = [
  supabaseMiddleware,
  authMiddleware,
];
```

---

## 5. Rules & Anti-Patterns

- **Throwing Redirects**: To stop execution and redirect, ALWAYS `throw redirect("/path")`. Do not return `redirect()` unless passing through `next()`.
- **Response Headers**: Never overwrite headers directly (`response.headers = ...`); use `append("Set-Cookie", ...)` and `set(key, value)`.
- **Context Immutability**: Context is request-scoped. Never save request context to module-level global variables.
