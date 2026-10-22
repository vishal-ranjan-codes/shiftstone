# docs/plans/

| Field | Declaration |
|---|---|
| **Purpose** | Implementation plans created by AI agents (typically by `/ss-plan`, `/ss-new-feature`, `/ss-new-migration`, `/ss-new-cron-job`). Each plan is a hybrid Loop+ICM artifact: numbered folders with `CONTEXT.md` stage contracts that drive a loop's checkpointed on-disk memory. |
| **When populated** | On demand, when a feature/migration/cron is being designed. Stays empty in a starter project. |
| **File types** | Numbered folder + `CONTEXT.md` + `output/` artifacts (long-lived plans may be flat `.md` files). |
| **Owner** | AI agent (per command) + developer review. |
| **Lifecycle** | Created → sealed on loop terminal state. |

**Anti-pattern guardrail:** do not put reports here (→ `docs/reports/`), status snapshots (→ `docs/status-reports/`), or bug logs (→ `docs/bugs/`).
