---
cost_tracking: workflow-end
description: Diagnose and fix type, lint, and build errors in the workspace (inner-gear diagnostic loop).
---

# Workflow: Diagnose & Troubleshoot

Use this workflow when compilation checks, type checks, lint checks, or React Router build checks fail in the {{PROJECT_NAME}} workspace.

---

## Phase 1: Run Diagnostics

1. Run the React Router typegen and TypeScript compiler:
   ```bash
   {{PACKAGE_MANAGER}} typecheck
   ```
2. Locate specific error messages, file paths, and line numbers.

---

## Phase 2: Diagnostic & Correction Checklist

Follow this checklist based on the error type:

### 1. React Router Route Types & Typegen
- Route types are generated under `.react-router/types/app/routes/+types/`.
- If an import like `import type { Route } from "./+types/my-route"` fails:
  - Verify the route is declared in `{{APP_PATH}}/app/routes.ts`.
  - Re-run typegen: `npx react-router typegen` inside `{{APP_PATH}}/`.
  - Ensure the route file has a valid `default` export component.

### 2. TypeScript / Database Schema Errors
- If types for Supabase tables or RPCs mismatch, regenerate the types:
  ```bash
  {{SUPABASE_TYPES_CMD}}
  ```
- Verify `database.types.ts` is imported correctly in `{{APP_PATH}}/app/lib/supabase/client.ts` and `admin.ts`.

### 3. Middleware & Context Errors
- In route middleware: verify `context.set(supabaseContext, supabase)` and `context.set(userContext, user)` are called correctly.
- In loaders and actions: verify `context.get(supabaseContext)` is typed properly.

### 4. Cloudflare Edge Runtime Incompatibilities
- If errors indicate `process` or Node built-in modules are not found:
  - Check that `"compatibility_flags": ["nodejs_compat"]` is in `wrangler.jsonc`.
  - Replace non-edge libraries with edge-compatible or Web standard equivalents (e.g. Fetch API, Web Crypto).

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
node .shiftstone/scripts/record-run.js diagnose --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
