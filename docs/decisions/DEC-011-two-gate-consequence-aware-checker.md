---
type: decision
decisionId: DEC-011
title: Two-Gate Consequence-Aware Maker-Checker Contract and Lens Resolver
status: accepted
pack: core
timestamp: 2026-10-19T23:36:00.000Z
---

# DEC-011 — Two-Gate Consequence-Aware Maker-Checker Contract and Lens Resolver

## Context
Traditional LLM code review either produces infinite loops over minor cosmetic nitpicks or fails to enforce critical zero-tolerance invariants (like security RLS checks or cross-boundary stack leaks).

## Decision
Adopt Locked Decision `LOCK-03` (`UG-17`): implement a Two-Gate Consequence-Aware Maker-Checker Contract (`checker-report/v1`).
- Gate A (Zero-Tolerance Invariant Gate): zero unresolved `critical` or `high` findings at `confidence >= 0.8` across active conditional lenses + `hallucination === 2/2` + disjoint maker/reviewer.
- Gate B (Calibrated Quality Gate): weighted `normalizedScore >= 80` (1.6 / 2.0).
Status `APPROVED` strictly requires passing both Gate A and Gate B. Domain/stack invariants are decoupled into `packs/<pack>/checker-lenses/*.lens.json`.

## Consequences
Completely stops infinite L4 nitpick loops over advisory comments while guaranteeing uncompromising zero-tolerance enforcement for security, boundary, and hallucination defects.
