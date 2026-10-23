name: new-feature-loop
description: Implement a new feature from approved spec to verified completion (outer-gate, L4 maker-checker).
use_when: |
  Adding a new feature whose spec is already approved and implementation-ready.
  Replaces the linear /new-feature workflow with a verified iterative loop.
trigger:
  type: manual
goal:
  statement: Feature is implemented, all checks pass, bible updated, backlog task marked done.
  type: mixed
execution:
  isolation: worktree
  baseline: worktree-snapshot
  ordering: worst-first
  steps:
    - Red first: write the failing test or eval for the feature before any implementation code (B4)
    - Read approved spec from docs/plans/<feature-id>/02_design/output/spec.md
    - Implement in the worktree (one file or one module per turn)
    - Write or update tests in the same turn
    - Update docs/bible/ if any new contract was introduced
    - Mark the backlog task as [/] (in-progress)
  skills:
    - ss-new-feature
    - vitest-testing
    - ss-docs
  enumerate: "node .shiftstone/scripts/feature-status.js --enumerate"
verification:
  ladder_level: 4
  command: "node .shiftstone/scripts/feature-status.js --check"
  expected_exit: 0
  rubric:
    dimensions:
      task_success:
        weight: 0.30
        guidance: "2 = feature fully implements the approved spec, all L1 checks pass, enumeration satisfied; 1 = partial; 0 = missing or checks fail"
      tool_use_quality:
        weight: 0.15
        guidance: "2 = typecheck/lint/test actually executed via the named skills; 1 = roundabout; 0 = claimed without running"
      trajectory_compliance:
        weight: 0.20
        guidance: "2 = every claimed verification step appears in the turn's tool-call trajectory; 1 = minor gap; 0 = fluent claims with skipped checks"
      hallucination:
        weight: 0.15
        guidance: "2 = no invented APIs, dependencies, or file paths; 1 = one unverifiable claim; 0 = fabricated reference shipped"
      response_quality:
        weight: 0.20
        guidance: "2 = no scope creep, bible updated for new contracts, backlog evidence attached; 1 = minor drift; 0 = scope creep or doc drift"
    threshold: 1.6
  critics: 1
  success_streak: 2
  hold_out: "tests/hold-out/"
  maker_checker: true
  eval_suite: harness-smoke
brakes:
  budget:
    max_iterations: 10
    max_tokens: 500000
    max_dollars_usd: 15.00
    sub_loop_multiplier: 0.5
  stagnation:
    max_barren_turns: 2
    detector: consecutive_no_progress
  human_gates:
    # first stage: direction is approved by a human before anything runs
    # (paired with the blocked terminal state: "Spec not approved")
    - "approve spec"
    # last stage: alignment â€” the close-out action needs human sign-off
    # (paired with the L4 maker-checker verdict via /verify)
    - "mark the backlog task as [x]"
    - "git push"
    - "gh pr create"
    - "/deploy"
terminal_states:
  success: "L4 score >= 0.8 for 2 consecutive turns + feature checks pass + enumeration satisfied"
  no_op: "Pre-check shows the feature is already implemented, verified and merged"
  blocked: "Spec not approved, missing credentials, or human review requested â†’ escalate"
  stalled: "2 consecutive turns with no progress â†’ abort, preserve worktree"
  exhausted: "Any budget ceiling hit â†’ abort, partial work only if verified"
memory:
  location: .loops/new-feature-loop/state.json
  format: markdown
  curated: true
  fresh_context_each_turn: true
architecture: maker_checker
actuation: ralph_skeleton
oversight: in
model:
  task_class: implementation
pattern_families:
  - A_define_done
  - B_act_without_breaking
  - C_earn_trust
  - D_sustain
health_metric:
  name: cost_per_accepted_change
  track_dollars: true
  track_tokens: true
