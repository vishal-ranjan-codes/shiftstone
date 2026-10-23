# ss-deploy — Production Deployment & Quality Gate Guide

Procedure for executing pre-flight quality checks, Level 5 human deployment sign-off, live platform release, and smoke verification.

---

## Iron Law

1. **Level 5 Protected Action Gate (UG-23, UG-24):** ⛔ STOP — Production deploy is a Level 5 protected action (`actionClass: "production-deploy"`). Never deploy without an active, non-expired human approval artifact in `.shiftstone/governance/approvals/APR-*.json`. Missing approval halts deterministically in terminal state `blocked`.
2. **Zero-Defect Pre-Flight & Workspace Pipeline:** Pre-flight checks (`pnpm typecheck`, `pnpm test`, `pnpm build`) and workspace validation (`npm run validate:workspace`) MUST pass with 0 errors and 0 failures. Never deploy broken or untested code.
3. **Never Commit Secrets:** Production secrets and credentials must be injected via platform secret stores or encrypted environment variables. Never commit `.env` or raw API keys.
4. **Mandatory Post-Deploy Smoke Test & Release Evidence:** Every deployment must verify live health endpoints (`/api/health`) and certify evidence with `node .shiftstone/scripts/validate-release-evidence.js`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"Tests failed on a minor UI component, but the backend deploy is safe."* | **Forbidden.** Failed tests indicate uncontrolled regressions. Fix all tests before deployment. |
| *"The user commanded '/deploy', so I can deploy immediately without asking."* | **Forbidden (Level 5 Gate).** Production deploy requires a validated human approval file (`APR-YYYYMMDD-XXX.json`). Without it, execution is `blocked`. |
| *"I don't need to check the live health endpoint."* | **Forbidden.** Builds that pass locally can fail in production due to runtime environment mismatches or missing secrets. |
| *"I can skip release evidence validation for hotfixes."* | **Forbidden.** `validate-release-evidence.js` must verify L1–L5 gates before marking release done. |

---

## Deployment Procedure

### Phase 1: Pre-Flight & Workspace Validation
Run the full pre-flight and workspace validation suite:
```bash
pnpm typecheck && pnpm test && pnpm build
npm run validate:workspace
```
Confirm zero errors. Verify that all required production secrets are configured in the platform console.

### Phase 2: Level 5 Protected Action Approval Gate
1. Verify active human approval artifact exists:
   ```bash
   node .shiftstone/scripts/validate-protected-actions.js
   ```
2. Confirm the approval in `.shiftstone/governance/approvals/APR-*.json`:
   - `actionClass === "production-deploy"`
   - `status === "active"`
   - `expiresAt > now`
   - Signed by a human identity (rejects agent IDs).
3. If approval is absent or expired $\rightarrow$ halt immediately with terminal state `blocked`.

### Phase 3: Platform Deployment
Execute the active pack's deploy script:
```bash
pnpm deploy
```
Monitor build output, verify release hashes, and record production URL.

### Phase 4: Smoke Test & Health Check
1. Query health endpoint: `/api/health`.
2. Verify public landing route: `/`.
3. Verify session/auth flow.

### Phase 5: Post-Deploy Documentation & Release Evidence
1. Append deployment release entry to `docs/bible/CHANGELOG.md`.
2. Validate release evidence bundle:
   ```bash
   node .shiftstone/scripts/validate-release-evidence.js
   ```

---

## Verification Ladder

- **L1 (Pre-Flight):** Typecheck, unit test, build, and `validate:workspace` exit 0.
- **L2 (Secret Guard):** Secret scanner confirms zero credentials in git diff.
- **L3 (Human Gate):** Active Level 5 human approval artifact present in `.shiftstone/governance/approvals/`.
- **L4 (Smoke Test):** Live `/api/health` returns status 200 OK.
- **L5 (Release Evidence & Changelog):** `validate-release-evidence.js` passes and `CHANGELOG.md` updated.

---

## Terminal States

- `success`: Deployed to production, smoke tests verified, release evidence certified, changelog updated.
- `blocked`: Pre-flight failure, missing/expired Level 5 human approval, or failed release evidence gate (mechanical halt).
- `escalated`: Production smoke test failed post-deploy or runtime outage requiring human architectural judgment/rollback.
