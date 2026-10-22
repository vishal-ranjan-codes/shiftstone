---
type: decision
decisionId: DEC-005
title: Tailwind CSS v4 Semantic Theme Tokens
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-05T00:00:00.000Z
---

# DEC-005 — Tailwind CSS v4 Semantic Theme Tokens

## Context
Need strict light/dark mode support and design consistency without hardcoded hex colors or raw gray Tailwind classes.

## Decision
Layer semantic theme utilities (`theme-bg-color`, `theme-fg-color`, `theme-fc-heading`, `theme-fc-base`, `theme-border-color`) over Tailwind CSS v4 `@theme` configuration and shadcn/ui components.

## Consequences
Zero color drift; light and dark modes toggle automatically and seamlessly.
