---
type: config-reference
timestamp: 2026-10-12T00:00:00Z
---

# Conventions

Stable, cross-cutting conventions for this workspace (ICM Layer 3).

## Naming & Commits

- Conventional Commits: `type(scope): summary` (feat, fix, docs, chore, refactor, test).
- Application code follows `.shiftstone/path-scoped-rules/code-quality.md` (TypeScript strict, explicit return types on exports).

## File Placement

- Application code lives in `{{APP_PATH}}/` — never in the workspace root.
- Plans → `docs/plans/<id>/`; bugs → `docs/bugs/open-bugs.md`; research → `docs/research/`.
- Reports → `docs/reports/`; periodic snapshots → `docs/status-reports/`; drift outputs → `docs/sync-reports/`.
- Stage folders carry a `CONTEXT.md` contract (template:
  `.shiftstone/governance/stage-contract-template.md`).

## Documentation Discipline

- Read `docs/bible/` before changing application code; update it after.
- Read `docs/research/README.md` before adding a dependency.
- Every `docs/*` directory ships a `README.md` purpose declaration — respect it.
- Knowledge files are OKF-formatted: frontmatter `type` + ISO-8601 `timestamp`, links stay relative and valid.

## Knowledge-Bundle Logs (OKF C6)

Every knowledge bundle carries an append-only `log.md` — the chronological
record agents maintain so history and changelogs survive across sessions —
plus a generated root `index.md` (`node .shiftstone/governance/index.js`, shallow:
bundle root only; catalogs stay the skills manifest / pack registry):

| Bundle | Log |
|---|---|
| Bible | `docs/bible/log.md` |
| Packs | `packs/log.md` |
| Skills | `.agents/skills/log.md` |

- Rows are `| Date | Scope | Change | Kind | Compiled |` (`Kind` ∈ Added, Changed, Fixed, Removed).
- **Append only.** Entries are added by `/sync-bible` and the `bookkeeping`
  skill at the end of a sync — never edited, reordered or deleted.
- An empty `Compiled` cell means pending. `/sync-bible` compiles pending
  rows into `docs/bible/CHANGELOG.md` via
  `node .shiftstone/scripts/compile-changelog.js` and stamps them.
- Keep the `Change` cell a single line without a literal `|` character.
