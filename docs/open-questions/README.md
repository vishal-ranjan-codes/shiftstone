# docs/open-questions/ — Open Questions Ledger

| Field | Declaration |
|---|---|
| **Purpose** | Canonical storage directory for architectural, product, and harness Open Questions (`UG-21`). Captures unresolved ambiguities before they harden into architectural decisions or stage contracts. |
| **File Naming** | `OQ-XXX-<slug>.md` (e.g., `OQ-001-cross-runtime-state.md`). |
| **Frontmatter** | `type: open-question`, `questionId: OQ-XXX`, `title: string`, `status: open \| under-review \| decided \| parked \| withdrawn`, `timestamp: ISO string`, and `resolvedBy: DEC-XXX` (mandatory when `status === "decided"`). |
| **Lifecycle** | `open` $\rightarrow$ `under-review` $\rightarrow$ `decided` (pointing to `resolvedBy: DEC-XXX`) \| `parked` \| `withdrawn`. |
| **Validation** | `node core/scripts/validate-decisions.js` validates all open-question files. |
| **Owner** | AI Agent and Human Architects during brainstorming (`ss-brainstorm`), planning (`ss-plan`), and diagnosis. |
