---
type: chapter-topic
title: "Webhooks & External Event Ingress"
chapter: "06-integrations"
file: "webhooks.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Ingress webhook endpoints, HMAC SHA-256 signature verification, idempotency records, and replay defense."
---

# Integrations — Webhooks & External Event Ingress

## 1. Webhook Receivers

Ingress webhook routes live under `routes/api.webhooks.ts` or provider-specific resource routes (e.g. `routes/api.stripe.webhook.ts`).

## 2. Cryptographic Signature Verification

Always verify cryptographic HMAC signatures using the Web Crypto API (`crypto.subtle`) before reading or parsing the request payload:
- Retrieve raw payload as ArrayBuffer or text.
- Compute HMAC SHA-256 with configured secret (`WEBHOOK_SECRET`).
- Reject immediately with HTTP 401 if signature mismatch occurs.

## 3. Idempotency & Replay Defense

Store processed event IDs in an append-only `webhook_events` table:
```sql
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
If `event_id` already exists, return HTTP 200 `{ "received": true, "duplicate": true }` without repeating side effects.
