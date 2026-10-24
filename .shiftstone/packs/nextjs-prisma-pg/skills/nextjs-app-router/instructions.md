# Next.js App Router Architecture Skill

> Load this skill when designing App Router layouts, writing React Server Components, configuring Route Handlers, or managing client boundaries in Next.js.

---

## 1. File Conventions & Hierarchy

The App Router structures routes under `app/`:

- `layout.tsx`: Shared UI wrapping route segments; preserves state across navigations.
- `page.tsx`: Unique UI rendered for a route segment.
- `loading.tsx`: Instant loading skeleton wrapped in a React Suspense boundary.
- `error.tsx`: Error boundary UI wrapping children (must be a `'use client'` component).
- `not-found.tsx`: UI rendered when `notFound()` is invoked.

Example root layout (`app/layout.tsx`):
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Production App Router setup',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

---

## 2. Server Components vs Client Boundaries

By default, all components inside the `app` directory are **React Server Components (RSC)**:

- Use RSC for data fetching, direct DB queries, and heavy dependencies.
- Add `'use client'` at the top of a file only when utilizing browser APIs, event listeners (`onClick`), or React state hooks (`useState`, `useEffect`).

```tsx
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}
```

---

## 3. Route Handlers (`app/api/**/route.ts`)

Define HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) as exported async functions:

```ts
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  return NextResponse.json({ status: 'ok', query });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ received: body }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }
}
```
