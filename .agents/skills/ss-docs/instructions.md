# ss-docs — Code-to-Bible Synchronization Mapping

Procedural reference mapping every code change to the exact Single Source of Truth (`docs/bible/`) file.

---

## Iron Law

1. **Mandatory Documentation Update:** Every code mutation that touches routes, models, middleware, auth, UI tokens, or cron workers MUST update the corresponding `docs/bible/` section before the task is closed.
2. **Physical Disk Updates Only:** Write updates directly to `docs/bible/`. Never emit temporary IDE brain artifacts.
3. **Changelog Invariant:** Every code change shipped to `main` must append an entry to `docs/bible/CHANGELOG.md`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The change was only one line, so docs don't need updating."* | **Forbidden.** One-line schema or route changes alter runtime contracts. Update the relevant chapter. |
| *"I'll update the bible at the end of the whole milestone."* | **Forbidden.** Documentation drift compounds exponentially. Update the bible in the same turn or unit. |
| *"The code is self-documenting."* | **Forbidden.** AI IDEs navigate the project using `docs/bible/` as Layer 1 SSOT. Undocumented code causes future hallucinations. |

---

## Code Change → Bible Mapping Matrix

| Code Change Type | Mandatory `docs/bible/` File(s) to Update |
|---|---|
| New DB table / column | `03-database/schema-reference.md` + `CHANGELOG.md` |
| New migration SQL | `03-database/migrations-and-seeding.md` + `CHANGELOG.md` |
| New / modified RLS policy | `03-database/rls-policies.md` + `CHANGELOG.md` |
| New auth flow / middleware | `04-auth-and-rbac/auth-overview.md` + `CHANGELOG.md` |
| New route / loader / action | `08-api-contracts/route-contracts.md` + `CHANGELOG.md` |
| New database RPC function | `05-core-systems/core-domain-rules.md` + `CHANGELOG.md` |
| New worker / cron schedule | `01-architecture/architecture-overview.md` + `CHANGELOG.md` |
| New env variable / secret | `02-setup-and-devops/environments-and-secrets.md` + `CHANGELOG.md` |
| New UI component / design token | `07-frontend/ui-architecture.md` + `CHANGELOG.md` |
| Third-party integration (storage/email/payments) | `06-integrations/external-services.md` + `CHANGELOG.md` |
| Architectural decision | `DECISIONS.md` (or `docs/decisions/DEC-XXX.md`) + `CHANGELOG.md` |

---

## Verification Ladder

- **L1 (Syntax):** Markdown formatting valid; OKF frontmatter present.
- **L2 (Existence):** All referenced code symbols and files exist on disk.
- **L3 (Parity Check):** `node core/scripts/bible-sync.js` reports 0 contract drift.
- **L4 (Checker Review):** Disjoint Checker verifies accuracy against implemented code.
- **L5 (Sign-Off):** Backlog item marked verified with documentation updated.

---

## Terminal States

- `success`: All affected `docs/bible/` files and `CHANGELOG.md` accurately updated.
- `blocked`: Code introduces architectural concepts with no matching Bible section.
- `escalated`: Code contradicts accepted ADR in `docs/bible/DECISIONS.md`.
