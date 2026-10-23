# ss-sync-engine — Bi-Directional Engine Synchronization Guide

Procedure for synchronizing universal engine code between the Parent Engineering Hub (`shiftstone-workspace/.shiftstone/`) and child framework starters (`frameworks/shiftstone/.shiftstone/`) per `DEC-014`.

---

## Iron Law

1. **Explicit Directionality:** Every sync MUST specify its direction (`--direction=outward` for Lab $\rightarrow$ Starter, or `--direction=inward` for Starter $\rightarrow$ Lab). Default is outward.
2. **Dry-Run Preview First:** Always execute `node .shiftstone/scripts/sync-engine.js --dry-run` to inspect added/modified files before applying any changes.
3. **Strict Boundary Isolation:** NEVER sync protected boundary files (`workspace-manifest.json`, `implementation-status.json`, `product.md`, `global.md`, `package.json`, `AGENTS.md`, `docs/bible/`). These files belong strictly to their respective workspace roles.
4. **Dual-Repo Post-Sync Verification:** After any synchronization, the master validator and test suites MUST be verified green in **BOTH** repositories:
   - `node .shiftstone/scripts/validate-workspace.js` (Lab)
   - `node frameworks/shiftstone/.shiftstone/scripts/validate-workspace.js` (Starter)
5. **No Blind Recursion:** Never use unvalidated filesystem copy tools (`cp -r`, `xcopy`) across the boundary. All mechanical syncing must flow through `.shiftstone/scripts/sync-engine.js`.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I can just copy the whole .shiftstone folder directly."* | **Forbidden.** Blind copying overwrites `workspace-manifest.json` (replacing starter settings with hub settings) and leaks hub identity into the public starter. |
| *"The change was only in one validator, no need to run the full master validator."* | **Forbidden.** Validators are interdependent. A change in `bible-sync.js` or `link-ide-folders.js` can break master certification stages. Always run `validate-workspace.js`. |
| *"I fixed a bug in the child framework; I don't need to sync inward to the lab."* | **Forbidden.** Any bugfix made in child without inward sync will be completely overwritten on the next outward sync from the lab. |
| *"Both sides pass, so we can skip logging the sync."* | **Forbidden.** Record the sync action in `.agents/skills/log.md` and emit a sync receipt when requested. |

---

## Execution Protocol

### Step 1: Pre-Sync Status & Direction Selection
Identify which direction the sync is moving:
- **Outward (`Lab → Starter`):** Engine improvements, new scripts, or test updates developed in `shiftstone-workspace` are being published to `frameworks/shiftstone`.
- **Inward (`Starter → Lab`):** Template bugfixes, onboarding improvements, or starter-specific engine fixes developed in `frameworks/shiftstone` are being integrated back into the lab.

Confirm both git repositories are in a clean or well-understood working state:
```bash
git status -s
git -C frameworks/shiftstone status -s
```

### Step 2: Dry-Run Preview
Execute the sync script in preview mode:
```bash
# Outward preview:
node .shiftstone/scripts/sync-engine.js --direction=outward --dry-run

# Inward preview:
node .shiftstone/scripts/sync-engine.js --direction=inward --dry-run

# Targeted single file/folder preview:
node .shiftstone/scripts/sync-engine.js --path=scripts/validate-workspace.js --dry-run
```

Review the diff summary:
- Check `➕ Created files` and `🔄 Updated files`.
- Verify that **zero** protected files appear in the changes list.

### Step 3: Boundary Inspection
If a modified file borders a boundary area (e.g., a rule loader or path configuration):
- Check for template placeholders (`{{PROJECT_NAME}}`, `{{APP_PATH}}`).
- Ensure no lab-specific paths (`frameworks/`, monorepo scripts) leak into universal starter files.

### Step 4: Apply Synchronization
Apply the mechanical file synchronization:
```bash
node .shiftstone/scripts/sync-engine.js --direction=<outward|inward>
```

### Step 5: Dual-Repo Verification Ladder
Run the 5-step Verification Ladder across both environments:

1. **Check Drift:**
   ```bash
   node .shiftstone/scripts/sync-engine.js --check
   ```
2. **Parent Lab Parity & Master Certification:**
   ```bash
   npm run parity
   node .shiftstone/scripts/validate-workspace.js
   pnpm -C .shiftstone test
   ```
3. **Child Starter Parity & Master Certification:**
   ```bash
   npm -C frameworks/shiftstone run parity
   node frameworks/shiftstone/.shiftstone/scripts/validate-workspace.js
   pnpm -C frameworks/shiftstone/.shiftstone test
   ```

### Step 6: Log Execution
When a sync is completed, append an audit entry to `.agents/skills/log.md` specifying the direction, file count, and verification status.

---

## Verification Ladder

- **L1 (Syntax):** `node .shiftstone/scripts/sync-engine.js --check` exits with code 0.
- **L2 (Unit Tests):** `pnpm -C .shiftstone test scripts/__tests__/sync-engine.test.ts` passes 100%.
- **L3 (Parity Gates):** `npm run parity` in lab and child framework both pass with zero violations.
- **L4 (Master Certification):** `validate-workspace.js` in both repositories passes all 5 stages cleanly (20/20 tasks).
- **L5 (Dual-Suite Vitest):** Full test suites pass cleanly across both `.shiftstone/` environments.

---

## Terminal States

- `success`: Engine code 100% synchronized in the specified direction and verified green across both repositories.
- `no_op`: Zero drift detected on initial `--check` or `--dry-run` inspection.
- `blocked`: Git working tree dirty with uncommitted conflicting changes or missing target repository directory.
- `escalated`: Boundary conflict detected (e.g. discrepancy in shared interfaces or role-protected file changes) requiring human architectural review.

