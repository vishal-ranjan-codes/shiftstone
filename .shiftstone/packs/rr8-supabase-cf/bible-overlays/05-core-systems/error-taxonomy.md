---
type: chapter-topic
title: "Error Taxonomy & Action Results"
chapter: "05-core-systems"
file: "error-taxonomy.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Standardized ActionResult structures, custom error classes, and React Router error boundaries."
---

# Core Systems — Error Taxonomy & Action Results

## 1. Action Result Standards

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

## 2. HTTP Error Mapping

| Domain Error Class | HTTP Status | Response Strategy |
|---|:---:|---|
| `ValidationError` | 400 | Return `ActionResult` with mapped field errors |
| `AuthenticationError` | 401 | Redirect to `/sign-in` with `redirectTo` return query |
| `AuthorizationError` | 403 | Silent redirect or 404 to avoid information disclosure |
| `NotFoundError` | 404 | Render React Router `ErrorBoundary` 404 view |
| `ConflictError` | 409 | Return `errors._form` explaining collision |
| `RateLimitError` | 429 | Return retry-after header and UI throttled message |
| `InternalServerError` | 500 | Sanitize message in production; log stack trace to server telemetry |
