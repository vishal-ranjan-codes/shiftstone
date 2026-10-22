---
type: decision
decisionId: DEC-002
title: Route Middleware-First Auth with @supabase/ssr & getClaims()
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-002 — Route Middleware-First Auth with @supabase/ssr & getClaims()

## Context
Need robust, secure server-side session validation without incurring unnecessary network roundtrips to Supabase Auth on every route request.

## Decision
Implement `supabaseMiddleware` running `await supabase.auth.getClaims()` to validate JWTs locally via JWKS, refresh cookies before downstream routes execute, and inject the client into React Router Context (`supabaseContext`).

## Consequences
Fast local JWT validation; session cookies are always refreshed cleanly across SSR requests.
