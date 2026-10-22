# [Topic] — Implementation Guide

---

## 🛠️ Code Setup

*Provide the exact code patterns required to integrate this solution into the Next.js + Supabase monorepo structure.*

### 1. Package Installation
```bash
{{PACKAGE_MANAGER}} --filter @{{PROJECT_NAME_LOWER}}/auth add [dependency]
```

### 2. Client Adapter Configuration
```typescript
// packages/[module]/src/client.ts
import { createServerClient } from '@{{PROJECT_NAME_LOWER}}/auth/server'

export async function getClient() {
  const supabase = await createServerClient()
  // client setup details
}
```

---

## 🗺️ Integration Flowchart

```mermaid
flowchart TD
    Client[Browser Client] -->|Calls Server Action| Action[Server Action]
    Action -->|Verify session| Auth[Supabase Auth]
    Action -->|Perform operation| Service[Researched Service]
    Service -->|Return payload| Action
    Action -->|Invalidate cache tag| Client
```

---

## 🔄 Sequence Diagram

```mermaid
sequenceDiagram
    participant User as Browser
    participant Action as Server Action
    participant DB as Supabase DB
    participant Ext as Researched API

    User->>Action: Form submit event
    Action->>DB: Verify session (getUser())
    DB-->>Action: Auth user object
    Action->>Ext: Invoke API call
    Ext-->>Action: Success payload
    Action-->>User: Return success response
```
