# ss-status — Session Orientation & Status Audit Guide

Procedure for auditing roadmap progress, detecting codebase implementation gaps, and generating structured status reports.

---

## Iron Law

1. **Physical Status Report on Disk:** Always write status reports to `docs/status-reports/<YYYY-MM-DD>-status.md`. Never output to temporary IDE brain artifacts.
2. **Reality-Grounded Progress:** A task is only considered implemented if the corresponding routes, components, migrations, or tests exist physically on disk. Do not trust unchecked assumptions.
3. **Docs-Only Invariant:** `/ss-status` is strictly an audit and orientation operation. Never modify source code during status inspection.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll output a status_report.md artifact in chat."* | **Forbidden.** Brain/chat artifacts are ephemeral. Write directly to `docs/status-reports/<YYYY-MM-DD>-status.md`. |
| *"The backlog says [x], so I don't need to check if code exists."* | **Forbidden.** Discrepancy checks uncover accidental regressions or missing implementations. |
| *"I'll fix this small bug while checking status."* | **Forbidden.** Keep audit turns pure. Log defects to `docs/bugs/open-bugs.md` and transition to `/ss-diagnose`. |

---

## Status Audit Procedure

### Phase 1: Scan Backlog & Active Milestone
1. Read `docs/backlog/MOC.md` to identify the current milestone and active phase.
2. For each phase directory:
   - Count completed `[x]` vs open `[ ]` tasks.
   - Calculate completion percentages.
3. Determine the **Active Sub-Phase** (first sub-phase with unresolved tasks).

### Phase 2: Grounded Codebase Verification
For tasks in the active sub-phase, cross-reference the filesystem:
- **Routes:** Inspect `app/routes/` and `app/routes.ts`.
- **Database:** Inspect migrations directory and generated types.
- **Components:** Inspect `app/components/`.
- Identify confirmed gaps (planned tasks with no code) vs undocumented code.

### Phase 3: Evaluate Health & Observability
1. Run quick compilation check:
   ```bash
   pnpm typecheck
   ```
2. Run loop health dashboard (if telemetry is active):
   ```bash
   node core/scripts/status-dashboard.js
   ```

### Phase 4: Output Status Report
Write to `docs/status-reports/<YYYY-MM-DD>-status.md`:
```markdown
# Development Status Report — [Date]

## Milestone Overview
| Phase | Title | Completed | Total | Progress |
|---|---|---|---|---|
| Phase 1 | Foundation | 12 | 12 | 100% |
| Phase 2 | Core Features | 4 | 10 | 40% |

## Active Phase Deep-Dive: [Phase Name]
- **Current Blocker:** None
- **Next Immediate Task:** [Task ID & Title]

## Health & Quality Baseline
- Compiler: [Pass / Fail]
- Unit Tests: [Pass / Fail]
```

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting and link integrity.
- **L2 (Disk Verification):** Physical report exists in `docs/status-reports/`.
- **L3 (Accuracy):** Task counts match actual checkboxes in `docs/backlog/`.
- **L4 (Checker Review):** Disjoint check verifies identified gaps exist on disk.
- **L5 (User Handoff):** Link presented to user with clear next immediate task.

---

## Terminal States

- `success`: Status report generated, saved to `docs/status-reports/`, next task identified.
- `no_op`: Workspace clean and idle.
- `blocked`: Missing backlog files preventing milestone progress calculation.
