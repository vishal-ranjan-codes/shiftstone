# Instructions for ss-steering — Universal AI Steering & Harness Engine

This skill governs the generation, maintenance, and verification of AI orientation routers, static rules, path-scoped rules, and multi-IDE shims across the ShiftStone ecosystem.

---

## 1. Architectural Model & Layer Mapping

ShiftStone partitions workspace intelligence into discrete context layers according to the 8-Layer Context Model (ICM §6.1–6.6):

- **Layer 0 (Universal Identity & Entry):** `AGENTS.md` provides orientation and directs agents to specialized subdirectories.
- **Layer 1 (Always-On Governance):** `.shiftstone/static-rules/*.md` enforces immutable product, security, and verification gates.
- **Layer 2 (Path-Scoped Conventions):** `.shiftstone/path-scoped-rules/*.md` injects localized instructions based on edited file paths.
- **Layer 3 (Callable Specialist Skills):** `.agents/skills/*/` contains 3-tier on-demand skills.
- **Layer 4 (Single Source of Truth Documentation):** `docs/bible/`, `docs/decisions/`, and `docs/research/` hold authoritative knowledge.

---

## 2. Step-by-Step Procedure

### Step 1: Synthesize Slim AGENTS.md Router
1. Read the template from [resources/agents-router-template.md](./resources/agents-router-template.md).
2. Substitute workspace parameters (`PROJECT_NAME`, `PRIMARY_ARCHETYPE`, `SKILL_INDEX`).
3. Enforce the strict 60-line ceiling:
   - Section 1: Orientation Header & Quirks pointers.
   - Section 2: Multi-Repo Ecosystem Layout.
   - Section 3: Universal Hard Rules (1–5).
   - Section 4: Documentation Directory Map (Markdown routing table).
   - Section 5: Dynamic Skill INDEX block (`<!-- SKILL-INDEX:BEGIN -->`).
   - Section 6: Suggested Next Steps table.
4. Verify `AGENTS.md` does not exceed 60 lines or 4,096 bytes.

### Step 2: Configure Static & Path-Scoped Rules
1. Ensure `.shiftstone/static-rules/` contains the required core rules from [resources/static-rules-templates.md](./resources/static-rules-templates.md):
   - `global.md`: Core dispatch table and operational mode contracts.
   - `governance.md`: Plan lifecycle and protected action gates.
   - `product.md`: Product vision, anti-goals, and core domain invariants.
   - `security.md`: Zero-trust boundary, credential protection, and sanitization.
   - `verification.md`: 5-step verification ladder and testing standards.
2. Ensure `.shiftstone/path-scoped-rules/` contains path-scoped rules from [resources/path-scoped-rules-catalog.md](./resources/path-scoped-rules-catalog.md):
   - `app-rules.md` (`paths: apps/web/**`): Framework routing, UI conventions.
   - `database-rules.md` (`paths: supabase/migrations/**`): RLS policies and SQL migrations.
   - `worker-rules.md` (`paths: workers/**`): Edge runtime limits and cron triggers.

### Step 3: Maintain Thin IDE Orientation Shims
1. Update root `CLAUDE.md`, `ANTIGRAVITY.md`, and `COMMANDCODE.md`.
2. Each shim must be $\le 30$–$50$ lines and strictly reference `AGENTS.md` as the authoritative SSOT without duplicating rules or instructions.
3. Preserve `.commandcode/taste/taste.md` as an empty stub (Universal Hard Rule 5).

### Step 4: Setup Junctions & Validate Context Budgets
1. Run `node .shiftstone/scripts/setup-ide-junctions.js` to ensure IDE skill folders link cleanly to `.agents/skills/`.
2. Run `node .shiftstone/scripts/validate-context-budgets.js` to assert zero budget overruns.

---

## Iron Laws

1. **Strict Slim Router Ceiling:** `AGENTS.md` must NEVER exceed 60 lines or 4,096 bytes. Never dump database schemas, API specs, or task cards into `AGENTS.md`.
2. **Zero Inlined Code In Steering:** Steering files route agents to `docs/bible/`, `docs/plans/`, or `.shiftstone/`—they never host inline implementation code.
3. **Empty Taste File Invariant:** `.commandcode/taste/taste.md` ships empty and remains unpopulated unless directly customized by the human developer.
4. **Cumulative Budget Limit:** Always-on context (`AGENTS.md` + always-on static rules) must NEVER exceed 12,288 bytes (~3,000 tokens).

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"It's more convenient to put database schemas directly in AGENTS.md so agents see them immediately."* | **Forbidden.** Inflating `AGENTS.md` wastes context window on every turn and breaches the 60-line ceiling. Route to `docs/bible/` instead. |
| *"Static rules are just slightly over 120 lines, it won't matter."* | **Forbidden.** Static rules load on every prompt. Overrunning the 120-line ceiling triggers CI rejection via `validate-context-budgets.js`. |
| *"I'll duplicate rules in CLAUDE.md and ANTIGRAVITY.md for IDE completeness."* | **Forbidden.** Duplicating rules leads to drift across IDEs. IDE files must remain thin reference shims pointing to `AGENTS.md`. |

---

## Verification Ladder

1. **L1 (Syntax & Links):** All markdown links in `AGENTS.md`, static rules, and path-scoped rules resolve to physical files on disk.
2. **L2 (Line & Token Budgets):** `node .shiftstone/scripts/validate-context-budgets.js` exits code 0 with zero warnings.
3. **L3 (Multi-IDE Parity):** `node .shiftstone/scripts/verify-ide-parity.js` confirms symlinks/junctions exist and synchronize correctly.
4. **L4 (Skills Manifest Index):** `node .shiftstone/scripts/generate-skills-manifest.js` regenerates the Skill INDEX block in `AGENTS.md` cleanly.

---

## Terminal States

- **`success`:** Steering files authored, line budgets verified ($\le 60$ lines for `AGENTS.md`, $\le 120$ lines for static rules), and `validate-context-budgets.js` exits 0.
- **`remediate`:** Line or byte ceilings exceeded; reduce verbosity and re-route details to documentation subfolders.
- **`blocked`:** Context budget validator or IDE junction script fails with unresolvable filesystem errors.
