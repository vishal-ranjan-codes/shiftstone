---
type: readme
timestamp: 2026-10-14T00:00:00.000Z
---

# bible-sync-loop — code ↔ bible ↔ decisions drift

**Level:** L1 (deterministic) · **Trigger:** manual · **Oversight:** out

Three-way diff over the SSOT surfaces of the workspace:

| Source | What it is |
|---|---|
| code | `docs/bible/` chapter directories on disk + every workspace path the bible references |
| bible | `docs/bible/README.md` table of contents + per-chapter `index.md` |
| decisions | `docs/bible/DECISIONS.md` ADRs + `packs/<pack>/decisions-seed.yaml` ADRs |

**Run:**

```sh
node core/scripts/bible-sync.js --report   # JSON update plan (the drift list)
node core/harness/cli.js run bible-sync-loop
```

**Incremental (C9):** declared stage inputs (`docs/bible`, the pack decisions
seed) are fingerprinted on every clean exit; the second run with no changes
exits `no_op` from the fingerprint gate without re-parsing. Spec:
[spec.md](./spec.md).
