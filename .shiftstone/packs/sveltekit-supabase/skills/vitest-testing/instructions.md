# Vitest Testing for SvelteKit & Supabase Skill

> Load this skill when writing unit tests for SvelteKit API endpoints (+server.ts), form actions, or mocking Supabase clients.

---

## 1. Testing SvelteKit Endpoints (`+server.ts`)

Call endpoint handlers directly with simulated RequestEvent context:

```ts
import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('GET /health endpoint', () => {
  it('returns json status ok', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

---

## 2. Mocking Supabase Client in Tests

```ts
import { describe, expect, it, vi } from 'vitest';

export function createMockSupabase() {
  return {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [{ id: 1, title: 'Test Todo' }], error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
    },
  };
}

describe('mocked supabase query', () => {
  it('returns test data without connecting to network', async () => {
    const supabase = createMockSupabase();
    const { data } = await supabase.from('todos').select('*').order('created_at');
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Test Todo');
  });
});
```
