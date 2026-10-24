# SQLAlchemy 2.0 Async PostgreSQL Skill

> Load this skill when designing database models, configuring AsyncEngine and AsyncSession, querying with Select statements, or managing transactions.

---

## 1. Engine & Session Setup

Configure `create_async_engine` and `async_sessionmaker` using `psycopg` or `asyncpg`:

```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+psycopg://user:password@localhost:5432/app_db"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
```

---

## 2. Declarative Models (SQLAlchemy 2.0 Style)

Use `Mapped` and `mapped_column` type annotations:

```python
from datetime import datetime, timezone
from uuid import UUID, uuid4
from sqlalchemy import ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    posts: Mapped[list["Post"]] = relationship(back_populates="author", cascade="all, delete-orphan")

class Post(Base):
    __tablename__ = "posts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    author: Mapped["User"] = relationship(back_populates="posts")
```

---

## 3. Querying & Transactions

Always execute queries with `select()` and handle async iteration:

```python
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def get_user_with_posts(session: AsyncSession, user_id: UUID) -> User | None:
    stmt = (
        select(User)
        .options(selectinload(User.posts))
        .where(User.id == user_id)
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

async def create_user_post(session: AsyncSession, user_id: UUID, title: str, content: str) -> Post:
    async with session.begin():
        post = Post(author_id=user_id, title=title, content=content)
        session.add(post)
    return post
```
