---
type: chapter
timestamp: 2026-10-13T00:00:00.000Z
description: Environment variables, secrets, deployment architecture
---
# 02 — Environments and Secrets

This chapter is the SSOT for **every environment and every credential** the workspace depends on. If an agent needs a variable, it must be able to answer "does this exist, where does it live, who owns it" from this file alone.

> Stack archetype packs pre-fill this chapter via `packs/<archetype>/bible-overlays/02-setup-and-devops/` at init.

## Core Environment Variables

Table every required variable: name, purpose, scope (server-only / browser-safe), where it is set locally, and where it is set in production. Never store values — only names and locations.

## Secret Management Workflow

- **Local development**: which file the runtime reads (and which one is gitignored).
- **Production**: the exact command used to set each secret on the deployment target.
- **Rotation**: who rotates what, and how a leaked secret is revoked.

## Build & Toolchain Configuration

Record toolchain settings the workspace depends on (package manager, build-time native dependencies, workspace globs) so a fresh clone builds without guesswork.

## Deployment Architecture

Describe how each environment is built and released (preview vs production), including any repository/app split the deployment target imposes.
