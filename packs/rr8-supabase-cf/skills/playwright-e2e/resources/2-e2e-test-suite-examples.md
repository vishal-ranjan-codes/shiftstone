## 2. E2E Test Suite Examples

### Theme Toggle Test (`e2e/theme.spec.ts`):
```typescript
import { test, expect } from "@playwright/test";

test("toggles between light and dark themes", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");

  const themeButton = page.getByRole("button", { name: /toggle theme/i });
  await themeButton.click();

  await expect(html).toHaveClass(/dark/);

  await themeButton.click();
  await expect(html).not.toHaveClass(/dark/);
});
```

### Route Protection Test (`e2e/auth-guard.spec.ts`):
```typescript
import { test, expect } from "@playwright/test";

test("redirects unauthenticated user from dashboard to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/.*sign-in/);
});
```

---
