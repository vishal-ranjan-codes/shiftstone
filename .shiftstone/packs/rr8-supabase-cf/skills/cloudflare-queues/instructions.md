
# Cloudflare Queues Skill

> Load this skill when configuring asynchronous message queues, offloading heavy background workloads, or processing webhook events asynchronously.

---

## 1. Cloudflare Queues Architecture

Cloudflare Queues enable Workers to produce and consume messages asynchronously with guaranteed delivery and automatic retry policies.

```
Producer (HTTP Route / Action)
       │
       ▼  await env.TASK_QUEUE.send({ taskId, payload })
Cloudflare Queue
       │
       ▼  queue(batch, env, ctx) consumer
Consumer Worker (Processes batch, writes to Supabase)
```

---

## 2. Configuration (`wrangler.jsonc`)

```jsonc
{
  "queues": {
    "producers": [
      {
        "queue": "task-processing-queue",
        "binding": "TASK_QUEUE"
      }
    ],
    "consumers": [
      {
        "queue": "task-processing-queue",
        "max_batch_size": 10,
        "max_batch_timeout": 5
      }
    ]
  }
}
```

---

## 3. Producer Pattern (In Route Action)

```typescript
export async function action({ request, context }: Route.ActionArgs) {
  const queue = context.cloudflare.env.TASK_QUEUE;
  const data = await request.json();

  // Send message to queue
  await queue.send({
    type: "GENERATE_REPORT",
    userId: data.userId,
    requestedAt: Date.now(),
  });

  return { status: "queued" };
}
```

---

## 4. Consumer Handler (`workers/app.ts`)

```typescript
export default {
  async fetch(request, env, ctx) {
    return requestHandler(request);
  },

  async queue(batch: MessageBatch<any>, env: CloudflareEnv, ctx: ExecutionContext) {
    for (const message of batch.messages) {
      try {
        console.log(`Processing message ID ${message.id}:`, message.body);
        // Process message...
        message.ack();
      } catch (err) {
        console.error(`Failed message ${message.id}:`, err);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;
```

---

## 5. Best Practices & Rules

- **Acknowledge vs Retry**: Always call `message.ack()` on successful processing and `message.retry()` on recoverable errors.
- **Idempotency**: Consumers must be idempotent because Queues offer at-least-once message delivery.
