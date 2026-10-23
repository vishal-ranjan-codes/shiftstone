---
cost_tracking: workflow-end
description: Pre-flight checks, production deployment via the active pack's deploy procedure, and post-deploy documentation.
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

4. Verify environment variables and secrets for the target environment are configured:
   - Consult the active pack's deployment docs (`docs/bible/02-setup-and-devops/`) and the app's env template (e.g. `.env.example`) for the required keys.
   - Confirm every required production secret is set in the deployment platform's secret store — never commit secret values.

---

## Phase 2 — Deploy Gate

5. **⛔ STOP — Confirm with the user before deploying to production.**

   Ask: *"All pre-flight checks passed. Ready to deploy to production? Confirm with 'yes' to proceed."*

---

## Phase 3 — Deploy

6. Deploy using the workspace deploy script defined by the active pack:
   ```bash
   {{PACKAGE_MANAGER}} deploy
   ```
   *(Or run the pack's documented deploy command inside `{{APP_PATH}}/` — see the pack manifest's `spec.workspace.rootScripts`.)*

7. Monitor the deployment output and verify the deployment URL/endpoint is healthy.

8. Smoke test primary user flows:
   - Public landing page: `/`
   - Authentication routes
   - Primary protected area
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
