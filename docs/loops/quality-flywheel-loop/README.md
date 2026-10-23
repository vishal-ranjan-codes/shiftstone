---
type: readme
timestamp: 2026-10-12T03:15:00.000Z
---
# quality-flywheel-loop

**Purpose:** continuous quality flywheel (amendment B5) — run the eval
suites, cluster failures by their `cluster` label, open one backlog item per
cluster, and regression-verify on fix.

**Invocation:**

```sh
node .shiftstone/harness/cli.js run quality-flywheel-loop      # manual trigger
node .shiftstone/harness/cli.js status quality-flywheel-loop   # oversight/budget/state
node .shiftstone/harness/cli.js validate quality-flywheel-loop # refusal gate
```

**Expected terminal states:**

| Situation | Terminal |
|---|---|
| Eval suite green | `no_op` |
| New failures, clusters proposed | `success` (red→green on the coverage gate) |
| Eval runner broken / ledger unwritable | `blocked` |
| 2 turns without a coverage change | `stalled` |
| 10 iterations / 30 min wall-clock | `exhausted` |

**Design:** failures come from `evals/runs.jsonl` (written by
`.shiftstone/harness/evals/run.js`); the turn script `flywheel.js` clusters by label
and appends one item per cluster to
`.loops/quality-flywheel-loop/backlog-proposals.md`. Promotion into
`docs/backlog/` is a human-gated step. Red-green on (A1) with a
`worktree-snapshot` baseline (A2); worst-first ordering (A3); enumeration over
the failing cases (A4).
