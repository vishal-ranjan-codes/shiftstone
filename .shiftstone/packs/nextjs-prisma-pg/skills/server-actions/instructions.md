# Next.js Server Actions Skill

> Load this skill when writing Server Actions, handling form submissions, validating inputs with Zod, or updating client UI optimistically.

---

## 1. Declaring Server Actions

Declare `'use server'` at the file or function level:

```ts
// app/actions/users.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

export type ActionState = {
  success?: boolean;
  errors?: Record<string, string[]>;
  message?: string;
};

export async function createUserAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = CreateUserSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.user.create({ data: parsed.data });
    revalidatePath('/users');
    return { success: true };
  } catch {
    return { success: false, message: 'Failed to create user' };
  }
}
```

---

## 2. Consuming Actions with `useActionState`

In a Client Component:

```tsx
'use client';

import { useActionState } from 'react';
import { createUserAction, type ActionState } from '@/app/actions/users';

const initialState: ActionState = {};

export function UserForm() {
  const [state, formAction, isPending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction}>
      <input name="name" placeholder="Full Name" required />
      {state.errors?.name && <p className="error">{state.errors.name[0]}</p>}

      <input name="email" type="email" placeholder="Email" required />
      {state.errors?.email && <p className="error">{state.errors.email[0]}</p>}

      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Create User'}
      </button>
    </form>
  );
}
```
