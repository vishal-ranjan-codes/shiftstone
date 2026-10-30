---
type: plan
title: Phase 5 — AI Steering Router & Context Rule Harness
status: planned
timestamp: {{TIMESTAMP}}
version: 1.0.0
owner: core
tags: [phase-5, steering, agents-router, context-budgets, rules]
---

# Phase 5: AI Steering Router & Context Rule Harness

**Status:** `planned`  
**Depends on:** Phase 4 (`phase-4-actionable-task-backlog.md`)  
**Plan Units:** `U11`, `U12`  
**Acceptance Criteria:** `AC-U11-01`, `AC-U12-01`  

---

## 1. Objective & Scope

Establishes the ultra-lean AI steering router in `AGENTS.md` and customizes workspace static and path-scoped rules. Strictly enforces context ceilings: `AGENTS.md` $\le 60$ lines / $\le 4,096$ bytes, individual static rules $\le 120$ lines / $\le 6,144$ bytes, and cumulative always-on rules $\le 12,288$ bytes (~2,655 tokens).

---

## 2. Inputs & Context Dependencies

| Input Path | Role / Requirement |
|---|---|
| `docs/plans/workspace-initialization/CONTEXT.md` | Provides workspace boundary paths and project identity. |
| `.agents/skills/ss-steering/resources/agents-router-template.md` | Slim AGENTS.md router template. |
| `.agents/skills/ss-steering/resources/static-rules-templates.md` | Standard static rules (`product.md`, `security.md`, etc.). |

---

## 3. Plan Units

### Unit `U11` — Compile Slim AGENTS.md Orientation Router
- **Layer:** core
- **Target Files:**
  - `AGENTS.md`
- **Mechanics:** Compiles slim router adhering to the 60-line ceiling, mapping documentation trees and skill indexes.
- **Acceptance Criteria:** `AC-U11-01`: `AGENTS.md` complies with $\le 60$ lines and $\le 4,096$ bytes ceilings.

---

### Unit `U12` — Synthesize Static & Path-Scoped Rules
- **Layer:** core
- **Target Files:**
  - `.shiftstone/static-rules/product.md`
  - `.shiftstone/static-rules/security.md`
  - `.shiftstone/path-scoped-rules/`
- **Mechanics:** Synthesizes project-specific product rules and security boundaries within strict byte allocations.
- **Acceptance Criteria:** `AC-U12-01`: Cumulative always-on rules do not exceed 12,288 bytes.

---

## 4. Verification & Outputs

- **Verification Command:** `node .shiftstone/scripts/validate-context-budgets.js`
- **Expected Artifacts:** Compliant `AGENTS.md` router and customized `.shiftstone/static-rules/`.
