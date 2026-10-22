---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Runtime topology, stack reference, monorepo boundaries
---
# 01 — Architecture Overview

This chapter is the SSOT for **how the system is put together**: the runtime topology, the technical stack, and the structural boundaries that keep it maintainable.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/01-architecture/` at init. When a pack overlay exists, it replaces this template wholesale.

## System Architecture

Describe the request/data flow of {{PROJECT_NAME}} end to end: entry points, server/runtime boundary, data stores, and background workers. Include a diagram (ASCII or Mermaid) that an agent can parse without loading source code.

## Technical Stack Reference

Maintain a table of the concrete technologies and pinned versions this workspace is built on (language, framework, runtime, database, storage, test tooling). Keep it current — this table is what agents consult before choosing libraries.

## Architectural Decisions & Distinctions

Record the structural choices that differentiate this system from the obvious alternatives (see also `DECISIONS.md` for the full ADR log). Each entry: what was chosen, what was rejected, and why.

## Monorepo Layout Structure (Dual-Repo Architecture)

- Workspace root holds AI steering, governance and documentation only — never application source code.
- Each archetype's application lives under its own `apps/<app>/` directory with an **independent git repository and remote** (`.workspace-git.json` describes the layout).
- AI IDE folders (`.claude/`, `.commandcode/`, `.agent/`, `.opencode/`) are junctions to canonical content — never copies.

## Loop Observability, Cost & Lineage (core harness)

The loop harness (`core/harness/`) keeps loop health and documentation drift auditable on disk:

- **Cost** — every loop run and slash-command workflow appends one row to `.loops/<id>/runs.jsonl` at end of run (`core/scripts/record-run.js`; opt out with `cost-tracker.enabled: false` in `core/context/cost-tracker.json`).
- **Dashboard** — `node core/scripts/status-dashboard.js` renders Cost per Accepted Change per loop / archetype / week, first-pass success rate, token burn rate, the terminal-state histogram and each loop's oversight mode; `/status` embeds it.
- **Incremental re-runs (C9)** — `core/harness/stage-deps.ts` fingerprints each stage's declared Inputs by content (sha256). A clean exit records fingerprints; the next run with unchanged inputs exits `no_op` before parsing anything, upstream output changes cascade downstream, and `force_rerun` is the per-stage escape hatch.
- **Lineage tracing (C10)** — `core/observability/lineage-tracer.ts` walks relative links backward from a deliverable through stage outputs to sources, git-diffs the per-stage files, and reports the first divergent stage plus the suspect `CONTEXT.md` contract line; `node core/scripts/drift-dashboard.js` combines those entry points with bible chapter staleness.
- **Memory** — curated loop lessons live in `.loops/<id>/lessons.md` (format: `docs/loops/_template/lessons.md`) and are pruned on evidence by `core/harness/memory/curate.ts`.

## Constraints & Operational Envelope

Document the hard limits of the deployment target (memory, execution time, region, cold-start behavior) and the architectural consequences of each.

## ShiftStone Framework v2.1 Architecture & Quality Flywheel

ShiftStone v2.1 upgrades the autonomous development OS with end-to-end governance:
- **Two-Gear Boundary & Verification Ladder (L1–L5):** Inner gear (L1/L2) runs locally without ceremony. Outer gear (L4/L5) requires disjoint Checker sign-off (score ≥ 80) and Level 5 human approval before publishing or mutating SSOT.
- **Level 1.5 Pre-Commit Anti-Gaming Guard:** Deterministically blocks test deletions, test skip modifiers (`.skip`, `fit`, `xit`), and typecheck/linter suppressions (e.g., TS ignore and ESLint disable comments).
- **Level 4 Two-Gate Consequence-Aware Maker-Checker Contract:** Gate A enforces zero unresolved critical/high findings (`confidence >= 0.8`), `hallucination === 2/2`, and disjoint context (`maker !== reviewer`). Gate B enforces calibrated normalized score (`>= 80`).
- **Level 5 Protected Action & Terminal State Governance:** High-consequence mutations (destructive migrations, RLS changes, production deploys, governance overrides) require explicit `protected-action-approval/v1` in `core/governance/approvals/`. Unapproved actions halt deterministically in terminal state `blocked`.
- **Dual Evaluation Architecture:** 3 Universal Synthetic Harness Trials (`T1`–`T3`) adversarially certify gate enforcement; 6 Pack Factory Capability Trials (`F1`–`F6`) certify vertical-slice domain readiness.
- **Quality Flywheel & Provenance:** Every trial and loop turn records structured provenance (`trajectory/v1`) and flywheel metrics (`telemetry/v1`) to `.logs/telemetry/flywheel.jsonl`.
- **Master Validation Gate:** `npm run validate:workspace` (`core/scripts/validate-workspace.js`) orchestrates all 15 validators across 5 deterministic stages.
