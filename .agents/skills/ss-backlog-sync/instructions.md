# ss-backlog-sync — Backlog Maintenance & Capacity Balancer Guide

Procedure for sweeping task backlogs, enforcing maximum task limits, splitting overloaded sub-phases, and synchronizing verified closures.

---

## Iron Law

1. **Maximum 12 Unresolved Tasks Per Backlog File:** Any sub-phase backlog file with $> 12$ open tasks (`- [ ]` or `- [/]`) is overloaded and MUST be split into logical child files.
2. **Verified Sign-Off Only for `[x]`:** NEVER mark a task `[x]` during backlog-sync without a verified Checker signature (`- [x] <task> — verified by <model-family> @ <score> (<date>)`). Unsigned `[x]` entries are rejected by CI.
3. **Docs-Only Invariant:** Backlog-sync is strictly a documentation maintenance operation. Never modify source code during this workflow.
4. **Physical Disk Edits Only:** Apply all updates directly to `docs/backlog/` and `docs/backlog/MOC.md`. Never output to temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"15 tasks in one file is fine because they are closely related."* | **Forbidden (Overload Law).** Large backlog files cause cognitive overload and LLM context truncation. Split into child files. |
| *"I saw the commit for this task, so I can mark it [x] directly."* | **Forbidden.** Commits are candidates, not proof. Route candidate closures through `/ss-verify`. |
| *"I don't need to update MOC.md after splitting a phase."* | **Forbidden.** `MOC.md` is the navigational Map of Content. Broken or missing links break agent routing. |

---

## Backlog Sweep Procedure

### Phase 1: Scan Backlogs & Task Limits
1. Walk `docs/backlog/` recursively.
2. Read all active and planned sub-phase backlog files.
3. Count open tasks (`- [ ]` and `- [/]`).

### Phase 2: Overload Detection & Split Planning
1. If any file contains $> 12$ open tasks:
   - Group tasks into 2 or 3 cohesive logical subsets.
   - Draft child backlog names (e.g. `1.2.1-db-connection.md`, `1.2.2-db-rls.md`).
2. Present proposed split plan to the user.

### Phase 3: Execute Splits & Update MOC
1. Create new child backlog files with standard frontmatter headers.
2. Move completed tasks or mark original file `status: completed`.
3. Update `docs/backlog/MOC.md` with links to child files and refreshed task counts.

### Phase 4: Closure Auditing (Outer-Gate Verification)
1. Match recent git commits against pending tasks.
2. For matching tasks, do NOT mark `[x]` directly: run `/ss-verify <task-id>` to generate verified signature.
3. Verify signature compliance:
   ```bash
   node core/scripts/check-backlog-signoff.js --strict
   ```

---

## Verification Ladder

- **L1 (Syntax):** Valid YAML frontmatter across all backlog files.
- **L2 (Capacity Check):** Zero backlog files exceed 12 open tasks.
- **L3 (MOC Freshness):** `docs/backlog/MOC.md` links match all active backlog files.
- **L4 (Sign-Off Check):** `node core/scripts/check-backlog-signoff.js` passes with 0 violations.
- **L5 (Git Diff):** Diff confirms only files under `docs/backlog/` were modified.

---

## Terminal States

- `success`: Backlog files balanced, overloaded phases split, MOC synchronized.
- `no_op`: Backlog is clean, all files under 12 tasks, zero drift.
- `blocked`: Broken backlog frontmatter or unsigned `[x]` preventing CI pass.
