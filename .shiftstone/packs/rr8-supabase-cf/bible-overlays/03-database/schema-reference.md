---
type: chapter-topic
title: "Database Schema Reference"
chapter: "03-database"
file: "schema-reference.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "PostgreSQL DDL, core entity tables, column definitions, constraints, foreign keys, and indexes."
---

# Database — Schema Reference

## Primary Data Models

All primary models in the application adhere to strict naming conventions, UUID primary keys, and timestamp audit triggers.

---

### `profiles` Table
Stores extended user profile information linked to `auth.users`.

```sql
-- 1. Create Role Enum
CREATE TYPE user_role AS ENUM ('user', 'admin');

-- 2. Create Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index for role queries
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- 4. Auto-profile creation trigger function
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
    'user'
  );
  RETURN NEW;
END;
$$;

-- 5. Attach trigger to auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### Example Application Table (`items`)
Reference pattern for application resource entities:

```sql
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_user_id ON public.items(user_id);
CREATE INDEX idx_items_created_at ON public.items(created_at DESC);

-- Automatic updated_at trigger
CREATE TRIGGER set_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

---

## Schema Modification Guidelines

1. Every table MUST have `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`.
2. Every table MUST have `created_at TIMESTAMPTZ DEFAULT NOW()` and `updated_at TIMESTAMPTZ DEFAULT NOW()`.
3. Every table MUST enable Row-Level Security:
   ```sql
   ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
   ```
4. Regenerate TypeScript types after any migration: `pnpm --filter @<project>/web supabase:types`.
