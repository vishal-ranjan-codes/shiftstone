# ss-init — Advanced Workspace Initializer & Product Architecting Guide

Procedural guide for initializing fresh workspaces into fully articulated, production-ready applications.

---

## Iron Law

1. **One Question Per Turn:** Never dump multiple questions simultaneously during requirements discovery. Always ask one question at a time using `ask_question`.
2. **Turn-by-Turn Checkpointing:** Persist session state to `.workspace-init-state.json` via `.shiftstone/init/session-state.js` after every single user response and step transition.
3. **Resumption Gate Invariant:** Always check `hasActiveSession(root)` before starting. If an active session exists, present the 1-click continuation modal (`Resume`, `Review`, `Discard`) without re-asking answered questions.
4. **Real-Time Progress Visibility:** Render the structured Markdown Progress Card (`renderProgressCard(state)`) at the start of each step transition to communicate completed counts, elapsed time, and dynamic ETAs.
5. **Declarative Step Pipeline:** Follow the 9 core steps registered in `.shiftstone/init/step-pipeline.json`. Dynamically handle optional steps (`step_5_branding`, `step_7_research`) by presenting the configured skip prompt.
6. **Deep Bible Synthesis:** Never leave `docs/bible/` with unpopulated template placeholders. Synthesize domain schemas, RLS policies, invariants, and route contracts from the discovery gates before completing initialization.
7. **Mechanical Separation:** Scaffolding operations (pack validation, starter cloning, git boundaries) are executed deterministically by `node .shiftstone/init.js`. Product architecture, brand naming, and Bible synthesis are executed by the skill.
8. **Physical Disk Output Only:** Output all configuration, schemas, decisions, and documentation directly to repo files. Never emit temporary IDE brain artifacts.

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

1. **`gate_1_problem_space` (Mandatory):** Problem space, value proposition, goals & anti-goals. Save checkpoint.
2. **`gate_2_actors_rbac` (Mandatory):** Actors, user personas & RBAC hierarchy. Save checkpoint.
3. **`gate_3_entity_modeling` (Mandatory):** Domain entity modeling & business invariants. Save checkpoint.
4. **`gate_4_tenant_security` (Mandatory):** Tenant isolation, security & compliance posture. Save checkpoint.
5. **`step_5_branding` (Optional):** Full-spectrum brand identity (`ss-brand`).
   - If user chooses "Configure now", execute `/ss-brand` workflow to generate brand strategy, OKLCH palette, and `docs/brand/brand-book.html`.
   - If user chooses "Skip for now", record in `skipped_steps` and proceed.
6. **`step_6_stack_archetype` (Mandatory):** Confirm stack archetype, package manager, and third-party services.
7. **`step_7_research` (Optional):** Pre-scaffold tech research (`docs/research/`).
   - Trigger research pass if third-party integrations (Stripe, Twilio, OpenAI) or custom architecture selected.
   - If standard flagship stack or user skips, record in `skipped_steps` and proceed.
8. **`step_8_mechanical_scaffold` (Mandatory):** Execute mechanical engine with domain-aware skill curation:
   ```bash
   node .shiftstone/init.js --name="<ProjectName>" --gh-user="<ghUser>" --skills="<skills>" --layout="monorepo" --pm="pnpm" -y
   ```
   - **Domain-Aware Skill Curation (`REQ-INIT-10`, `LOCK-INIT-12`):** Run `applySkillCuration` from `.shiftstone/init/skill-curator.js`:
     - Inspects interview context: prunes background jobs (`cron`, `jobs`), file storage (`remote-storage`, `storage`), and UI skills for API-only services, cutting context window overhead by $\ge 15\%$.
     - Evaluates declared third-party integrations against `skills.sh` via `evaluateCommunitySkills`: automatically installs packages with $\ge 10,000$ installs and surfaces lower counts as opt-in recommendations.
     - Materializes active symlinks in `.agents/skills/` without dangling junctions, mirrors across active IDE folders (`linkIdeFolders`), and regenerates `.shiftstone/context/skills-manifest.yaml` and the Skill INDEX in `AGENTS.md`.
   Save checkpoint.
9. **`step_9_bible_backlog_synthesis` (Mandatory):** Deep Bible & Steering Synthesis (`REQ-INIT-06`–`09`).
   - Evaluate project taxonomy: run `evaluateTaxonomy(context_data)` to determine optimal chapter hierarchy.
   - Autonomously restructure `docs/bible/` via `restructureBible(root, taxonomy)` without halting for user confirmation (`LOCK-INIT-06`).
   - Log `DEC-017: Adaptive Product Documentation Topology` to `docs/bible/DECISIONS.md`.
   - Deep Domain Synthesis: consume all interview data to author concrete schemas (PostgreSQL DDL), complete RLS policies, domain invariants, Mermaid state diagrams, and typed route contracts into modular chapter files (<= 400 lines each, `LOCK-INIT-05`, `LOCK-INIT-07`).
   - Validate synthesis: run `node .shiftstone/init/validate-bible-synthesis.js` to ensure zero `{{...}}` tokens or prompt boilerplate survive.
   - Customize AI steering: apply `steering-customizer.js` to update `product.md`, `global.md`, and dynamically generate `bible-rules.md` mapping source files to active Bible files (`LOCK-INIT-08`).
   - Populate `docs/backlog/` with structured Phase 1 and Phase 2 user stories.
   - Save checkpoint.

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
