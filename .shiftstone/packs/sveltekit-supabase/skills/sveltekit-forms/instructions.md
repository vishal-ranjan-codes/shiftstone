# SvelteKit Form Actions & Progressive Enhancement Skill

> Load this skill when writing SvelteKit form actions, applying `use:enhance`, validating FormData, or handling form error states.

---

## 1. Defining Form Actions (`+page.server.ts`)

Export an `actions` object containing default or named actions:

```ts
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  login: async ({ request, locals }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString();
    const password = formData.get('password')?.toString();

    if (!email || !password) {
      return fail(400, {
        email,
        missing: true,
        message: 'Email and password are required',
      });
    }

    const { error } = await locals.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return fail(400, {
        email,
        invalid: true,
        message: error.message,
      });
    }

    redirect(303, '/dashboard');
  },
};
```

---

## 2. Progressive Enhancement with `use:enhance`

Forms work without JavaScript enabled, and seamlessly enhance into single-page async requests when JS loads:

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let loading = $state(false);
</script>

<form
  method="POST"
  action="?/login"
  use:enhance={() => {
    loading = true;
    return async ({ update }) => {
      loading = false;
      await update();
    };
  }}
>
  {#if form?.message}
    <p class="error">{form.message}</p>
  {/if}

  <label>
    Email:
    <input name="email" type="email" value={form?.email ?? ''} required />
  </label>

  <label>
    Password:
    <input name="password" type="password" required />
  </label>

  <button type="submit" disabled={loading}>
    {loading ? 'Signing in...' : 'Sign In'}
  </button>
</form>
```
