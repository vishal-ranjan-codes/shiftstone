---
type: plan
title: Phase 4 — Actionable Task Backlog & Capacity Balancing
status: planned
timestamp: {{TIMESTAMP}}
version: 1.0.0
owner: core
tags: [phase-4, backlog, task-cards, user-stories, capacity]
---

# Phase 4: Actionable Task Backlog & Capacity Balancing

**Status:** `planned`  
**Depends on:** Phase 3 (`phase-3-technical-bible-and-adrs.md`)  
**Plan Units:** `U9`, `U10`  
**Acceptance Criteria:** `AC-U9-01`, `AC-U10-01`  

---

## 1. Objective & Scope

Generates the actionable implementation backlog in `docs/backlog/` directly from `docs/bible/PRD/phase-1-foundation-prd.md`. Purges all static starter seeds (e.g. historical `2026-09-05` templates) and authors discrete, persona-based User Story task cards with strict phase capacity balancing ($\le 12$ tasks per subfolder).

---

## 2. Inputs & Context Dependencies

| Input Path | Role / Requirement |
|---|---|
| `docs/bible/PRD/phase-1-foundation-prd.md` | Functional requirements and milestone acceptance criteria. |
| `.agents/skills/ss-backlog/resources/task-card-template.md` | User Story format and checklist structure. |
| `.agents/skills/ss-backlog/resources/backlog-phase-template.md` | Phase ledger and capacity threshold rules. |

---

## 3. Plan Units

### Unit `U9` — Purge Stale Starter Seeds & Initialize Master MOC
- **Layer:** core
- **Target Files:**
  - `docs/backlog/README.md`
  - `docs/backlog/MOC.md`
- **Mechanics:** Eradicates legacy uncustomized seeds and initializes the master implementation Map of Content.
- **Acceptance Criteria:** `AC-U9-01`: Zero stale template seeds remain; `MOC.md` tracks active project roadmap.

---

### Unit `U10` — Author Phase 1 Foundation Task Cards
- **Layer:** core
- **Target Files:**
  - `docs/backlog/Phase 1 - Foundation & Auth Setup/index.md`
  - `docs/backlog/Phase 1 - Foundation & Auth Setup/1.1-*.md`
- **Mechanics:** Generates bounded task cards with User Story statements, PRD links, checklists, and test verification gates ($\le 12$ tasks).
- **Acceptance Criteria:** `AC-U10-01`: All task cards contain persona user stories and phase capacity does not exceed 12 items.

---

## 4. Verification & Outputs

- **Verification Command:** `pnpm -C .shiftstone vitest run tests/skills/ss-backlog.test.ts`
- **Expected Artifacts:** Synchronized `docs/backlog/MOC.md` and Phase 1 task card directory.
