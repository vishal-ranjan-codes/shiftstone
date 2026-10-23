---
cost_tracking: workflow-end
description: Automated workflow to create GitHub repositories (if needed) and push both the root workspace governance and nested web app repositories to GitHub.
---

# /push — Dual-Repo GitHub Publishing Workflow

> Use this workflow when the user commands "Push to GitHub", "Push both repos", or types `/push`.
> It checks repository status, verifies GitHub CLI authentication, creates remote repositories if needed, and pushes both repositories sequentially.

---

## Pre-Flight Checks

1. **Read Repository Staging Metadata**:
   Read `.workspace-git.json` from the workspace root:
   - Identify `githubUser`, `workspace.repo`, `workspace.remote`, `app.path`, `app.repo`, `app.remote`.
   - If `.workspace-git.json` is missing or unconfigured, prompt the user for their GitHub username.

2. **Verify Local Git States**:
   - Check if root workspace has uncommitted changes: `git status --porcelain`.
   - Check if nested app (`apps/web/`) has uncommitted changes: `git -C apps/web status --porcelain`.
   - If uncommitted changes exist, stage and commit them before pushing.

---

## Execution: Automated Push

### Path A: GitHub CLI (`gh`) Available & Authenticated
Run `gh auth status` to check login.
If authenticated:
1. **Create & Push Nested Web App**:
   ```powershell
   gh repo create <githubUser>/<appRepo> --private --source=apps/web --remote=origin --push
   ```
   *(If repo already exists on GitHub: `git -C apps/web push -u origin main`)*.

2. **Create & Push Root Workspace Governance**:
   ```powershell
   gh repo create <githubUser>/<workspaceRepo> --private --source=. --remote=origin --push
   ```
   *(If repo already exists on GitHub: `git push -u origin main`)*.

### Path B: Standard Git (Without `gh` CLI)
1. Ensure the user has created the empty repositories on [GitHub](https://github.com/new):
   - `<workspaceRepo>`
   - `<appRepo>`
2. Execute the sequential push commands:
   ```powershell
   # 1. Push nested web app
   git -C apps/web push -u origin main

   # 2. Push root workspace governance
   git push -u origin main
   ```

---

## Post-Push Checkpoint

1. Update `.workspace-git.json`:
   - Set `workspace.pushed = true`
   - Set `app.pushed = true`
2. Output a summary with direct clickable GitHub links:
   - **Workspace Governance**: `https://github.com/<user>/<workspaceRepo>`
   - **Production Web App**: `https://github.com/<user>/<appRepo>`
   - **Deployment Notice**: Inform user that the platform's Pages/CDN hosting or GitHub Actions can be connected directly to the `<appRepo>` repository.

---

## Run Logging

When this workflow reaches its outcome, append exactly one `runs.jsonl` row (at workflow end, never per-tool-call):

```sh
node .shiftstone/scripts/record-run.js push --state <success|no_op|blocked|stalled|exhausted|error> --reason "<one-line outcome>" --tokens <estimate> --dollars <estimate> --accepted <changes applied>
```

Use `--state no_op` when the workflow found nothing to do, `--state blocked` when escalating to a human, and `--accepted 0` for read-only audits. Omit `--tokens`/`--dollars` only when they cannot be estimated. Opt out via `cost-tracker.enabled: false` in `.shiftstone/context/cost-tracker.json`.
