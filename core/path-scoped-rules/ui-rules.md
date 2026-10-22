---
activation: always
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "**/*.jsx"
---

# {{PROJECT_NAME}} — UI & Design System Rules

## Styling System

We use the project's styling system layered with semantic design token
variables. Styling configuration is CSS-first where the stack supports it —
prefer token variables over framework config files.

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

- Built with the project's component-library primitives located under `{{APP_PATH}}/components/ui/` (or the pack-equivalent path).
- Never write raw native `<button>` tags — always import the shared Button (or pack-equivalent) primitive.
- **Card Component**: Subtle borders (`theme-card-bg theme-border-color border`), no large `hover:shadow-2xl`.
- **Theme Management**: Handled by the app's dedicated theme module; render-blocking theme scripts belong in the document head to prevent FOUC.
- **Mobile Touch Targets**: All interactive elements must measure **at least 44x44px** on mobile viewports.
- **Mobile Overlays**: Use slide-in `<Sheet>` / `<Drawer>` components instead of disruptive modal dialogs on small screens.
- **Fonts**: Self-hosted variable font loaded from `public/fonts/`.
- **Icons & Toasts**: Use the project's icon set and notification library consistently — never mix ad-hoc alternatives.
