---
type: readme
timestamp: 2026-10-13T00:00:00.000Z
---
# {{PROJECT_NAME}} — Development Bible

> This is the Single Source of Truth (SSOT) for the {{PROJECT_NAME}} codebase.
> It describes *how* and *why* things are built the way they are.

| Field | Declaration |
|---|---|
| **Purpose** | Architecture SSOT: the eight stack-agnostic chapters document how and why the system is built; code changes are not complete until the relevant chapter is updated (universal hard rules #2/#4). |
| **When populated** | At init (pack `bible-overlays/` pre-fill the template), then continuously by `/ss-new-feature`, `/ss-sync-bible` and the `bible-sync-loop` on every shipped change. |
| **File types** | `01`–`08` chapter directories + `README.md` (generated ToC), `DECISIONS.md` (ADRs), `CHANGELOG.md`, `MODE.md`, `log.md`, `index.md`. |
| **Owner** | AI agents maintain; `/ss-sync-bible` edits require outer-gear Checker sign-off (≥ 0.8). |
| **Lifecycle** | Living document — chapters updated per change; staleness tracked by the drift dashboard; log rows compile into the changelog. |

---

## The Philosophy: Documentation-First

Every feature starts by reading the bible, and ends by updating the bible. If a code change is not documented in the bible, the task is NOT complete.

The eight chapters below are a **stack-agnostic template**. When a stack archetype pack is installed at init, its `bible-overlays/` pre-fill each chapter with the concrete stack documentation for the selected archetypes.

---

## Table of Contents

| Section | Description | File |
|---|---|---|
| **Start Here** | This index and system orientation | `README.md` |
| **MODE** | Engagement-mode declaration: vibe / structured / agentic per environment | `MODE.md` |
| **ADRs** | All Architecture Decision Records (DEC-XXX) | `DECISIONS.md` |
| **Changelog** | Complete history of all shipped modifications | `CHANGELOG.md` |
| **Log** | Append-only change record; compiled into the changelog by /sync-bible | `log.md` |
| **01 — Architecture Overview** | Runtime topology, stack reference, monorepo boundaries | `01-architecture/architecture-overview.md` |
| **02 — Environments and Secrets** | Environment variables, secrets, deployment architecture | `02-setup-and-devops/environments-and-secrets.md` |
| **03 — Database Schema Reference** | Schema reference, access policies, and migration flows | `03-database/schema-reference.md` |
| **04 — Auth & Role-Based Access Control (RBAC)** | Authentication architecture, guards, session handling, roles | `04-auth-and-rbac/auth-overview.md` |
| **05 — Core Systems & Domain Rules** | Business domain rules, atomic transactions, result standards | `05-core-systems/core-domain-rules.md` |
| **06 — Integrations & External Services** | Object storage, background jobs, external APIs | `06-integrations/external-services.md` |
| **07 — Frontend & UI Architecture** | Styling system, semantic design tokens, theme management | `07-frontend/ui-architecture.md` |
| **08 — Route & API Contracts** | Endpoint response contracts, built-in endpoints, module rules | `08-api-contracts/route-contracts.md` |
