# evals — Labeled Evaluation Suites (B1)

Tests verify the deterministic parts; evals verify the non-deterministic parts
(trajectory, tool use, response quality). Without both, it is always vibe coding.

## Layout

```
evals/
├── README.md               ← this file
├── runs.jsonl              ← appended results (clustered by quality-flywheel-loop)
├── _template/cases.jsonl   ← copy this to start a suite (never executed: `_` prefix is skipped)
└── <suite-name>/
    ├── cases.jsonl         ← one JSON case per line (labeled dataset)
    └── suite.json          ← optional: { "min_pass_rate": 1.0 }
```

## Running

```sh
node .shiftstone/harness/evals/run.js               # all suites, warn mode
node .shiftstone/harness/evals/run.js --suite X     # one suite
node .shiftstone/harness/evals/run.js --strict      # CI gate: exit 1 on regression
```

CI runs every suite on push/PR via `.github/workflows/evals-in-ci.yml`.
A loop runs its registered suite each verification turn via
`verification.eval_suite: <suite-name>` in its spec.

## Case fields

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Stable case id (used in results + clustering) |
| `kind` | yes | `exact` \| `contains` \| `regex` \| `command` \| `trajectory` \| `rubric` |
| `input` / `expected` | for value kinds | Observed value / expected value or pattern |
| `command` (+ `exit_code`) | for `command` | Shell command; exit code decides (default 0) |
| `trajectory` + `claimed_checks` | for `trajectory` | Recorded tool calls vs. checks the agent claims it ran |
| `cluster` | recommended | Root-cause label; one backlog item per cluster (B5) |
| `tags` | no | Freeform labels |

`rubric` cases are skipped by the runner — scoring against the 5-dimension
schema (`.shiftstone/harness/evals/rubric-schema.json`) is the L4 Checker's job
during loop verification, where the judge returns per-dimension scores.
