# Plan Maintenance & Intent-Preserving Evolution Protocol

This reference provides the architectural standard for modifying, updating, or refactoring existing implementation plans (`CONTEXT.md` or `phase-<N>-<name>.md`) across ShiftStone workspaces.

---

## 1. Core Motivation & Problem Statement

When an implementation plan is modified, agents frequently commit one of two severe errors:
1. **Blind Truncation / Lazy Summarization**: When fixing a validation error (e.g. missing `Outputs` heading) or trying to satisfy line limits, the agent rewrites the file and lazily condenses 50-line technical unit specifications, schema contracts, and root-cause analyses into 2-line summary bullets.
2. **Paralysis from Blunt Invariants**: When given a blunt prohibition ("never delete or modify existing unit specifications"), an agent refuses legitimate user directives to delete obsolete tasks, fix incorrect root causes, or re-architect invalid approaches.

The **Intent-Driven Plan Evolution Protocol** resolves both extremes by classifying plan edits by **Intent Mode**.

---

## 2. The Three Intent Modes

```
               ┌────────────────────────────────────────────────────────┐
               │           PLAN MODIFICATION INTAKE DECISION            │
               └────────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│     MODE 1       │             │     MODE 2       │             │     MODE 3       │
│ Validation / Lint│             │ Additive Scope   │             │ Corrective Edit  │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│• Missing heading │             │• "Add tasks"     │             │• User says delete│
│• Table row count │             │• Audit findings  │             │• Wrong root cause│
│• Stage validator │             │• New criteria    │             │• Re-architecture │
├──────────────────┤             ├──────────────────┤             ├──────────────────┤
│ MANDATE:         │             │ MANDATE:         │             │ MANDATE:         │
│ Zero technical   │             │ Full retention;  │             │ Depth Parity;    │
│ content mutation;│             │ new units added  │             │ replace with     │
│ append sections. │             │ alongside old.   │             │ full mechanics.  │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### Mode 1: Structural & Validation Fixes
- **Triggers**: Running `validate-stage-contracts.js`, fixing broken markdown links, adding missing required headings (`Outputs`, `Verification`, `Durable Memory`, `Human Checkpoint`), or trimming input table rows.
- **Allowed Actions**: Append or insert missing structural headings, tables, or frontmatter keys.
- **Strict Invariants**:
  - **Zero Technical Mutation**: Existing `Problem & Root Cause` analyses, `Data & Schema Contracts`, and `Detailed Unit Specifications` are frozen.
  - Agents must NEVER summarize, condense, or delete technical content to satisfy a validator or line guideline.

### Mode 2: Additive Scope & Audit Updates
- **Triggers**: User requests: *"update the plan with your new audit findings"*, *"add tasks for X"*, *"include these improvements"*.
- **Allowed Actions**: Add new units (`Un+1`), add new acceptance criteria, or enrich existing units with missing parameters.
- **Strict Invariants**:
  - **Strict Preservation**: Existing units and problem breakdowns must be fully retained in their complete technical depth.
  - Newly audited tasks must be written with the exact same level of granular detail (Target Files, Schemas, Mechanics, Edge Cases) as previously authored tasks.

### Mode 3: Corrective Refactoring & Explicit Deletion
- **Triggers**: User requests: *"remove task 2"*, *"that root cause is wrong, change the approach to Y"*, *"re-architect Phase 1"*, or newly discovered facts invalidate an existing approach.
- **Allowed Actions**: Delete, replace, or re-architect units as explicitly instructed.
- **Strict Invariants**:
  - **Depth Parity Invariant**: When replacing or re-architecting a unit, the replacement MUST maintain equal or greater technical depth (Target Files, Schemas, Mechanics, Verification).
  - Deleting or replacing a detailed unit spec must NEVER result in a degraded, superficial 2-line bullet summary.

---

## 3. Operational Tooling Rules

### Rule 1: The Surgical Edit Rule (Targeted Edits over Blanket Replacement)
- When modifying an **existing** stage contract, agents **MUST use targeted patch/edit capability** (such as `edit_file` or precise search-replace) for localized block edits, appending new sections, or updating specific units.
- Blanket file replacement that overwrites existing mature plans is strictly prohibited unless creating a brand-new file or executing an authorized 100% rewrite. This physically eliminates accidental LLM summarization of untouched sections.

### Rule 2: The Sizing Ceiling vs. Depth Invariant
- Skill guidelines such as *"$\le 500$ lines per phase contract"* are triggers for **Phase Decomposition**, never an excuse for **Summary Compression**.
- If a phase contract naturally grows beyond 500 lines because it contains multiple complex units with extensive code schemas, the agent MUST **split the phase into two modular sub-phases** (e.g. `phase-1a-layout.md` and `phase-1b-sizing.md`), **NEVER strip out technical depth** to artificially stay under the line limit.

### Rule 3: Scoped Evidence Invalidation
- When a phase contract or unit definition is amended, the definition hash (`definitionSha256`) is recalculated for that phase.
- **Scope-Bound Invalidation**: Changes to an active phase's contract invalidate verification and review freshness only for the affected phase and its direct dependent outputs. Unrelated predecessor phases with untouched source and definitions retain their historical validity.
