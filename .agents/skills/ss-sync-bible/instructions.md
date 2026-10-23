# ss-sync-bible — Code ↔ Bible Alignment & SSOT Sync Guide

Procedure for running 3-way drift detection and applying documentation updates behind a mandatory disjoint Checker sign-off.

---

## Iron Law

1. **Outer-Gate Checker Sign-Off:** NEVER apply proposed edits to `docs/bible/` or `docs/backlog/` without obtaining a disjoint Checker sign-off score $\ge 80 / 100$ (`0.8`). The maker agent must never self-approve its own documentation drift updates.
2. **Deterministic Detectors First:** Always start by running `node .shiftstone/scripts/bible-sync.js --report` and `node .shiftstone/scripts/sync-bible-proposal.js --dry-run`. Never guess what is drifted.
3. **Machine-Generated Files are Inviolable:** `docs/bible/README.md` ToC, chapter index files, and `docs/bible/DECISIONS.md` are machine-generated. Never hand-edit them; run `.shiftstone/governance/bible/index.js` and `.shiftstone/scripts/compile-decisions.js`.
4. **Physical Disk Output Only:** Write sync proposals to `docs/reports/sync/` and final updates to `docs/bible/`. Never output to temporary IDE brain artifacts.
5. **Proposal-Before-Mutation Law (`UG-22`):** Validated learning records must generate a reviewable proposal in `docs/reports/sync/SYNC-YYYYMMDD-XXX.md` via `sync-bible-proposal.js` before modifying `docs/bible/`. Mutating `docs/bible/` directly from raw lessons is strictly forbidden.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"The drift is minor, so I can apply the changes without spawning a Checker."* | **Forbidden (Outer Gate).** Unreviewed documentation updates cause contract regressions and hallucinated conventions. Checker sign-off is non-negotiable. |
| *"I'll hand-edit the ToC table in docs/bible/README.md or the DECISIONS.md table."* | **Forbidden.** Hand-edits get wiped by index generators and `compile-decisions.js`. Update individual files instead. |
| *"Code exists, so I can mark the backlog task [x] right now."* | **Forbidden.** Closing backlog tasks requires `/ss-verify` with verifiable test evidence. |
| *"I will directly paste the lesson into docs/bible/ without generating a proposal."* | **Forbidden (`UG-22`).** Run `node .shiftstone/scripts/sync-bible-proposal.js` to create an auditable proposal in `docs/reports/sync/`. |

---

## Sync Procedure

### Phase 1: Mechanical Drift Detection
1. Run 3-way drift detection:
   ```bash
   node .shiftstone/scripts/bible-sync.js --report
   ```
2. Scan validated learning records for pending promotions (`UG-22`):
   ```bash
   node .shiftstone/scripts/sync-bible-proposal.js --dry-run
   ```
3. Verify ToC freshness:
   ```bash
   node .shiftstone/governance/bible/index.js --check
   ```
4. Check decisions and changelog freshness:
   ```bash
   node .shiftstone/scripts/compile-decisions.js --check
   node .shiftstone/scripts/compile-changelog.js --check
   ```

### Phase 2: Domain Cross-Check
Compare codebase against `docs/bible/`:
- **Database:** Migrations vs `03-database/schema-reference.md`.
- **API Contracts:** Route modules vs `08-api-contracts/route-contracts.md`.
- **Auth:** Middleware handlers vs `04-auth-and-rbac/auth-overview.md`.
- **Scheduled Workers:** Cron configuration vs `01-architecture/architecture-overview.md`.

### Phase 3: Propose Diff in `docs/reports/sync/`
1. For validated learning records:
   ```bash
   node .shiftstone/scripts/sync-bible-proposal.js
   ```
   Generates `docs/reports/sync/SYNC-YYYYMMDD-XXX.md` detailing source records and proposed diff blocks.
2. For codebase drift, document structured diff proposal in `docs/reports/sync/SYNC-YYYYMMDD-<slug>.md`.

### Phase 4: Disjoint Checker Review & Application
1. Spawn a Checker subagent to score proposed documentation updates against codebase truth.
2. If Checker score $\ge 0.8$ and Level 5 sign-off is granted:
   ```bash
   node .shiftstone/scripts/sync-bible-proposal.js --apply SYNC-YYYYMMDD-XXX --approval <approvalId>
   ```
   This automatically marks learning records as `promoted` with `promotedByProposalId`.
3. Re-run compilers:
   ```bash
   node .shiftstone/scripts/compile-decisions.js
   node .shiftstone/governance/bible/index.js
   node .shiftstone/scripts/compile-changelog.js
   ```

---

## Verification Ladder

- **L1 (Syntax):** Frontmatter and markdown formatting valid (`validate-decisions.js`, `validate-learning.js`).
- **L2 (Mechanical Check):** `bible-sync.js --report` and `compile-decisions.js --check` exit 0.
- **L3 (ToC Integrity):** `.shiftstone/governance/bible/index.js` confirms ToC is up to date.
- **L4 (Checker Review):** Disjoint Checker returns approval score $\ge 80 / 100$.
- **L5 (Proposal & Changelog):** Proposal applied cleanly via `sync-bible-proposal.js` and `compile-changelog.js` complete.

---

## Terminal States

- `success`: Drift resolved, proposal verified by Checker and applied, Bible updated.
- `no_op`: Code, Bible, and ADRs are already in 100% alignment.
- `blocked`: Disjoint Checker rejected the proposed documentation updates.
- `escalated`: Code directly violates accepted architectural decision.
