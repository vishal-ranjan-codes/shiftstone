---
type: chapter
timestamp: 2026-09-06T00:18:08.465Z
---
# 08 — Route & API Contracts

All server-side data loading and mutations in {{PROJECT_NAME}} are handled via React Router 8 route modules and resource routes.

---

## Contract Standards

### Route Action Response Format

Every route action must return a standardized response object or throw a redirect:

```typescript
export type ActionResult<T = unknown> = 
  | { success: true; data: T; message?: string } 
  | { success: false; errors: Record<string, string[]>; message?: string };
```

---

## Built-In Resource Routes Specification

Resource routes export `loader` or `action` without a default React component:

### 1. `GET /api/health`
- **File**: `routes/api.health.ts`
- **Auth**: Public
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-06T12:00:00.000Z",
    "runtime": "cloudflare-workers",
    "version": "1.0.0"
  }
  ```

### 2. `GET /api/user`
- **File**: `routes/api.user.ts`
- **Middleware**: `[supabaseMiddleware, authMiddleware]`
- **Response**:
  ```json
  {
    "id": "uuid-here",
    "email": "user@example.com",
    "created_at": "2026-09-06T12:00:00.000Z"
  }
  ```

### 3. `POST /api/upload`
- **File**: `routes/api.upload.ts`
- **Middleware**: `[supabaseMiddleware, authMiddleware]`
- **Payload**: `multipart/form-data` with `file`
- **Response**:
  ```json
  {
    "success": true,
    "key": "uploads/1725600000-uuid.png",
    "url": "https://pub-account.r2.dev/uploads/1725600000-uuid.png"
  }
  ```

### 4. `GET /api/download/:key`
- **File**: `routes/api.download.$key.ts`
- **Auth**: Public or Protected based on bucket access policy
- **Response**: Binary stream with content-disposition and proper MIME type.

### 5. `POST /api/webhooks`
- **File**: `routes/api.webhooks.ts`
- **Auth**: HMAC signature header check (`X-Webhook-Signature`)
- **Response**: `{ "received": true }`

---

## Route Module Implementation Rules

1. **Input Validation**: ALWAYS parse incoming form data or JSON payloads using a Zod schema before executing business logic.
2. **Authorize via Middleware**: Route-level protection is enforced via `authMiddleware` or `adminMiddleware`.
3. **Handle Errors Gracefully**: Wrap database operations in try/catch blocks and return descriptive error messages.
4. **Type Safety**: Always import `Route` namespace from `./+types/<route-name>` for type-safe `loader`, `action`, and component props.
