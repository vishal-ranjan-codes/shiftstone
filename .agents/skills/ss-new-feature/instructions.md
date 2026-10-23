# ss-new-feature — Feature Development Lifecycle Guide

End-to-end procedure for scoping, planning, implementing, and documenting new features in the ShiftStone framework.

---

## Iron Law

1. **Physical Plan Output via `/ss-plan`:** Feature planning MUST delegate to `/ss-plan` and output physical files in `docs/plans/<feature-slug>/`. Never output plans to temporary IDE brain artifacts.
2. **Human Gate 1 (Spec Approval):** ⛔ STOP — Never write implementation code before obtaining explicit human approval on the implementation plan in `docs/plans/<feature-slug>/`.
3. **Red-First TDD Invariant:** Implement failing test scenario(s) capturing the feature contract BEFORE writing production code.
4. **Mandatory Documentation Parity:** Every feature shipped MUST update the corresponding `docs/bible/` chapters and `CHANGELOG.md` before marking the task complete.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll draft a quick temporary plan in chat first."* | **Forbidden.** Plans outside `docs/plans/` do not persist. Delegate directly to `/ss-plan` in `docs/plans/<feature-slug>/`. |
| *"The user asked for the feature now, so I can skip Gate 1."* | **Forbidden.** Gate 1 guarantees alignment on scope, edge cases, and non-goals. Unapproved code causes architectural drift. |
| *"I'll update the Bible later when the next feature is done."* | **Forbidden.** Documentation drift is compounding. Update `docs/bible/` immediately after verification passes. |

---

## The U-Shaped Lifecycle

### Phase 1 — Understand (Effort: DIRECTION — Human-Heavy)
1. Read `docs/bible/README.md` and relevant SSOT chapters:
   - Routes/Loaders/Actions $\rightarrow$ `08-api-contracts/route-contracts.md`
   - Auth & Session Guards $\rightarrow$ `04-auth-and-rbac/auth-overview.md`
   - Database & RLS $\rightarrow$ `03-database/schema-reference.md`
   - UI Architecture $\rightarrow$ `07-frontend/ui-architecture.md`
2. Load relevant specialist skills indicated by the active pack's pre-flight matrix.

### Phase 2 — Plan (Effort: DIRECTION — Human-Heavy)
3. Invoke `/ss-plan` to author `docs/plans/<feature-slug>/CONTEXT.md` (or plan suite).
4. **⛔ STOP — HUMAN GATE 1:** Obtain explicit human sign-off on the physical plan in `docs/plans/` before writing any code.

### Phase 3 — Implement (Effort: AUTOMATED — Agent-Owned)
5. Run pre-flight gate:
   ```bash
   node .shiftstone/scripts/agent-preflight.js --target "<targetFiles>" --verify-cmd "npm test"
   ```
6. Red First: write failing tests proving the requirement.
7. Green: implement minimal code to pass tests.
8. Refactor using `/ss-simplify`.

### Phase 4 — Document & Align (Effort: ALIGNMENT — Human-Heavy)
9. Update `docs/bible/` chapters per `/ss-docs` mapping and append to `docs/bible/CHANGELOG.md`.
10. **⛔ STOP — HUMAN GATE 2:** Run `/ss-verify <task-id>` to spawn a disjoint Checker before closing task.

---

## Verification Ladder

- **L1 (Syntax & Pre-Flight):** Valid receipt from `agent-preflight.js`; zero typecheck errors.
- **L2 (Unit & Contract Tests):** Automated feature tests pass green.
- **L3 (Budget Gate):** Code and documentation obey line and byte ceilings.
- **L4 (Checker Review):** Disjoint Checker verifies spec compliance and code quality.
- **L5 (Human Acceptance):** Human developer reviews diff and signs off.

---

## Terminal States

- `success`: Feature implemented, tested, documented in Bible, and signed off.
- `blocked`: Spec rejected by human at Gate 1 or pre-flight gate failure.
- `escalated`: Disputed architectural design requiring technical lead decision.
