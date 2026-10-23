---
type: decision
decisionId: DEC-013
title: Documentation Directory Consolidation (13 → 9 Folders)
status: accepted
pack: core
timestamp: 2026-10-24T00:00:00.000Z
---

# DEC-013 — Documentation Directory Consolidation (13 → 9 Folders)

## Context
The `docs/` tree carried 13 top-level subdirectories, four of which were empty scaffolding containing only a README and a generated index (`roadmap/`, `open-questions/`, `status-reports/`, `sync-reports/`). This made the documentation hard to browse, and `roadmap/` duplicated `docs/backlog/MOC.md`, which already serves as the roadmap SSOT. The Parent Engineering Hub adopted the same consolidation in its `DEC-016`; the engine changes flowed into this framework via the outward `sync-engine.js` (DEC-014).

## Decision
Consolidate `docs/` to 9 top-level folders, mirroring the hub:

| Old Path | New Path | Rationale |
|---|---|---|
| `docs/roadmap/` | removed — `docs/backlog/MOC.md` | MOC.md is and remains the single roadmap SSOT. |
| `docs/open-questions/` | `docs/decisions/` (OQ-XXX files live alongside DEC-XXX files) | One decision-lifecycle folder; the OQ → DEC (`resolvedBy`) lifecycle is preserved. |
| `docs/status-reports/` | `docs/reports/status/` | Status snapshots are reports; nested under the reports sink. |
| `docs/sync-reports/` | `docs/reports/sync/` | Sync receipts are reports; nested under the reports sink. |
| `docs/bugs/` | unchanged | Contract-bound ledger (`/ss-bug-report`, release-evidence gate reads `open-bugs.md`). |

Final tree: `backlog/`, `bible/`, `bugs/`, `decisions/`, `loops/`, `plans/`, `reports/` (`learning/`, `status/`, `sync/`), `research/`, `videos/`.

Framework-local references are updated: `AGENTS.md` directory map, `.shiftstone/static-rules/global.md`, `.shiftstone/path-scoped-rules/bible-rules.md`, `_config/conventions.md`, skills `ss-status` / `ss-sync-bible` / `ss-schema-sync`, `docs/plans/README.md`, and `DEC-010`. Engine scripts arrived via the DEC-014 boundary-protected sync.

## Consequences
- `docs/` presents 9 browsable top-level folders; new projects seeded by `seed-governance.js` are born with the slim tree.
- OQ and DEC records share one validated directory; `validate-decisions.js` filters by filename prefix (`DEC-*.md`, `OQ-*.md`).
- Compiled `docs/bible/DECISIONS.md` links open questions with same-directory paths.
- Hub `DEC-016` and this record keep both repositories' decision ledgers consistent.
