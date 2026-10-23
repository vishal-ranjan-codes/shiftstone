name: schema-sync-loop
description: Detect and resolve drift between bible schema, migrations, and generated TypeScript types.
use_when: Database schema, migrations, or generated types may be out of sync.
trigger:
  type: manual   # also fireable via event/git-hook: node .shiftstone/harness/cli.js trigger schema-sync-loop
goal:
  statement: All 3 sources (docs/bible schema reference, supabase migrations, database types) describe the same schema.
  type: verifiable
execution:
  isolation: none
  baseline: worktree-snapshot
  ordering: worst-first
  steps:
    - Plan the incremental check (C9): stages whose declared inputs are unchanged since the last clean run are skipped â€” nothing to parse
    - Parse docs/bible/03-database/schema-reference.md into a canonical schema
    - Parse supabase/migrations/*.sql into a canonical schema
    - Parse the generated database types into a canonical schema
    - Compute a 3-way diff; report drift
    - If drift is detected, update the 2 lagging sources to match the leader (migrations)
    - Re-run type generation if the types file was lagging
  skills:
    - supabase-migrations
    - supabase-postgres
    - ss-docs
  enumerate: "node .shiftstone/scripts/schema-sync.js --enumerate"
  turn_command: "node .shiftstone/scripts/schema-sync.js --apply"
  incremental:
    state: .loops/schema-sync-loop/stage-deps.json
    stages:
      - id: bible-schema
        inputs:
          - docs/bible/03-database/schema-reference.md
      - id: migrations
        inputs:
          - supabase/migrations
      - id: database-types
        inputs:
          - apps/web/app/types/database.types.ts
verification:
  ladder_level: 1
  command: "node .shiftstone/scripts/schema-sync.js --check"
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
  success: "All 3 sources match and --check exits 0 (red-before/green-after proven)"
  no_op: "All 3 sources already match before any turn, or their fingerprints are unchanged since the last clean run (C9 incremental skip)"
  blocked: "Supabase not configured (source missing) â†’ escalate"
  stalled: "2 consecutive turns with no diff reduction â†’ abort"
  exhausted: "max_iterations or max_tokens hit"
memory:
  location: .loops/schema-sync-loop/state.json
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
