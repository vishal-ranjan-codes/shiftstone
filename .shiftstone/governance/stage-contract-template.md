---
schemaVersion: stage-contract/v1
type: stage-contract
stageId: STAGE-01
planId: template-plan
title: Template Stage Contract
status: planned
effort: AUTOMATED
undeclaredInputPolicy: amend-and-reload
inputs:
  - path: docs/bible/01-architecture/architecture-overview.md
    role: ssot-bible
    requiredStatus: active
outputs:
  - path: docs/reports/template-artifact.md
    artifactType: report
verificationLevels:
  - L1
  - L2
exitCriteria:
  - id: EC-01
    level: L1
    command: npm test
    expected: exit 0
---

# Template Stage — CONTEXT

> Stage contract (ICM Layer 2, stage-contract/v1). The agent loads **only** the
> files declared under `inputs` (scoped loading — the loader refuses
> directory crawls) and writes **only** the artifacts declared under
> `outputs`.

## Undeclared Input Amendment Protocol (amend-and-reload)

If during stage execution the Maker agent discovers a need to consume an input file
not declared in `inputs[]`:
1. **HALT execution immediately.** Never silently read undeclared source or documentation files.
2. **Amend this contract (`CONTEXT.md`):** Append the required input path to `inputs[]` with its appropriate `role` and `requiredStatus`.
3. **Re-validate the contract:** Execute `node .shiftstone/scripts/validate-stage-contracts.js`.
4. **Reload stage context:** Resume the stage with the newly declared input properly recorded in the audit trail.

## Human Effort

Band: **AUTOMATED** — one of `DIRECTION` | `AUTOMATED` | `ALIGNMENT` (U-shaped effort curve).

- **DIRECTION** (first stage of the sequence): human-heavy. The human writes
  and corrects the brief; the stage must not be treated as agreed until that
  direction is approved. Agent proposes, human decides.
- **AUTOMATED** (middle stages): agent-owned. The human intervenes on
  exceptions only — no approval needed to seal; deterministic checks gate it.
- **ALIGNMENT** (last stage of the sequence): human-heavy. The human inspects
  the final output against the stage-1 intent (bugs, drift, misalignment).

Gate: `none` for AUTOMATED; for DIRECTION/ALIGNMENT name what the human
approves before this stage seals (e.g. `spec approval`, `final review via
/verify >= 0.8`).

## Inputs

Every file this stage reads, tagged with its ICM role. Concrete relative
paths only — no globs, no machine-absolute paths:

- docs/bible/01-architecture/architecture-overview.md (role: ssot-bible)

## Process

The operations this stage runs, in order (one numbered step per operation):

1. Read declared inputs and verify preconditions.
2. Execute bounded operations strictly within declared output targets.
3. Validate output artifacts against defined exit criteria.

## Outputs

Every artifact this stage produces:

- docs/reports/template-artifact.md (artifactType: report)

---

**Lifecycle:** Copy this template into a stage folder
(`docs/plans/<id>/<nn>-<stage>/CONTEXT.md`), fill the sections, validate with:

```sh
node .shiftstone/scripts/validate-stage-contracts.js
```
