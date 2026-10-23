---
type: chapter
timestamp: 2026-09-06T00:17:51.451Z
---
# 05 — Core Systems & Domain Rules

## Domain Logic Architecture

{{PROJECT_NAME}} keeps route modules clean by isolating complex domain operations into dedicated domain modules or Supabase Remote Procedure Calls (RPCs).

---

## Action Result Standards

All domain handlers and route actions return a standardized response structure:

```typescript
export type ActionResult<T = unknown> = 
  | { success: true; data: T; message?: string } 
  | { success: false; errors: Record<string, string[]>; message?: string };
```

- Form fields map directly to `errors[fieldName]`.
- Form-wide issues map to `errors._form`.
- Never return raw database error messages or crash the process.

---

## Transactional RPC Functions

For multi-step or atomic operations (e.g. creating an organization, transferring credits, deleting an account):
- Implement a PostgreSQL function with `SECURITY DEFINER`.
- Set an explicit `SET search_path = public`.
- Call the function from the route action:
  ```typescript
  const { data, error } = await supabase.rpc("api_atomic_operation", {
    p_user_id: user.id,
    p_param: input.param,
  });
  ```

---

## Resource Routes

In React Router 8, endpoints that serve JSON, handle webhooks, or stream downloads without rendering HTML are called **Resource Routes**:
- Export `loader` or `action`.
- **Do NOT export a default React component**.
- Return plain objects or `Response` instances.

---

## Error Boundaries

- Every layout and major route exports an `ErrorBoundary`.
- Differentiate between expected HTTP responses (`isRouteErrorResponse(error)`) and unexpected runtime exceptions (`error instanceof Error`).
- Never leak stack traces in production.
