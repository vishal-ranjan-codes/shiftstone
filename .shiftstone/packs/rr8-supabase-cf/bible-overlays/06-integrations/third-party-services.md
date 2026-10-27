---
type: chapter-topic
title: "Third-Party Services & Cron Schedulers"
chapter: "06-integrations"
file: "third-party-services.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Cloudflare R2 S3 storage, presigned URLs, and Cloudflare Scheduled Workers (Cron Jobs)."
---

# Integrations — Third-Party Services & Cron Schedulers

## 1. Cloudflare R2 Object Storage

Object storage is powered by Cloudflare R2 using standard S3 compatibility:
- **Zero Egress Fees**: Cloudflare does not charge for egress data transfer.
- **Client**: AWS SDK S3 client (`@aws-sdk/client-s3`) in `app/lib/r2/client.ts`.
- **Direct Uploads**: Route `api/upload.ts` accepts files up to 10MB.
- **Presigned URLs**: For files > 10MB, generate presigned upload URLs via `@aws-sdk/s3-request-presigner` so clients upload directly to R2, bypassing Worker memory limits.
- **Download Streaming**: Presigned download URLs or edge streaming via `routes/api.download.$key.ts`.

---

## 2. Cloudflare Scheduled Workers (Cron Jobs)

- Background workers execute via Cloudflare Cron Triggers declared under `triggers.crons` in `apps/web/wrangler.jsonc`.
- Dispatched to `scheduled(controller, env, ctx)` in `apps/web/workers/app.ts`.
- **Idempotency Guard**: All scheduled tasks acquire a PostgreSQL advisory lock (`SELECT pg_try_advisory_xact_lock(...)`) to prevent concurrent execution across multiple edge instances.
- Always wrap execution in `ctx.waitUntil(...)` to allow background promises to settle before worker isolate shutdown.
