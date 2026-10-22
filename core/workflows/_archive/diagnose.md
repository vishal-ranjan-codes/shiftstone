---
cost_tracking: workflow-end
description: Diagnose and fix type, lint, and build errors in the workspace (inner-gear diagnostic loop).
---

# Workflow: Diagnose & Troubleshoot

Use this workflow when compilation checks, type checks, lint checks, or framework build checks fail in the {{PROJECT_NAME}} workspace.

---

## Phase 1: Run Diagnostics

1. Run the framework type-check (including codegen/typegen where the stack provides it):
   ```bash
   {{PACKAGE_MANAGER}} typecheck
   ```
2. Locate specific error messages, file paths, and line numbers.

---

## Phase 2: Diagnostic & Correction Checklist

Follow this checklist based on the error type:

### 1. Framework Type Generation (typegen) Errors
- Generated types live under the framework's codegen output directory (see the active pack's docs for its location).
- If an import of a generated route/handler type fails:
  - Verify the module is declared in the framework's route entry point.
  - Re-run the stack's typegen inside `{{APP_PATH}}/` (see the active pack's docs).
  - Ensure the module has a valid entry export.

### 2. TypeScript / Database Schema Errors
- If generated database types mismatch the schema, regenerate them with the pack's documented type-generation command (see `docs/bible/03-database/`).
- Verify the generated types file is imported correctly by the data-layer clients.

### 3. Middleware & Context Errors
- In route middleware/hooks: verify the context setters (request-scoped clients, user context) are called correctly.
- In loaders/actions/handlers: verify context getters are typed properly.

### 4. Runtime Incompatibilities
- If errors indicate `process` or Node built-in modules are not found on the target runtime:
  - Check the runtime's compatibility flags/config in the pack's runtime config file.
  - Replace non-portable libraries with runtime-agnostic or Web-standard equivalents (e.g. Fetch API, Web Crypto).

### 5. Linter & Style Errors
- Run the package manager linter:
   ```bash
   {{PACKAGE_MANAGER}} lint
   ```

---

## Phase 3: Final Verification

1. Re-run compilation checks:
   ```bash
   {{PACKAGE_MANAGER}} typecheck
   ```
2. Confirm compiler passes with zero errors.

---

## Post-Write Checkpoint

- [ ] TypeScript compiler runs clean (`typecheck`)
- [ ] Linter returns no errors (`lint`)

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js diagnose --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
