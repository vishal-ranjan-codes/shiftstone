# ss-lesson — Rule Accumulation & Learning Record Guide

Procedure for turning agent mistakes and hard-won insights into persistent learning records and approved static rules.

---

## Iron Law

1. **Human Approval Gate:** ⛔ STOP — An agent must NEVER append rules to `core/static-rules/` or promote lessons to `docs/bible/` without explicit human sign-off.
2. **Evidence-Grounded Learning:** Every lesson MUST cite concrete evidence: commit hash, file:line, failing test output, or regression description. No hypothetical rules without proof.
3. **Budget Ceiling Compliance:** Rules added to static context must never violate context ceilings (`AGENTS.md <= 60 lines`, static rules `<= 120 lines`, cumulative budget `<= 3,000 tokens`). If budget is full, compress or generalize existing rules.
4. **Physical Disk Output Only:** Output learning records to `docs/reports/learning/` or proposed rule changes directly on disk. Never output to temporary IDE brain artifacts.
5. **Proposal Promotion Pipeline (`UG-22`):** Validated learning records must proceed through the proposal-based promotion engine (`node core/scripts/sync-bible-proposal.js`). A learning record is marked `promoted` only when an approved proposal is applied with `promotedByProposalId`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll add the rule directly to global.md without asking."* | **Forbidden.** Static context is high-leverage and always-on. Unreviewed rules cause prompt pollution and steering conflicts. |
| *"The static budget is full, but this one extra rule won't hurt."* | **Forbidden.** `validate-context-budgets.js` will fail CI. Compress or consolidate older lessons to make space. |
| *"I don't need evidence because the mistake was obvious in chat."* | **Forbidden.** Rules without cited evidence cannot be audited and become obsolete baggage. |
| *"I can mark status 'promoted' on a learning record by hand."* | **Forbidden (`UG-20`).** `validate-learning.js` rejects `status: promoted` without a valid `promotedByProposalId`. Use `sync-bible-proposal.js --apply`. |

---

## Lesson Lifecycle

### Phase 1: Capture the Mistake & Evidence
Document the failure event:
- What happened (the exact erroneous action or hallucination).
- Evidence (`file:line`, test failure output, git commit).
- Why it violated intent.
- Recurring cost if not prevented.

### Phase 2: Draft the Learning Record
1. Query existing learning records in `docs/reports/learning/` to avoid duplicates (Jaccard similarity threshold $< 0.70$).
2. Draft a structured learning record (`learning-record/v1`):
   - Category: `architecture | security | performance | testing | harness | pack-domain`.
   - Root cause and distilled lesson.
   - Status: `candidate` (or `validated` after review).
   - Evidence paths (must exist on disk).
   - Promotion targets (`docs/bible/*` or `core/static-rules/*`).
3. If proposing a static rule, draft at most 2 imperative lines:
   `**<Rule in one sentence>.** <Why / what it prevents (source: <task-id>)>`.

### Phase 3: Human Approval & Validation Gate
- Present the evidence and drafted rule/record to the human developer.
- **⛔ STOP — Await explicit approval before saving.**
- Verify with `node core/scripts/validate-learning.js`.

### Phase 4: SSOT Promotion via `/ss-sync-bible`
1. Validated records in `docs/reports/learning/` feed into the proposal engine:
   ```bash
   node core/scripts/sync-bible-proposal.js --dry-run
   node core/scripts/sync-bible-proposal.js
   ```
2. On approved review, apply the proposal:
   ```bash
   node core/scripts/sync-bible-proposal.js --apply SYNC-YYYYMMDD-XXX --approval <approvalId>
   ```
   This automatically transitions the learning record to `status: "promoted"` and populates `promotedByProposalId`.
3. If appending to static rules, run budget check:
   ```bash
   node core/scripts/validate-context-budgets.js
   ```
4. Run `pnpm parity` to verify zero violations.

---

## Verification Ladder

- **L1 (Syntax):** JSON learning record conforms to `learning-record/v1` schema (`validate-learning.js`).
- **L2 (Deduplication):** Jaccard token overlap against prior lessons is $< 0.70$.
- **L3 (Budget Gate):** `node core/scripts/validate-context-budgets.js` passes.
- **L4 (Evidence Verification):** Disjoint check verifies cited evidence exists on disk.
- **L5 (Proposal & Human Gate):** Promotion applied via `sync-bible-proposal.js` with human sign-off.

---

## Terminal States

- `success`: Learning record recorded, proposal approved, and promoted to SSOT.
- `no_op`: Mistake already covered by an existing rule or record.
- `blocked`: Static rule budget full and compression refused.
- `escalated`: Disputed rule causing conflicting steering behavior.
