---
activation: always
---

# {{PROJECT_NAME}} — Bible Rules

---

## Mode Detection

Before any `docs/bible/` update check, identify the current mode from the file path being written:

| File Path Prefix | Mode | Action |
|---|---|---|
| `{{APP_PATH}}/` | Development Mode | Run full `docs/bible/` check using mapping table below |
| `docs/research/` | Research Mode | Skip `docs/bible/` checks; verify `docs/research/README.md` index is updated |
| `docs/bible/` | Direct Bible Edit | Skip — bible is already being updated |
| `.agent/`, `.agents/`, `.claude/`, `.opencode/` | Config Mode | Skip — no `docs/bible/` update needed |
| `docs/sync-reports/`, `docs/bugs/`, `docs/plans/`, `docs/reports/`, `docs/status-reports/` | Docs Artifact | Skip — no `docs/bible/` update needed |

When the path is ambiguous, ask the user before proceeding.

---

## Change → docs/bible/ Mapping Table

Use this table in Development Mode to identify which `docs/bible/` file(s) to update:

| Change Type | docs/bible/ File to Update |
|---|---|
| New DB table or column | `03-database/schema-reference.md` |
| New or modified migration | `03-database/migrations-and-seeding.md` |
| New or modified RLS policies | `03-database/rls-policies.md` |
| New or modified Route / Loader / Action / Resource Route | `08-api-contracts/route-contracts.md` |
| New or modified Route Middleware | `04-auth-and-rbac/auth-overview.md` |
| New or modified scheduled worker / cron job | `01-architecture/architecture-overview.md` or `05-core-systems/` |
| New or modified object-storage integration | `06-integrations/external-services.md` |
| New core systems domain logic | `05-core-systems/core-domain-rules.md` |
| New UI component or styling token | `07-frontend/ui-architecture.md` |
| Architecture decision made | `DECISIONS.md` (new DEC-XXX entry) |
| Any shipped feature or bug fix | `log.md` row → compiled into `CHANGELOG.md` (`node .shiftstone/scripts/compile-changelog.js`) |

---

## ADR Format

Every architecture decision gets a DEC-XXX entry in `docs/bible/DECISIONS.md`:

```markdown
## DEC-XXX — [Short Title]

- **Date**: YYYY-MM-DD
- **Status**: Accepted
- **Context**: [Why this decision was needed]
- **Decision**: [What was decided]
- **Consequences**: [Trade-offs and implications]
```

---

## Changelog Entry Format

Every shipped change is recorded as an append-only `log.md` row (format in
`_config/conventions.md`) and compiled into `docs/bible/CHANGELOG.md` by
`node .shiftstone/scripts/compile-changelog.js` — prefer the log path over a direct
changelog edit, so the record and the changelog cannot drift apart:

```markdown
## [YYYY-MM-DD]

### Added / Changed / Fixed
- [Description of change] — [affected route, package, or area]
```

---

## Core Bible Rules

- ALWAYS read `docs/bible/README.md` before starting any feature.
- ALWAYS update the relevant `docs/bible/` file after any code change in `{{APP_PATH}}/`.
- Research findings MUST be saved to `docs/research/` — never inline in `docs/bible/`.
