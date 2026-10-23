# docs/decisions/ — Architecture Decision Records (ADRs) & Open Questions

| Field | Declaration |
|---|---|
| **Purpose** | Canonical storage directory for individual Architecture Decision Records (ADRs) following the Open Knowledge Framework (OKF) One Concept Per File standard (`LOCK-02` / `UG-21`), and for Open Questions (`OQ-XXX`) — unresolved ambiguities captured before they harden into decisions or stage contracts (consolidated per `DEC-013`). |
| **File Naming** | Decisions: `DEC-XXX-<slug>.md` (e.g., `DEC-001-react-router-8-architecture.md`, `DEC-010-adr-storage-and-compiled-index.md`). Open Questions: `OQ-XXX-<slug>.md` (e.g., `OQ-001-cross-runtime-state.md`). |
| **Frontmatter (DEC)** | `type: decision`, `decisionId: DEC-XXX`, `title: string`, `status: proposed \| accepted \| superseded \| deprecated \| rejected`, `pack: string`, `timestamp: ISO string`, and `supersededBy: DEC-XXX` (mandatory when `status === "superseded"`). |
| **Frontmatter (OQ)** | `type: open-question`, `questionId: OQ-XXX`, `title: string`, `status: open \| under-review \| decided \| parked \| withdrawn`, `timestamp: ISO string`, and `resolvedBy: DEC-XXX` (mandatory when `status === "decided"`). |
| **Lifecycle (DEC)** | `proposed` $\rightarrow$ `accepted` $\rightarrow$ `superseded` (with `supersededBy`) \| `deprecated` \| `rejected`. |
| **Lifecycle (OQ)** | `open` $\rightarrow$ `under-review` $\rightarrow$ `decided` (pointing to `resolvedBy: DEC-XXX`) \| `parked` \| `withdrawn`. Owners: AI Agent and Human Architects during brainstorming (`ss-brainstorm`), planning (`ss-plan`), and diagnosis. |
| **Compiled View** | `docs/bible/DECISIONS.md` is deterministically compiled from these individual files by `.shiftstone/scripts/compile-decisions.js`. Never edit `docs/bible/DECISIONS.md` directly. |
| **Validation** | `node .shiftstone/scripts/validate-decisions.js` and `node .shiftstone/scripts/compile-decisions.js --check`. |
