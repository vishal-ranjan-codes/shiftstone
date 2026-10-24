# Go PostgreSQL with pgx Skill

> Load this skill when connecting Go services to PostgreSQL, configuring pgxpool, executing queries, or running atomic transactions.

---

## 1. Connection Pool Initialization

Use `github.com/jackc/pgx/v5/pgxpool` for high-performance concurrency:

```go
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, connString string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 5
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute
	config.HealthCheckPeriod = 1 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pgx pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return pool, nil
}
```

---

## 2. Queries and Row Scanning

Always pass `context.Context` and scan into struct fields:

```go
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

func GetUserByID(ctx context.Context, pool *pgxpool.Pool, id string) (*User, error) {
	query := `SELECT id, email, name, created_at FROM users WHERE id = $1`
	var u User
	err := pool.QueryRow(ctx, query, id).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}
```

---

## 3. Atomic Transactions

Safely commit or rollback transactions with deferred rollback:

```go
func CreateUserWithProfile(ctx context.Context, pool *pgxpool.Pool, email, name, bio string) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) // no-op if committed

	var userID string
	err = tx.QueryRow(ctx, "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id", email, name).Scan(&userID)
	if err != nil {
		return fmt.Errorf("insert user: %w", err)
	}

	_, err = tx.Exec(ctx, "INSERT INTO profiles (user_id, bio) VALUES ($1, $2)", userID, bio)
	if err != nil {
		return fmt.Errorf("insert profile: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}
```
