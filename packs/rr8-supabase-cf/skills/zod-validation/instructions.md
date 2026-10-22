
# Zod Validation Skill

> Load this skill when defining validation schemas, parsing form data, or structuring API contracts.

---

## 1. Action Validation Pattern

Always use `safeParse()` in route actions to validate user input:

```typescript
import { z } from "zod";

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(100),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  website: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
```

### Parsing `FormData`:
```typescript
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const rawData = Object.fromEntries(formData);

  const result = profileUpdateSchema.safeParse(rawData);
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  // result.data is strongly typed
  return { success: true, data: result.data };
}
```

---

## 2. Common Coercion Patterns

In web forms, inputs always submit as strings. Use Zod's `z.coerce` to parse numbers and booleans:

```typescript
const filterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  is_active: z.coerce.boolean().optional(),
});
```

---

## 3. Best Practices & Rules

- **Never Trust Client Data**: Validate both client-side (for UX) and server-side in the action (for security).
- **Use `.flatten().fieldErrors`**: Standardize error returns so frontend components can easily bind errors to specific input fields.
