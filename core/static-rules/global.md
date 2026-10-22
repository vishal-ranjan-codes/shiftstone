---
activation: always
---

# {{PROJECT_NAME}} — Global Rules

Enforced on every single agent task. Read this file before acting on any request.

---

## Task → Rule File Dispatch

| Task Type | Rule File to Read |
|---|---|
| Any stack-specific code (follow the active archetype's conventions) | Pack-shipped rules in `core/path-scoped-rules/` (e.g. `stack-rules.md`, layered at init) |
| Folder structure or file placement decisions | `core/path-scoped-rules/structure.md` |
| TypeScript quality, naming conventions, git commits, error handling | `core/path-scoped-rules/code-quality.md` |
| UI components, styling, design tokens | `core/path-scoped-rules/ui-rules.md` |
| Research, technology decisions, library selection | `core/path-scoped-rules/research-rules.md` |
| Bible updates, documentation, ADRs, changelog | `core/path-scoped-rules/bible-rules.md` |
| Harness changes (AGENTS.md, IDE shims, rules, workflows, evals, skills) | `core/static-rules/governance.md` |
| Workspace identity, project registry, hard rules | `core/static-rules/product.md` |
| Engagement mode / autonomy boundary (vibe, structured, agentic) | `docs/bible/MODE.md` (read it first; undeclared ⇒ structured) |

---

## Skills

The skill INDEX lives **only** in `AGENTS.md` (generated from
`core/context/skills-manifest.yaml`). Load skill details through the skills
loader (`core/context/skills-loader.ts`) — never paste skill tables into rule
files.

---

## Universal Rules

The four universal hard rules live **only** in `AGENTS.md` (Layer 0, read by
every IDE). Do not duplicate them here.

---

## Mode Detection (Bible Update Checks)

Before running any `docs/bible/` update check, identify the current mode:

- **Research Mode**: files being written to `docs/research/` → skip `docs/bible/` checks; only verify `docs/research/README.md` index is updated.
- **Development Mode**: files being written to `{{APP_PATH}}/` → run full `docs/bible/` check using the mapping table in `core/path-scoped-rules/bible-rules.md`.
- **Config/Workspace Mode**: files in `core/`, `.agent/`, `.agents/`, `.claude/`, `docs/sync-reports/`, `docs/bugs/`, `docs/plans/`, `docs/reports/`, `docs/status-reports/` → skip `docs/bible/` checks entirely.
