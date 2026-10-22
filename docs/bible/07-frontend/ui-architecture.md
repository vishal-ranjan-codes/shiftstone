---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Styling system, semantic design tokens, theme management
---
# 07 — Frontend & UI Architecture

This chapter is the SSOT for **how the interface is built**: styling system, design tokens, theming, and component standards.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/07-frontend/` at init (styling config, token tables, theme helpers, component library wiring).

## Styling System

Document the styling approach (engine, configuration entry points, how utilities are extended) and the rule for where styles live per surface.

## Semantic Design Tokens

Publish the token table — name, role, and value for every semantic color/space/radius token — and the rule that components consume **tokens, never raw hex values**. Light/dark variants are part of the token, not the component.

## Theme Management

Describe how the active theme is resolved and persisted (script/flash handling included), and why the project's own theme helper is used instead of a third-party default.

## Component Standards

- Shared components come from the documented component library — extend those before creating new primitives.
- Touch targets are at least **44×44px**; visible focus states are mandatory.
- Self-hosted fonts where licensing allows; no layout shift on font load.
