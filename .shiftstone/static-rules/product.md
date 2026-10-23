---
activation: always
---

# {{PROJECT_NAME}} — Product & Workspace Identity

- **Product**: {{PROJECT_NAME}} — {{PRODUCT_IDENTITY}}
- **Stack**: {{STACK_IDENTITY}}
- **Philosophy**: Documentation-first. Never write code without first reading the `docs/bible/`. Every change updates the `docs/bible/`.

The workspace map, task routing, and universal hard rules live in `AGENTS.md`
(Layer 0) — this file owns product identity and the project registry only.

---

## Project Registry

| Folder | Status | Rule |
|---|---|---|
| `{{APP_PATH}}/` | ACTIVE | All active full-stack application code lives here |
| `docs/bible/` | ACTIVE — SSOT | Read before coding, update after coding |
| `docs/plans/` | ACTIVE | Implementation plans (root-level `plans/` is deprecated — never create it) |
| `.shiftstone/` | ACTIVE | Framework engine: harness, context, governance, observability |
| `_config/` | ACTIVE | ICM Layer 3 stable references (conventions, style, constraints) |
