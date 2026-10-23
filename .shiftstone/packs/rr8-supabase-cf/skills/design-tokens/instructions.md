
# Semantic Design Tokens Skill

> Load this skill when styling any component, layout, or page to guarantee seamless light/dark mode compatibility.

---

## 1. Absolute Rule: No Hardcoded Raw Colors

To prevent color drift and broken dark modes:
- **NEVER use raw color utility classes**: `bg-white`, `bg-black`, `bg-gray-100`, `text-slate-900`, `text-gray-500`, `border-gray-200`.
- **ALWAYS use semantic theme tokens**:

---

## 2. Standard Design Token Mappings

| Role | Semantic Class | Replaces | Notes |
|---|---|---|---|
| Page Background | `theme-bg-color` | `bg-white dark:bg-black` | Main surface background |
| Secondary Surface | `theme-card-bg` | `bg-white dark:bg-neutral-900` | Card, modal, panel surfaces |
| Border | `theme-border-color` | `border-gray-200 dark:border-neutral-800` | Standard structural borders |
| Heading Text | `theme-fc-heading` | `text-gray-900 dark:text-white` | Page titles, h1, h2, card titles |
| Body Text | `theme-fc-base` | `text-gray-700 dark:text-gray-300` | Standard paragraphs, labels |
| Muted/Secondary Text | `theme-fc-light` | `text-gray-500 dark:text-gray-400` | Helper text, timestamps, subtitles |
| Accent Brand Color | `theme-primary` | `text-blue-600 dark:text-blue-400` | Primary CTAs, highlights |

---

## 3. Typography Semantic Tokens

```html
<!-- Main Page Header -->
<h1 className="theme-h1">Dashboard Overview</h1>

<!-- Section Header -->
<h2 className="theme-h2">Recent Transactions</h2>

<!-- Subsection Header -->
<h3 className="theme-h3">Item Details</h3>

<!-- Standard Body Paragraph -->
<p className="theme-p">Detailed summary of your operations.</p>
```

---

## 5. Review Checklist for UI Edits

- [ ] Does any element use `bg-white`? $\rightarrow$ Replace with `theme-bg-color` or `theme-card-bg`.
- [ ] Does any text use `text-black` or `text-gray-900`? $\rightarrow$ Replace with `theme-fc-heading` or `theme-fc-base`.
- [ ] Does any border use `border-gray-200`? $\rightarrow$ Replace with `theme-border-color`.
- [ ] Test in both Light mode and Dark mode!

See [resources/4-example-component-with-semantic-tokens.md](./resources/4-example-component-with-semantic-tokens.md) for the long-form reference.
