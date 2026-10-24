# Pydantic v2 Schema & Settings Skill

> Load this skill when declaring request/response schemas, validating payloads, serializing models, or managing application settings.

---

## 1. Schema Definitions & Validation

Use `BaseModel`, `Field`, and `ConfigDict`:

```python
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        if not value.replace(" ", "").isalpha():
            raise ValueError("Name must contain only alphabetic characters and spaces")
        return value

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    name: str
    created_at: datetime
```

---

## 2. Application Settings Management

Use `pydantic-settings` for typed environment variable loading:

```python
from functools import lru_cache
from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "FastAPI Service"
    environment: str = "development"
    debug: bool = False
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/app"
    secret_key: str = "dev-secret-change-in-production"

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## 3. Serialization and Computed Fields

```python
from pydantic import BaseModel, computed_field

class OrderSummary(BaseModel):
    items_count: int
    subtotal_cents: int
    tax_cents: int

    @computed_field
    @property
    def total_cents(self) -> int:
        return self.subtotal_cents + self.tax_cents
```
