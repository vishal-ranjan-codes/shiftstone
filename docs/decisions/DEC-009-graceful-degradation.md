---
type: decision
decisionId: DEC-009
title: Graceful Degradation for Zero-Credential Environments
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-06T00:00:00.000Z
---

# DEC-009 — Graceful Degradation for Zero-Credential Environments

## Context
Fresh template checkouts, public portfolio previews, or local initial setups often lack live Supabase or Cloudflare credentials, causing traditional SSR frameworks to throw fatal 500 crashes on startup.

## Decision
Implement graceful degradation in `app/middleware/supabase.ts`. If environment variables are absent, store `null` in `supabaseContext` and permit downstream routes to proceed. Public pages (`/`, `/about`, `/contact`, `/design-system`) render normally, while auth pages display informative configuration banners.

## Consequences
Smooth developer onboarding; zero startup crashes when cloning or reviewing the template.
