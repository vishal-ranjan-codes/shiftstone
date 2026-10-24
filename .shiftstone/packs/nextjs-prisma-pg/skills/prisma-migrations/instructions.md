# Prisma Migrations & Database Sync Skill

> Load this skill when running migrations, seeding test data, or deploying schema updates to production PostgreSQL databases.

---

## 1. Development Migration Lifecycle

```bash
# Generate and apply a new migration from schema.prisma in development
pnpm prisma migrate dev --name add_user_roles

# Regenerate Prisma Client types after schema changes
pnpm prisma generate

# Prototype quickly without writing a migration history (prototyping only)
pnpm prisma db push

# Launch Prisma Studio web GUI to browse data
pnpm prisma studio
```

---

## 2. Production Migrations

In CI/CD and deployment pipelines, never use `prisma migrate dev`. Use `prisma migrate deploy`:

```bash
# Apply pending migrations safely without interactive prompts
pnpm prisma migrate deploy

# Check migration status
pnpm prisma migrate status
```

---

## 3. Database Seeding Setup

Configure `prisma.seed` in `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Example `prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'System Admin',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```
