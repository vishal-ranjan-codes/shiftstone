# Pytest Async Testing Skill

> Load this skill when writing unit tests, setting up pytest fixtures, testing FastAPI endpoints, or mocking database sessions.

---

## 1. Test Configuration & Fixtures (`conftest.py`)

Configure async fixtures and isolated database sessions:

```python
import pytest
from collections.abc import AsyncGenerator
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from main import app
from app.dependencies import get_db

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"

@pytest.fixture
def client() -> TestClient:
    return TestClient(app)

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

---

## 2. Testing Endpoints

```python
import pytest
from fastapi.testclient import TestClient

def test_health_check(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@pytest.mark.anyio
async def test_async_endpoint(async_client) -> None:
    response = await async_client.get("/users")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
```

---

## 3. Mocking & Monkeypatching

Use `monkeypatch` or `unittest.mock` for external services:

```python
from unittest.mock import AsyncMock, patch

@pytest.mark.anyio
async def test_external_service_mock(async_client):
    mock_send = AsyncMock(return_value={"id": "msg_123", "status": "sent"})
    with patch("app.services.email.send_email", mock_send):
        response = await async_client.post("/invite", json={"email": "alice@example.com"})
        assert response.status_code == 200
        mock_send.assert_awaited_once()
```
