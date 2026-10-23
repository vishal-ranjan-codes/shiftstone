
# Cloudflare CI/CD Deployment Skill

> Load this skill when configuring GitHub Actions workflows, deploying to Cloudflare Workers, or managing production secrets.

---

## 1. Production Deployment Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test --run

      - name: Build
        run: pnpm build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_PUBLISHABLE_KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
          SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
```

---

## 2. Secrets Management

Set production secrets via the Wrangler CLI or GitHub repository secrets:

```bash
# Push secret to Cloudflare Workers
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

---

## 3. Pre-Flight Checklist

Before deploying:
- [ ] Run `pnpm typecheck` (`react-router typegen && tsc`) $\rightarrow$ 0 errors.
- [ ] Run `pnpm lint` $\rightarrow$ 0 errors.
- [ ] Run `pnpm test --run` $\rightarrow$ all tests passing.
- [ ] Verify `wrangler.jsonc` has `"compatibility_flags": ["nodejs_compat"]`.
- [ ] Confirm all database migrations are applied to production Supabase.
