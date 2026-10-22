---
cost_tracking: workflow-end
description: Run type-checks, lints, tests, and auto-fix compilation errors across the workspace.
---

# /nexus — Build & Quality Verification Checker

> Use this workflow to run type-checks, lints, and automated error diagnostics across the application.

---

## Phase 1: Quality Checks

1. Run the TypeScript type-check (incl. framework typegen where provided):
   ```bash
   {{PACKAGE_MANAGER}} typecheck
   ```

2. Run the linter:
   ```bash
   {{PACKAGE_MANAGER}} lint
   ```

3. Run unit tests:
   ```bash
   {{PACKAGE_MANAGER}} test
   ```

---

## Phase 2: Auto-Remediation

If any failures occur:
1. For framework type-generation errors: re-run the stack's typegen inside `{{APP_PATH}}/` (see the active pack's docs).
2. For database type mismatches: re-run the pack's database type-generation command (see `docs/bible/03-database/`).
3. For lint formatting issues: run `{{PACKAGE_MANAGER}} lint --fix`.
4. If errors persist, transition to `/diagnose` workflow for guided troubleshooting.

---

## Phase 3: Final Verification

Re-run:
```bash
{{PACKAGE_MANAGER}} typecheck && {{PACKAGE_MANAGER}} lint
```
Confirm all checks pass with 0 errors.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js nexus --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
