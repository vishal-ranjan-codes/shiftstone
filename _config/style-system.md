---
type: config-reference
timestamp: 2026-10-12T00:00:00Z
---

# Style System

Stable UI style constraints (ICM Layer 3). Detailed how-to lives in skills;
this file states the non-negotiables.

- **Semantic tokens only** — colors come from `theme-*` / `fg-*` design tokens; never hardcode raw hex/rgb in components (`design-tokens` skill).
- **Tailwind v4 CSS-first config** — `@theme` / `@utility` in CSS, no JS tailwind config (`tailwind-v4` skill).
- **shadcn/ui primitives** — extend primitives instead of forking components (`shadcn-ui` skill).
- **Accessibility floor** — WCAG AA contrast, ≥44px touch targets (`web-design-guidelines` skill).
- **Dark mode** — every new token ships a dark-mode value (`theme-management` skill).
- Canonical mapping tables live in `docs/bible/07-frontend/`; update them when the style system changes.
