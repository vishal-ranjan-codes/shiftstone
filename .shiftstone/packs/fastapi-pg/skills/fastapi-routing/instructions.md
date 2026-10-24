# FastAPI Routing & Dependency Injection Skill

> Load this skill when designing REST endpoints, structuring APIRouter modules, wiring dependency injection, or handling exceptions.

---

## 1. APIRouter Modularization

Group routes by domain with prefixes and tags:

```python
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.user import UserCreate, UserResponse
from app.dependencies import get_db, get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Route logic
    ...

@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),
) -> UserResponse:
    ...
```

---

## 2. Dependency Injection Chains

FastAPI dependencies can depend on other dependencies:

```python
from typing import Annotated
from fastapi import Depends, Header, HTTPException, status

async def verify_token(x_token: Annotated[str, Header()]) -> str:
    if x_token != "fake-secret-token":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Token header",
        )
    return x_token

async def get_active_user(token: Annotated[str, Depends(verify_token)]) -> dict:
    return {"token": token, "role": "admin"}
```

---

## 3. Global Exception Handling

```python
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

class DomainException(Exception):
    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": exc.message, "code": exc.code},
        )
```
