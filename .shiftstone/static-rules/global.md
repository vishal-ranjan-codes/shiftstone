---
activation: always
---

# {{PROJECT_NAME}} — Global Rules

Enforced on every single agent task. Read this file before acting on any request.

---

## Task → Rule File Dispatch

| Task Type | Rule File to Read |
|---|---|
| Any stack-specific code (follow the active archetype's conventions) | Pack-shipped rules in `.shiftstone/path-scoped-rules/` (e.g. `stack-rules.md`, layered at init) |
| Folder structure or file placement decisions | `.shiftstone/path-scoped-rules/structure.md` |
| TypeScript quality, naming conventions, git commits, error handling | `.shiftstone/path-scoped-rules/code-quality.md` |
| UI components, styling, design tokens | `.shiftstone/path-scoped-rules/ui-rules.md` |
| Research, technology decisions, library selection | `.shiftstone/path-scoped-rules/research-rules.md` |
| Bible updates, documentation, ADRs, changelog | `.shiftstone/path-scoped-rules/bible-rules.md` |
| Harness changes (AGENTS.md, IDE shims, rules, workflows, evals, skills) | `.shiftstone/static-rules/governance.md` |
| Workspace identity, project registry, hard rules | `.shiftstone/static-rules/product.md` |
| Engagement mode / autonomy boundary (vibe, structured, agentic) | `docs/bible/MODE.md` (read it first; undeclared ⇒ structured) |

---

## Skills

The skill INDEX lives **only** in `AGENTS.md` (generated from
`.shiftstone/context/skills-manifest.yaml`). Load skill details through the skills
loader (`.shiftstone/context/skills-loader.ts`) — never paste skill tables into rule
files.

---

## Universal Rules

The four universal hard rules live **only** in `AGENTS.md` (Layer 0, read by
every IDE). Do not duplicate them here.

---

## Mode Detection (Bible Update Checks)

Before running any `docs/bible/` update check, identify the current mode:

- **Research Mode**: files being written to `docs/research/` → skip `docs/bible/` checks; only verify `docs/research/README.md` index is updated.
- **Development Mode**: files being written to `{{APP_PATH}}/` → run full `docs/bible/` check using the mapping table in `.shiftstone/path-scoped-rules/bible-rules.md`.
- **Config/Workspace Mode**: files in `core/`, `.agent/`, `.agents/`, `.claude/`, `docs/bugs/`, `docs/plans/`, `docs/reports/` (incl. `status/`, `sync/`) → skip `docs/bible/` checks entirely.
