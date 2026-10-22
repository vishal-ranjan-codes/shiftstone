---
type: readme
timestamp: 2026-10-17T05:40:00.000Z
---
# docs/videos/

| Field | Declaration |
|---|---|
| **Purpose** | IDE walkthroughs — one guided path per AI IDE covering `init → skills → first loop → /verify`, plus links to recorded video versions (task 7.8). |
| **When populated** | At release time (Phase 7) and whenever a new IDE shim ships; video URLs are added next to each walkthrough once recorded. |
| **File types** | Markdown walkthroughs (OKF frontmatter) + video link entries. |
| **Owner** | Framework maintainers (see `CODEOWNERS`). |
| **Lifecycle** | Created → reviewed → updated when the harness UX changes (kept honest by the link-integrity CI gate). |

## Walkthroughs

| IDE | Walkthrough | Recording |
|---|---|---|
| Google Antigravity | [antigravity-walkthrough.md](./antigravity-walkthrough.md) | _to be recorded_ |
| Claude Code | [claude-code-walkthrough.md](./claude-code-walkthrough.md) | _to be recorded_ |
| Command Code | [command-code-walkthrough.md](./command-code-walkthrough.md) | _to be recorded_ |
| OpenCode | [opencode-walkthrough.md](./opencode-walkthrough.md) | _to be recorded_ |

Every walkthrough runs the same four-beat path against the same harness; only the
entry points differ (shims, junction folders, command namespaces). If a video
link is missing, the markdown walkthrough is the canonical, versioned artifact.
