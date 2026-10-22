---
name: ss-backlog-sync
description: Backlog maintenance & capacity balancer — sweep all task backlogs in docs/backlog/, detect overloaded sub-phases (> 12 tasks), split phases, and sync verified closures.
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-21T00:00:00.000Z
version: 2.1.0
---

# ss-backlog-sync

Backlog maintenance and capacity balancing engine for managing `docs/backlog/`, splitting overloaded phases (> 12 tasks), and updating `docs/backlog/MOC.md`.

- Invocation: `/ss-backlog-sync`
- Procedural knowledge: [instructions.md](./instructions.md)
