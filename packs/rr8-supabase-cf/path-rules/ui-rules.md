---
activation: always
paths:
  - "apps/web/app/components/**/*"
  - "apps/web/app/routes/**/*"
  - "apps/web/app/globals.css"
---

# {{PROJECT_NAME}} — UI & Design System Rules

## Styling System

We use **Tailwind CSS v4** layered with semantic design token variables defined in `{{APP_PATH}}/app/globals.css`.
Tailwind v4 is CSS-first: no `tailwind.config.js` exists or should ever be created.

### Hard Color Rules
- **NEVER use raw color classes** (e.g. `bg-white`, `text-slate-900`, `border-gray-200`, `bg-black`) — they break theme switching and dark mode.
- **ALWAYS use semantic theme utilities**:

| UI Role | Semantic Utility Class | Description |
|---|---|---|
| Page Background | `theme-bg-color` | Light: `#F5F5F5` / Dark: `#0A0A0A` |
| Container / Card Surface | `theme-fg-color` or `theme-card-bg` | Light: `#FFFFFF` / Dark: `#1A1A1A` |
| Primary Text / Headings | `theme-fc-heading` | Highest contrast text |
| Secondary Headings | `theme-fc-heading-light` | Medium-high contrast |
| Body Text | `theme-fc-base` | Default paragraph / label text |
| Muted / Caption Text | `theme-fc-light` | Hints, timestamps, metadata |
| Borders | `theme-border-color` | Component and container borders |
| Primary Brand Action | `bg-primary text-primary-foreground` | Blue `#1877F2` / Dark `#4A9FFF` |

### Typography Scale
Use standardized typography utility classes:
- `theme-h1` — Page main title
- `theme-h2` — Section header
- `theme-h3` — Card / modal title
- `theme-h4` — Subsection header
- `theme-h5` — Widget title
- `theme-h6` — Small label

---

## Component Standards

- Built with **shadcn/ui** primitives located under `{{APP_PATH}}/app/components/ui/` using the `~/` path alias.
- Never write raw native `<button>` tags — always import `<Button>` from `~/components/ui/button`.
- **Card Component**: Subtle borders (`theme-card-bg theme-border-color border`), no large `hover:shadow-2xl`.
- **Theme Management**: Handled via `app/lib/theme.ts` (zero-dependency, replacing `next-themes`). Inline `<ThemeScript />` in `<head>` of `root.tsx` prevents FOUC.
- **Mobile Touch Targets**: All interactive elements must measure **at least 44x44px** on mobile viewports.
- **Mobile Overlays**: Use `<Sheet>` or `<Drawer>` (Vaul) instead of disruptive modal dialogs on small screens.
- **Fonts**: Self-hosted Inter variable font loaded from `public/fonts/`.
- **Icons & Toasts**: Icons use `lucide-react`; notifications use `sonner`.
