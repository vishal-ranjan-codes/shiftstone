# ss-init — 5-Gate Socratic Interview Rubric & Protocol

Structured interview rubric for eliciting product requirements, entity models, and architectural boundaries in plain English.

---

## 3-Tier Conversational Support Protocol

To make initialization empowering for both non-technical founders and seasoned engineers, every discovery step implements the 3-Tier Support Protocol:

1. **Layer 1 (Everyday Default):** Frame all prompts in conversational, non-technical English using universal analogies (e.g., explaining database entities like items saved in a personal locker).
2. **Layer 2 ("Explain Simply" Cue):** Every technical discovery prompt includes the standard guidance:
   > *(If you're not sure, reply with **"explain simply"** to hear everyday examples, or **"you decide"** and I'll recommend the industry standard for your product type!)*
3. **Layer 3 ("Decide For Me" Auto-Pilot Mode):** When a user responds with *"you decide"*, *"what do you recommend?"*, or *"I don't know"*, analyze the product archetype, present 3 clear industry-standard recommendations, and ask for a simple confirmation.

---

## Universal Tri-Archetype Catalog

Use these three diverse archetypes for analogies and illustrative examples across all prompts:

1. **Local Consumer Marketplace:** e.g., booking local tutors or fitness trainers with public listings, appointment scheduling, and review ratings.
2. **B2B Team SaaS:** e.g., team task management, client invoice approval, and multi-user workspace permissions.
3. **AI-Native Developer Tool:** e.g., automated audio meeting summarizer with webhook alerts, API key management, and developer documentation.

---

## Rules of Engagement

- **Conversational Open Intake:** Gate 1 uses open, friendly plain text. Strictly avoid restricting users to rigid multiple-choice buttons via `ask_question`. Explicitly welcome pasting pre-existing PRD drafts from any AI tool or document.
- **Adaptive Gate Resolution:** If a pasted plan or detailed answer resolves downstream topics ($\ge 80\%$ confidence), acknowledge the extracted information and auto-skip that gate.
- **One Question Per Turn:** Always ask one focused question at a time.
- **Turn-by-Turn Checkpointing:** After every user response, call `saveCheckpoint(root, { current_step, context_data })` to write `.workspace-init-state.json`.
- **Resumption Gate:** Check `hasActiveSession(root)` before starting; offer 1-click continuation if an interrupted session is detected.
- **Thinking Partner:** Challenge fuzzy requirements, surface edge cases, and define non-goals early without intimidating technical jargon.

---

## Gate 0: Resumption Gate & Checkpoint Detection

- **Check:** `hasActiveSession(root)` from `.shiftstone/init/session-state.js`.
- **If Active:**
  - Render real-time progress card (`renderProgressCard(state)`).
  - Present continuation modal (`(Recommended) Resume from where I left off`, `Review & modify previously completed answers`, `Discard checkpoint and restart initialization from scratch`).
  - If Resume: retain `context_data` and resume at the first incomplete gate.
  - If Discard: `purgeState(root)` and start at Gate 1.

---

## The 5 Gates

### Gate 1: What You're Building & Why It Matters
- **Opening Greeting:**
  > "Welcome to ShiftStone! Tell me about what you're dreaming of building. What kind of app or website is it, who is it for, and what problem does it solve for them?
  > 
  > 💡 **Have an existing plan?** If you already drafted a PRD or brainstormed with ChatGPT, Claude, Gemini, or have notes from a developer, feel free to paste the entire plan here! I will extract everything you've already decided and skip any questions that are already answered."
- **Elicitation:**
  - Product Vision: What does the product do?
  - Target Audience: Who are the primary people using it?
  - Core Workflow: What is the main action they take inside the app?
- **Checkpoint:** Save Gate 1 response and extracted `trait_matrix` to `context_data`.

### Gate 2: Who Uses Your App & Their Permissions
- **Prompt:**
  > "Who will be using your app, and what should different people be allowed to see or do?
  > 
  > *(If you're not sure, reply with **"explain simply"** to hear everyday examples, or **"you decide"** and I'll recommend the industry standard for your product type!)*"
- **Analogy:** Like a hotel where guests have room keys, staff have master keys, and managers have access to the accounting office.
- **Elicitation:**
  - User Types: Regular members, account owners, team admins, or guest visitors.
  - Organization Model: Personal individual accounts vs company/team workspaces.
- **Auto-Pilot ("Decide For Me"):** Recommend standard 3-tier structure (Admin, Member, Viewer).
- **Checkpoint:** Save Gate 2 response to `context_data`.

### Gate 3: Key Information Your App Stores & Critical Rules
- **Prompt:**
  > "What are the primary things or records your application needs to store, and are there any unbreakable rules for them?
  > 
  > *(If you're not sure, reply with **"explain simply"** to hear everyday examples, or **"you decide"** and I'll recommend the industry standard for your product type!)*"
- **Analogy:** Like items saved in labelled cubbies (e.g., Users, Bookings, Invoices) and house rules (e.g., "a paid invoice cannot be deleted").
- **Elicitation:**
  - Core Records: The 3–5 main entities the application tracks.
  - Unbreakable Rules: Invariants that ensure data integrity.
- **Auto-Pilot ("Decide For Me"):** Propose standard entities mapped to the product archetype with sensible lifecycle rules.
- **Checkpoint:** Save Gate 3 response to `context_data`.

### Gate 4: Privacy, Security & Data Protection
- **Prompt:**
  > "How should customer data be protected, and do you have any specific privacy or compliance standards to meet?
  > 
  > *(If you're not sure, reply with **"explain simply"** to hear everyday examples, or **"you decide"** and I'll recommend the industry standard for your product type!)*"
- **Analogy:** Making sure Customer A can never accidentally peek into Customer B's files, even if they share the same underlying system.
- **Elicitation:**
  - Data Isolation: Row-level security separating organizations or accounts.
  - Privacy / Regulatory: GDPR data export/deletion, audit logging for sensitive actions.
- **Auto-Pilot ("Decide For Me"):** Recommend strict tenant isolation via PostgreSQL RLS with standard GDPR deletion hooks.
- **Checkpoint:** Save Gate 4 response to `context_data`.

### Gate 4.5: Brand Naming Hook
- **Prompt:** "Have you decided on a project name, or would you like to explore category-defining brand name candidates?"
- **Branch:**
  - User has name $\rightarrow$ Lock name and advance to Gate 5.
  - User undecided $\rightarrow$ Dispatch `/ss-brand-naming` to present 4–6 Placek-vetted candidates with live collision checks.
- **Checkpoint:** Save Brand name to `context_data`.

### Gate 5: Tech Stack & Third-Party Services Confirmation
- **Prompt:** "Confirming technical foundations: Stack Archetype, Package Manager, and Third-Party Integrations (payments, email, AI)?"
- **Elicitation:**
  - Archetype confirmation (e.g. configured flagship pack).
  - Third-party integrations (Stripe, Resend, Supabase, Cloudflare Workers).
- **Checkpoint:** Save stack choices to `context_data`.
