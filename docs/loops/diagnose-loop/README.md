---
type: readme
timestamp: 2026-10-12T02:29:53.226Z
---
# diagnose-loop

**Purpose:** deterministic (L1, inner-gear) loop that drives `core/` back to a
green typecheck/lint state after changes.

**Invocation:**

```sh
node .shiftstone/harness/cli.js run diagnose-loop      # manual trigger
node .shiftstone/harness/cli.js status diagnose-loop   # oversight/budget/state
node .shiftstone/harness/cli.js validate diagnose-loop # refusal gate
```

**Expected terminal states:**

| Situation | Terminal |
|---|---|
| `core/` typechecks cleanly | `no_op` |
| errors present, fixable by an agent turn | `success` (red→green proven) |
| 2 turns without error reduction | `stalled` |
| 10 iterations / 30 min wall-clock | `exhausted` |

**Design:** red-green on (A1) with a `worktree-snapshot` baseline (A2);
worst-first ordering (A3); budget 10 iterations, 2 barren-turn brake;
`oversight: out` (routine, reversible edits only).
