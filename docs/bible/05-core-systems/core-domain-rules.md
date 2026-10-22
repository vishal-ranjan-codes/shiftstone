---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Business domain rules, atomic transactions, result standards
---
# 05 — Core Systems & Domain Rules

This chapter is the SSOT for **business rules that must not drift**: how domain logic is organized, what every handler returns, and how errors surface.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/05-core-systems/` at init.

## Domain Logic Architecture

{{PROJECT_NAME}} keeps transport/route modules clean by isolating complex domain operations into dedicated domain modules or database-side routines. A route handler validates, authorizes and delegates — it does not implement business rules inline.

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

## Transactional Operations

For multi-step or atomic operations (create an organization, transfer credits, delete an account):
- Implement the operation as a single database transaction / routine that either fully succeeds or fully rolls back.
- Give the routine an explicit, deterministic search path / schema qualification.
- Call it from one place in the application, with typed inputs.

## Resource Endpoints

Endpoints that serve JSON, handle webhooks, or stream downloads without rendering a page follow the **resource endpoint** rules: export only the request handlers, never a default UI component, and return plain objects or `Response` instances.

## Error Boundaries

- Every layout and major route exports an error boundary.
- Differentiate between expected HTTP error responses and unexpected runtime exceptions.
- Never leak stack traces in production.
