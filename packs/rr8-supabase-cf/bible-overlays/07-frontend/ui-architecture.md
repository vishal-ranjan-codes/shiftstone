---
type: chapter
timestamp: 2026-09-06T00:18:02.984Z
---
# 07 — Frontend & UI Architecture

## Styling System

{{PROJECT_NAME}} uses **Tailwind CSS v4** layered with a custom semantic design token system in `{{APP_PATH}}/app/globals.css`.
- **CSS-First Configuration**: Tailwind v4 removes `tailwind.config.js`. All fonts, theme variables, and keyframes are defined inside CSS `@theme` blocks.
- **Vite Integration**: Compiled via `@tailwindcss/vite` in `vite.config.ts`.

---

## Semantic Design Tokens

| UI Role | Semantic Class | Light Mode | Dark Mode | Usage |
|---|---|---|---|---|
| Page Canvas | `theme-bg-color` | `#F5F5F5` | `#0A0A0A` | Global document background |
| Container Surface | `theme-fg-color` / `theme-card-bg` | `#FFFFFF` | `#1A1A1A` | Cards, modals, sidebars |
| Heading Text | `theme-fc-heading` | `#111827` | `#FFFFFF` | Main page titles, h1, h2 |
| Secondary Heading | `theme-fc-heading-light` | `#374151` | `#E5E7EB` | h3, h4, section titles |
| Body Copy | `theme-fc-base` | `#4B5563` | `#D1D5DB` | Paragraphs, descriptions |
| Muted Captions | `theme-fc-light` | `#9CA3AF` | `#9CA3AF` | Timestamps, helper hints |
| Structural Border | `theme-border-color` | `#E5E7EB` | `#262626` | Card and divider lines |
| Brand Primary | `bg-primary text-primary-foreground` | Blue `#1877F2` | Blue `#4A9FFF` | Primary buttons, active tabs |

---

## Theme Management (`app/lib/theme.ts`)

Instead of relying on Next.js-specific `next-themes`, the framework uses a lightweight helper:
- Persists theme choice (`light`, `dark`, `system`) to `localStorage`.
- Listens to `(prefers-color-scheme: dark)` media query for system changes.
- Injects an inline blocking `<ThemeScript />` in `<head>` of `app/root.tsx` to immediately apply `.dark` before the first paint, eliminating Flash of Unstyled Content (FOUC).

---

## Component Standards

- **Primitives**: Built with **shadcn/ui** primitives located under `{{APP_PATH}}/app/components/ui/` using the `~/` path alias.
- **Card Design**: Subtle borders (`theme-card-bg theme-border-color border`) without aggressive hover drop-shadows.
- **Touch Targets**: All mobile interactive buttons and links must measure at least **44x44px**.
- **Typography**: Inter Variable font self-hosted in `public/fonts/` (no external CDN dependencies).
