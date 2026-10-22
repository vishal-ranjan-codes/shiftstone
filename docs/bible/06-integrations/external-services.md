---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Object storage, background jobs, external APIs
---
# 06 — Integrations & External Services

This chapter is the SSOT for **everything outside the system boundary**: object storage, scheduled/background work, and third-party APIs.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/06-integrations/` at init.

## Object Storage

Document each storage bucket/service: purpose, credentials, upload/download flow, and the URL strategy (presigned vs proxied) — including the file-key convention the app writes.

## Background & Scheduled Work

Document every scheduled/background job: trigger schedule, handler location, idempotency strategy, and the lock/claim mechanism that prevents double execution.

## Webhooks & External Event Processing

- **Idempotency**: every inbound webhook handler must be safe to run twice — record processed event IDs.
- **Signature verification**: verify the provider's HMAC/signature over the raw request body **before** parsing it; reject on mismatch.
- **Timeouts & retries**: bound external calls; document the retry/backoff policy per integration.
