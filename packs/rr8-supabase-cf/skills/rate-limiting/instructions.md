
# Cloudflare Rate Limiting Skill

> Load this skill when protecting authentication routes, API endpoints, or file upload handlers from abuse.

---

## 1. Rate Limiting Strategy on Edge Workers

In Cloudflare Workers, incoming IP addresses can be read via `request.headers.get("CF-Connecting-IP")`.
Rate limits can be enforced using:
1. In-memory map (per isolate).
2. Cloudflare KV or Durable Objects (for distributed global coordination).

---

## 2. In-Memory Token Bucket Middleware (`app/middleware/rate-limit.ts`)

```typescript
import type { MiddlewareFunction } from "react-router";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const ipMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(config: RateLimitConfig = { maxRequests: 60, windowMs: 60000 }): MiddlewareFunction<Response> {
  return async ({ request }, next) => {
    const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    const now = Date.now();

    const record = ipMap.get(ip) || { count: 0, resetTime: now + config.windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + config.windowMs;
    } else {
      record.count += 1;
    }

    ipMap.set(ip, record);

    if (record.count > config.maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    const response = await next();
    response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, config.maxRequests - record.count)));
    return response;
  };
}
```

---

## 3. Best Practices & Rules

- **Protect Sensitive Routes**: Apply strict limits (e.g. 5 requests / minute) on `/sign-in`, `/auth/verify-otp`, and `/api/upload`.
- **Return 429 & Retry-After**: Always return standard `429 Too Many Requests` with a `Retry-After` header.
