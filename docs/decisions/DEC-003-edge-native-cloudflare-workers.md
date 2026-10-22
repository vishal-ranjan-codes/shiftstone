---
type: decision
decisionId: DEC-003
title: Edge-Native Cloudflare Workers Runtime
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-003 — Edge-Native Cloudflare Workers Runtime

## Context
Need global low-latency execution and cost-effective serverless deployment with scheduled task capabilities.

## Decision
Deploy {{PROJECT_NAME}} to Cloudflare Workers / Pages using `@cloudflare/vite-plugin` and `wrangler`.

## Consequences
Code runs in V8 isolates at the edge; requires Node compatibility flags (`nodejs_compat`) and avoidance of non-edge Node APIs.
