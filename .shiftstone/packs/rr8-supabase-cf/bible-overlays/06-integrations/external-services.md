---
type: chapter
timestamp: 2026-09-06T00:17:56.927Z
---
# 06 — Integrations & External Services

## 1. Cloudflare R2 Object Storage

Object storage is powered by Cloudflare R2 using standard S3 compatibility:
- **Zero Egress Fees**: Cloudflare does not charge for data transfer out.
- **Client**: AWS SDK S3 client (`@aws-sdk/client-s3`) in `app/lib/r2/client.ts`.
- **Direct Uploads**: Route `api/upload.ts` accepts files up to 10MB.
- **Presigned URLs**: For files > 10MB, generate presigned upload URLs via `@aws-sdk/s3-request-presigner` so clients upload directly to R2, bypassing Worker memory ceilings.
- **Download Streaming**: Presigned download URLs or edge streaming via `routes/api.download.$key.ts`.

---

## 2. Cloudflare Scheduled Workers (Cron Jobs)

- Background workers execute via Cloudflare Cron Triggers declared under `triggers.crons` in `{{APP_PATH}}/wrangler.jsonc`.
- Dispatched to `scheduled(controller, env, ctx)` in `{{APP_PATH}}/workers/app.ts`.
- **Idempotency Guard**: All scheduled tasks acquire a PostgreSQL advisory lock (`SELECT pg_try_advisory_xact_lock(...)`) to prevent concurrent execution across multiple edge instances.
- Always wrap execution in `ctx.waitUntil(...)` to allow background promises to settle.

---

## 3. Webhooks & External Event Processing

- Ingress webhook routes live under `routes/api.webhooks.ts`.
- **Signature Verification**: Always verify HMAC signatures using `crypto.subtle` before parsing request bodies.
- **Idempotency**: Store processed webhook IDs in a `webhook_events` table to prevent duplicate side effects.
