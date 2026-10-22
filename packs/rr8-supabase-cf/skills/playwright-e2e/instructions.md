
# Playwright E2E Testing Skill

> Load this skill when writing browser automation tests, testing user journey flows, or verifying route protection.

---

## 1. Playwright Configuration (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```

---

## 3. Test Commands

```bash
pnpm test:e2e       # Run headless E2E tests
pnpm test:e2e:ui    # Run interactive Playwright UI
```

See [resources/2-e2e-test-suite-examples.md](./resources/2-e2e-test-suite-examples.md) for the long-form reference.
