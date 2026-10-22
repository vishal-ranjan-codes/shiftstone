---
activation: always
---

# {{PROJECT_NAME}} — Workspace Initialization Rules

This rule is active when the project directory is detected as **Uninitialized** (i.e. `apps/web/package.json` or `docs/` is missing, but `core/init.js` is present in the workspace).

---

## Initialization Steering

If you detect the workspace is uninitialized, you MUST coordinate the automated startup loop:

> [!TIP]
> **IDE-First Quick Start Support**:
> If the user opens an empty directory and asks to clone this framework template, execute:
> `git clone https://github.com/vishal-ranjan-codes/react-router-supabase-workspace-framework.git .`
> Then immediately proceed to Step 1 below.

### Step 1: Scoping & Interview (1-Turn)
Greet the user and request key details about their SaaS concept. Keep it concise (ask exactly 3–4 questions):
1. **SaaS Concept**: What does the application do?
2. **User Roles**: Who will use the platform? (e.g. Standard Customer, Team Admin)
3. **Core Database Resources**: What are the main data entities to track? (e.g. Projects, Files, Tasks)
4. **Third-Party Integrations**: What external services are required? (e.g. Stripe billing, Resend emails, pgvector AI search)
5. **GitHub Account / Org**: Username or organization for automated Dual-Repo Git remote setup.

### Step 2: Propose the Automated Setup Command
Once the user describes their concept, propose running the automated setup command (the archetype composer) that clones the official starter boilerplate from GitHub, customizes the workspace, and prepares the Dual-Repo Git architecture:

```powershell
node core/init.js --name="MySaaS" --gh-user="my-github-user" --skills="stripe,resend" --layout="monorepo" --pm="pnpm" --clone-starter -y
```

Add `--archetype=<pack>` (or `--archetypes=<a>,<b>`) to compose a non-default or multiple stack archetypes.

This command automatically:
1. Validates the selected pack manifests (`packs/_schema.json`) and refuses conflicting packs.
2. Clones the flagship pack's starter framework from [https://github.com/vishal-ranjan-codes/react-router-supabase-framework.git](https://github.com/vishal-ranjan-codes/react-router-supabase-framework) into `apps/web/`.
3. Seeds governance from the packs: bible overlays over `docs/bible/`, pack-seeded ADRs into `DECISIONS.md`, pack skills as `.agents/skills/` junctions, regenerated skills manifest + `AGENTS.md` INDEX.
4. Establishes the **Dual-Repo Monorepo Architecture**:
   - Independent Git repository inside each `apps/<app>/` pointing to `https://github.com/<user>/<project>-app.git`.
   - Root workspace Git repository pointing to `https://github.com/<user>/<project>-workspace.git` with every app dir gitignored.
   - Saves `.workspace-git.json` deployment metadata. Zero network pushes are made during initialization.
5. Dynamically synthesizes project-specific specialist skills into `.agents/skills/<skill>/SKILL.md`.
6. Configures monorepo orchestration (`pnpm-workspace.yaml`, root `package.json`).
7. Precision replaces template placeholders across documentation, rules, and manifests.
8. Generates documentation folders and shared skills junctions for Claude Code and Command Code.

*(Note: In offline environments, `--starter-path="D:\Website\react-router-supabase-framework"` can be passed to copy from local disk instead).*

### Step 3: Pre-Fill Consolidated Documentation & Register Skills
After the folder structure is generated and initialized successfully:
1. **Pre-fill** `docs/bible/03-database/schema-reference.md` with complete, proposed SQL schemas (e.g. `profiles`, `resources`) with primary keys and `created_at/updated_at` timestamps.
2. **Pre-fill** `docs/bible/03-database/rls-policies.md` with proposed SELECT/INSERT/UPDATE Row-Level Security rules.
3. **Pre-fill** `docs/bible/04-auth-and-rbac/auth-overview.md` with session guarding redirects and roles.
4. **Pre-fill** `docs/bible/05-core-systems/core-domain-rules.md` with the business rules.
5. **Pre-fill** `docs/bible/08-api-contracts/route-contracts.md` with the route loaders and actions.
6. **Append** a new entry to `docs/bible/CHANGELOG.md` documenting the workspace launch.
7. **Register** any newly synthesized skills in `AGENTS.md`, `ANTIGRAVITY.md`, and `COMMANDCODE.md` under `## Project-Specific Skills`.

Once complete, present the initialized project workspace to the user. Inform them that both repositories are staged locally, and when ready to push to GitHub, they can simply type `Push to GitHub` or run `/push`!

