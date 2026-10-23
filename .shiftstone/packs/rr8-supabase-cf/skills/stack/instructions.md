
# {{PROJECT_NAME}} Stack Skill

> Load this skill before writing any React Router 8, Supabase, or Cloudflare Workers code.

---

## 1. Application Layout & Imports

All active application code lives inside `{{APP_PATH}}/` (e.g. `apps/web/`).
Import paths use the `~/` alias pointing to `app/`:

| Path | Purpose |
|---|---|
| `~/routes.ts` | Route hierarchy definition |
| `~/routes/*` | Route modules (pages, layouts, resource endpoints) |
| `~/middleware/*` | Route middleware (supabase, auth, cors, rate-limit) |
| `~/lib/supabase/*` | Supabase browser and admin client factories |
| `~/lib/context.ts` | React Router context definitions (`userContext`) |
| `~/lib/supabase/context.ts` | Supabase client context definition (`supabaseContext`) |
| `~/components/ui/*` | shadcn/ui components |
| `~/types/database.types.ts` | Generated Supabase TypeScript types |

---

## 2. Supabase Client Factory Patterns

### In Route Middleware (`app/middleware/supabase.ts`)
```typescript
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { MiddlewareFunction } from "react-router";
import { supabaseContext } from "~/lib/supabase/context";

export const supabaseMiddleware: MiddlewareFunction<Response> = async ({ request, context }, next) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    context.set(supabaseContext, null);
    return next();
  }

  const pendingCookies: any[] = [];
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

  // Validate JWT locally via JWKS & refresh cookies
  await supabase.auth.getClaims();

  // Inject into context
  context.set(supabaseContext, supabase);

  const response = await next();

  for (const { name, value, options } of pendingCookies) {
    response.headers.append("Set-Cookie", serializeCookieHeader(name, value, options));
  }
  for (const [key, value] of Object.entries(pendingHeaders)) {
    response.headers.set(key, value);
  }

  return response;
};
```

### In Browser Client (`app/lib/supabase/client.ts`)
```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "~/types/database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    const supabaseUrl = window.env?.SUPABASE_URL;
    const supabasePublishableKey = window.env?.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabasePublishableKey) return null;
    client = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  }
  return client;
}
```

### For Admin Tasks / Scheduled Workers ONLY (`app/lib/supabase/admin.ts`)
```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "~/types/database.types";

export function createAdminClient(env: { SUPABASE_URL: string; SUPABASE_SECRET_KEY: string }) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

---

## 3. Route Module Pattern

Every route exports its middleware chain, loader, action, and default component:

```typescript
import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/my-feature";
import { supabaseMiddleware } from "~/middleware/supabase";
import { authMiddleware } from "~/middleware/auth";
import { supabaseContext } from "~/lib/supabase/context";
import { z } from "zod";

// 1. Middleware chain
export const middleware: Route.MiddlewareFunction[] = [
  supabaseMiddleware,
  authMiddleware,
];

// 2. Meta
export function meta() {
  return [{ title: "My Feature" }];
}

// 3. Loader (GET)
export async function loader({ context }: Route.LoaderArgs) {
  const supabase = context.get(supabaseContext);
  const { data, error } = await supabase.from("items").select("*");
  if (error) throw new Response("Failed to load items", { status: 500 });
  return { items: data ?? [] };
}

// 4. Action (POST/PUT/DELETE)
const createSchema = z.object({ title: z.string().min(1) });

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: "Invalid title provided" };
  }

  const supabase = context.get(supabaseContext);
  const { data, error } = await supabase.from("items").insert({ title: parsed.data.title }).select().single();
  if (error) return { success: false, error: error.message };

  return { success: true, data };
}

// 5. Component
export default function MyFeaturePage({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="p-6 theme-bg-color min-h-screen">
      <h1 className="theme-h1 mb-4">Items</h1>
      <Form method="post" className="space-y-4">
        <input name="title" className="border theme-border-color p-2 rounded" placeholder="Item title" />
        <button type="submit" disabled={isSubmitting} className="bg-primary text-primary-foreground px-4 py-2 rounded">
          {isSubmitting ? "Adding..." : "Add Item"}
        </button>
      </Form>
      {actionData?.error && <p className="text-destructive mt-2">{actionData.error}</p>}
    </div>
  );
}
```
