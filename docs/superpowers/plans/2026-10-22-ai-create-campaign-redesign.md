# AI Create Campaign Flow Redesign & Engine Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AI Create Campaign experience with live email generation on every user input, lean principle-driven AI phase interviewing with fresh per-phase context, structured Campaign Brief extraction, and streamlined two-pane UI.

**Architecture:** 
- The single source of truth is a structured `CampaignBrief` object attached to `CampaignDraft.brief`.
- Each phase defines an objective, required facts for completion, and nice-to-haves in `phase-definitions.ts`.
- AI turns run with a fresh conversation context seeded only with the `CampaignBrief` and the current phase's messages (no previous phase raw transcripts). The AI extracts facts, evaluates phase completion, and asks lean, conversational follow-ups (business context & pain points first).
- Every brief update triggers live email generation with versioning to discard stale generations, and the UI provides a seamless preview without flashes or layout shifts.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, Express, Prisma, Google Gemini (`@google/genai`), Vitest.

## Global Constraints
- Keep right-panel email preview size, layout, and visual styling intact.
- Right panel starts blank: no placeholder copy, no strategy inputs assembled list, no thought starters.
- Left panel: remove top info box, keep bottom input console; phase bar shows only the current phase; remove "Phase X of 8" inside chat messages.
- First user turn ("I want to get more clients using cold outreach") produces an instant complete draft email, and the AI's follow-up focuses on business context, clients, and pain points (never jumping to CTA).
- Multi-tenant safe: all reads, writes, and AI actions are scoped by `workspaceId`.

---

### Task 1: Campaign Brief & Phase Definition Architecture

**Files:**
- Create: `api/services/email-marketing/campaign-brief.types.ts`
- Create: `api/services/email-marketing/phase-definitions.ts`
- Test: `api/services/email-marketing/__tests__/phase-definitions.test.ts`

**Interfaces:**
- Produces: `CampaignBrief`, `PhaseDefinition`, `PHASE_DEFINITIONS`, `getPhaseDefinition(phaseId)`

- [ ] **Step 1: Write unit tests for phase definitions and brief schema**
  Define tests covering the 8 phases, their objectives, required vs nice-to-have items, and initial brief generation from business profile.
- [ ] **Step 2: Run tests to ensure they fail**
  Verify module imports fail before files are created.
- [ ] **Step 3: Implement `campaign-brief.types.ts` and `phase-definitions.ts`**
  Implement comprehensive types for `CampaignBrief` (including `liveEmail`, `businessContext`, `customerProfile`, `painPoints`, `offer`, `goal`, `audience`, `cta`, `tone`, etc.) and the lean 8-phase configuration where Phase 1 enforces business context, customer profile, and pain points before downstream actions.
- [ ] **Step 4: Run tests and verify they pass**

---

### Task 2: Live Email Generator Service (Cold Outreach & Live Updates)

**Files:**
- Create/Update: `api/services/email-marketing/live-email-generator.service.ts`
- Test: `api/services/email-marketing/__tests__/live-email-generator.test.ts`

**Interfaces:**
- Consumes: `CampaignBrief`, `BusinessProfile`
- Produces: `generateLiveEmail(brief, profile, version)` -> `{ subject, previewText, bodyText, bodyHtml, version }`

- [ ] **Step 1: Write unit tests for live email generation**
  Test cold outreach generation with sparse input (e.g. only "get more clients using cold outreach"), verifying it produces a complete, natural email with pain-point-grounded opening, single CTA, compliance footer, and version stamping.
  Test fallback behavior when external AI client is mocked.
- [ ] **Step 2: Run tests to ensure failure**
- [ ] **Step 3: Implement `live-email-generator.service.ts`**
  Implement the live email generation pipeline with cold outreach heuristics:
  - Subject lines that are concise and non-spammy.
  - Opening line focused on recipient's pain point/situation rather than self-introduction.
  - Single CTA matching the brief or default sensible low-friction action.
  - Merge tags (`{{firstName}}` / `Hi Alex`) with graceful fallbacks.
  - Clean HTML layout with physical address and unsubscribe footer.
- [ ] **Step 4: Run tests and verify they pass**

---

### Task 3: AI Interview Engine Rebuild (Extraction, Fresh Context, Business Context First)

**Files:**
- Modify: `api/services/email-marketing/interview.service.ts`
- Test: `api/services/email-marketing/__tests__/interview-rebuild.test.ts`

**Interfaces:**
- Consumes: `PhaseDefinition`, `CampaignBrief`, `generateLiveEmail`
- Produces: Updated `runTurn` and `createDraft` that manage `brief`, per-phase message context, and live email updates.

