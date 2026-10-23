
# React Router 8 Actions & Forms Skill

> Load this skill when building data mutations, HTML form submissions, client-side optimistic UI, or validating user inputs.

---

## 1. Action Function Design (`Route.ActionArgs`)

All mutations (POST, PUT, DELETE) are handled by route `action` functions:

```typescript
import { redirect } from "react-router";
import type { Route } from "./+types/new-item";
import { z } from "zod";
import { supabaseContext } from "~/lib/supabase/context";

const itemSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().optional(),
  price: z.coerce.number().positive("Price must be greater than 0"),
});

export type ItemActionResult =
  | { success: true; id: string }
  | { success: false; errors: Record<string, string[]> };

export async function action({ request, context }: Route.ActionArgs): Promise<ItemActionResult | Response> {
  const supabase = context.get(supabaseContext);
  if (!supabase) {
    return { success: false, errors: { _form: ["Database service unavailable"] } };
  }

  const formData = await request.formData();
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { data, error } = await supabase
    .from("items")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return {
      success: false,
      errors: { _form: [error.message] },
    };
  }

  return redirect(`/dashboard/items/${data.id}`);
}
```

---

## 2. Using `<Form>` vs `useFetcher`

### A. `<Form>` — Full Page Navigation / Redirection
Use `<Form method="post">` when the submission navigates to a new page or updates the current route:

```tsx
import { Form, useNavigation, useActionData } from "react-router";
import type { Route } from "./+types/new-item";

export default function NewItemPage({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <Form method="post" className="space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" name="name" required />
        {actionData && !actionData.success && actionData.errors.name && (
          <p className="text-red-500">{actionData.errors.name[0]}</p>
        )}
      </div>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Item"}
      </button>
    </Form>
  );
}
```

### B. `useFetcher` — In-Page Mutations & Optimistic UI
Use `useFetcher` when updating an item inline without triggering navigation (e.g. toggle favorite, delete item in list, inline status change):

```tsx
import { useFetcher } from "react-router";

export function ItemRow({ item }: { item: { id: string; name: string; is_completed: boolean } }) {
  const fetcher = useFetcher();
  
  // Optimistic calculation: use optimistic state while submitting
  const isCompleted = fetcher.formData
    ? fetcher.formData.get("completed") === "true"
    : item.is_completed;

  return (
    <div className="flex items-center justify-between p-3 border rounded">
      <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
        {item.name}
      </span>
      <fetcher.Form method="post" action={`/api/items/${item.id}/toggle`}>
        <input type="hidden" name="completed" value={String(!isCompleted)} />
        <button type="submit" disabled={fetcher.state !== "idle"}>
          {isCompleted ? "Mark Incomplete" : "Mark Complete"}
        </button>
      </fetcher.Form>
    </div>
  );
}
```

---

## 3. Standardized Action Results

Always export a structured result type for predictable client handling:

```typescript
export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; errors: Record<string, string[]>; message?: string };
```

---

## 4. Best Practices & Rules

- **Validate with Zod**: ALWAYS run `schema.safeParse(...)` on incoming form data before touching the database.
- **Intent-Based Actions**: When one form has multiple submit buttons, use a `name="intent"` field to discriminate the action (e.g. `intent="save"`, `intent="publish"`).
- **CSRF Protection**: By default, React Router actions accept form posts from the same origin. Verify origin headers on sensitive external webhook routes.
