
# Specialist Skill: Backlog Controller

This skill defines the procedures to manipulate task lists and issues catalogs.

---

## 1. Backlog Frontmatter Manipulation

Ensure task files contain this exact YAML frontmatter header:
```yaml
title: "Sub-Phase Title"
status: "planned"  # active | planned | completed
type: "backlog"
tags: ["backlog", "supabase", "react-router"]
phase: "X.Y"
lastUpdated: "YYYY-MM-DD"
component: "web"  # web | auth | db | ui | etc.
```

---

## 2. Granular Backlog Directories

Tasks are organized under `docs/backlog/`:
- `Phase 1 - Foundation & Auth Setup/`
- `Phase 2 - Core SaaS Features/`
- `Phase 3 - Storage & Background Jobs/`
- `Phase 4 - Testing & Telemetry/`
- `Phase 5 - Launch & Polish/`

When updating a task:
1. Locate the correct sub-phase `.md` file inside the appropriate phase directory.
2. Modify the status indicator: `[ ]` (Todo), `[/]` (In-Progress), or `[x]` (Completed).
3. Update `lastUpdated` date in the frontmatter.
4. Append a log row to the file's `## Change Log` table:
   | Date | Task | Action | Assignee |
   |---|---|---|---|

---

## 3. Split Trigger Rule (12 Tasks Max)

To prevent files from becoming too large and causing AI context degradation:
- Count unresolved (`[ ]` or `[/]`) tasks in the active file.
- If count exceeds **12**, propose splitting tasks into child sub-phase files (e.g. `1.2.1-db-connection.md` and `1.2.2-db-rls-setup.md`).
- Update `docs/backlog/MOC.md` with the new file links and task counts.
