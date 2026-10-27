---
type: chapter-topic
title: "Route Actions & Mutation Contracts"
chapter: "08-api-contracts"
file: "route-actions.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Server action specifications, form mutation contracts, Zod schemas, and ActionResult structures."
---

# API Contracts — Route Actions & Mutation Contracts

## 1. Action Result Response Standard

Every route action must return a standardized response object or throw a redirect:

```typescript
export type ActionResult<T = unknown> = 
  | { success: true; data: T; message?: string } 
  | { success: false; errors: Record<string, string[]>; message?: string };
```

---

## 2. Server Action Implementation Rules

1. **Input Validation**: ALWAYS parse incoming form data or JSON payloads using a Zod schema before executing business logic.
2. **Authorize via Middleware**: Route-level protection is enforced via `authMiddleware` or `adminMiddleware`.
3. **Handle Errors Gracefully**: Wrap database operations in try/catch blocks and return descriptive field or form errors.
4. **Type Safety**: Always import `Route` namespace from `./+types/<route-name>` for type-safe `Route.ActionArgs`.
