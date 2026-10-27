---
type: chapter-topic
title: "Local Environment & Secrets Setup"
chapter: "02-setup-and-workflow"
file: "local-environment.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Local .dev.vars configuration, Supabase API keys, Cloudflare R2 secrets, and pnpm build dependencies."
---

# Setup & Workflow — Local Environment & Secrets Setup

## 1. Core Environment Variables

Every developer must maintain a local `.dev.vars` inside `apps/web/` matching this schema. Never commit `.dev.vars` to Git.

```bash
# Supabase Configuration (Supabase 2025/2026 Standard Keys)
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_your-publishable-key"
SUPABASE_SECRET_KEY="sb_secret_your-secret-key" # SERVER ONLY (Cloudflare Workers / Admin)

# Cloudflare R2 Storage (Optional)
CLOUDFLARE_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="your-bucket-name"
R2_PUBLIC_DOMAIN="pub-your-account-id.r2.dev"

# Webhooks & Security (Optional)
WEBHOOK_SECRET="your-webhook-secret"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

> [!WARNING]
> The `SUPABASE_SECRET_KEY` bypasses all Row-Level Security (RLS). It must NEVER be exposed to browser clients or placed in public variables. In production, configure secrets via `wrangler secret put <KEY>`.

## 2. Monorepo Build Dependencies (`package.json`)

To prevent security warnings and installation prompts in `pnpm`, root and app `package.json` files must explicitly permit build scripts for trusted binaries:

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "esbuild",
    "workerd"
  ]
}
```
