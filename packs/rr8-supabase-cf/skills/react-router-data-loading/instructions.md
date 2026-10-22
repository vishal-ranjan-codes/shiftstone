
# React Router 8 Data Loading Skill

> Load this skill when writing route loaders, client loaders, handling streaming responses, or optimizing data fetching.

---

## 1. Loader Basics (`Route.LoaderArgs`)

In React Router 8, data loading happens on the server before the component renders.

```typescript
import type { Route } from "./+types/items";
import { supabaseContext } from "~/lib/supabase/context";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const supabase = context.get(supabaseContext);
  if (!supabase) {
    return { items: [], unconfigured: true };
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = 20;

  const { data: items, count, error } = await supabase
    .from("items")
    .select("*", { count: "exact" })
    .range((page - 1) * limit, page * limit - 1)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Response(error.message, { status: 500 });
  }

  return {
    items: items ?? [],
    total: count ?? 0,
    page,
  };
}

export default function ItemsPage({ loaderData }: Route.ComponentProps) {
  const { items, total } = loaderData;
  return (
    <div>
      <h1>Total Items: {total}</h1>
      {/* render list */}
    </div>
  );
}
```

---

## 2. Client Loaders (`clientLoader`)

When using client-side caching (e.g. IndexedDB, local state, or client-side storage), export a `clientLoader`:

```typescript
export async function clientLoader({ serverLoader, params }: Route.ClientLoaderArgs) {
  const cached = localStorage.getItem(`item-${params.id}`);
  if (cached) return JSON.parse(cached);

  const serverData = await serverLoader();
  localStorage.setItem(`item-${params.id}`, JSON.stringify(serverData));
  return serverData;
}
clientLoader.hydrate = true; // Run during SSR hydration
```

---

## 3. Streaming & Deferred Data

For slow third-party API calls, stream data to improve Time to First Byte (TTFB):

```typescript
import { Suspense } from "react";
import { Await } from "react-router";
import type { Route } from "./+types/analytics";

export async function loader({ context }: Route.LoaderArgs) {
  // Fast critical data
  const criticalMetric = await fetchCriticalMetric();
  // Slow background metric (do NOT await here)
  const slowMetricsPromise = fetchSlowMetrics();

  return {
    criticalMetric,
    slowMetrics: slowMetricsPromise,
  };
}

export default function AnalyticsPage({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1>{loaderData.criticalMetric}</h1>
      <Suspense fallback={<p>Loading deep analytics...</p>}>
        <Await resolve={loaderData.slowMetrics}>
          {(metrics) => <MetricsChart data={metrics} />}
        </Await>
      </Suspense>
    </div>
  );
}
```

---

## 4. Revalidation Control (`shouldRevalidate`)

Prevent unnecessary loader re-executions during actions:

```typescript
export function shouldRevalidate({ actionResult, defaultShouldRevalidate }: Route.ShouldRevalidateArgs) {
  if (actionResult?.skipListRefresh) {
    return false;
  }
  return defaultShouldRevalidate;
}
```

---

## 5. Best Practices & Rules

- **Return Plain Objects**: In React Router 8, return plain JavaScript objects directly from loaders; `json()` helper is optional and usually omitted unless custom headers or status codes are required.
- **Throw Responses for Errors**: Throw `new Response("Not Found", { status: 404 })` to trigger the nearest `ErrorBoundary`.
- **Never Over-fetch**: Always select specific columns in Supabase (`.select("id, name, status")`) rather than `.select("*")` on high-volume tables.
