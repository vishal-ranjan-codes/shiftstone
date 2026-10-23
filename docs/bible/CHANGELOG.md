---
type: changelog
timestamp: 2026-09-05T14:49:35.878Z
---
# {{PROJECT_NAME}} — Changelog

All notable changes to {{PROJECT_NAME}} will be documented in this file.

---

## [2026-10-23] — Synced from log.md

### Added
- [skills] Added ss-sync-engine 3-tier core skill (manual-load) — orchestrates bi-directional engine synchronization between Parent Lab Hub (.shiftstone/) and Child Frameworks with boundary protection (DEC-014)

---

## [2026-10-21] — Synced from log.md

### Added
- [core] Universal Workspace Framework v2.1 Phase 2 implemented (UG-07 to UG-10, UG-32): stage-contract/v1, plan-unit/v1, validate-stage-contracts, validate-plan-units, StageDagRunner, and ss-plan skill
- [core] Universal Workspace Framework v2.1 Phase 3 implemented (UG-11 to UG-15, UG-31, UG-33, UG-34): 4-layer agent pre-flight gate, pre-tool-use hook, validate-skills-completeness, validate-research, preflight-matrix.yaml, ss-init, ss-brainstorm, and ss-brand-naming
- [core] Universal Workspace Framework v2.1 Phase 4 implemented (UG-15 to UG-19): checker-lens/v1 schema, validate-checker-lenses, 7 core and pack conditional lenses, checker-report/v1 schema (LOCK-03), validate-checker-report, Level 1.5 check-anti-gaming gate, and loop-runner wiring
- [core] Universal Workspace Framework v2.1 Phase 5 implemented (UG-20 to UG-22): learning-record/v1 schema, validate-learning, per-file ADRs (docs/decisions/DEC-XXX), compile-decisions, and proposal-based sync-bible-proposal engine
- [core] Universal Workspace Framework v2.1 Phase 6 implemented (UG-23 to UG-26): protected-action-approval/v1 schema, Level 5 protected-actions policy and enforcement gate (terminal state blocked), release-evidence/v1 schema, validate-release-evidence, and workflow-to-skill hardening for ss-verify, ss-deploy, ss-new-migration
- [core] Universal Workspace Framework v2.1 Phase 7 implemented (UG-27 to UG-30): trajectory/v1 & telemetry/v1 schemas, record-telemetry flywheel recorder, otel-tracer, synthetic harness trials (T1-T3), pack factory capability trials (F1-F6), master validate-workspace orchestrator, and v2.1.0-universal release seal

---

## [2026-10-20] — Synced from log.md

### Added
- [core] Universal Workspace Framework v2.1 Phase 1 implemented (UG-01 to UG-06): validate-context-budgets, validate-context-integrity, setup-ide-junctions, verify-ide-parity, and validate-manifest

---

## [2026-10-19] — Synced from log.md

### Changed
- [core] Hardened CI & enforcement gates (WS-F): junction-slot tracked files check, static-budget CI gate, pnpm across GitHub Actions workflows, and verification test additions (WS-G)

---

## [2026-10-18] — Synced from log.md

### Added
- [skills] Added find-skills core skill (manual-load) — discover/install skills from skills.sh for any stack; installed via `npx skills add https://github.com/vercel-labs/skills --skill find-skills`, adapted to the 3-tier convention; removed the phantom pack include
- [packs] Flagship pack gained surface overlays: `composition.path_scoped_rules`, `composition.workflows` and `composition.commandcode` fragment layered over core at composition, keeping the engine's core rules and workflows stack-neutral

### Changed
- [skills] Relocated docs skill from the rr8 pack to core (blueprint §6.3 `pack: core`) and neutralized its stack-specific mapping examples so alternative archetypes stay token-free

---

## [2026-10-17] — Synced from log.md

### Added
- [packs] 3 starter packs scaffolded (task 7.5): SvelteKit, Expo React Native and Go/Chi starters — valid manifests + packaging metadata + working scaffold scripts; all 6 packs validate via `node .shiftstone/init.js --validate`

---

## [2026-10-16] — Phase 5: Observability, Cost & Lineage

### Added
- Workflow-end cost logging: every slash-command workflow appends exactly one row to `.loops/<id>/runs.jsonl` via `.shiftstone/scripts/record-run.js` (opt-out: `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`).
- Loop-health dashboard: `node .shiftstone/scripts/status-dashboard.js` renders Cost per Accepted Change per loop/archetype/week, first-pass success rate, token burn rate, terminal-state histogram and per-loop oversight modes (`.shiftstone/observability/cac-aggregator.ts`); `/status` embeds it.
- Loop state schema and memory templates: `docs/loops/.schema.json`, `docs/loops/_template/` (`state.json` + `lessons.md` format); evidence-based lesson curation via `.shiftstone/harness/memory/curate.ts`.
- Run-trace visualizer: Mermaid DAG of loop turns (`.shiftstone/observability/trace-viz.ts`).
- C9 incremental stage engine: Make-style content hashing of declared Inputs, skip/cascade decisions, `force_rerun` escape hatch (`.shiftstone/harness/stage-deps.ts`); loop specs gain `execution.incremental`; `schema-sync-loop` refactored onto it and `bible-sync-loop` authored with `.shiftstone/scripts/bible-sync.js` (3-way diff: code vs bible vs decisions).
- C10 lineage/semantic-debug tracer (`.shiftstone/observability/lineage-tracer.ts`) and drift dashboard (`.shiftstone/observability/drift-dashboard.ts`): walks relative links backward from a deliverable, git-diffs per-stage outputs, reports the first divergent stage + suspect `CONTEXT.md` line, plus bible chapter staleness.

---

## [2026-10-16] — Synced from log.md

### Added
- log.md bootstrap — append-only chronological record for the bible bundle (task 6.7)
- /sync-bible now runs in the outer gear: mechanical 3-way drift detection, mandatory Checker sign-off before any doc edit, log append and changelog compilation in the same run (tasks 6.3/6.9)
- [packs] log.md bootstrap — append-only chronological record for the pack bundle (task 6.7)
- [skills] log.md bootstrap — append-only chronological record for the skills bundle (task 6.7)
- [skills] Added bookkeeping skill — one-pass index/link/log/format maintenance with inner-gear boundary (task 6.8)

### Changed
- Chapter frontmatter carries title/description; README Table of Contents regenerated from it by .shiftstone/governance/bible/index.js (task 6.2)
- [skills] Bookkeeping repair procedure adds the skills-manifest regeneration step (Phase 6 verification audit)

---

## [2026-09-05] — Workspace Initialized

### Added
- Documentation-first architecture bible structure and AI-first backlog initialized.
- Multi-IDE AI steering for Anti-Gravity, Claude Code, Command Code, and OpenCode configured.
