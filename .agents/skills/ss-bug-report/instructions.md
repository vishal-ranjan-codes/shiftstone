# ss-bug-report — Bug Capture & Defect Tracking Guide

Procedure for capturing, classifying, documenting, and logging software bugs in the ShiftStone workspace.

---

## Iron Law

1. **Physical Bug Dossier on Disk:** Every captured bug MUST be written directly to `docs/bugs/BUG-XXX-<slug>.md` and registered in `docs/bugs/open-bugs.md`. Never output to temporary IDE brain artifacts.
2. **Never Delete `docs/bugs/open-bugs.md`:** The open bugs ledger is permanent and append-only. Resolved bugs are marked `Fixed` or `Closed`, never deleted.
3. **Sequential BUG-XXX Numbering:** Increment from the highest existing ID in `docs/bugs/open-bugs.md`. Never overwrite or reuse an existing bug ID.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll output a bug_report.md artifact in chat."* | **Forbidden.** Brain/chat artifacts are ephemeral. Write directly to `docs/bugs/BUG-XXX-<slug>.md`. |
| *"The bug is minor, so I don't need to log it in open-bugs.md."* | **Forbidden.** All defects must be tracked in the central ledger for traceability and release readiness. |
| *"I'll delete the bug row now that it's fixed."* | **Forbidden.** Update the status column to `Fixed` with the resolving commit hash; preserve audit history. |

---

## Bug Capture Protocol

### Phase 1: Gather Reproduction & Impact Details
1. Elicit from user or error context:
   - **Title:** One-line summary.
   - **Severity:**
     - `Critical` = data corruption, auth bypass, security failure.
     - `High` = major feature broken, no workaround.
     - `Medium` = secondary feature broken, workaround available.
     - `Low` = cosmetic UI issue or minor formatting bug.
   - **Role affected:** Public, Authenticated, Admin, API.
   - **Steps to reproduce:** Concrete steps and inputs.
   - **Expected vs Actual Behavior.**
   - **Suspected file/function:** Code pointer if known.

### Phase 2: Create Physical Bug Dossier
1. Check `docs/bugs/open-bugs.md` for the highest existing `BUG-XXX` number and increment.
2. Write `docs/bugs/BUG-XXX-<slug>.md`:
   ```markdown
   # BUG-[XXX]: [Title]

   - **Status:** Open
   - **Severity:** [Critical | High | Medium | Low]
   - **Discovered:** [YYYY-MM-DD]
   - **Target Area:** [File / Route / Component]

   ## Steps to Reproduce
   1. ...

   ## Expected Behavior
   ...

   ## Actual Behavior
   ...

   ## Suspected Cause & Proposed Remediation
   ...
   ```

### Phase 3: Log to Central Ledger
Append a row to `docs/bugs/open-bugs.md`:
```markdown
| BUG-[XXX] | [Title] | Open | [Severity] | [YYYY-MM-DD] |
```

### Phase 4: Offer Immediate Fix
Ask user: *"Logged BUG-[XXX] in `docs/bugs/open-bugs.md`. Would you like me to resolve this bug now using `/ss-diagnose`?"*

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting and link integrity.
- **L2 (Disk Verification):** Physical file exists in `docs/bugs/BUG-XXX-<slug>.md`.
- **L3 (Ledger Sync):** `docs/bugs/open-bugs.md` contains the new row.
- **L4 (Checker Review):** Disjoint check confirms reproduction steps are unambiguous.
- **L5 (User Handoff):** Bug logged and immediate fix offered.

---

## Terminal States

- `success`: Bug documented on disk and logged in `open-bugs.md`.
- `blocked`: Incomplete error details preventing clear bug classification.
- `escalated`: Critical security vulnerability requiring immediate incident response.
