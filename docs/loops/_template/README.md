---
type: readme
timestamp: 2026-10-14T00:00:00.000Z
---

# _template — loop runtime state templates

Purpose: versioned **templates and format specs** for the gitignored runtime
state a loop keeps under `.loops/<loop>/`. Never store live run state here.

| File | Purpose | When copied |
|---|---|---|
| [state.json](./state.json) | Fresh `LoopState` skeleton — validates against [../.schema.json](../.schema.json) | On first run the harness writes the real state (Family D persistence); copy this only when bootstrapping a loop by hand |
| [lessons.md](./lessons.md) | Lesson-block format + curation rules (task 5.5/5.6) | When a loop starts recording lessons under `memory.location` |

**Runtime layout** (all gitignored, `.loops/`):

```
.loops/<loop>/state.json        # LoopState — schema-validated
.loops/<loop>/runs.jsonl        # one row per run (cost-tracker.ts, task 5.1)
.loops/<loop>/lessons.md        # curated memory (curate.ts, task 5.6)
.loops/<loop>/stage-deps.json   # incremental stage fingerprints (stage-deps.ts, C9)
.loops/<loop>/baselines/        # A2 pre-turn snapshots
.loops/<loop>/runs/             # rotated trajectory traces (B3)
```

**Owner:** loop harness (`.shiftstone/harness/`). **Lifecycle:** templates manual,
runtime files auto-generated.
