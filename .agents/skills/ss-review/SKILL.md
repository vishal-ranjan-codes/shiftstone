---
name: ss-review
description: AI first-pass code review against the tuned checklist — findings grouped by category (hallucinated dependencies, error handling, subtle correctness) before human review.
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-21T00:00:00.000Z
version: 2.1.0
---

# ss-review

AI first-pass code review engine for inspecting diffs against the 3 primary failure classes of AI-generated code.

- Invocation: `/ss-review [<commit|file|branch>]`
- Procedural knowledge: [instructions.md](./instructions.md)
- Review checklist: [resources/review-checklist.md](./resources/review-checklist.md)
- Spec reviewer prompt: [resources/spec-reviewer-prompt.md](./resources/spec-reviewer-prompt.md)
