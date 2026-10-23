# docs/decisions/ — Architecture Decision Records (ADRs)

| Field | Declaration |
|---|---|
| **Purpose** | Canonical storage directory for individual Architecture Decision Records (ADRs) following the Open Knowledge Framework (OKF) One Concept Per File standard (`LOCK-02` / `UG-21`). |
| **File Naming** | `DEC-XXX-<slug>.md` (e.g., `DEC-001-react-router-8-architecture.md`, `DEC-010-adr-storage-and-compiled-index.md`). |
| **Frontmatter** | `type: decision`, `decisionId: DEC-XXX`, `title: string`, `status: proposed \| accepted \| superseded \| deprecated \| rejected`, `pack: string`, `timestamp: ISO string`, and `supersededBy: DEC-XXX` (mandatory when `status === "superseded"`). |
| **Lifecycle** | `proposed` $\rightarrow$ `accepted` $\rightarrow$ `superseded` (with `supersededBy`) \| `deprecated` \| `rejected`. |
| **Compiled View** | `docs/bible/DECISIONS.md` is deterministically compiled from these individual files by `.shiftstone/scripts/compile-decisions.js`. Never edit `docs/bible/DECISIONS.md` directly. |
| **Validation** | `node .shiftstone/scripts/validate-decisions.js` and `node .shiftstone/scripts/compile-decisions.js --check`. |
