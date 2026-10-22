
# Tailwind CSS v4 Skill

> Load this skill when writing CSS, configuring Tailwind themes, styling components, or creating custom utility classes.

---

## 1. Tailwind CSS v4 Paradigm Shift

Tailwind CSS v4 replaces JavaScript configuration files (`tailwind.config.js`) with native CSS-first configuration:
- **No `tailwind.config.js` or `tailwind.config.ts`**: All theme configuration is written directly in `app/globals.css`.
- **Vite Plugin**: `@tailwindcss/vite` handles compilation without PostCSS.
- **`@theme` Directive**: Defines design tokens directly in CSS.

---

## 2. Global Stylesheet (`app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  
  /* Core palette mappings */
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

---

## 3. Creating Custom Utilities (`@utility`)

In Tailwind v4, define custom utilities using the `@utility` directive:

```css
@utility theme-h1 {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--color-foreground);
}

@utility theme-h2 {
  font-size: 1.875rem;
  line-height: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--color-foreground);
}
```

---

## 4. Best Practices & Rules

- **Do NOT create `tailwind.config.js`**: Tailwind v4 ignores it and it introduces configuration conflicts.
- **Use CSS Variables with `var(...)`**: Reference CSS variables inside `@theme` blocks.
- **Keep `@import "tailwindcss";` at line 1**: All imports and theme blocks must follow this statement.
