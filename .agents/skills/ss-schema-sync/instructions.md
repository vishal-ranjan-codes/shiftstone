# ss-schema-sync — Database Schema 3-Way Alignment Guide

Procedure for auditing database schema consistency across Bible documentation, SQL migration files, and generated TypeScript types.

---

## Iron Law

1. **3-Way Consistency:** All 3 representations (Bible documentation, SQL migration files, generated TypeScript types) MUST agree. If any one differs, the system is in an unverified state.
2. **Automated Detection First:** Run `node .shiftstone/scripts/schema-sync.js` before manual inspection.
3. **Physical Sync Receipt:** Output audit results directly to `docs/reports/sync/<YYYY-MM-DD>-schema-sync.md`. Never output to temporary IDE brain artifacts.
4. **Remediation Order:** Fix missing migrations via `/ss-new-migration`, regenerate types via the pack typegen script (e.g. `npm run db:types`), and update `docs/bible/03-database/schema-reference.md`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The migration is applied locally, so the Bible doesn't need updating."* | **Forbidden.** Future coding turns rely on `docs/bible/` as the ground truth. Undocumented tables cause hallucinations. |
| *"I can edit the generated database types file directly."* | **Forbidden.** Generated files get overwritten. Always re-run the CLI typegen script. |
| *"The types are slightly outdated, but code compiles."* | **Forbidden.** Outdated types mask missing nullable fields and trigger subtle runtime errors. |

---

## Execution Protocol

### Step 1: Run Deterministic Alignment Script
```bash
node .shiftstone/scripts/schema-sync.js
```
- If 3 sources match $\rightarrow$ record clean status.
- If drift detected $\rightarrow$ analyze 3-way table.

### Step 2: 3-Way Cross-Analysis
1. **Bible Documentation:** Read `docs/bible/03-database/schema-reference.md`.
2. **SQL Migrations:** Inspect pack migrations directory (e.g. `migrations/*.sql`) chronologically.
3. **Generated Types:** Inspect generated TypeScript interfaces.

### Step 3: Emit Sync Receipt
Write report to `docs/reports/sync/<YYYY-MM-DD>-schema-sync.md`:
```markdown
# Schema Sync Report — [Date]

| Entity / Field | Bible Doc | SQL Migrations | Generated Types | Status |
|---|---|---|---|---|
| `profiles` | ✅ Documented | ✅ Exists | ✅ Generated | 🟢 Aligned |
| `invoices` | ❌ Missing | ✅ Exists | ✅ Generated | 🔴 Doc Outdated |
```

### Step 4: Apply Actionable Remediation
- Outdated docs $\rightarrow$ update `docs/bible/03-database/schema-reference.md`.
- Outdated types $\rightarrow$ run pack type generation script (e.g. `npm run db:types`).
- Missing migration $\rightarrow$ invoke `/ss-new-migration`.

---

## Verification Ladder

- **L1 (Syntax):** SQL files and generated type files parse cleanly.
- **L2 (Typecheck):** `pnpm typecheck` exits 0 with active schema types.
- **L3 (Script Check):** `node .shiftstone/scripts/schema-sync.js` reports all 3 sources match.
- **L4 (Checker Review):** Disjoint check confirms zero undocumented columns.
- **L5 (Receipt):** Sync report saved to `docs/reports/sync/`.

---

## Terminal States

- `success`: All 3 sources 100% synchronized and verified.
- `no_op`: Zero drift detected on initial check.
- `blocked`: Corrupt migration file or failing database connection preventing schema reflection.
- `escalated`: Disputed schema modifications requiring technical lead approval.
