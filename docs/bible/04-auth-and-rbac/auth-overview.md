---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Authentication architecture, guards, session handling, roles
---
# 04 — Auth & Role-Based Access Control (RBAC)

This chapter is the SSOT for **who is allowed to do what**: authentication methods, session verification, and the role model.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/04-auth-and-rbac/` at init.

## Authentication Architecture

Document the auth stack end to end: where credentials are exchanged, where sessions are stored, how requests prove identity on the server, and which middleware/guard sits in front of protected routes.

## Multi-Method Authentication

List every supported sign-in method (password, one-time code, magic link, OAuth…) and where each is configured. Keep method selection **centralized in one config module** — never scattered across routes and forms.

## Route Guarding Patterns

Show the canonical guards: the authentication guard applied to all protected routes, and the role guard applied to admin surfaces. Include the concrete file paths agents must reuse instead of inventing new guards.

## User Roles & Assignment Rules

| Role | Capabilities | How it is granted |
|---|---|---|
| `user` | … | automatic on sign-up |
| `admin` | … | **granted manually by an existing admin — never self-assigned** |

## Token Verification Best Practices

- Verify tokens **server-side on every request that matters** — never trust client-claimed identity.
- Prefer verified-signature checks over session lookups where both exist; document which one this codebase uses and why.
- Refresh/rotate sessions before downstream handlers run, so loaders/actions always see a valid session.
