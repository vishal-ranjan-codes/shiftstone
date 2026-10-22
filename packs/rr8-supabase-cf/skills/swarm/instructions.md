
# Multi-Agent Swarm Orchestration Skill

This skill details how to coordinate, prompt, and orchestrate specialized subagents to run in parallel using the native `invoke_subagent` tool.

---

## 🧭 Swarm Spawning Guidelines

### When to Spawn a Subagent
1. **Context Pressure**: Large research or multi-file audits that would overwhelm the parent context.
2. **Parallel Operations**: Simultaneously validating database schemas, reviewing route modules, and writing test suites.
3. **Safety & Auditing**: Running security reviews, RLS audits, or design token checks before shipping.

---

## 👥 Federated Swarm Roles & Prompts

### 1. Route & Code Reviewer
- **Role**: `React Router & TypeScript Code Auditor`
- **Focus**:
  - React Router 8 loader/action signatures and typed `Route` arguments.
  - Supabase SSR middleware cookie handling and `getClaims()`.
  - Cloudflare Edge runtime compatibility (no incompatible Node APIs).
  - TypeScript strict mode compliance with no arbitrary `any`.

### 2. Database Schema Architect
- **Role**: `Lead Database Architect & Supabase RLS Expert`
- **Focus**:
  - PostgreSQL schema integrity, UUID primary keys, and timestamp triggers.
  - Row-Level Security (RLS) policies on all tables.
  - Transactional safety and security definer RPC functions.
  - Type alignment with `app/types/database.types.ts`.

### 3. UI & Accessibility Specialist
- **Role**: `Design Token & Accessibility Auditor`
- **Focus**:
  - Strict enforcement of Tailwind CSS v4 `@theme` tokens (`theme-bg-color`, `theme-fg-color`, `theme-fc-*`).
  - Prohibition of hardcoded hex or raw Tailwind colors.
  - Mobile touch target minimum 44px.
  - ARIA attributes and keyboard navigation in shadcn/ui components.
