---
activation: always
---

# {{PROJECT_NAME}} — Research Rules

---

## Library-First Rule

Before recommending any technology, library, or integration approach:
1. Read `docs/research/README.md` to check if this topic has been researched.
2. If research exists and is complete → use the findings directly.
3. If research exists but is partial → supplement with targeted web searches.
4. If no research exists → proceed with web search, then save findings via the `/research` workflow.

NEVER recommend a technology based solely on model training knowledge when project-specific research exists.

---

## Topic → Research File Mapping

| Topic | Research Folder | Status |
|---|---|---|
| Folder Structure as Agentic Architecture | `docs/research/ai-tools/folder-structure-agentic-architecture/` | Complete |
| The New SDLC With Vibe Coding | `docs/research/ai-tools/new-sdlc-vibe-coding-2026/` | Complete |
| Loop Engineering | `docs/research/ai-tools/loop-engineering-2026/` | Complete |

> Update this table every time a new research document is added to `docs/research/`.

---

## How to Use Existing Research

1. Open `docs/research/README.md` — find the relevant topic row.
2. Navigate to the topic folder.
3. Read `04-CONCLUSION.md` first — this is the direct answer and recommendation.
4. Read `03-COMPARISON.md` for trade-off details if needed.
5. Read `05-IMPLEMENTATION.md` for working code patterns if available.
6. Cite the research: "Per docs/research/<topic>/04-CONCLUSION.md..."

---

## When to Consult Research

| Situation | What to Check |
|---|---|
| Choosing a library or package | `docs/research/README.md` index first |
| Planning a new integration | Relevant topic folder in `docs/research/` |
| Making an architecture decision | `DECISIONS.md` + `docs/research/` |
| Evaluating a technology trade-off | `03-COMPARISON.md` in relevant topic folder |
| Implementing a researched pattern | `05-IMPLEMENTATION.md` in relevant topic folder |

---

## Research Gap Rule

When no research exists for a topic:
1. Flag it explicitly: "No research found for [topic] in docs/research/".
2. Proceed with web search for the current task.
3. Suggest running `/research` after the current task to save findings permanently.

---

## Cross-Linking Rule

When creating new research:
- In `00-BRIEF.md`: reference any related research topics.
- In `04-CONCLUSION.md`: note if this decision supersedes or relates to an architecture decision (DEC-XXX) entry in `docs/bible/DECISIONS.md`.
- Always update `docs/research/README.md` index with the new topic row after completing research.
