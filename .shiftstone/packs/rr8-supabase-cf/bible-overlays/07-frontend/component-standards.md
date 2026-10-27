---
type: chapter-topic
title: "Component Standards & Design System"
chapter: "07-frontend"
file: "component-standards.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "shadcn/ui component standards, accessibility (WCAG AA), touch target guidelines, and typography."
---

# Frontend — Component Standards & Design System

## 1. Component Primitives

- **Primitives**: Built with **shadcn/ui** primitives located under `apps/web/app/components/ui/` using the `~/` path alias.
- **Card Design**: Subtle borders (`theme-card-bg theme-border-color border`) without aggressive hover drop-shadows.
- **Touch Targets**: All mobile interactive buttons and links must measure at least **44x44px**.
- **Typography**: Inter Variable font self-hosted in `public/fonts/` (no external CDN dependencies).

---

## 2. Accessibility Guidelines (WCAG 2.1 AA)

1. **Color Contrast**: All text must achieve $\ge 4.5:1$ contrast against surface backgrounds ($\ge 3:1$ for large text).
2. **Keyboard Navigation**: All interactive elements must exhibit visible `:focus-visible` outline rings using `ring-primary`.
3. **Screen Readers**: Form inputs must have explicit `<Label>` elements or `aria-label` tags. Error states must set `aria-invalid="true"`.
