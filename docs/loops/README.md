---
type: readme
timestamp: 2026-10-12T02:30:05.507Z
---
# Loops — versioned loop specifications

| Field | Declaration |
|---|---|
| **Purpose** | Canonical, versioned **loop specs** consumed by the Loop Runner (`.shiftstone/harness/`). Runtime state, baselines and run history live in `.loops/` (gitignored), never here. |
| **When populated** | When a new automation loop is authored with the `loop-author` skill; updated when loop behavior changes. |
| **File types** | `<loop-id>/spec.md` + `README.md`; `_template/` (state.json, lessons.md); `.schema.json` state schema. |
| **Owner** | Loop author (human + agent) via the `loop-author` skill; specs gate through `.shiftstone/harness/cli.js validate`. |
| **Lifecycle** | Authored → validated (refusal gate) → versioned here → runtime state accumulates in `.loops/`. |

| Loop | Level | Trigger | Purpose |
|---|---|---|---|
| [diagnose-loop](./diagnose-loop/) | L1 | manual | Drive `core/` back to a green typecheck |
| [schema-sync-loop](./schema-sync-loop/) | L1 | manual / event | Three-way schema drift detection |
| [bible-sync-loop](./bible-sync-loop/) | L1 | manual | Code ↔ bible ↔ decisions drift detection |
| [new-feature-loop](./new-feature-loop/) | L4 | manual | Spec → verified feature with outer gate |
| [quality-flywheel-loop](./quality-flywheel-loop/) | L1 | manual | Eval failures → clusters → backlog items (B5) |

**Authoring:** use the `loop-author` skill (7-question interview + hardening
pass), then gate the spec:

```sh
node .shiftstone/harness/cli.js validate <loop-id>
```

**Running:**

```sh
node .shiftstone/harness/cli.js run <loop-id>
node .shiftstone/harness/cli.js status <loop-id>
```
