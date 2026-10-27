---
type: chapter-topic
title: "Role & Permission Matrix"
chapter: "04-auth-and-rbac"
file: "permissions-matrix.md"
timestamp: 2026-10-26T12:00:00.000Z
description: "User roles (user, admin), assignment triggers, capability matrices, and tenant isolation rules."
---

# Auth & RBAC — Role & Permission Matrix

## 1. User Roles & Assignment Rules

The system recognizes roles stored in `public.profiles.role`:

| Role | Access Scope | How to Assign |
|---|---|---|
| `user` | `/dashboard/*` and public routes | **Automatic** on sign-up via the `handle_new_user()` database trigger |
| `admin` | `/admin/*`, `/dashboard/*`, and public routes | **Strictly Manual** — direct database update or admin RPC only |

Public sign-up forms NEVER permit users to choose or request the `admin` role.

---

## 2. Resource Capability Matrix

| Resource / Action | Anonymous | Authenticated (`user`) | Administrator (`admin`) |
|---|:---:|:---:|:---:|
| View Landing, Pricing & Public Docs | Allow | Allow | Allow |
| Sign-in / Sign-up / Reset Password | Allow | Deny (Redirect) | Deny (Redirect) |
| Read Own Profile & Resources | Deny | Allow (`auth.uid() = user_id`) | Allow |
| Mutate Own Profile & Resources | Deny | Allow (`auth.uid() = user_id`) | Allow |
| Access `/admin/*` Routes & Dashboards | Deny | Deny (Silent 404/Redirect) | Allow |
| Manage System Users & Platform Audit Logs | Deny | Deny | Allow |
| Override Database Rows across Tenants | Deny | Deny | Allow (via Service Role RPC only) |
