# docs/reports/sync/

| Field | Declaration |
|---|---|
| **Purpose** | **Cross-source sync receipts** (DECIDED — blueprint §10.16 Candidate C): any operation that synchronizes two sources of truth emits a receipt here — bible ↔ code, migrations ↔ types, plan ↔ implementation, git ↔ remote. Primary use case: drift-detection outputs from `/ss-sync-bible` and `/ss-schema-sync` (what drifted, what auto-fixed, what needs human review). |
| **When populated** | On each sync run by `/ss-sync-bible`, `/ss-schema-sync`, and other sync loops. Stays empty in a starter project. |
| **File types** | Timestamped markdown/YAML receipt files (example: `2026-10-09T1430Z-bible-sync.md`). |
| **Owner** | Sync skills and workflows (auto-generated). |
| **Lifecycle** | Emitted per run; retained as audit trail. |
