name: quality-flywheel-loop
description: Continuous quality flywheel â€” run the eval suites, cluster failures by root cause, open one backlog item per cluster, regression-verify on fix (B5).
use_when: |
  Eval runs have produced failures that need clustering into root causes,
  or a periodic sweep is needed to confirm every failing case is tracked.
trigger:
  type: manual
goal:
  statement: Every currently-failing eval case is clustered and covered by an open backlog item; fixes regression-verify green on the next run.
  type: verifiable
execution:
  isolation:
    mode: none
    network: none
    credentials: none
  baseline: worktree-snapshot
  ordering: worst-first
  steps:
    - Run every eval suite (node .shiftstone/harness/evals/run.js) for fresh labeled results
    - Read the latest failures and group them by their cluster label
    - Open one backlog item per uncovered cluster in the proposals ledger
    - Regression-verify: after a fix lands, re-run the loop and confirm the cluster closes green
    - Promote closed-cluster backlog items into docs/backlog/ after human review
  skills:
    - ss-docs
    - vitest-testing
  enumerate: node .shiftstone/harness/evals/flywheel.js --list-failures
  turn_command: node .shiftstone/harness/evals/flywheel.js
verification:
  ladder_level: 1
  command: node .shiftstone/harness/evals/flywheel.js --verify
  expected_exit: 0
  red_green: true
  success_streak: 1
  maker_checker: false
brakes:
  budget:
    max_iterations: 10
    max_wallclock_s: 1800
    sub_loop_multiplier: 0.5
  stagnation:
    max_barren_turns: 2
    detector: consecutive_no_progress
  human_gates:
    - promote backlog item
terminal_states:
  success: "every failing eval case is covered by an open backlog item; red-before/green-after proven on the coverage gate"
  no_op: "no failing eval cases â€” the suite is green, nothing to cluster"
  blocked: "the eval runner cannot execute or the proposals ledger is unwritable â†’ escalate"
  stalled: "2 consecutive turns without a coverage change â†’ abort, preserve the ledger"
  exhausted: "max_iterations or wall-clock ceiling hit before all failures were clustered"
memory:
  location: .loops/quality-flywheel-loop/state.json
  format: json
  curated: true
  fresh_context_each_turn: false
architecture: solo
actuation: /goal
oversight: out
model:
  task_class: monitoring
pattern_families:
  - A_define_done
  - B_act_without_breaking
  - D_sustain
health_metric:
  name: cost_per_accepted_change
  track_dollars: true
  track_tokens: true
