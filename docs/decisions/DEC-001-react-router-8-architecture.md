---
type: decision
decisionId: DEC-001
title: React Router 8 (Framework Mode) Architecture
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-001 — React Router 8 (Framework Mode) Architecture

## Context
Needed a modern, full-stack React framework with first-class server-side rendering, streaming, data loading, route-level middleware, and native Edge runtime compatibility.

## Decision
Adopt React Router 8 in framework mode (`@react-router/dev`), taking advantage of native `MiddlewareFunction` support, type-safe Context API, and automatic route type generation (`+types/`).

## Consequences
Avoids complex server/client component boundaries from RSC; provides unified loaders, actions, and middleware per route module.
