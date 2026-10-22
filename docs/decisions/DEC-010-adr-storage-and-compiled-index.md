---
type: decision
decisionId: DEC-010
title: Canonical Individual OKF ADR Storage and Auto-Compiled Ledger Index
status: accepted
pack: core
timestamp: 2026-10-19T23:36:00.000Z
---

# DEC-010 — Canonical Individual OKF ADR Storage and Auto-Compiled Ledger Index

## Context
Monolithic ADR ledgers (`docs/bible/DECISIONS.md`) create token bloat when loaded by AI agents, cause git merge conflicts during parallel loop branches, and prevent fine-grained `status: superseded` stage-contract blocking.

## Decision
Adopt Locked Decision `LOCK-02` (`UG-21`): store every architecture decision in its own atomic concept file in `docs/decisions/DEC-XXX-<slug>.md` and open questions in `docs/open-questions/OQ-XXX-<slug>.md`. Maintain `core/scripts/compile-decisions.js` to deterministically compile all decisions into a compact summary table in `docs/bible/DECISIONS.md` linking back to the individual ADRs.

## Consequences
Enables stage-contract input validation to block superseded decisions, eliminates token bloat by letting agents load only relevant decisions, and preserves 100% backward compatibility for human-facing bible readers.
