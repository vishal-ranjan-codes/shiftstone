---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Endpoint response contracts, built-in endpoints, module rules
---
# 08 — Route & API Contracts

This chapter is the SSOT for **every contract between clients and the server**: request shapes, response shapes, and the endpoint inventory.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/08-api-contracts/` at init (built-in endpoint specs, framework-specific contract patterns).

## Contract Standards

### Endpoint Response Format

Every endpoint returns the shared result shape — success payloads and field-level errors in a structure clients can parse uniformly:

```typescript
export type ActionResult<T = unknown> =
  | { success: true; data: T; message?: string }
  | { success: false; errors: Record<string, string[]>; message?: string };
```

Breaking changes to this shape are architecture changes: update this chapter, the shared type, and every consumer in one reviewed change.

## Built-In Endpoint Specification

Document each built-in endpoint the workspace ships (health, session/user, uploads, downloads, inbound webhooks): path, method, auth requirement, request schema, and response schema.

## Endpoint Module Implementation Rules

1. Validate every input with the project's schema validator before use.
2. Apply the documented auth/role guard — endpoints are never "public by omission".
3. Wrap handler bodies in error handling that maps failures to the result shape.
4. Keep request/response types generated or shared — no hand-duplicated interfaces.
