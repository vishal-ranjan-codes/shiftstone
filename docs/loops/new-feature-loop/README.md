---
type: readme
timestamp: 2026-10-12T02:30:05.507Z
---
# new-feature-loop

**Purpose:** outer-gate (L4, maker-checker) loop that takes an approved feature
spec through implementation, verification and sign-off — the loop-driven
replacement for the linear `/new-feature` workflow.

**Invocation:**

```sh
node core/harness/cli.js run new-feature-loop      # manual trigger
node core/harness/cli.js status new-feature-loop
node core/harness/cli.js validate new-feature-loop
```

**Expected terminal states:**

| Situation | Terminal |
|---|---|
| no approved spec at `docs/plans/<id>/02_design/output/spec.md` | `blocked` (spec not approved) |
| tree clean + checks pass + no work to do | `no_op` |
| L4 judge ≥ 0.8 twice with all spec tasks addressed | `success` |
| gated action (`git push`, `gh pr create`, `/deploy`) denied under `oversight: in` | `blocked` |
| 2 barren turns | `stalled` |
| 10 iterations / $15 / 500k tokens | `exhausted` |

**Design:** L4 with mandatory disjoint checker (`maker_checker: true`,
`architecture: maker_checker`), frozen rubric, `success_streak: 2`,
hold-out set, enumeration of spec task checkboxes (A4), `oversight: in` with
three human gates (A8), Ralph fresh-context actuation, red-green disabled at
L4 (proof is the judge + deterministic pre-check), baseline
`worktree-snapshot` (A2) with auto-rollback on regression.
