
# React Router 8 Error Boundaries Skill

> Load this skill when designing error handling, 404 pages, layout boundaries, or handling unexpected server exceptions.

---

## 1. Error Boundary Architecture

React Router 8 error boundaries catch errors thrown during:
- Route middleware
- Route loaders
- Route actions
- React component rendering

When an error is thrown in a route, React Router stops rendering that route and renders its `ErrorBoundary`. If that route does not define one, the error bubbles up to the parent layout, and finally to `app/root.tsx`.

---

## 2. Standard Error Boundary Component

```tsx
import { isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/dashboard-items";
import { Button } from "~/components/ui/button";

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    // Thrown Response objects (e.g. 404, 401, 403, 500)
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          {error.status} {error.statusText}
        </h1>
        <p className="text-muted-foreground">{error.data || "Resource error"}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  if (error instanceof Error) {
    // JavaScript Runtime Exceptions
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Unexpected Error</h1>
        <p className="text-sm font-mono bg-muted p-2 rounded max-w-md overflow-auto">
          {error.message}
        </p>
        <Button onClick={() => window.location.reload()}>Reload Page</Button>
      </div>
    );
  }

  return <h1>Unknown Error Occurred</h1>;
}
```

---

## 3. Global Root Error Boundary (`app/root.tsx`)

Every application MUST export a root `ErrorBoundary` to catch uncaught root failures:

```tsx
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404 Not Found" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
```

---

## 4. Best Practices & Rules

- **Use HTTP Responses for Expected Domain Errors**: If an item is missing, throw `new Response("Item not found", { status: 404 })`. Do not throw raw JavaScript Error objects for normal HTTP conditions.
- **Never Leak Stack Traces in Production**: Only display `error.stack` when `import.meta.env.DEV` is true.
- **Provide Actionable Recovery**: Always provide a "Go to Dashboard" link or "Retry" button inside error boundaries.
