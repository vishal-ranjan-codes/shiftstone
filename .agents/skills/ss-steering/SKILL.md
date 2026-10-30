---
name: ss-steering
description: Universal AI steering and multi-IDE orientation engine — generates and maintains slim AGENTS.md router (<= 60 lines), static rules, path-scoped rules catalog, IDE orientation shims, and multi-IDE directory junctions.
pack: core
tier: manual-load
type: skill
timestamp: 2026-10-30T00:00:00.000Z
version: 3.0.0
---

# ss-steering — Universal AI Steering & Multi-IDE Harness Engine

33rd first-party core skill of the ShiftStone framework. Governs Layer 0 identity, Layer 1 task routing, and context boundary orchestration across all supported AI IDEs (Claude Code, Antigravity, CommandCode, Cursor, Codex).

- **Invocation:** `/ss-steering`
- **Procedural Knowledge:** [instructions.md](./instructions.md)
- **Slim AGENTS.md Router Template:** [resources/agents-router-template.md](./resources/agents-router-template.md)
- **Static Rules Specifications:** [resources/static-rules-templates.md](./resources/static-rules-templates.md)
- **Path-Scoped Rules Catalog:** [resources/path-scoped-rules-catalog.md](./resources/path-scoped-rules-catalog.md)

---

## Capabilities & Output Artifacts

1. **Slim Orientation Router (`AGENTS.md`):** Generates and maintains the universal root entry point capped strictly at $\le 60$ lines and $\le 4,096$ bytes, routing agent intents to documentation directories without dumping code or architecture schemas.
2. **Deterministic Static Rules (`.shiftstone/static-rules/*.md`):** Manages always-on behavioral contracts (`product.md`, `global.md`, `security.md`, `verification.md`, `governance.md`), enforcing $\le 120$ lines / $\le 6,144$ bytes per rule and $\le 12,288$ bytes cumulative always-on budget.
3. **Targeted Path-Scoped Rules (`.shiftstone/path-scoped-rules/*.md`):** Configures context-injected guidelines activated dynamically via `paths:` frontmatter globs (`app-rules.md`, `database-rules.md`, `worker-rules.md`).
4. **Thin Multi-IDE Shims:** Emits non-duplicative orientation pointers in root `CLAUDE.md`, `ANTIGRAVITY.md`, `COMMANDCODE.md`, and `opencode.json`.
5. **Directory Junctions & Budget Validation:** Executes mechanical junction link creation via `setup-ide-junctions.js` and validates token and line budgets via `validate-context-budgets.js`.
