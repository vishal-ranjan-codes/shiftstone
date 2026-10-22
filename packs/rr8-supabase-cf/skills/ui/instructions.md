
# Design System & Component Library Skill Guide

Use this skill guide whenever building any page, component, or visual UI element for {{PROJECT_NAME}}. It ensures strict alignment with our Tailwind CSS v4 design tokens and the pre-installed shadcn/ui component library.

---

## 🎨 1. Color Palette & Surface Tokens

Our custom design system automatically handles light and dark mode switching. **Do not use hardcoded hex values or raw gray Tailwind colors.**

### Surface & Layout Utilities
| Class Name | Light Mode Hex | Dark Mode Hex | Usage |
|---|---|---|---|
| `.theme-bg-color` | `#F5F5F5` | `#0A0A0A` | Main page body background |
| `.theme-bg-color-dark` | `#EEEEEE` | `#050505` | Secondary or darker page background |
| `.theme-fg-color` | `#FFFFFF` | `#1A1A1A` | Main card, panel, block, or content background |
| `.theme-fg-color-dark` | `#FAFAFA` | `#242424` | Secondary card background |
| `.theme-border-color` | `#DFDFDF` | `#333333` | Standard division borders |
| `.theme-border-color-light` | `#F0F0F0` | `#2A2A2A` | Subdued, lighter borders |

### Typography Utilities
| Class Name | Light Mode Hex | Dark Mode Hex | Usage |
|---|---|---|---|
| `.theme-fc-base` | `#4D4D4D` | `#CCCCCC` | Default standard body text color |
| `.theme-fc-light` | `#8C8C8C` | `#A0A0A0` | Muted details, subtitles, secondary text |
| `.theme-fc-lighter` | `#BFBFBF` | `#808080` | Placeholder or disabled text |
| `.theme-fc-heading` | `#262626` | `#FAFAFA` | Primary page headers and prominent text |
| `.theme-fc-heading-light` | `#363636` | `#E8E8E8` | Secondary sub-headers and card titles |

### Brand Actions & Gradients
- **Primary Brand Color (Facebook Blue)**: Mapped to standard `--color-primary` variable (resolves to `#1877F2` in light / `#4A9FFF` in dark).
- **Core Action classes**:
  - Brand background: `bg-primary`, text brand: `text-primary`.
  - Hover states: `bg-primary/75` (button hover), `bg-primary/50` (disabled), `bg-primary/8` (accent highlight).
  - Premium Button Gradients: `theme-primary-btn-gradient` (sleek primary CTA gradient).

---

## 📐 2. Custom Layout & Shape Tokens

Ensure consistent spacing, radius shapes, and cards across all pages.

### Border Radius
- **Core Radius (10px)**: Use `.theme-rounded` for cards, modals, and major containers.
- **Small Radius (6px)**: Use `.theme-rounded-sm` for inputs, buttons, and badges.

### Layout Containers
- **Main Wrapper**: `.container` (max-width `7xl` centered with padding).
- **Reusable Card**: Use `.box` class which combines page foreground, borders, and main border-radius (`theme-fg-color theme-border-color border rounded-[var(--theme-rounded)]`).

### Dynamic Opacity Shades
Use `.theme-bg-shade-*` for transparent tint overlays:
- `theme-bg-shade-3` (3% opacity)
- `theme-bg-shade-5` (5% opacity) - ideal for card list hover highlights
- `theme-bg-shade-10` (10% opacity)
- `theme-bg-shade-20` through `theme-bg-shade-100`

---

## 🧱 3. Typography Scale

Always use semantic typography classes to ensure unified heading scales:

```tsx
<h1 className="theme-h1">Page Title</h1> // Font-size: 2rem, Medium, heading color
<h2 className="theme-h2">Section Title</h2> // Font-size: 1.75rem, Medium
<h3 className="theme-h3">Card Title</h3> // Font-size: 1.5rem, Medium
<h4 className="theme-h4">Sub-title</h4> // Font-size: 1.25rem, Medium
<h5 className="theme-h5">Label Bold</h5> // Font-size: 1rem, Bold
<h6 className="theme-h6">Category Header</h6> // Font-size: 0.875rem, Bold uppercase
```

---

## 🧱 4. Component Mapping (shadcn/ui Available)

Always import UI primitives from `~/components/ui/` to guarantee screen-reader (ARIA) support and keyboard responsiveness.

| Scenario | Component Import | Usage Guidelines |
|---|---|---|
| Any Button | `import { Button } from "~/components/ui/button"` | Supports `variant="default" \| "outline" \| "ghost" \| "destructive"` |
| Text Input | `import { Input } from "~/components/ui/input"` | Clean styles, supports `theme-rounded-sm` |
| Selector | `import { Select } from "~/components/ui/select"` | Clean dropdown selection |
| Form Fields | `import { Form, FormField, FormItem } from "~/components/ui/form"` | Manages labels, validations, and ARIA attributes |
| Confirm Modals | `import { AlertDialog } from "~/components/ui/alert-dialog"` | Destructive actions (delete, deactivate) |
| Standard Dialogs | `import { Dialog } from "~/components/ui/dialog"` | Clean modally locked cards on desktop |
| Mobile Overlays | `import { Sheet } from "~/components/ui/sheet"` or `Drawer` | Touch-friendly panels sliding from bottom/side |
| Toast Alerts | `import { toast } from "sonner"` | Lightweight action notifications |

---

## ♿ 5. Accessibility (A11y) Rules

- **Touch targets**: Guarantee a minimum of 44px by 44px height and width on all mobile interactive areas (buttons, links).
- **Icons**: Wrap icon-only buttons with `<Tooltip>` or include `<span className="sr-only">Label</span>`.
- **Fonts**: Self-hosted Inter variable font is loaded via `public/fonts/Inter-Variable.ttf`.
