---
type: chapter
timestamp: 2026-09-06T01:31:40.880Z
---
# 02 — Environments and Secrets

## Core Environment Variables

Every developer must maintain a local `.dev.vars` inside `{{APP_PATH}}/` matching this schema. Never commit `.dev.vars` to Git.

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

---

## Secret Management Workflow

### Local Development
In local development, the Cloudflare Vite plugin loads secrets from `apps/web/.dev.vars`:
- Ensure `.dev.vars` is included in `.gitignore`.
- Provide `.dev.vars.example` in `{{APP_PATH}}/` for team members to copy.

### Production (Cloudflare Workers)
Production secrets are securely set via Wrangler CLI:
```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

---

## Monorepo Build Dependencies (`package.json`)

To prevent security warnings and installation prompts in `pnpm`, root and app `package.json` files must explicitly permit build scripts for trusted binaries:

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "esbuild",
    "workerd"
  ]
}
```

---

## Dual-Repo Production Deployment Architecture

Because the workspace operates as a Dual-Repo Monorepo:
1. **Application Deployment Source**: Cloudflare Pages / Workers connects directly to the nested web application repository (`https://github.com/<user>/<project>-app.git`).
2. **Root Directory in Cloudflare Dashboard**: Set root directory to `.` (since the app repository root contains `wrangler.jsonc`, `package.json`, and `vite.config.ts`).
3. **Build Command**: `pnpm run build`
4. **Deploy Output Directory**: `build/client`
5. **Governance Isolation**: The root workspace repository (`<project>-workspace.git`) is completely independent, preventing documentation updates or backlog adjustments from triggering unnecessary production builds.

