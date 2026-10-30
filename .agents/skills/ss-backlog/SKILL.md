---
name: ss-backlog
description: Actionable task backlog authoring and capacity engine — generates phased, user-story-driven task cards from PRDs with capacity balancing (<= 12 tasks per phase) and zero stale seeds.
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-30T00:00:00.000Z
version: 3.0.0
---

# ss-backlog — Actionable Task Backlog Authoring & Capacity Engine

35th first-party core skill of the ShiftStone framework. Governs the authoring, decomposition, and capacity balancing of implementation backlogs (`docs/backlog/`), transforming PRD requirements into bounded, user-story-driven task cards while preventing sub-phase bloat.

- **Invocation:** `/ss-backlog`
- **Procedural Knowledge:** [instructions.md](./instructions.md)
- **User Story Task Card Template:** [resources/task-card-template.md](./resources/task-card-template.md)
- **Backlog Phase Index Template:** [resources/backlog-phase-template.md](./resources/backlog-phase-template.md)
- **Master MOC Template:** [resources/moc-template.md](./resources/moc-template.md)

---

## Capabilities & Output Artifacts

1. **User Story Task Card Generation:** Formats discrete tasks (`1.1-workspace-setup.md`) with explicit persona user stories (*"As a [persona], I want [goal] so that [benefit]"*), acceptance criteria, and verification commands.
2. **PRD Traceability Binding:** Directly links every task card back to functional requirements in `docs/bible/PRD/phase-1-foundation-prd.md`.
3. **Phase Capacity Balancer:** Enforces a hard limit of $\le 12$ tasks per phase subfolder. Automatically triggers sub-phase decomposition (e.g., `Phase 1a`, `Phase 1b`) when capacity is exceeded.
4. **Eradication of Stale Seeds:** Purges uncustomized historical templates (e.g. `lastUpdated: 2026-09-05`) and replaces them with active project milestones.
5. **Master Map of Content (`docs/backlog/MOC.md`):** Aggregates phase health, task completion metrics, and dependency links across all backlog phases.
