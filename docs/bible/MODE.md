---
type: document
timestamp: 2026-10-12T03:30:00.000Z
---

# Engagement Mode Declaration (B10)

This file declares **which engagement mode each environment/branch permits**.
It is read by the static rule in `.shiftstone/static-rules/global.md` (task routing
table) before acting. Mode is a project-wide boundary — the Two-Gear boundary
only governs task granularity.

## The three modes

| Mode | Meaning | Agent boundary |
|---|---|---|
| `vibe` | Exploratory — human drives, agent reacts | Suggest and discuss only; no commits, no spec/loop changes, no writes outside a scratch area |
| `structured` | Plan-first — the default | Work only from an approved plan/spec; human gates and `/verify` apply; no autonomous pushes |
| `agentic` | Autonomous execution within the harness | Loops may run within brakes, terminal states and human gates; unattended triggers additionally require the A7 sandbox (`network` isolation + scoped credentials) |

## Declarations

| Environment / Branch | Mode | Notes |
|---|---|---|
| `main` | `structured` | Nothing lands without the `/ss-verify` outer gate |
| Feature branches / worktrees | `agentic` | Loop-driven work; still inside brakes + gates |
| `docs/`, research spikes | `vibe` | Exploratory; no code paths touched |
| Production deploys, migrations | `structured` | `/ss-deploy`, `/ss-new-migration` outer gate mandatory |
| Scheduled / unattended triggers | `agentic` | Requires `execution.isolation` sandbox (A7) or the runner refuses |

**Fallback:** an environment or branch not listed here is `structured`.

**Changing a mode** is an architecture change: edit this table via a reviewed
plan (bible SSOT rules apply) — never flip a mode ad hoc inside a session.
