# Go Database Migrations Skill

> Load this skill when creating, structuring, or running SQL migrations using golang-migrate in Go applications.

---

## 1. Migration File Naming Convention

Create paired `.up.sql` and `.down.sql` files with sequential timestamps:

```text
migrations/
  ├── 000001_create_users_table.up.sql
  ├── 000001_create_users_table.down.sql
  ├── 000002_add_posts_table.up.sql
  └── 000002_add_posts_table.down.sql
```

Example `000001_create_users_table.up.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Example `000001_create_users_table.down.sql`:
```sql
DROP TABLE IF EXISTS users;
```

---

## 2. Running Migrations Programmatically via `embed.FS`

Embed migrations into the Go binary for zero-dependency container deployment:

```go
package migrations

import (
	"database/sql"
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed *.sql
var migrationFiles embed.FS

func RunUp(db *sql.DB) error {
	driver, err := iofs.New(migrationFiles, ".")
	if err != nil {
		return fmt.Errorf("create iofs driver: %w", err)
	}

	instance, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("create db instance: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", driver, "postgres", instance)
	if err != nil {
		return fmt.Errorf("create migrate: %w", err)
	}

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}

	return nil
}
```

---

## 3. CLI Commands

```bash
# Create a new migration pair
migrate create -ext sql -dir migrations -seq create_users_table

# Apply all up migrations
migrate -path migrations -database "$DATABASE_URL" up

# Rollback the last migration
migrate -path migrations -database "$DATABASE_URL" down 1
```
