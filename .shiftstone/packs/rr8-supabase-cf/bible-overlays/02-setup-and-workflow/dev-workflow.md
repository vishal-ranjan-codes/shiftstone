---
type: chapter-topic
title: "Development Loop & Deployment Pipeline"
chapter: "02-setup-and-workflow"
file: "dev-workflow.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Day-to-day development workflow, type generation, Vitest execution, and Cloudflare Pages deployment pipeline."
---

# Setup & Workflow — Development Loop & Deployment Pipeline

## 1. Engineering Loop

1. **Start Local Server**: Run `pnpm dev` at the workspace root to boot the Vite development server with Cloudflare Workers emulation.
2. **Type Generation**: When database schemas change, run `pnpm --filter @<project>/web supabase:types` to regenerate `./+types` and database interfaces.
3. **Testing Discipline**: Run `pnpm test` (Vitest) before committing changes. Apply Red-First TDD for any bug fixes or route modifications.

## 2. Production Deployment (Cloudflare Pages / Workers)

Because the workspace operates as a Dual-Repo Monorepo:
1. **Application Deployment Source**: Cloudflare Pages connects directly to the nested web application repository (`https://github.com/<user>/<project>-app.git`).
2. **Root Directory in Cloudflare Dashboard**: Set root directory to `.` (since the app repository root contains `wrangler.jsonc`, `package.json`, and `vite.config.ts`).
3. **Build Command**: `pnpm run build`
4. **Deploy Output Directory**: `build/client`
5. **Governance Isolation**: The root workspace repository (`<project>-workspace.git`) is completely independent, preventing documentation updates from triggering production rebuilds.
