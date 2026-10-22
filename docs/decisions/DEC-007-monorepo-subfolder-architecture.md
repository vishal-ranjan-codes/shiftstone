---
type: decision
decisionId: DEC-007
title: Monorepo Subfolder Architecture
status: accepted
pack: core
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-007 — Monorepo Subfolder Architecture

## Context
Prevent AI coding agents from polluting the workspace root with mixed application code, documentation, and configuration files.

## Decision
Establish workspace root strictly for AI steering, documentation architecture (SSOT), and monorepo scripts (`pnpm-workspace.yaml`). All active application source code resides in `apps/web/`.

## Consequences
Clean separation of concerns; AI IDEs can manage documentation without risking app compilation drift.
