# Vitest Testing for Next.js & Prisma Skill

> Load this skill when testing Next.js App Router route handlers, mocking PrismaClient, or configuring Vitest for Next.js applications.

---

## 1. Route Handler Testing

Test route handlers (`GET`, `POST`) directly by invoking the exported async handler:

```ts
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns status ok with 200 code', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

---

## 2. Mocking Prisma Client

Mock database operations using `vi.mock` or a custom mock singleton:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getUserById } from '@/lib/users';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('getUserById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user record when found', async () => {
    const fakeUser = { id: 'u1', email: 'alice@example.com', name: 'Alice' };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(fakeUser as any);

    const result = await getUserById('u1');
    expect(result).toEqual(fakeUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });
});
```

---

## 3. Testing Server Actions

```ts
import { describe, expect, it, vi } from 'vitest';
import { createUserAction } from '@/app/actions/users';

describe('createUserAction', () => {
  it('rejects invalid email payloads', async () => {
    const formData = new FormData();
    formData.append('email', 'not-an-email');
    formData.append('name', 'Bob');

    const result = await createUserAction({}, formData);
    expect(result.success).toBe(false);
    expect(result.errors?.email).toBeDefined();
  });
});
```
