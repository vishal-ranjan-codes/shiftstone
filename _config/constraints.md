---
type: config-reference
timestamp: 2026-10-12T00:00:00Z
---

# Constraints

Hard workspace constraints (ICM Layer 3). These are limits, not advice.

## Context Budgets (`core/context/token-budget.json`)

- Static context: ≤ **200 lines** per IDE (Layer 0 + 1 + 2 combined); root shims ≤ **50 lines** each.
- Dynamic context: ≤ **8 000 tokens** loaded per turn (skills instructions, budget-enforced by the loader).
- Stage loads: **2 000–8 000 tokens** per CONTEXT.md (`loadStageInputs` refuses crawls and over-budget stages).

## Loop Budgets (blueprint §7.8)

- `max_iterations` ≤ **10**; default stagnation brake **2 barren turns**.
- L4+ verification requires a disjoint maker-checker; `/verify` verdict floor **0.8**.
- Irreversible actions (`git push`, `gh pr create`, `/deploy`, …) sit behind human gates when `oversight: in`.

## Governance

- Harness/framework files change only through the parity gate: `pnpm parity`
  (duplication, OKF frontmatter, link integrity, index freshness) must pass.
- Never pre-populate `.commandcode/taste/taste.md`.
