# ss-nexus — Build & Quality Verification Runner Guide

Procedure for running compiler, linter, and unit test suites with deterministic automated remediation.

---

## Iron Law

1. **Deterministic Execution:** Always run official workspace typecheck, lint, and test scripts. Never fabricate ad-hoc compilation commands.
2. **Zero Suppression Gaming:** Never resolve compilation or lint errors by adding `@ts-ignore`, `@ts-expect-error`, or `eslint-disable`. Fix the underlying type or code defect.
3. **Clean Baseline Required:** If errors persist after automated typegen and lint fixes, transition immediately to `/ss-diagnose`.
4. **Physical Disk Edits Only:** Apply fixes directly to source files. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll add @ts-ignore to suppress this route type error."* | **Forbidden (Anti-Gaming).** Route type errors indicate mismatched loader/action contracts or stale typegen. |
| *"Vitest passed, so I can skip running the linter."* | **Forbidden.** Code cleanliness and lint compliance are required for green build status. |
| *"The error is in generated files, so I'll edit the generated code."* | **Forbidden.** Hand-editing generated files is overwritten on next build. Regenerate via proper CLI command. |

---

## Execution Procedure

### Step 1: Run Quality Suites
```bash
pnpm typecheck
pnpm lint
pnpm test
```

### Step 2: Automated Remediation Pass
If checks fail, apply deterministic fixes in order:
1. **Framework Typegen Errors:** Re-run stack type generation command.
2. **Database Type Mismatches:** Re-run database type generator (e.g. `npm run db:types`).
3. **Linter Formatting Issues:** Run `pnpm lint --fix`.

### Step 3: Verification Checkpoint
Re-run compilation and linter:
```bash
pnpm typecheck && pnpm lint
```
- If 100% clean $\rightarrow$ record run and succeed.
- If errors persist $\rightarrow$ hand off to `/ss-diagnose`.

---

## Verification Ladder

- **L1 (Compilation):** Typecheck command exits 0 with zero diagnostics.
- **L2 (Linter):** Linter exits 0 with zero warnings or errors.
- **L3 (Tests):** Unit tests pass 100% green.
- **L4 (Checker Review):** Verify zero suppression tags added.
- **L5 (Log Record):** Append run telemetry to `.loops/nexus/runs.jsonl`.

---

## Terminal States

- `success`: Workspace compiler, linter, and tests pass 100% green.
- `no_op`: Workspace already clean before run.
- `blocked`: Unresolvable build error handed off to `/ss-diagnose`.
