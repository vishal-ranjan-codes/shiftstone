# HTTPX Async HTTP Client Skill

> Load this skill when calling external APIs from FastAPI services, configuring connection pools, managing timeouts, or using ASGITransport in tests.

---

## 1. Async Client Lifecycle Management

Manage `httpx.AsyncClient` lifespan using FastAPI's lifespan context manager to reuse connections:

```python
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from fastapi import FastAPI
import httpx

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: create client with connection limits and timeouts
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(10.0, connect=5.0),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
    )
    yield
    # Shutdown: close client connections cleanly
    await app.state.http_client.aclose()

app = FastAPI(lifespan=lifespan)
```

---

## 2. Making Requests with Retries and Error Handling

```python
import httpx
from fastapi import HTTPException, status

async def fetch_github_user(client: httpx.AsyncClient, username: str) -> dict:
    url = f"https://api.github.com/users/{username}"
    try:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Upstream error")
    except httpx.RequestError as exc:
        raise HTTPException(status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="Network error")
```

---

## 3. In-Memory ASGI Testing with ASGITransport

Test ASGI applications directly without spinning up a live network port:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from main import app

@pytest.mark.anyio
async def test_health_with_transport():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://app.test") as client:
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
```
