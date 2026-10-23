---
cost_tracking: workflow-end
description: Pre-flight checks, Cloudflare Workers production deployment, and post-deploy documentation.
---

# /deploy — Deployment Workflow

> Use this workflow before every production deployment.
> Enforces quality gates and ensures documentation is updated after shipping.

---

## Phase 1 — Pre-flight Checks

1. Run type check — must pass with **0 errors**:
   ```bash
   {{PACKAGE_MANAGER}} typecheck
   ```
   If errors → run `/diagnose` workflow first.

2. Run tests — must pass with **0 failures**:
   ```bash
   {{PACKAGE_MANAGER}} test
   ```

3. Run build — must pass with **0 errors**:
   ```bash
   {{PACKAGE_MANAGER}} build
   ```

4. Verify Cloudflare secrets and environment variables are configured:
   - Run `npx wrangler secret list` inside `{{APP_PATH}}/`
   - Required production secrets:
     - `SUPABASE_URL`
     - `SUPABASE_PUBLISHABLE_KEY`
     - `SUPABASE_SECRET_KEY`
     - Cloudflare R2 credentials (if using AWS S3 client: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`)

---

## Phase 2 — Deploy Gate

5. **⛔ STOP — Confirm with the user before deploying to production.**

   Ask: *"All pre-flight checks passed. Ready to deploy to Cloudflare production? Confirm with 'yes' to proceed."*

---

## Phase 3 — Deploy

6. Deploy via Wrangler:
   ```bash
   {{PACKAGE_MANAGER}} deploy
   ```
   *(Or run `npx wrangler deploy` directly from `{{APP_PATH}}/`)*

7. Monitor the deployment output and verify the worker URL is healthy.

8. Smoke test primary user flows:
   - Public landing page: `/`
   - Authentication routes: `/sign-in`, `/sign-up`
   - Protected dashboard: `/dashboard`
   - Health check: `/api/health`

---

## Phase 4 — Document

9. Append deployment entry to `{{BIBLE_PATH}}/CHANGELOG.md`.

---

## Post-Write Checkpoint

- [ ] All pre-flight checks passed
- [ ] User gave explicit approval
- [ ] Deployment succeeded
- [ ] Smoke tests passed
- [ ] `{{BIBLE_PATH}}/CHANGELOG.md` updated

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js deploy --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
