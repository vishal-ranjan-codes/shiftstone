# Instructions for ss-backlog — Actionable Task Backlog Engine

This skill governs the generation, maintenance, and capacity balancing of implementation backlogs (`docs/backlog/`).

---

## 1. Backlog Architecture & Directory Layout

The task backlog is structured into phased directory hierarchies:
- `docs/backlog/README.md`: Overview of backlog structure and workflow rules.
- `docs/backlog/MOC.md`: Master Map of Content tracking phase progress and dependencies.
- `docs/backlog/Phase 1 - <Name>/`: Phased execution folder containing:
  - `index.md`: Phase overview, milestone criteria, and task ledger.
  - `1.1-<slug>.md` through `1.N-<slug>.md`: Discrete, actionable task cards.

---

## 2. Step-by-Step Procedure

### Step 1: Ingest PRD & Milestones
1. Read the approved Phase PRD (`docs/bible/PRD/phase-1-foundation-prd.md`).
2. Identify primary user personas and key user journeys.
3. Map requirements to high-level milestones (Database/Models, Edge Handlers, UI Components, E2E Verification).

### Step 2: Generate User Story Task Cards
1. Use the template from [resources/task-card-template.md](./resources/task-card-template.md).
2. Author individual task files (`1.1-<name>.md`) adhering to:
   - **User Story:** Explicit persona format (*"As a [persona], I want [goal] so that [benefit]"*).
   - **PRD Link:** Direct markdown reference to `docs/bible/PRD/phase-1-foundation-prd.md`.
   - **Target Files:** Declared list of source and test files to be touched.
   - **Checklist:** Concrete implementation steps (`- [ ] ...`).
   - **Verification Gate:** Specific test commands (`pnpm vitest run ...`) and expected outcomes.

### Step 3: Enforce Phase Capacity Rules
1. Count total task files in the phase subfolder.
2. If task count $> 12$:
   - Split phase into sub-phases (e.g. `Phase 1a - Core Backend & Auth`, `Phase 1b - Frontend & Workflows`).
   - Re-index task numbers and update dependencies.
3. Update `index.md` with the template from [resources/backlog-phase-template.md](./resources/backlog-phase-template.md).

### Step 4: Update Master Map of Content (`MOC.md`)
1. Recompile `docs/backlog/MOC.md` using [resources/moc-template.md](./resources/moc-template.md).
2. Record task counts, completion percentages, and active blockers.

---

## Iron Laws

1. **User Story Mandatory Invariant:** Every task card must begin with an explicit user story: *"As a [persona], I want [goal] so that [benefit]"*.
2. **Phase Capacity Ceiling:** No phase directory may hold more than 12 tasks. Sub-phase decomposition is mandatory when exceeded.
3. **Zero Untouched Starter Seeds:** Backlogs must NEVER retain legacy uncustomized starter templates (e.g. `2026-09-05` seeds). All tasks must reflect the active project PRD.
4. **Mandatory Verification Gate:** Every task card must declare automated test commands to verify completion.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"We have 15 small tasks, keeping them in one phase is simpler."* | **Forbidden.** Phases with > 12 tasks inflate planning context and increase cognitive overload. Split into sub-phases. |
| *"A task card doesn't need a user story if it's purely technical."* | **Forbidden.** Even technical tasks serve user personas (e.g. *"As an Operator, I want secure database migrations so that tenant data remains isolated"*). |
| *"I'll keep the template backlog until development starts."* | **Forbidden.** Retaining stale starter seeds creates false progress tracking. Purge and regenerate from PRD. |

---

## Verification Ladder

1. **L1 (Syntax & User Stories):** All task files contain valid YAML frontmatter, user story statements, and PRD links.
2. **L2 (Capacity Gate):** All phase subfolders have $\le 12$ task cards.
3. **L3 (MOC Synchronization):** `docs/backlog/MOC.md` accurately reflects all physical phase folders and tasks.
4. **L4 (Backlog Sync Skill):** Run `/ss-backlog-sync` to verify zero orphan tasks or overloaded phases.

---

## Terminal States

- **`success`:** Task cards generated with user stories, phase capacity $\le 12$ respected, and `MOC.md` fully synchronized.
- **`remediate`:** Phase exceeds 12 tasks or tasks lack user story format; decompose phase and reformat cards.
- **`blocked`:** Phase PRD missing or lacks functional acceptance criteria.
