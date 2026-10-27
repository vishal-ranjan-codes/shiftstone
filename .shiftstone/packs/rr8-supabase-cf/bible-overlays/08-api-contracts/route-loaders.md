---
type: chapter-topic
title: "Route Loaders & Built-In Endpoints"
chapter: "08-api-contracts"
file: "route-loaders.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Server data loaders, typegen contracts (+types/), cache-control policies, and built-in resource routes."
---

# API Contracts — Route Loaders & Built-In Endpoints

## 1. Loader Implementation Rules

1. **Context Ingestion**: Read database and authentication clients directly from `context.get(supabaseContext)` and `context.get(userContext)`.
2. **Type Safety**: Use automatic type generation `./+types/<route-name>` for loader return typing (`Route.LoaderArgs`, `Route.ComponentProps`).
3. **Response Caching**: Add appropriate `Cache-Control` headers for public resource loaders.

---

## 2. Built-In Resource Routes Specification

Resource routes export `loader` or `action` without a default React component:

### 1. `GET /api/health`
- **File**: `routes/api.health.ts`
- **Auth**: Public
- **Response**: `{ "status": "healthy", "timestamp": "...", "runtime": "cloudflare-workers", "version": "1.0.0" }`

### 2. `GET /api/user`
- **File**: `routes/api.user.ts`
- **Middleware**: `[supabaseMiddleware, authMiddleware]`
- **Response**: `{ "id": "uuid", "email": "user@example.com", "created_at": "..." }`

### 3. `POST /api/upload`
- **File**: `routes/api.upload.ts`
- **Middleware**: `[supabaseMiddleware, authMiddleware]`
- **Payload**: `multipart/form-data` with `file`
- **Response**: `{ "success": true, "key": "uploads/...", "url": "https://..." }`

### 4. `GET /api/download/:key`
- **File**: `routes/api.download.$key.ts`
- **Auth**: Public or Protected based on bucket access policy
- **Response**: Binary stream with content-disposition and proper MIME type.

### 5. `POST /api/webhooks`
- **File**: `routes/api.webhooks.ts`
- **Auth**: HMAC signature header check (`X-Webhook-Signature`)
- **Response**: `{ "received": true }`
