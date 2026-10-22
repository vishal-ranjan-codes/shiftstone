# ss-push — Dual-Repo GitHub Publishing Guide

Procedure for synchronizing and pushing both the root workspace governance and nested application git repositories to GitHub.

---

## Iron Law

1. **Dual-Repo Independence:** The workspace repository and the application repository (`apps/web/`) are independent Git repositories. Always verify status and push sequentially: nested app first, root workspace second.
2. **Never Push Dirty Trees Without Confirmation:** If unstaged changes exist, confirm their inclusion with the user before committing and pushing.
3. **Secret Scanner Pre-Push Invariant:** Run the secret scanner hook before any git push operation. Never push credentials, tokens, or `.env` files to remotes.
4. **Physical Metadata Reading:** Read remote mappings directly from `.workspace-git.json`. Never push to hardcoded personal remotes.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll only push the root repository since it's the main repo."* | **Forbidden.** Pushing root without the nested app leaves the application code orphaned locally. |
| *"The secret scanner flagged an API key, but it's just a test key."* | **Forbidden.** Test keys must use mock formats (`sk-test-placeholder`). Live keys pushed to GitHub trigger security revocation. |
| *"I can force-push with --force to overwrite divergence."* | **Forbidden.** Force-pushing overwrites upstream collaborator commits. Use standard fast-forward pushes. |

---

## Publishing Procedure

### Step 1: Read Staging Metadata
Read `.workspace-git.json` from the workspace root:
- Extract `githubUser`, `workspace.repo`, `workspace.remote`, `app.path`, `app.repo`, `app.remote`.
- If missing, prompt user for GitHub username.

### Step 2: Verify Local Status & Cleanliness
1. Check nested app:
   ```bash
   git -C apps/web status --porcelain
   ```
2. Check root workspace:
   ```bash
   git status --porcelain
   ```
3. If uncommitted changes exist, review and commit them cleanly.

### Step 3: Run Secret Scanner Guard
Verify zero secrets in staged diffs:
```bash
node core/harness/hooks/pre-commit.js
```

### Step 4: Execute Sequential Remote Push
- **Method A (GitHub CLI `gh`):**
  1. Push nested app:
     ```bash
     gh repo create <user>/<appRepo> --private --source=apps/web --remote=origin --push || git -C apps/web push -u origin main
     ```
  2. Push root workspace:
     ```bash
     gh repo create <user>/<wsRepo> --private --source=. --remote=origin --push || git push -u origin main
     ```
- **Method B (Standard Git):**
  1. `git -C apps/web push -u origin main`
  2. `git push -u origin main`

---

## Verification Ladder

- **L1 (Status):** Staged git status is clean on both repositories.
- **L2 (Secret Guard):** Secret scanner exits 0 with zero credential findings.
- **L3 (App Push):** Nested app repository pushes to remote successfully.
- **L4 (Root Push):** Root workspace repository pushes to remote successfully.
- **L5 (Remote URL):** GitHub repository URLs verified accessible.

---

## Terminal States

- `success`: Both repositories staged, committed, and pushed cleanly to GitHub.
- `no_op`: Both repositories already clean and up to date with remote `main`.
- `blocked`: GitHub CLI unauthenticated or git remote authentication failed.
- `escalated`: Divergent remote branch requiring non-fast-forward merge.
