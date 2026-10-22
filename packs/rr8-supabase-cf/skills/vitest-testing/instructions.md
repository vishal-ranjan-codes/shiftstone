
# Vitest Unit & Integration Testing Skill

> Load this skill when writing unit tests, testing React components, mocking Supabase clients, or running test suites.

---

## 1. Test Configuration (`vitest.config.ts`)

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

---

## 2. Testing UI Components

```tsx
// tests/components/button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Button } from "~/components/ui/button";

describe("Button component", () => {
  it("renders with text and handles click", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeDefined();

    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## 3. Mocking Supabase Context in Middleware/Loaders

```typescript
import { describe, it, expect, vi } from "vitest";
import { authMiddleware } from "~/middleware/auth";
import { supabaseContext } from "~/lib/supabase/context";

describe("authMiddleware", () => {
  it("throws redirect to /sign-in when unauthenticated", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }),
      },
    };

    const mockContext = new Map();
    mockContext.set(supabaseContext, mockSupabase);

    await expect(
      authMiddleware({ context: mockContext } as any, vi.fn())
    ).rejects.toThrow();
  });
});
```

---

## 4. Test Commands

```bash
# In workspace or apps/web/
pnpm test          # Run tests in watch mode
pnpm test --run    # Run single pass
pnpm test:ui       # Open Vitest UI
pnpm test:coverage # Generate coverage report
```
