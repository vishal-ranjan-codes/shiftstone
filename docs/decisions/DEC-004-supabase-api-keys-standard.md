---
type: decision
decisionId: DEC-004
title: Supabase 2025 API Keys Standard
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-004 — Supabase 2025 API Keys Standard

## Context
Supabase introduced new API key formats replacing legacy JWT-based anon and service_role keys.

## Decision
Adopt `SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`) for browser and SSR, and `SUPABASE_SECRET_KEY` (`sb_secret_...`) for server-side admin operations.

## Consequences
Keys are transmitted via `apikey` headers rather than Bearer authorization headers; secret keys are blocked from browser contexts.
