# ss-brand — Full-Spectrum Branding & Design System Engine Guide

Procedural guide for formulating strategic brand positioning, verbal voice guidelines, accessible OKLCH color palettes, typography scales, design tokens, and a living interactive Brand Book.

---

## Iron Law

1. **One Question Per Turn:** Always ask one question at a time during discovery using `ask_question`. Never dump multiple brand dimensions in a single turn.
2. **Accessible Perceptual Color Science:** All color palettes MUST use the OKLCH color space with mathematical lightness contrast verification ensuring WCAG AA ($\ge 4.5:1$) compliance for body text across both light and dark modes.
3. **Living Brand Book Standard:** Generate `docs/brand/brand-book.html` as a self-contained, single-file HTML5 application with zero external runtime script dependencies (`LOCK-INIT-10`).
4. **Multi-Format Token Export:** Materialize tokens simultaneously to W3C Community Group JSON (`docs/brand/brand-tokens.json`), CSS custom properties (`docs/brand/brand-theme.css`), and strategic voice documentation (`docs/brand/brand-strategy.md`).
5. **Physical Disk Output Only:** All files are written directly to `docs/brand/` on disk. Never emit temporary ephemeral scratch files or unrooted artifacts.

---

## Red Flags & Rationalization Defense

| Excuse / Rationalization | Reality & Anti-Bypass Rule |
|---|---|
| *"I'll just pick a hex color from memory and guess the dark mode."* | **Forbidden (OKLCH Law).** OKLCH ensures uniform perceptual lightness. Guessing hex codes causes dark mode contrast failures. |
| *"The user just wants a simple logo, so I'll skip the strategy document."* | **Forbidden.** Without archetype positioning and tone-of-voice sliders, future UI copywriting and interface styling drift. |
| *"I'll host the brand book on an external CDN or web service."* | **Forbidden (DEC-010).** The Brand Book must be a portable, offline-capable single-file HTML application in `docs/brand/brand-book.html`. |
| *"I'll generate all 5 discovery gates at once to be faster."* | **Forbidden.** One question per turn is mandatory for thoughtful founder alignment. |

---

## The 4-Phase Branding Workflow

### Phase 1: Socratic Discovery Interview
Consult [resources/brand-interview-rubric.md](./resources/brand-interview-rubric.md) and execute 5 focused questions via `ask_question`:
1. **Brand Archetype:** Identify Primary (70%) and Secondary (30%) archetypes from [resources/archetype-matrix.md](./resources/archetype-matrix.md).
2. **Aesthetic Direction:** Select visual philosophy (Swiss Minimalist, Warm Editorial, Cyber-Industrial, Neo-Brutalist).
3. **Color Mood:** Calibrate brand hue, saturation, and light/dark mode preference from [resources/oklch-color-palettes.md](./resources/oklch-color-palettes.md).
4. **Typography Personality:** Select modular ratio and font family pairings from [resources/typography-pairings.md](./resources/typography-pairings.md).
5. **Tone of Voice Sliders:** Determine 4 spectrum ratings (Formal-Casual, Technical-Accessible, Concise-Narrative, Reserved-Energetic).

### Phase 2: Strategy & Verbal Identity Synthesis
Synthesize the elicited decisions into `docs/brand/brand-strategy.md`:
- **Core Value Proposition & Positioning Statement**
- **Archetype Profiles:** Primary & Secondary archetype dynamics.
- **Audience Personas:** Key motivators, anxieties, and aesthetic expectations.
- **Voice & Tone Guidelines:** Specific microcopy examples for buttons, onboarding, alerts, empty states, and error handling.

### Phase 3: OKLCH Palette & Typography Generation
Generate calibrated color and typographic scales:
- **Primary Scale:** OKLCH 50 to 950 steps for primary brand color.
- **Functional Semantics:** Success (Green), Warning (Amber), Error (Red), Info (Sky/Blue).
- **Surface & Elevation:** Neutral base, raised cards, overlays, and border tokens for light and dark modes.
- **Typography Tokens:** Modular font sizes (`xs` through `4xl`), line heights, letter spacings, and font stacks.

### Phase 4: Brand Book & Token Materialization
Materialize all brand assets directly to physical disk files:
1. `docs/brand/brand-tokens.json` (W3C standard format).
2. `docs/brand/brand-theme.css` (CSS variables with `:root` and `.dark` blocks).
3. `docs/brand/brand-book.html` (Interactive single-file application generated via `.shiftstone/init/brand-generator.js`).
4. Update session checkpoint state if running within `/ss-init`.

---

## Verification Ladder

- **L1 (Syntax):** Valid YAML frontmatter in `SKILL.md`, valid markdown syntax across all docs.
- **L2 (Token Schema):** `docs/brand/brand-tokens.json` parses as valid JSON with valid token structures.
- **L3 (Contrast Check):** All text-on-surface color pairings satisfy WCAG AA ($\ge 4.5:1$).
- **L4 (HTML Portability):** `docs/brand/brand-book.html` opens cleanly offline in any standard browser.
- **L5 (Founder Sign-Off):** Founder approves brand personality, color palette, and voice sliders.

---

## Terminal States

- `success`: Brand strategy documented, tokens materialized, and `brand-book.html` generated and verified.
- `blocked`: Contradictory aesthetic constraints requiring human clarification.
- `escalated`: Disputed brand naming or trademark conflict needing legal review.
