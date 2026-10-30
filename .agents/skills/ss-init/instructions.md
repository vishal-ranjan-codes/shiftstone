# ss-init — Advanced Workspace Initializer & Product Architecting Guide

Procedural guide for initializing fresh workspaces into fully articulated, production-ready applications.

---

## Iron Law

1. **One Question Per Turn & Open Intake:** Never dump multiple questions simultaneously during requirements discovery. Always ask one question at a time. Gate 1 uses open conversational text prompts with PRD ingestion support — strictly ban confining users with rigid multiple-choice category buttons.
2. **3-Tier Conversational Support Protocol:** Technical gates must provide Layer 1 (conversational analogies), Layer 2 ("explain simply" cue), and Layer 3 ("you decide" / auto-pilot recommendation mode) to empower non-technical founders.
3. **Turn-by-Turn Checkpointing:** Persist session state to `.workspace-init-state.json` via `.shiftstone/init/session-state.js` after every single user response and step transition, retaining `dialogue_history`, `trait_matrix`, and `resolved_gates`.
4. **Resumption Gate Invariant:** Always check `hasActiveSession(root)` before starting. If an active session exists, present the 1-click continuation modal (`Resume`, `Review`, `Discard`) without re-asking answered questions.
5. **Real-Time Progress Visibility:** Render the structured Markdown Progress Card (`renderProgressCard(state)`) at the start of each step transition to communicate completed counts, elapsed time, and dynamic ETAs.
6. **Declarative Step Pipeline:** Follow the 9 core steps registered in `.shiftstone/init/step-pipeline.json`. Dynamically handle optional steps (`step_5_branding`, `step_7_research`) by presenting the configured skip prompt.
7. **Deep Bible Synthesis:** Never leave `docs/bible/` with unpopulated template placeholders. Synthesize domain schemas, RLS policies, invariants, and route contracts from the discovery gates before completing initialization.
8. **Mechanical Separation:** Scaffolding operations (pack validation, starter cloning, git boundaries) are executed deterministically by `node .shiftstone/init.js`. Product architecture, brand naming, and Bible synthesis are executed by the skill.
9. **Physical Disk Output Only:** Output all configuration, schemas, decisions, and documentation directly to repo files. Never emit temporary IDE brain artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll skip the Socratic interview and just use generic defaults."* | **Forbidden.** Without domain elicitation, `docs/bible/` remains generic and subsequent AI turns hallucinate business logic. |
| *"I'll ask all 5 discovery gates at once to speed up initialization."* | **Forbidden.** One question per turn is mandatory for thoughtful product modeling. |
| *"The user has no name in mind, so I'll generate a quick placeholder like MySaaS."* | **Forbidden (Placek Rule).** Dispatch Gate 4.5 (`/ss-brand-naming`) to explore vetted, collision-free brand names. |
| *"I won't save checkpoints until the entire interview is finished."* | **Forbidden (Resumability Rule).** Atomic checkpointing to `.workspace-init-state.json` must occur after every single user answer. |
| *"I won't show the progress card to save space."* | **Forbidden (Progress Visibility Rule).** Progress Card must be displayed at every phase/step boundary. |

---

## The Initialization Lifecycle

### Step 0: Resumption Gate & Checkpoint Detection (`REQ-INIT-01`, `REQ-INIT-02`)
- Before asking Gate 1, check `hasActiveSession(root)` using `.shiftstone/init/session-state.js`.
- If true and `status === "in_progress"`:
  1. Render the real-time Progress Card (`renderProgressCard(state)` from `.shiftstone/init/progress-renderer.js`).
  2. Prompt the user with `ask_question`:
     - `(Recommended) Resume from where I left off (Step X: <Step Name>)`
     - `Review & modify previously completed answers`
     - `Discard checkpoint and restart initialization from scratch`
  3. **On Resume:** Load `context_data` directly into active memory without re-asking answered questions. Advance directly to the first uncompleted step.
  4. **On Review:** Present summary of recorded answers in `context_data` and allow modification before proceeding.
  5. **On Discard:** Call `purgeState(root)` and start freshly at Gate 1.

### Declarative Step Execution Loop (`step-pipeline.json`)
The initializer iterates through the 9 steps registered in `.shiftstone/init/step-pipeline.json`:

