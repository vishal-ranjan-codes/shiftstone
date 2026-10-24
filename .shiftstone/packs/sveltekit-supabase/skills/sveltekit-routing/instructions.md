# SvelteKit Routing & Server Endpoints Skill

> Load this skill when designing SvelteKit routes, writing server loaders, defining layout hierarchies, or creating API endpoints.

---

## 1. Route File Architecture (`src/routes/`)

SvelteKit uses filesystem-based directory routing:

- `+page.svelte`: The component rendering the page UI.
- `+page.server.ts`: Server-only `load` function executing before the page renders.
- `+layout.svelte`: Persistent layout wrapping child pages and nested layouts.
- `+layout.server.ts`: Server-only `load` function providing shared layout data.
- `+server.ts`: API endpoint route handling HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`).

---

## 2. Server Loaders & Page Props (Svelte 5 Runes)

Load data securely on the server without leaking database credentials:

```ts
// src/routes/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  const { session, user } = await locals.safeGetSession();
  if (!session) {
    error(401, 'Unauthorized');
  }

  return {
    user,
    timestamp: new Date().toISOString(),
  };
};
```

Consume the data in the page component using Svelte 5 `$props()`:

```svelte
<!-- src/routes/dashboard/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<h1>Welcome, {data.user?.email}</h1>
<p>Loaded at: {data.timestamp}</p>
```

---

## 3. Standalone API Endpoints (`+server.ts`)

Return standard `Response` objects or use the `json` helper:

```ts
// src/routes/health/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({ status: 'ok', uptime: process.uptime() });
};
```
