name: bible-sync-loop
description: "Detect and resolve drift between the bible's structure/ToC, the code paths it references, and the ADR set (3-way diff: code vs bible vs decisions)."
use_when: |
  After adding, removing or renaming a bible chapter, moving code that the
  bible references, or when DECISIONS.md and pack decisions-seed.yaml drift
  apart. Emits an update plan (--report) when drift exists.
trigger:
  type: manual
goal:
  statement: code, bible (README ToC + chapters + index files) and decisions (ADRs) all agree â€” bible-sync --check exits 0.
  type: verifiable
execution:
  isolation: none
  baseline: worktree-snapshot
  ordering: worst-first
  steps:
    - Plan the incremental check (C9): stages whose declared inputs are unchanged since the last clean run are skipped
    - Run node .shiftstone/scripts/bible-sync.js --report to see the 3-way diff (code vs bible vs decisions)
    - Fix one drift item per turn â€” update the lagging side (ToC row, chapter index.md, ADR, or the stale code reference)
    - Re-run --report until the drift list is empty
  skills:
    - ss-docs
  enumerate: "node .shiftstone/scripts/bible-sync.js --report"
  turn_command: "node .shiftstone/scripts/bible-sync.js --apply"
  incremental:
    state: .loops/bible-sync-loop/stage-deps.json
    stages:
      - id: bible-structure
        inputs:
          - docs/bible
      - id: decisions-seed
        inputs:
          - packs/rr8-supabase-cf/decisions-seed.yaml
verification:
  ladder_level: 1
  command: "node .shiftstone/scripts/bible-sync.js --check"
  expected_exit: 0
  red_green: true
  success_streak: 1
  maker_checker: false
brakes:
  budget:
    max_iterations: 3
    max_tokens: 100000
    sub_loop_multiplier: 0.5
  stagnation:
    max_barren_turns: 2
    detector: output_hash_unchanged
  human_gates: []
terminal_states:
  success: "Drift resolved by an agent turn and --check exits 0 (red-before/green-after proven)"
  no_op: "code, bible and decisions already agree before any turn, or their fingerprints are unchanged since the last clean run (C9 incremental skip)"
  blocked: "Bible core files (README.md/DECISIONS.md/index.md) missing â†’ escalate"
  stalled: "2 consecutive turns with no drift reduction â†’ abort"
  exhausted: "max_iterations or max_tokens hit"
memory:
  location: .loops/bible-sync-loop/state.json
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
