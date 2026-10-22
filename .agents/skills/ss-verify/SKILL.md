---
name: ss-verify
description: Mandatory outer gate — executes the 5-Step Verification Ladder, spawns a disjoint Checker subagent, and blocks task completion when normalized score is below 80/100 (0.8).
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-21T00:00:00.000Z
version: 2.1.0
---

# ss-verify

Mandatory Level 4 outer-gate verification engine. Spawns an isolated Checker subagent in a disjoint context to evaluate completed work against the 5 Universal Dimensions before marking tasks complete.

- Invocation: `/ss-verify <task-id> [--strict]`
- Procedural knowledge: [instructions.md](./instructions.md)
- Checker subagent prompt: [resources/checker-prompt.md](./resources/checker-prompt.md)
