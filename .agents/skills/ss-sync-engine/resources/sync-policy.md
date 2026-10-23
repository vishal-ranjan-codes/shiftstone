# ShiftStone Engine Synchronization Policy (DEC-014 Reference)

This document formalizes the boundary separation rules between the **ShiftStone Engineering Hub** (Parent Lab) and the **ShiftStone Starter Framework** (Child Repository).

---

## 1. Directory Classification

### Category A: Universal Engine Logic (100% Shared)
These files contain framework mechanisms, algorithms, loop engines, and validation logic that MUST remain identical across all ShiftStone instances:
- `.shiftstone/scripts/` — CLI commands, validators, checkers, shims, compilers
- `.shiftstone/harness/` — Loop runner, state machine, hooks, evals, verifier
- `.shiftstone/context/` — Skills loader, token budget calculator, model routing
- `.shiftstone/init/` — Archetype composer, dual-repo engine, seed governance
- `.shiftstone/observability/` — Lineage tracer, cost tracker, drift dashboard
- `.shiftstone/tests/` — Engine unit and integration tests
- `.shiftstone/governance/schemas/` — JSON schemas for contracts, manifests, telemetry
- `.shiftstone/governance/checker-lenses/` — Universal checker lenses

### Category B: Role-Protected Boundary Files (NEVER Overwritten Blindly)
These files define the identity, role, and configuration of the specific workspace:

| File Path | Parent Lab Hub Role | Child Starter Framework Role | Why Protected |
|---|---|---|---|
| `.shiftstone/governance/workspace-manifest.json` | `"workspaceRole": "engineering-hub"` | Blank starter configuration | Role definition and active packs differ |
| `.shiftstone/governance/implementation-status.json` | Monorepo implementation status | Clean starter `{ "phases": {} }` | Progress tracking is workspace-specific |
| `.shiftstone/static-rules/product.md` | `ShiftStone Engineering Hub` | `{{PROJECT_NAME}}` starter template | Lab identity vs. generic starter template |
| `.shiftstone/static-rules/global.md` | Hub development rules | Starter project development rules | Operating mode rules differ |
| `AGENTS.md`, `CLAUDE.md`, etc. | Hub workspace layout (`frameworks/`) | Starter project layout (`apps/`) | Topology and hard rules differ |
| `package.json` | Hub monorepo dependencies & scripts | Starter dependencies & scripts | Script surfaces differ |
| `docs/bible/` | ShiftStone OS Development Bible | Starter project Development Bible | Architecture documentation differs |
| `docs/decisions/` | ShiftStone OS ADRs (`DEC-013`, `014`) | Starter seed ADRs (`DEC-010`–`012`) | Decision records reflect local architecture |

---

## 2. Synchronization Invariants

1. **Zero Placeholder Leakage:** A sync from Framework $\rightarrow$ Lab must never introduce unexpanded placeholders (`{{...}}`) into the Lab.
2. **Zero Lab Path Leakage:** A sync from Lab $\rightarrow$ Framework must never introduce lab-only paths (e.g. `frameworks/`) into starter scripts.
3. **LF Line Endings:** All files must maintain LF line endings to ensure Windows-Unix cross-platform compatibility.
4. **Master Certification Preservation:** No sync may be approved if either workspace fails `validate-workspace.js`.
