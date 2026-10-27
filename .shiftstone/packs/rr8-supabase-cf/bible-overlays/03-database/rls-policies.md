---
type: chapter-topic
title: "Row-Level Security Policies"
chapter: "03-database"
file: "rls-policies.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "Row Level Security (RLS) policies per table, access matrices, and tenant isolation helper functions."
---

# Database — Row-Level Security (RLS) Policies

All tables must have Row-Level Security enabled. No exceptions.

---

## Core Security Policies

### `profiles` Table
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

---

## Policy Performance Rules

1. Wrap subqueries in `(SELECT 1 FROM ...)` so PostgreSQL caches query results across evaluated rows.
2. Ensure columns used in `USING` or `WITH CHECK` clauses (such as `user_id`, `role`, `team_id`) are properly indexed.
3. Test policies locally via `supabase test db` before deploying migrations to production.
