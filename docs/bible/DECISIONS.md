---
type: decisions
timestamp: 2026-10-21T00:00:00.000Z
---
# Architecture Decision Records (ADRs)

All foundational engineering and architectural decisions for this workspace are documented here in chronological order.
This ledger is auto-compiled from individual OKF decision files in `docs/decisions/` by `.shiftstone/scripts/compile-decisions.js` (`LOCK-02` / `UG-21`).

---

<!-- Pack-seeded ADRs are inserted here at init (.shiftstone/packs/<archetype>/decisions-seed.yaml). New ADRs append below the seeded block. -->

## Architecture Decisions Ledger

| ID | Title | Status | Pack | Date | Details |
|---|---|---|---|---|---|
| DEC-001 | React Router 8 (Framework Mode) Architecture | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-001](../decisions/DEC-001-react-router-8-architecture.md) |
| DEC-002 | Route Middleware-First Auth with @supabase/ssr & getClaims() | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-002](../decisions/DEC-002-route-middleware-auth.md) |
| DEC-003 | Edge-Native Cloudflare Workers Runtime | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-003](../decisions/DEC-003-edge-native-cloudflare-workers.md) |
| DEC-004 | Supabase 2025 API Keys Standard | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-004](../decisions/DEC-004-supabase-api-keys-standard.md) |
| DEC-005 | Tailwind CSS v4 Semantic Theme Tokens | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-005](../decisions/DEC-005-tailwind-semantic-tokens.md) |
| DEC-006 | Cloudflare R2 Object Storage via S3-Compatible API | accepted | rr8-supabase-cf | 2026-09-05 | [DEC-006](../decisions/DEC-006-cloudflare-r2-storage.md) |
| DEC-007 | Monorepo Subfolder Architecture | accepted | core | 2026-09-05 | [DEC-007](../decisions/DEC-007-monorepo-subfolder-architecture.md) |
| DEC-008 | Multi-Method Authentication Architecture with Centralized Config | accepted | rr8-supabase-cf | 2026-09-06 | [DEC-008](../decisions/DEC-008-multi-method-auth-config.md) |
| DEC-009 | Graceful Degradation for Zero-Credential Environments | accepted | rr8-supabase-cf | 2026-09-06 | [DEC-009](../decisions/DEC-009-graceful-degradation.md) |
| DEC-010 | Canonical Individual OKF ADR Storage and Auto-Compiled Ledger Index | accepted | core | 2026-10-19 | [DEC-010](../decisions/DEC-010-adr-storage-and-compiled-index.md) |
| DEC-011 | Two-Gate Consequence-Aware Maker-Checker Contract and Lens Resolver | accepted | core | 2026-10-19 | [DEC-011](../decisions/DEC-011-two-gate-consequence-aware-checker.md) |
| DEC-012 | 1-to-1 Legacy Workflow-to-Skill Migration and Universal Skills Unification | accepted | core | 2026-10-19 | [DEC-012](../decisions/DEC-012-workflow-to-skill-migration.md) |
| DEC-013 | Documentation Directory Consolidation (13 → 9 Folders) | accepted | core | 2026-10-24 | [DEC-013](../decisions/DEC-013-docs-directory-consolidation.md) |

## Open Questions Ledger

*No open questions at this time.*