1. **`gate_1_problem_space` (Mandatory — "What You're Building & Why It Matters"):** Elicit product vision, core problem, and audience via open conversational prompt (`OPENING_GREETING`). Support direct PRD ingestion, extract 7-dimensional `trait_matrix`, and evaluate downstream gate resolution. Save checkpoint.
2. **`gate_2_actors_rbac` (Mandatory — "Who Uses Your App & Their Permissions"):** Elicit user types and account permissions. Include 3-Tier Support Protocol ("explain simply", "you decide"). Check **Adaptive Question Router**: if `evaluateGateResolution` indicates answered in ingested PRD, auto-skip with confirmation. Save checkpoint.
3. **`gate_3_entity_modeling` (Mandatory — "Key Information Your App Stores & Critical Rules"):** Elicit core data records and business invariants with locker/cubby analogies. Include 3-Tier Support Protocol. Check **Adaptive Question Router**: if resolved by PRD, auto-skip with confirmation. Save checkpoint.
4. **`gate_4_tenant_security` (Mandatory — "Privacy, Security & Data Protection"):** Elicit data isolation and compliance needs. Include 3-Tier Support Protocol. Check **Adaptive Question Router**: if resolved by PRD, auto-skip with confirmation. Save checkpoint.
5. **`step_5_branding` (Optional):** Full-spectrum brand identity (`ss-brand`).
   - If user chooses "Configure now", execute `/ss-brand` workflow to generate brand strategy, OKLCH palette, and `docs/brand/brand-book.html`.
   - If user chooses "Skip for now", record in `skipped_steps` and proceed.
6. **`step_6_stack_archetype` (Mandatory):** Confirm stack archetype, package manager, and third-party services.
7. **`step_7_research` (Optional):** Pre-scaffold tech research (`docs/research/`).
   - Trigger research pass if third-party integrations (Stripe, Twilio, OpenAI, Dodo Payments) or custom architecture selected.
   - Generate Tier 2 Workspace Initialization Plan Suite directly to disk in `docs/plans/workspace-initialization/` (`CONTEXT.md`, `README.md`, `plan-manifest.json`, and 5 discrete phase contracts) before synthesis begins (`LOCK-INIT3-18`).
   - If standard flagship stack or user skips, record in `skipped_steps` and proceed.
8. **`step_8_mechanical_scaffold` (Mandatory):** Execute mechanical engine with domain-aware skill curation:
   ```bash
   node .shiftstone/init.js --name="<ProjectName>" --gh-user="<ghUser>" --skills="<skills>" --layout="monorepo" --pm="pnpm" -y
   ```
   - **Domain-Aware Skill Curation (`REQ-INIT-10`, `LOCK-INIT-12`):** Run `applySkillCuration` from `.shiftstone/init/skill-curator.js`:
     - Inspects interview context: prunes background jobs (`cron`, `jobs`), file storage (`remote-storage`, `storage`), and UI skills for API-only services, cutting context window overhead by $\ge 15\%$.
     - Evaluates declared third-party integrations dynamically on `skills.sh` via `queryCommunitySkills`: automatically installs packages with $\ge 10,000$ installs into `.agents/skills/`, surfaces lower counts as opt-in recommendations, and links across IDEs (`linkIdeFolders`).
     - Materializes active symlinks in `.agents/skills/` without dangling junctions and regenerates `.shiftstone/context/skills-manifest.yaml` and the Skill INDEX in `AGENTS.md`.
   Save checkpoint.
