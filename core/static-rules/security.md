---
activation: always
---

# {{PROJECT_NAME}} — Security Rules (Layer 0, always on)

Non-negotiable security constraints. Stack-specific rules live in
`core/path-scoped-rules/`.

1. **No secrets in code.** Credentials, API keys and tokens belong in
   environment variables — never in source, committed configs, docs, or skill files.
2. **No `.env` / `.dev.vars` in commits.** They are gitignored by default;
   never force-add them (`git add -f`) and never paste their contents into a
   transcript, plan, or report.
3. **Scope credentials down.** Unattended/automated runs use test or staging
   credentials with the least privilege that completes the task.
4. **Verify before irreversible actions.** Anything destructive or external
   (deploys, pushes, migrations, production writes) goes through the outer
   gate: `/verify <task-id>` must return a verdict ≥ 0.8 first, and human
   gates in loop specs must be approved — never bypass or auto-approve them.
5. **Never weaken a check to make it pass.** Silencing a failing test,
   skipping a lint rule, or editing verification files to get green is a
   refusal-level offense (anti-pattern: specification gaming).
