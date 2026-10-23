---
type: readme
timestamp: 2026-10-12T02:29:53.224Z
---
# schema-sync-loop

**Purpose:** deterministic (L1) three-way diff loop across the bible schema
reference, Supabase migrations, and generated TypeScript types.

**Invocation:**

```sh
node .shiftstone/harness/cli.js run schema-sync-loop       # manual trigger
node .shiftstone/harness/cli.js trigger schema-sync-loop   # event/git-hook receiver
node .shiftstone/harness/cli.js watch schema-sync-loop     # file-watch trigger
node .shiftstone/harness/cli.js status schema-sync-loop
```

**Expected terminal states:**

| Situation | Terminal |
|---|---|
| all 3 sources present and matching | `no_op` |
| drift that an agent turn resolves | `success` |
| a source is missing (no Supabase project) | `blocked` (exit 78 escalate) |
| 2 turns without diff reduction | `stalled` |
| 3 iterations / 100k tokens | `exhausted` |

**Design:** red-green on (A1) with `worktree-snapshot` baseline (A2);
`output_hash_unchanged` stagnation detector; budget 3 iterations / 100k
tokens; `oversight: out`.