9. **`step_9_bible_backlog_synthesis` (Mandatory):** Tier 2 Plan-Driven Autonomous Multi-Skill Orchestration (`REQ-INIT3-18`, `LOCK-INIT3-18`, `REQ-09`, `LOCK-DS-06`).
   - Rather than attempting a monolithic inline synthesis in a single context that causes prompt exhaustion and context rot, Step 9 formally delegates execution of `docs/plans/workspace-initialization/` to `ss-execute-plan` via the **Autonomous Governor**:
     ```bash
     node .shiftstone/scripts/plan.js orchestrate docs/plans/workspace-initialization
     ```
   - The Governor traverses the 5 phases of the initialization DAG, spawning fresh ephemeral worker subagents per phase with bounded context ($\le 4,500$ tokens) and wiping context completely between phases:
     - **Phase 1 (Product PRD & Vision):** Spawns ephemeral worker for `/ss-bible` to synthesize `docs/bible/PRD/` (ecosystem & phase PRDs) and `docs/bible/00-product-and-vision/`.
     - **Phase 2 (App Scaffolding & Theming):** Spawns ephemeral worker invoking `app-scaffolder.js` to clone starter, inject active brand tokens from `docs/brand/brand-tokens.json` into `apps/web/app/globals.css`, author initial SQL migration (`apps/web/supabase/migrations/`), generate TypeScript database types, and inject environment variables and SDK dependencies.
     - **Phase 3 (Technical Bible & ADRs):** Spawns ephemeral worker invoking `/ss-bible` to author modular technical chapters (Chapters 01–08 and domain chapters) and `decisions-generator.js` to author physical ADR files in `docs/decisions/` compiled into `docs/bible/DECISIONS.md`.
     - **Phase 4 (Actionable Task Backlog):** Spawns ephemeral worker invoking `/ss-backlog` to wipe starter template seeds and author Phase 1 user story task cards ($\le 12$ tasks) linked to PRD acceptance criteria.
     - **Phase 5 (AI Steering & Rules):** Spawns ephemeral worker invoking `/ss-steering` to synthesize slim `AGENTS.md` router ($\le 60$ lines) and static/path-scoped rules ($\le 12$ KB).
   - Validates synthesis: run `node .shiftstone/init/validate-bible-synthesis.js` to ensure zero `{{...}}` tokens survive.
   - Save checkpoint.

### Adaptive Question Router & 3-Tier Conversational Support Protocol (`REQ-INIT3-18`, `LOCK-INIT3-13`, `LOCK-INIT3-14`)
- **Adaptive Gate Skipping:** Before asking any discovery gate, call `evaluateAdaptiveQuestionRouting({ gateId, traitMatrix })`. If the gate is marked `status: 'resolved'`, skip it with confirmation. If `status: 'partial'`, ask only the focused clarifying question.
- **Layer 1 (Conversational Analogies):** Frame all prompts in friendly, plain English (cubbies, apartment buildings, keys) avoiding developer jargon.
- **Layer 2 ("Explain Simply" Cue):** When user requests clarification, provide real-world analogies explaining the concept simply.
- **Layer 3 ("Decide For Me" Auto-Pilot):** When user responds with "you decide", "decide for me", or "recommended", auto-select industry-standard defaults and proceed without halting.

### Step 10: Verification Ladder, Scalable Launchpad & Completion Receipt (`REQ-INIT-11`, `LOCK-INIT-11`)
- Run `node .shiftstone/scripts/validate-manifest.js` and `pnpm parity`.
- **Scalable Next-Steps Launchpad (`launchpad.js`):**
  - Read `.workspace-init-state.json` to extract `skipped_steps` and resolve `post_init_suggestion` from `step-pipeline.json` (`AC-U12-01`).
  - Render formatted Markdown Launchpad card featuring Deferred Initializer Setup (`/ss-brand`, `/ss-research`) and Core Lifecycle Actions (`/ss-plan`, `/ss-nexus`, dev server) (`AC-U12-02`).
  - Inject pending commands table into `AGENTS.md` under `## Suggested Next Steps` (`AC-U12-03`).
- **Permanent Audit Receipt (`receipt.js`):** Write `launchpad.suggested_next_steps` and skills curation record into `.workspace-init-receipt.json` (`LOCK-INIT-02`, `LOCK-INIT-11`).
- Final Progress Card: Render 100% completed progress card.
- Purge session state: Call `purgeState(root)` to remove `.workspace-init-state.json` (`LOCK-INIT-02`).

---

## Verification Ladder

- **L1 (Syntax):** Valid markdown formatting, valid YAML frontmatter across all created files.
- **L2 (CLI Scaffolding):** `node .shiftstone/init.js` completes with exit code 0.
- **L3 (Bible Parity):** All Bible chapters populated without placeholder strings.
- **L4 (Workspace Integrity):** `node .shiftstone/scripts/validate-manifest.js` passes cleanly.
- **L5 (Human Sign-off):** Founder/developer confirms workspace structure and is ready for `/ss-plan`.

---

## Terminal States

- `success`: Workspace initialized, Bible populated, backlog generated, state purged, receipt emitted.
- `blocked`: Git remote conflict, missing package manager, or starter clone network failure.
- `escalated`: Disputed multi-tenant security architecture requiring human architectural decision.
