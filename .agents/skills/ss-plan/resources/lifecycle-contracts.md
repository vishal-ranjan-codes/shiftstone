# Planning Lifecycle Contracts & Execution Harness

This document describes the machine-verifiable planning lifecycle in the ShiftStone workspace: data schemas, execution commands, state projection, and verification gates.

---

## 1. Lifecycle Artifact Hierarchy

| Artifact | Schema / Format | Role & Creation Time |
| :--- | :--- | :--- |
| **Stage Contract** | `ICM Stage` Markdown | Authored at planning time (`phase-<N>-<name>.md` or `CONTEXT.md`). Specifies objectives, inputs ($\le 8$), process units, outputs, verification levels, and detailed unit specs. |
| **Plan Manifest** | `plan-manifest/v1` | Authored at planning time (`plan-manifest.json`). Defines static phase DAG (`dependsOn`), unit mappings, check runners, and regression obligations. |
| **Plan Unit** | `plan-unit/v1` | Authored at planning time (`plan-units/U<n>.json`). Captures granular requirement IDs, acceptance criteria, inputs, outputs, verification commands, and 4-scenario coverage. |
| **Runtime State** | `plan-state/v1` | Maintained by tools during execution (`output/state.json`). Recomputed dynamically from the manifest, selected handoffs, and checker reports via `.shiftstone/scripts/lib/plan-state.js`. |
| **Handoff Attempt** | `plan-handoff/v1` | Appended at boundaries during execution (`output/handoffs/P<n>/attempt-<nnn>.json`). Captures immutable observed facts, pre/post source snapshots, runner check evidence, and preservation logs. |
| **README Status Span** | Markdown table | Managed display between `<!-- plan-status:start -->` and `<!-- plan-status:end -->` in `README.md`. Kept in sync via `plan render --write`. |

> **Invariant**: `output/state.json` and handoff attempts are **never invented during plan authoring**. They are produced strictly during actual phase execution and verified by `validate-plan-evidence.js`.

---

## 2. Planning Commands & Tooling

The workspace harness provides the `.shiftstone/scripts/plan.js` CLI entrypoint (with wrapper `bin/plan.js` and root npm scripts):

```bash
# 1. Inspect suite status and phase axes
node .shiftstone/scripts/plan.js status <suite-path> [--json]
npm run plan:status -- <suite-path>

# 2. Generate honest resume packet for a phase
node .shiftstone/scripts/plan.js resume <suite-path> --phase P1 [--mode implement|remediate] [--json]
npm run plan:resume -- <suite-path> --phase P1

# 3. Begin phase execution (records entry snapshot and preservation inventory)
node .shiftstone/scripts/plan.js begin <suite-path> --phase P1 [--expected-revision N]
npm run plan:begin -- <suite-path> --phase P1

# 4. Verify an automated check defined in manifest
node .shiftstone/scripts/plan.js verify <suite-path> --phase P1 --check check-foundation-build
npm run plan:verify -- <suite-path> --phase P1 --check <check-id>

# 5. Record checkpoint or interrupted boundary
node .shiftstone/scripts/plan.js checkpoint <suite-path> --phase P1 --facts <path-to-facts.json> [--expected-revision N]
npm run plan:checkpoint -- <suite-path> --phase P1 --facts <path-to-facts.json>

# 6. Verify strict acceptance gates and close phase
node .shiftstone/scripts/plan.js close <suite-path> --phase P1 --facts <path-to-facts.json> [--expected-revision N]
npm run plan:close -- <suite-path> --phase P1 --facts <path-to-facts.json>

# 7. Check or update managed README status table
node .shiftstone/scripts/plan.js render <suite-path> --check
node .shiftstone/scripts/plan.js render <suite-path> --write [--expected-revision N]
npm run plan:render -- <suite-path> --write
```

### Exit Codes:
- `0`: Valid successful action.
- `1`: Invalid schema, broken reference, malformed manifest, or inconsistent artifacts.
- `2`: Valid state but requested execution/close blocked by readiness (e.g. unmet predecessor dependencies or open acceptance gates).
- `3`: Stale revision (CAS mismatch), lock contention, or interrupted atomic update.

---

## 3. Four Status Projection Axes

Phase state is derived across four orthogonal axes:

1. **Implementation**: `planned` → `in-progress` → `implemented`
2. **Verification**: `not-run` → `pending` → `failed` | `passed`
   - Automated tests require actual runner exit code `0` and matching source digests.
   - Any required failed check produces `failed`.
   - In-flight source modifications during a check result in `blocked` (pending).
3. **Review**: `not-requested` → `pending` → `blocked` | `rejected` | `approved`
   - Must reference an actual disjoint checker report (`checker-report/v1`) with matching planning source and definition digests.
   - Self-issued reviews (where reviewer equals maker) are strictly rejected.
4. **Acceptance**: `open` → `complete`
   - Becomes `complete` **only when**:
     - `implementation === 'implemented'`
     - `verification === 'passed'` (all required checks passed and fresh)
     - `review === 'approved'` (if review is required)
     - Human approval valid (if Level 5 protected surface touched)
     - Zero blocking issues.