- [ ] **Step 1: Write unit tests for the rebuilt interview flow**
  Test:
  1. Initial turn with "I want to get more clients using cold outreach" -> AI extracts goal & flags cold outreach, generates live draft email, and responds with question about business & client pain points (NOT CTA).
  2. Fact extraction populates `brief` fields across turns.
  3. AI does not re-ask facts already in the brief.
  4. Fresh conversation context per phase (only current phase messages passed to LLM).
  5. AI signals phase completion when required criteria are met.
  6. Stale live email generation discarded if version is older than latest brief.
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement engine rebuild in `interview.service.ts`**
  - Update `createDraft` to initialize empty `CampaignBrief` with profile snapshot facts.
  - Update prompt builder to use lean, principle-based system prompts seeded with `CampaignBrief` and current phase's objective & completion criteria.
  - Implement extraction step that extracts facts into `brief` and updates `briefVersion`.
  - Trigger live email generator on brief update and attach `liveEmail` to `draft.brief`.
  - Remove "Phase X of 8" prefix from AI chat messages.
- [ ] **Step 4: Run tests and verify all pass**

---

### Task 4: API Routes & Versioned Live Email Endpoint

**Files:**
- Modify: `api/routes/create-with-ai.routes.ts`
- Modify: `src/lib/createWithAiApi.ts`
- Test: `api/routes/__tests__/create-with-ai-live.test.ts`

**Interfaces:**
- Exposes: `liveEmail` in `CampaignDraft` responses and `POST /drafts/:draftId/live-email` for manual/debounced refinement.

- [ ] **Step 1: Write integration tests for API routes**
- [ ] **Step 2: Update `create-with-ai.routes.ts` & `createWithAiApi.ts`**
  Ensure draft serialization carries `brief.liveEmail` and client types reflect `CampaignBrief` and live email state.
- [ ] **Step 3: Verify tests pass**

---

### Task 5: UI Redesign - Live Email Canvas (Right Panel)

**Files:**
- Modify: `src/components/email-marketing/LiveEmailCanvas.tsx`
- Test: `src/components/email-marketing/__tests__/LiveEmailCanvas.test.tsx`

**Interfaces:**
- Consumes: `draft.brief.liveEmail`, `profile`

- [ ] **Step 1: Write component tests for `LiveEmailCanvas`**
  - When draft has no user inputs yet: renders clean blank email preview frame (From, To, empty Subject, blank white sheet).
  - Asserts that placeholder text ("The email copy will be generated once campaign strategy is confirmed") is NOT present.
  - Asserts that strategy inputs matrix is NOT present.
  - When live email exists in brief: renders subject, preview, and HTML/text body.
  - Tests smooth loading indicator during regeneration without layout shift.
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement UI updates in `LiveEmailCanvas.tsx`**
  Remove strategy checklist and placeholder banner. Render blank email canvas initially and live email copy once generated, with subtle header loading badge during regeneration.
- [ ] **Step 4: Verify tests pass**

---

### Task 6: UI Redesign - Interview Chat & Phase Bar (Left Panel)

**Files:**
- Modify: `src/components/email-marketing/InterviewChat.tsx`
- Modify: `src/components/email-marketing/InterviewFlow.tsx`
- Test: `src/components/email-marketing/__tests__/InterviewChat.test.tsx`

**Interfaces:**
- Top phase bar shows only the current phase (e.g. "Phase 1: Goal") with progress indicator.
- Chat stream has no "Phase X of 8" prefix text.
- Top info box removed; bottom console remains.
- Suggested thought starters removed.

- [ ] **Step 1: Write component tests for `InterviewChat` and phase bar**
  - Verify top info box is not rendered.
  - Verify thought starters are not rendered.
  - Verify chat messages do not include "Phase X of 8".
  - Verify top phase bar displays only the current phase.
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Update `InterviewChat.tsx` and `InterviewFlow.tsx`**
  Implement the updated layout, single-phase top bar, and clean chat rendering.
- [ ] **Step 4: Verify tests pass**

---

### Task 7: Full System Verification & Regression Testing

**Files:**
- All changed files

- [ ] **Step 1: Run complete unit test suite** (`npm test`)
- [ ] **Step 2: Run TypeScript typecheck** (`npm run typecheck`)
- [ ] **Step 3: Run ESLint** (`npm run lint`)
- [ ] **Step 4: End-to-End manual/automated verification**
  Verify the exact flow: Start campaign -> Right panel is clean blank email -> Type "I want to get more clients using cold outreach" -> Live email appears immediately in right panel -> AI asks about business context/pain points -> Next answer updates live email smoothly.
