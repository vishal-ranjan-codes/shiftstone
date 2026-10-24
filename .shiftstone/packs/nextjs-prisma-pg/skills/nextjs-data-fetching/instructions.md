# Next.js Server-Side Data Fetching Skill

> Load this skill when fetching data in Server Components, configuring revalidation tags, or streaming responses with Suspense.

---

## 1. Direct Server Component Data Fetching

Fetch database records directly inside async Server Components:

```tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    notFound();
  }

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

---

## 2. Revalidation Strategies

Next.js provides time-based and on-demand cache revalidation:

```ts
import { revalidatePath, revalidateTag } from 'next/cache';

// Time-based revalidation in fetch
const data = await fetch('https://api.example.com/items', {
  next: { revalidate: 3600, tags: ['items'] },
});

// On-demand revalidation in Server Actions or Route Handlers
export async function clearItemCache() {
  revalidateTag('items');
  revalidatePath('/dashboard/items');
}
```

---

## 3. Streaming with Suspense

Prevent slow database queries from blocking the initial page render:

```tsx
import { Suspense } from 'react';

async function SlowAnalytics() {
  const stats = await prisma.user.count();
  return <div>Total users: {stats}</div>;
}

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<p>Loading analytics...</p>}>
        <SlowAnalytics />
      </Suspense>
    </div>
  );
}
```
