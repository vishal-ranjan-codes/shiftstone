# find-skills — Discover & Install Skills from skills.sh

Companion to [SKILL.md](./SKILL.md). Source: [`vercel-labs/skills`](https://github.com/vercel-labs/skills) (installed via `npx skills add https://github.com/vercel-labs/skills --skill find-skills`), adapted to this workspace's skill conventions.

## When to use this skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.

**Key commands:**

- `npx skills find [query] [--owner <owner>]` — search for skills interactively or by keyword, optionally scoped to a GitHub owner
- `npx skills add <package>` — install a skill from GitHub or other sources
- `npx skills update` — update all installed skills

**Browse skills at:** https://skills.sh/

## How to help users find skills

### Step 1: Understand what they need

1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Check the leaderboard first

Before running a CLI search, check the [skills.sh leaderboard](https://skills.sh/) — it ranks skills by total installs, surfacing the most popular and battle-tested options.

For example, top skills for web development include:

- `vercel-labs/agent-skills` — React, Next.js, web design (100K+ installs each)
- `anthropics/skills` — Frontend design, document processing (100K+ installs)

### Step 3: Search for skills

If the leaderboard doesn't cover the need:

```bash
npx skills find [query] [--owner <owner>]
```

Examples:

- "how do I make my React app faster?" → `npx skills find react performance`
- "can you help me with PR reviews?" → `npx skills find pr review`
- "I need to create a changelog" → `npx skills find changelog`

### Step 4: Verify quality before recommending

**Do not recommend a skill based solely on search results.** Always verify:

1. **Install count** — prefer skills with 1K+ installs; be cautious below 100.
2. **Source reputation** — official sources (`vercel-labs`, `anthropics`, `microsoft`) are more trustworthy than unknown authors.
3. **GitHub stars** — treat a source repo with <100 stars with skepticism.

### Step 5: Present options to the user

For each relevant skill: name + what it does, install count and source, the install command, and a skills.sh link. Example:

```
I found a skill that might help! The "react-best-practices" skill provides
React and Next.js performance optimization guidelines from Vercel Engineering.
(185K installs)

To install it:
npx skills add vercel-labs/agent-skills@react-best-practices

Learn more: https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### Step 6: Offer to install

```bash
npx skills add <owner/repo@skill> -g -y
```

`-g` installs globally (user-level); `-y` skips confirmation prompts. See "Installing into this workspace" below before installing into the project.

## Common skill categories

| Category | Example queries |
|---|---|
| Web Development | react, nextjs, typescript, css, styling |
| Testing | testing, jest, playwright, e2e |
| DevOps | deploy, docker, kubernetes, ci-cd |
| Documentation | docs, readme, changelog, api-docs |
| Code Quality | review, lint, refactor, best-practices |
| Design | ui, ux, design-system, accessibility |
| Productivity | workflow, automation, git |

## Tips for effective searches

1. **Use specific keywords**: "react testing" beats "testing".
2. **Try alternative terms**: if "deploy" fails, try "deployment" or "ci-cd".
3. **Check popular sources**: `vercel-labs/agent-skills`, `ComposioHQ/awesome-claude-skills`.

## When no skills are found

1. Acknowledge that no relevant skill was found.
2. Offer to help with the task directly with general capabilities.
3. Suggest creating one with `npx skills init`.

```
I searched for skills related to "xyz" but didn't find any matches.
I can still help you with this task directly! Would you like me to proceed?

If this is something you do often, you could create your own skill:
npx skills init my-xyz-skill
```

## Installing into this workspace

This workspace owns its skill tree (`.agents/skills/` is the canonical view; `.claude/skills` and `.commandcode/skills` are junctions to it). A skill installed **into the project** must land as a **real directory**, follow the 3-tier structure, and be registered:

1. **Fetch the skill content** (copy, never symlink):

   ```sh
   npx skills add <source> --skill <name> --agent claude-code --copy -y
   ```

   Files land in `.agents/skills/<name>/`. Do **not** keep the generated root `skills-lock.json` — this repo does not track CLI lockfiles; provenance goes in `.agents/skills/log.md` instead.

2. **Classify ownership:**
   - **Universal core skill** (stack-agnostic, harness/meta) → keep in `.agents/skills/<name>/`.
   - **Stack skill** → move to `packs/<pack>/skills/<name>/` and add the name to that pack's `composition.skills.include` in `manifest.yaml` (the link script surfaces it back into `.agents/skills/` as a junction).

3. **Restructure to 3 tiers** per the `skills-author` skill: `SKILL.md` (manifest: `name`, `description`, `type`, `timestamp`, `version`, `pack`), `instructions.md` (procedural body), optional `resources/`.

4. **Register**:
   - Add the gitignore negation for core skills: `!/.agents/skills/<name>/` (otherwise the skill is silently untracked).
   - Declare `tier`/`paths`/`depends_on` in `.shiftstone/scripts/generate-skills-manifest.js` CONFIG (`manual-load` unless discovery should be automatic).
   - Run `node .shiftstone/scripts/generate-skills-manifest.js` (rewrites `.shiftstone/context/skills-manifest.yaml` + the AGENTS.md Skill INDEX).
   - Append a row to `.agents/skills/log.md` and run `node .shiftstone/scripts/compile-changelog.js`.

5. **Gate**: `pnpm parity` must pass (manifest budgets, OKF frontmatter, links, indexes).

## See also

- [skills-author](../ss-add-skill/instructions.md) — authoring and registering skills in this workspace
- [bookkeeping](../ss-bookkeeping/instructions.md) — bundle index/log maintenance when a skill move leaves stale records
