# Bounded Phase Resumption Protocol

This reference instructs downstream engineering agents how to orient, inspect prerequisites, and resume work on an active phase within a plan suite without loading excessive historical context.

---

## 1. Running the Resume Tool

Before editing code or modifying contracts, run the resume command for the target phase:

```bash
# Default implementation mode:
npm run plan:resume -- docs/plans/<suite-name> --phase P2

# Or directly:
node .shiftstone/scripts/plan.js resume docs/plans/<suite-name> --phase P2 [--json]
```

---

## 2. Operational Modes: `implement` vs. `remediate`

### Mode A: `implement` (Default)
- **Use when**: Ready to implement new unit tasks in the phase.
- **Prerequisite Enforcement**: The tool checks each dependency declared in `phase.dependsOn`:
  - Every predecessor phase must have `acceptance === 'complete'`.
  - If any predecessor is pending, failed, or blocked by an active issue, the command **fails with exit code 2** (`ready: false`).
- **Guidance**: You must resolve the predecessor blocker before beginning implementation.

### Mode B: `remediate`
- **Use when**: Fixing a failed check, addressing checker review findings, or repairing stale evidence in the current phase.
- **Behavior**: Permits targeting the phase's gaps without requiring downstream readiness claims.
- **Exit Code**: Exits with code `0` (`ready: true`), emitting the checklist of failing checks or missing gates to repair.
- **Command**:
  ```bash
  node .shiftstone/scripts/plan.js resume docs/plans/<suite-name> --phase P2 --mode remediate
  ```

---

## 3. Bounded Context & `readTargets`

The resume tool outputs a deterministic list of `readTargets`:

1. **Suite Overview**: `${suite}/README.md` (to understand overall architecture and phase relationships).
2. **Active Phase Contract**: The current stage contract (`phase-<N>-<name>.md`).
3. **Active Unit Definitions**: JSON files in `${suite}/plan-units/` belonging to this phase (`U3.json`, `U4.json`).
4. **Immediate Predecessor Handoff**: The latest attempt file from the immediate predecessor phase (`output/handoffs/P1/attempt-*.json`).
5. **Reviewer Evidence**: Any checker report referenced by the predecessor or active handoff.
6. **Controlling Policies**: Applicable rules (`AGENTS.md`, `.shiftstone/static-rules/global.md`, `verification.md`).
7. **Scoped Source Files**: Exact paths declared in `phase.sourcePaths`, check source paths, and unit `allowedInputs`.

> **Reading Invariant**: Downstream agents **MUST physically inspect the files listed in `readTargets`** before writing code. A CLI command returning a list of targets does not prove the agent understands the interfaces. Total token payload across declared `readTargets` is mathematically bounded ($\le 4,500$ tokens).

---

## 4. Regression Checklist & Inherited Guarantees

The resume output includes `regressionCheckIds`:
- These are automated checks declared in `phase.checks` with `regressionFor` mapping to predecessor phases.
- Downstream agents must ensure that implementation of new units does not regress earlier phase deliverables. Run regression checks before closing the phase.
