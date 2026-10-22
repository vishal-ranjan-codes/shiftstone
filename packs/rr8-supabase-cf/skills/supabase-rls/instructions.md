
# Supabase Row Level Security (RLS) Skill

> Load this skill when writing SQL migrations, creating new tables, defining security policies, or debugging permission errors.

---

## 1. Absolute Rule: Always Enable RLS

Every public schema table created in PostgreSQL MUST have RLS enabled immediately:

```sql
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
```

---

## 2. Standard Policy Patterns

### Pattern A: User Ownership (Single Tenant / Personal Data)
```sql
-- Select own data
CREATE POLICY "Users can view own items"
ON items FOR SELECT
USING (auth.uid() = user_id);

-- Insert own data (enforce user_id equals current user)
CREATE POLICY "Users can insert own items"
ON items FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Update own data
CREATE POLICY "Users can update own items"
ON items FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete own data
CREATE POLICY "Users can delete own items"
ON items FOR DELETE
USING (auth.uid() = user_id);
```

### Pattern B: Role-Based Admin Access
Avoid querying `profiles` table directly inside the policy if it causes infinite recursion. Use a `SECURITY DEFINER` helper function:

```sql
-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Policy utilizing the function
CREATE POLICY "Admins can view all items"
ON items FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can update all items"
ON items FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());
```

### Pattern C: Public Read / Authenticated Write (e.g. Blog, Catalog)
```sql
CREATE POLICY "Public can view published items"
ON posts FOR SELECT
USING (published = true OR auth.uid() = author_id);

CREATE POLICY "Authors can insert posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = author_id);
```

---

## 3. Avoiding Infinite Recursion in `profiles` RLS

When querying the `profiles` table itself, policies MUST NOT join `profiles` recursively:

```sql
-- 1. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Users can read own profile
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- 3. Users can update own profile
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Admins can read all profiles via SECURITY DEFINER function
CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT
USING (public.is_admin());
```

---

## 4. Best Practices & Rules

- **ALWAYS combine `USING` and `WITH CHECK` on `UPDATE`**: `USING` determines which existing rows can be updated, while `WITH CHECK` ensures the row after modification still complies.
- **Index Foreign Keys**: Always add an index on columns used in RLS policies (e.g. `CREATE INDEX idx_items_user_id ON items(user_id);`). Unindexed policy columns cause severe query performance degradation.
- **Do Not Rely on Client Side**: Never trust `user_id` sent in request bodies; enforce `auth.uid() = user_id` at the database level.
