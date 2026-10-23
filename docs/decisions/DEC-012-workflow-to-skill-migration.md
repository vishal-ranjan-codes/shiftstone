---
type: decision
decisionId: DEC-012
title: 1-to-1 Legacy Workflow-to-Skill Migration and Universal Skills Unification
status: accepted
pack: core
timestamp: 2026-10-19T23:36:00.000Z
---

# DEC-012 — 1-to-1 Legacy Workflow-to-Skill Migration and Universal Skills Unification

## Context
Legacy workflows (`.shiftstone/workflows/*.md`, `.agent/workflows/`, `.claude/commands/`) fragmented agent capabilities across multiple directories and formats, causing IDE drift and duplication across IDE shims.

## Decision
Adopt Locked Decision `LOCK-04` (`UG-31` / `UG-32` / `UG-33`): migrate all 20 legacy workflows 1-to-1 into standardized 3-tier core agent skills in `.agents/skills/ss-<name>/` (`SKILL.md` + `instructions.md` + `resources/`), prefixed with `ss-` to prevent collisions with native IDE slash commands. Decommission `.shiftstone/workflows/` and unify all 4 IDE configurations strictly on `.agents/skills/` via directory junctions.

## Consequences
Single SSOT for all agent operational capabilities, zero prompt duplication, uniform slash command discovery across Antigravity, Claude Code, CommandCode, and OpenCode, and full compliance with the 8-Pillar Anti-Bypass standard.
