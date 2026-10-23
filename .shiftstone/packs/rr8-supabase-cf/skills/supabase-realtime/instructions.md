
# Supabase Realtime Skill

> Load this skill when implementing live database updates, chat systems, live notifications, or collaborative presence.

---

## 1. Realtime Architecture in React 19

Supabase Realtime provides WebSockets connections to:
1. **Postgres Changes**: Receive INSERT, UPDATE, DELETE events directly from PostgreSQL tables.
2. **Broadcast**: Ephemeral low-latency messaging between connected clients (e.g. typing indicators, cursor movements).
3. **Presence**: Synchronize online/offline state and user metadata.

---

## 2. Postgres Changes Subscription Hook

```typescript
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";

export function useRealtimeItems(initialItems: any[]) {
  const [items, setItems] = useState(initialItems);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("public:items")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) => prev.map((item) => item.id === payload.new.id ? payload.new : item));
          } else if (payload.eventType === "DELETE") {
            setItems((prev) => prev.filter((item) => item.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return items;
}
```

---

## 3. Database Publication Requirement

In Supabase, tables must be added to the `supabase_realtime` publication before events are emitted:

```sql
-- In a database migration:
ALTER PUBLICATION supabase_realtime ADD TABLE public.items;
```

---

## 4. Best Practices & Rules

- **Respect RLS**: Realtime in Supabase automatically filters change events by Row-Level Security policies. Ensure RLS policies allow the subscribed user to view the rows.
- **Always Clean Up Channels**: Always return `supabase.removeChannel(channel)` in `useEffect` cleanup functions to avoid memory leaks and ghost WebSocket listeners.
- **Use Broadcast for Ephemeral Events**: Do not write to the database for high-frequency events like cursor movements or typing indicators; use `channel.send({ type: 'broadcast', event: 'typing', ... })`.
