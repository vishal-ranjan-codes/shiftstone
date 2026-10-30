# Execution & Outgoing Handoff Protocol

This reference provides the operational instructions for executing phase work, capturing verified check evidence, and recording immutable handoff attempts using the `.shiftstone/scripts/plan.js` tooling suite.

---

## 1. The Execution Lifecycle

Every execution run follows a disciplined boundary protocol:

```
Reconcile & Begin → Implement & Verify Checks → Checkpoint / Close → State Update
```

1. **Reconcile & Begin**:
   - Before editing files, start the phase execution:
     ```bash
     node .shiftstone/scripts/plan.js begin docs/plans/<suite-name> --phase P1
     ```
   - This records an `entrySnapshot` containing scope digests and inventories pre-existing staged, unstaged, and untracked files into the `preservation` ledger.
   - **Preservation Invariant**: Never run `git reset --hard`, `git clean -fd`, or `git stash` to clear pre-existing work. Pre-existing changes are preserved and tracked read-only.

2. **Execute & Verify Checks**:
   - For every automated check declared in `plan-manifest.json`:
     ```bash
     node .shiftstone/scripts/plan.js verify docs/plans/<suite-name> --phase P1 --check <check-id>
     ```
   - The verify runner executes in the declared bounded working directory (`cwd`), with safe cross-platform runner resolution (`pnpm.cmd`, `npm.cmd`).
   - **In-Flight Mutation Detection**: Source snapshots are computed before and after the run. If scoped source files or environment variables change during the verification run itself, the check is marked as `blocked` rather than passed.
   - Raw output is preserved as an immutable evidence artifact under `output/checks/<check-id>-<timestamp>.txt`.

3. **Intermediate Checkpoint on Interruption**:
   - If work is interrupted, blocked, or partially completed:
     ```bash
     node .shiftstone/scripts/plan.js checkpoint docs/plans/<suite-name> --phase P1 --facts <path-to-facts.json>
     ```
   - Records an immutable attempt (`attempt-001.json`, `attempt-002.json`, ...) with `event: "checkpoint"` and monotonic `previousRef` chaining.
   - Does NOT close the phase or claim false completion.

4. **Phase Closure & Acceptance Gate**:
   - When all active unit deliverables are implemented and all required checks have passed:
     ```bash
     node .shiftstone/scripts/plan.js close docs/plans/<suite-name> --phase P1 --facts <path-to-facts.json>
     ```
   - **Strict Gate Rule**: `close` enforces that `acceptance === 'complete'`. If any required check is failed, skipped, stale, or if an independent review is missing/rejected, `close` **fails with exit code 2** and leaves acceptance open.
   - The maker agent cannot forge a passing review or supply its own reviewer identity.

---

## 2. Structure of the Facts File (`--facts`)

A local temporary JSON file supplied to `checkpoint` or `close`:

```json
{
  "summary": "Completed core module implementation with passing unit tests.",
  "actor": {
    "id": "maker-session-1",
    "role": "maker"
  },
  "implementation": "implemented",
  "terminalState": "success",
  "changes": [
    {
      "path": "apps/web/src/feature.ts",
      "reason": "Implemented core algorithm",
      "unitIds": ["U1"]
    }
  ],
  "deviations": [],
  "materialContext": [],
  "issues": [],
  "reviewRefs": [
    {
      "path": "docs/plans/sample/output/checker-p1.json",
      "sha256": "4a7b..."
    }
  ],
  "approvalRefs": [],
  "next": {
    "phaseId": "P2",
    "entryConditions": ["P1 acceptance complete"],
    "firstAction": "Inspect P2 contract and resume."
  }
}
```

---

## 3. Storage and Concurrency Safety

- **Compare-and-Swap (CAS)**:
  Use `--expected-revision <N>` when updating state. If another agent or session has advanced the state revision, the command fails with exit code `3`.
- **Exclusive Lock**:
  The suite's `output/.lock` file prevents concurrent interleaved writes.
- **Transaction Journaling**:
  Writes are staged via `output/.transaction.json` and committed using atomic same-volume renames. Incomplete updates are safely recovered on startup.
