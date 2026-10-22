
# Theme Management Skill

> Load this skill when configuring dark mode, working with theme toggles, or debugging theme flash on page reload.

---

## 1. Why Custom Theme Management?

In Next.js, `next-themes` is commonly used. In React Router 8 on Cloudflare Workers, `next-themes` introduces Next.js-specific dependencies.
The framework replaces it with a lightweight, zero-dependency module: `app/lib/theme.ts`.

---

## 2. Implementation (`app/lib/theme.ts`)

```typescript
export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
}

export function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark);

  root.classList.toggle("dark", isDark);
}
```

---

## 3. Preventing Flash of Unstyled Content (FOUC)

In `app/root.tsx`, an inline blocking script runs before CSS rendering to immediately set the `dark` class:

```tsx
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('theme') || 'system';
        var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (isDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
```

Include `<ThemeScript />` inside `<head>` of `app/root.tsx`.

---

## 4. Theme Toggle Component

```tsx
import { Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getTheme, setTheme } from "~/lib/theme";
import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [theme, setLocalTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = getTheme();
    const isDark = current === "dark" || (current === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setLocalTheme(isDark ? "dark" : "light");
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    setLocalTheme(next);
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
```
