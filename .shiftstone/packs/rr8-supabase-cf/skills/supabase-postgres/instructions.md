
# Supabase PostgreSQL Data Modeling Skill

> Load this skill when designing database schemas, writing triggers, creating indexes, or setting up relational structures.

---

## 1. Baseline Standards

Every table designed in {{PROJECT_NAME}} must satisfy:
1. **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
2. **Timestamps**:
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
3. **Foreign Keys**: Explicit `REFERENCES other_table(id) ON DELETE CASCADE` (or `ON DELETE SET NULL`).
4. **Naming**: Table names and columns must be `snake_case`.

---

## 2. The Core `profiles` Table & Auth Trigger

In Supabase, user authentication identities live in `auth.users`. Application profiles are mirrored to `public.profiles`:

```sql
-- 1. Create Enum for roles
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- 2. Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Auto-profile creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    'user' -- Always default to user
  );
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 3. Automatic `updated_at` Trigger

Add an automatic timestamp updater to every table:

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to table:
CREATE TRIGGER set_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## 4. PostgreSQL Advisory Locks for Scheduled Jobs

When running Cloudflare Cron Triggers or background workers across multiple edge instances, use advisory locks to guarantee that only one worker processes the job:

```sql
CREATE OR REPLACE FUNCTION public.acquire_cron_lock(job_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  locked BOOLEAN;
BEGIN
  -- Try to acquire an advisory transaction lock using 64-bit hashtext
  SELECT pg_try_advisory_xact_lock(hashtext(job_name)) INTO locked;
  RETURN locked;
END;
$$;
```

---

## 5. Indexing Guidelines

- Always index columns used in:
  - `WHERE` clauses (e.g. `status`, `type`)
  - Foreign keys (e.g. `user_id`, `organization_id`)
  - Order by timestamps (e.g. `created_at DESC`)
- Example composite index:
  ```sql
  CREATE INDEX idx_items_user_created ON items (user_id, created_at DESC);
  ```
