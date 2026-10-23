---
title: "AI-First Backlog Guide"
status: "active"
type: "guide"
tags: ["backlog", "guide", "ai-alignment", "workflows"]
lastUpdated: "2026-09-05"
component: "core"
---

# AI-First Backlog Guide

This guide outlines how developers and AI agents interact with the {{PROJECT_NAME}} backlog and roadmap system.

Rather than relying on heavy manual tracking, this system is **AI-first**: you instruct the AI coding agent in plain English, and the agent reads, checks, edits, and refactors the markdown backlogs automatically.

---

## 1. Developer Chat Interactions

You can view, add, modify, or prioritize tasks by speaking to **Anti-Gravity**, **Claude Code**, or **OpenCode** in the chat.

### Adding Tasks
Simply instruct the AI:
> **Developer:** *"We should add a custom validation schema for user registration in Phase 1. Add it as a P1 task."*
> 
> **AI Action:** The agent locates the Phase 1 files, appends `- [ ] **[P1]** User registration schema validation` to `1.3-supabase-auth-middleware.md`, and updates the task counts in `MOC.md`.

### Changing Priorities
> **Developer:** *"Make the Supabase client helper a P1, and deprioritize webhook tests to P3."*

### Querying Status
To see active, pending, or completed tasks, run the `/ss-status` slash command.

---

## 2. AI Automation Loop

When you assign a coding task to an AI agent, the agent coordinates the backlog sync automatically.
**Closing a task is loop-driven**: `[/] → [x]` happens only behind the `/ss-verify` outer gate.

```
[Start Task] ──> AI marks task as In-Progress [- [/]] in backlog
                    │
                    ▼
             AI writes code & runs compilation / testing
                    │
                    ▼
[Success]    ──> AI runs /ss-verify <task-id> — a disjoint Checker subagent
                    │         scores the task against the rubric (≥ 0.8 required)
                    │
        ┌─── score < 0.8: BLOCKED — task stays [/], gaps are reported
        ▼
[Verified]   ──> AI marks task as Completed [- [x]] WITH the signature:
                    │         - [x] <task> — verified by <model-family> @ <score> (<date>)
                    ▼
             AI appends the bundle log.md row & CHANGELOG entry
```

**Hard rule (task 6.4):** no agent, workflow, or git-scan may write `[x]` without
the `— verified by …` signature — `node .shiftstone/scripts/check-backlog-signoff.js --strict`
(part of `pnpm parity` and CI) fails the build on an unsigned closure. Only `/ss-verify`
produces the signature.

---

## 3. Backlog Self-Maintenance & Splitting (Overload Prevention)

To prevent backlog files from growing too large (which causes AI agents to lose focus and hallucinate), we enforce an **unresolved task limit of 12**.

* **The Rule**: No active backlog file is allowed to contain more than 12 unresolved (`[ ]` or `[/]`) tasks.
* **The Splitting Command (`/ss-backlog-sync`)**:
  - If task counts exceed 12, the AI splits the tasks into logical subsets.
  - It creates new child backlog files.
  - It updates the central `MOC.md` Map of Content.
