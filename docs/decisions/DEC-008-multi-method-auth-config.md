---
type: decision
decisionId: DEC-008
title: Multi-Method Authentication Architecture with Centralized Config
status: accepted
pack: rr8-supabase-cf
timestamp: 2026-09-06T00:00:00.000Z
---

# DEC-008 — Multi-Method Authentication Architecture with Centralized Config

## Context
Different SaaS applications require different login experiences (Email+Password, Email OTP 6-digit codes, passwordless Magic Links, or Google OAuth). Hardcoding a single method reduces template flexibility.

## Decision
Centralize auth method selection in `app/lib/auth/config.ts` (`authConfig.methods`) supporting all 4 methods. Default to Email+Password (primary) and Email OTP (secondary) with modular components (`MethodSelector`, `PasswordForm`, `EmailOtpForm`, `GoogleButton`).

## Consequences
Developers toggle auth methods via simple boolean flags without altering route logic or rewriting forms.
