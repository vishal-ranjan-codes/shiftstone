# Supabase SSR with SvelteKit Skill

> Load this skill when integrating Supabase authentication, setting up `@supabase/ssr` cookies in `hooks.server.ts`, or querying PostgreSQL tables.

---

## 1. Supabase Client in Server Hooks (`src/hooks.server.ts`)

Manage authentication cookies securely on every request:

```ts
import { createServerClient } from '@supabase/ssr';
import { type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      },
    },
  });

  event.locals.safeGetSession = async () => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };

    return { session, user };
  };

  return resolve(event);
};
```

---

## 2. Row Level Security & Server Queries

Always query using the authenticated server client so RLS policies are enforced:

```ts
// src/routes/todos/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { data: todos, error } = await locals.supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load todos:', error.message);
    return { todos: [] };
  }

  return { todos };
};
```
