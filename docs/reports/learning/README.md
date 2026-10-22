# docs/reports/learning/ — Curated Learning Registry (`learning-record/v1`)

| Field | Declaration |
|---|---|
| **Purpose** | Curated knowledge compounding repository storing structured learning records (`learning-record/v1`). Replaces raw uncurated lesson appending with structured root-cause analysis, verified evidence paths, and anti-overlap Jaccard deduplication (`UG-20`). |
| **When populated** | Authored by `/ss-lesson` or diagnosis loops when an agent mistake, edge-case failure, or harness defect is identified. |
| **File types** | Structured JSON files named `LR-YYYYMMDD-XXX.json` strictly conforming to `core/governance/schemas/learning-record.schema.json`. |
| **Lifecycle** | `candidate` $\rightarrow$ `validated` $\rightarrow$ `promoted` (via `/ss-sync-bible` proposal) or `rejected`. |
| **Validation** | `node core/scripts/validate-learning.js` (enforces schema, disk evidence paths, and Jaccard token overlap $< 0.70$). |
| **Owner** | AI Agent (`ss-lesson`, `ss-diagnose`, `ss-sync-bible`) with human outer-gate sign-off. |
