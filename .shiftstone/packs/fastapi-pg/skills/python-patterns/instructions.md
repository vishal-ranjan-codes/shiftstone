# Python Patterns & Architecture Skill

> Load this skill when structuring Python modules, writing type annotations, designing async services, or applying dependency injection patterns.

---

## 1. Modern Type Annotations (Python 3.12+)

Use built-in generics (`list`, `dict`, `set`, `tuple`) instead of typing module equivalents:

```python
from typing import Annotated, Protocol
from collections.abc import AsyncIterator, Sequence

# Built-in generic types
def process_items(items: list[str]) -> dict[str, int]:
    return {item: len(item) for item in items}

# Union syntax using |
def find_user(user_id: int) -> dict[str, str] | None:
    ...

# Type aliases with the type statement (PEP 695)
type JsonDict = dict[str, object]
type UserId = int
```

---

## 2. Structural Subtyping with Protocols

Prefer Protocols (interfaces) over rigid multiple inheritance for decoupleable service boundaries:

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class UserRepository(Protocol):
    async def get_by_id(self, user_id: int) -> dict[str, str] | None: ...
    async def create(self, email: str, name: str) -> dict[str, str]: ...

class PostgresUserRepository:
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def get_by_id(self, user_id: int) -> dict[str, str] | None:
        async with self.session_factory() as session:
            ...
```

---

## 3. Async/Await & Task Concurrency

Avoid blocking I/O calls (`time.sleep`, standard `requests`, sync DB calls) in async handlers:

```python
import asyncio
from collections.abc import AsyncIterator

# Use async context managers for resource safety
async def fetch_external_status(client, urls: Sequence[str]) -> list[int]:
    tasks = [client.get(url) for url in urls]
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    return [r.status_code for r in responses if not isinstance(r, Exception)]

# Async generator for streaming responses
async def event_generator() -> AsyncIterator[str]:
    for i in range(10):
        await asyncio.sleep(0.5)
        yield f"data: event {i}\n\n"
```

---

## 4. Dataclasses & Immutability

Use `dataclass(frozen=True, slots=True)` for domain value objects:

```python
from dataclasses import dataclass
from datetime import datetime

@dataclass(frozen=True, slots=True)
class TenantContext:
    tenant_id: str
    organization_id: str
    created_at: datetime
```
