
# Security Headers & CORS Skill

> Load this skill when configuring HTTP security headers, CORS policies, or hardening cookie security.

---

## 1. Security Headers Middleware (`app/middleware/security.ts`)

```typescript
import type { MiddlewareFunction } from "react-router";

export const securityHeadersMiddleware: MiddlewareFunction<Response> = async (args, next) => {
  const response = await next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  return response;
};
```

---

## 2. CORS Middleware for API Routes (`app/middleware/cors.ts`)

```typescript
import type { MiddlewareFunction } from "react-router";

export function createCorsMiddleware(allowedOrigins: string[]): MiddlewareFunction<Response> {
  return async ({ request }, next) => {
    const origin = request.headers.get("Origin");

    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      const headers = new Headers();
      if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
        headers.set("Access-Control-Max-Age", "86400");
      }
      return new Response(null, { status: 204, headers });
    }

    const response = await next();

    if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }

    return response;
  };
}
```

---

## 3. Cookie Security Attributes

When writing session cookies, `@supabase/ssr` defaults to:
- `HttpOnly: true` (prevents JavaScript access, mitigating XSS token theft).
- `Secure: true` (in production over HTTPS).
- `SameSite: "Lax"` (protects against CSRF on standard navigations).
