name: diagnose-loop
description: Detect and fix type/lint compile errors in the core harness (inner-gear, deterministic L1 loop).
use_when: |
  Type errors, lint failures, or a broken compile state after changes to core/.
  Inner-gear loop: no /verify outer-gate required.
trigger:
  type: manual
goal:
  statement: core/ passes typecheck and lint with zero errors.
  type: verifiable
execution:
  isolation: none
  baseline: worktree-snapshot
  ordering: worst-first
  steps:
    - Run pnpm -C core typecheck to enumerate compile errors (worst first)
    - Fix one error per turn with a single targeted edit
    - Re-run typecheck; keep the change only if the error count drops
  skills:
    - stack
    - vitest-testing
verification:
  ladder_level: 1
  command: "pnpm -C core typecheck"
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
  human_gates: []
terminal_states:
  success: "typecheck exits 0 after at least one fix turn, red-before/green-after proven"
  no_op: "typecheck already passes before any turn"
  blocked: "the fix requires credentials or an unavailable toolchain → escalate"
  stalled: "2 consecutive turns with no reduction in compile errors → abort, preserve work"
  exhausted: "max_iterations or wall-clock ceiling hit"
memory:
  location: .loops/diagnose-loop/state.json
  format: json
  curated: true
  fresh_context_each_turn: false
architecture: solo
actuation: /goal
oversight: out
pattern_families:
  - A_define_done
  - B_act_without_breaking
  - D_sustain
health_metric:
  name: cost_per_accepted_change
  track_dollars: true
  track_tokens: true
