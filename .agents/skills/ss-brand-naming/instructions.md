# ss-brand-naming — Procedural Brand Creation & Collision Filter Guide

Step-by-step instructions for executing the David Placek brand-naming pipeline.

---

## Iron Law

1. **Mandatory Live Search Collision Checks:** NEVER suggest or present any brand candidate to a user without conducting an explicit live web search collision check using `search_web`.
2. **Physical Disk Output Only:** All persistent naming briefs live in `docs/research/naming/` or return in-memory to `/ss-init`. Never write candidate profiles or recommendations to temporary IDE brain artifacts.
3. **Typology Enforcement:** NEVER recommend generic functional or descriptive compound names (e.g., `FastCode`, `DocManager`) as primary recommendations; every candidate must belong to one of Placek's 3 strategic typologies: Coined, Metaphorical, or Compound Multiplier.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Countermeasure |
|---|---|
| *"It sounds unique, so I don't need to search the web for collisions."* | **Forbidden.** Many clean-sounding coined words already belong to active VC startups or npm packages. Live `search_web` is mandatory. |
| *"The user asked for a simple descriptive name like QuickCRM."* | **The Descriptive Trap.** Descriptive names blend into category noise and destroy trademark viability. Offer at least 3 metaphorical or coined alternatives. |
| *"Everyone likes this name immediately; it's safe."* | **The Consensus Warning.** Unanimous early agreement signals a bland, inoffensive name. Encourage the user to evaluate polarized, high-memorability candidates. |
| *"I'll check domain availability using internal model knowledge."* | **Forbidden.** Training weights are frozen. Domain screening requires live DNS/RDAP verification or explicit search. |

---

## Procedural Workflow (Identify, Invent, Implement)

### Phase 1: Identify (Context & Strategy)
1. Gather core inputs (either from `/ss-init` Gates 1–4 or interactive query):
   - Problem space, target audience, and primary emotional transformation.
   - Competitor naming landscape (to establish category patterns to break away from).
2. Ask the user via `ask_question`: "Do you require domain registration availability checks (.com, .dev, .ai)?"

### Phase 2: Invent (Phonosemantics & 3 Typologies)
1. Consult [resources/sound-symbolism.md](./resources/sound-symbolism.md) to select appropriate consonant acoustics:
   - Plosives (`B`, `P`, `D`, `T`, `K`) for power, speed, infrastructure.
   - Fricatives (`V`, `F`, `S`, `Z`) for agility, elegance, swift transformation.
2. Draft candidates across all 3 archetypes in [resources/naming-archetypes.md](./resources/naming-archetypes.md):
   - **Coined / Neologisms** (e.g. *Vercel*, *Sonos*)
   - **Metaphorical / Arbitrary** (e.g. *Azure*, *BlackBerry*)
   - **Compound Multipliers** (e.g. *Windsurf*)

### Phase 3: Implement (Collision Filtering & Presentation)
1. Execute web search collision checks for top candidates per [resources/domain-screening.md](./resources/domain-screening.md). Drop any name with conflicting trademark/product footprint.
2. If domain checks enabled: verify `.com` / `.dev` / `.ai` status.
3. Stress-test shortlisted candidates against [resources/evaluation-rubric.md](./resources/evaluation-rubric.md).
4. Present 4–6 vetted, collision-free candidates to user using `ask_question`, categorizing by typology with linguistic rationales.

---

## Verification Ladder

- **L1 (Deterministic Syntax):** Frontmatter valid, `SKILL.md ≤ 180 lines`, `instructions.md ≤ 450 lines`, zero broken links.
- **L2 (Evidence Verification):** Live web search receipts recorded for all presented candidates.
- **L3 (Typology Compliance):** Candidates span Coined, Metaphorical, and Compound categories.
- **L4 (Checker Review):** Disjoint review confirming absence of descriptive clichés.
- **L5 (User Selection):** User confirms final selected brand name.

---

## Terminal States

- `success`: User selects a confirmed, collision-free brand name.
- `no_op`: User confirms an existing brand name without requesting suggestions.
- `blocked`: Tool unavailability prevents verified web search collision checks.
- `stalled`: User rejects $\ge 3$ candidate batches; requires manual stakeholder intervention.
