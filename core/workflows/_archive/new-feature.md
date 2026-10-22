---
cost_tracking: workflow-end
description: Full feature development loop — from reading the bible to updating documentation after implementation.
---

# /new-feature — Feature Development Workflow

> Use this workflow whenever building a new feature or significant capability.
> This workflow enforces the documentation-first philosophy and prevents bible drift.

**Human effort follows the U-shaped curve (C12):** direction-heavy first,
automated middle, alignment-heavy last. The two human gates are explicit:

```
  Human effort
       ▲   GATE 1                          GATE 2
       │   ▼                                ▼
       │  ███                               ███
       │  ███   automated (agent-owned)     ███
       │  ███  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁  ███
       └──█──────────────────────────────────█──►
        Phases 1–2                      Phases 5–6
        DIRECTION                  ALIGNMENT
```

| Phases | Effort band | Gate |
|---|---|---|
| 1–2 (Understand, Plan) | **DIRECTION** — human-heavy | **Gate 1**: ⛔ spec approval before any code |
| 3–4 (Implement, Verify) | **AUTOMATED** — agent-owned, inner gear | deterministic checks only |
| 5–6 (Document, Align) | **ALIGNMENT** — human-heavy | **Gate 2**: ⛔ Checker sign-off (`/verify` ≥ 0.8) before completion |

Loop counterpart (`docs/loops/new-feature-loop/spec.md`): the same poles are
enforced by the `blocked` terminal state (no approved spec → the loop never
starts) and `brakes.human_gates` on the close-out action
(`mark the backlog task as [x]`) plus push/deploy actions.

---

## Phase 1 — Understand (Effort: DIRECTION — human-heavy)

1. Read `docs/bible/README.md` to understand the documentation map.

2. Read the relevant `{{BIBLE_PATH}}/` section for the feature area:
   - Routing / Loaders / Actions? → `08-api-contracts/route-contracts.md`
   - Auth & Session Guards? → `04-auth-and-rbac/auth-overview.md`
   - Database & RLS? → `03-database/schema-reference.md` & `rls-policies.md`
   - Storage / Uploads? → `06-integrations/external-services.md`
   - UI Architecture? → `07-frontend/ui-architecture.md`

3. Load `.agents/skills/stack/SKILL.md` — understand the code patterns.

4. Load `.agents/skills/docs/SKILL.md` — identify which `{{BIBLE_PATH}}/` files will need updating after implementation.

---

## Phase 2 — Plan (Effort: DIRECTION — human-heavy)

5. Create an **implementation_plan.md artifact** covering:
   - What database changes are needed (new tables, columns, RPCs)
   - What Route definitions in `app/routes.ts` and route modules in `app/routes/` are needed
   - What Loaders, Actions, and Middleware functions are needed
   - What UI changes are needed (design tokens, component-library components)
   - Which `{{BIBLE_PATH}}/` files will be updated after implementation

6. **⛔ STOP — HUMAN GATE 1 (front-loaded spec approval): get explicit user
   approval on the implementation_plan.md artifact before writing any code.**
   This is the first stage's human gate — direction is the human's, and an
   unapproved spec must never reach Phase 3. (The loop equivalent: `blocked`
   without an approved spec.)

---

## Phase 3 — Implement (Effort: AUTOMATED — agent-owned)

0. **Red first — tests + evals BEFORE code.** Before writing any
   implementation code, write the failing test or eval that captures the
   feature's intent contract (unit test for deterministic behavior, eval case
   in `evals/<suite>/cases.jsonl` for non-deterministic behavior). The failing
   red is the proof the check can push back; the loop harness's red-before
   check (A1) refuses a verification that was already green before the change.
   Implementation code is written only to make that red go green.

7. If database changes are needed → run `/new-migration` workflow first.

8. Implement Route Loaders, Actions, and Middleware in `{{APP_PATH}}/app/`:
   - Pattern: Zod validate → retrieve client from context → execute logic → return typed `ActionResult<T>` or data.

9. **If the feature has any UI component — UI Pre-Build Check**:
   - Load `.agents/skills/ui/SKILL.md`.
   - Identify which existing UI components will be used.
   - Confirm layout zone: Public, Auth, Dashboard, or Admin.
   - Confirm semantic tokens are used (`theme-bg-color`, `theme-fg-color`, `theme-fc-heading`, `theme-fc-base`, etc.).
   - Confirm mobile touch targets are at least 44px.

10. If background jobs are needed → run `/new-cron-job` workflow.

---

## Phase 4 — Verify (Effort: AUTOMATED — agent-owned)

11. Run type check — must pass with **0 errors**:
    ```bash
    {{PACKAGE_MANAGER}} typecheck
    ```

12. Run lint check — must pass with **0 errors**:
    ```bash
    {{PACKAGE_MANAGER}} lint
    ```

13. Run unit tests:
    ```bash
    {{PACKAGE_MANAGER}} test
    ```

---

## Phase 5 — Document (Effort: ALIGNMENT — human-heavy)

14. Update every `{{BIBLE_PATH}}/` file identified in Phase 1 using the docs skill mapping table.

15. Append to `{{BIBLE_PATH}}/CHANGELOG.md` — through the bundle log: add the
    `log.md` rows (`_config/conventions.md`) and run
    `node core/scripts/compile-changelog.js`.

16. If any architecture decision was made during implementation: add new DEC-XXX to `DECISIONS.md`.

---

## Phase 6 — Align: Checker Sign-Off (Effort: ALIGNMENT — human-heavy)

**⛔ STOP — HUMAN GATE 2 (back-loaded review).** The loop does not end on the
maker's own word (C12: alignment is human-heavy; Macedo 07: no task complete
without verification).

17. Run `/verify <task-id>` on the backlog task this feature implements:
    - a **disjoint Checker** (fresh context, different agent than the maker)
      scores the finished feature against the frozen rubric;
    - **score ≥ 0.8** → the task may close `[/] → [x]` with the signature
      `- [x] <task> — verified by <model-family> @ <score> (<date>)`;
    - **score < 0.8** → report the gaps; fix and re-verify. No completion,
      no push, no closing the workflow.

---

## Post-Write Checkpoint

Before marking this workflow complete, verify each item:

- [ ] Human Gate 1 passed: implementation_plan.md explicitly approved
- [ ] Type check passes with zero errors: `{{PACKAGE_MANAGER}} typecheck`
- [ ] Lint passes with zero errors: `{{PACKAGE_MANAGER}} lint`
- [ ] Tests pass: `{{PACKAGE_MANAGER}} test`
- [ ] Every `{{BIBLE_PATH}}/` file identified in Phase 1 has been updated
- [ ] Bundle `log.md` rows appended and `node core/scripts/compile-changelog.js` run
- [ ] If any architecture decision was made: a new DEC-XXX entry exists in `DECISIONS.md`
- [ ] Human Gate 2 passed: `/verify <task-id>` verdict ≥ 0.8 recorded on the task line

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node core/scripts/record-run.js new-feature --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `core/context/cost-tracker.json`.
