---
name: ss-execute-plan
description: Execute approved implementation plans unit-by-unit with bounded context (<= 4,500 tokens), Red-First TDD, and Two-Stage Review (Spec Compliance + Code Quality).
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-21T00:00:00.000Z
version: 2.1.0
---

# ss-execute-plan

Orchestrates the step-by-step execution of approved implementation plans (`docs/plans/<suite>/`) with strict context bounding, Red-First TDD, and Two-Stage Review.

- Invocations: `/ss-execute-plan`, `/ss-work`
- Procedural knowledge: [instructions.md](./instructions.md)
- Implementer subagent prompt: [resources/implementer-prompt.md](./resources/implementer-prompt.md)
