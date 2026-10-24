# Uvicorn Production Deployment Skill

> Load this skill when configuring Uvicorn, tuning worker concurrency, writing Dockerfiles for FastAPI, or handling production signals.

---

## 1. Running Uvicorn in Development vs Production

```bash
# Development: hot reload, single worker
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Production: multiple workers, optimized loop
uv run uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4 \
  --loop uvloop \
  --http httptools \
  --proxy-headers \
  --forwarded-allow-ips='*'
```

---

## 2. Docker Containerization

Multi-stage build for a lightweight production image:

```dockerfile
FROM python:3.12-slim AS builder

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

COPY pyproject.toml ./
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runner

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY . .

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

---

## 3. Graceful Shutdown & Health Checks

Ensure SIGTERM handling finishes in-flight requests cleanly:

- Expose `/health` for Kubernetes / load-balancer probes.
- Close database connection pools and background tasks in the FastAPI lifespan cleanup block.
