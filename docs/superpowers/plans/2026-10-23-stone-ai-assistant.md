# Stone AI Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, multi-tenant AI assistant operating Stone AIO on behalf of signed-in users with streaming, 3 access modes (Read-only, Draft, Full autonomy), memory, platform tools, and enterprise security.

**Architecture:** Browser UI -> Express routes (`/api/assistant`) -> Orchestrator loop -> AI Engine (`@google/genai` Interactions API) <-> Tool Registry (Role & Mode Gated) <-> Platform Services & PostgreSQL with FORCE RLS.

**Tech Stack:** Node.js, Express, TypeScript, React 19, Tailwind CSS, Prisma, PostgreSQL (FORCE RLS), `@google/genai` v1.52.0 (Gemini 3.8 Flash, Interactions API), BullMQ, Vitest.

## Global Constraints

- Server-only identity: `workspaceId` and `userId` come only from authenticated `req`, verified by `resolveWorkspace`.
- Zero raw HTML rendering from markdown; remote images show as plain links.
- Single data-access module (`api/services/assistant/assistant.repo.ts`) is the only code that touches assistant database tables.
- PostgreSQL row-level security with FORCE enabled on assistant tables.
- Non-existent or cross-tenant conversations return identical 404 responses, never 403.
- Short database transactions; never hold transactions open across streaming or model calls.
- Never hardcode model IDs; all models come from config (`packages/ai/client.ts` or env).
- Build in strict stages: S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8 -> S9.

---

### Stage S0: Preflight & Security Patch (Completed)
- [x] Preflight checks on `@google/genai` v1.52.0 and Interactions API.
- [x] Identify role hierarchy (`owner`, `admin`, `member`) and tenant isolation patterns.
- [x] Patch IDOR vulnerability in `api/routes/chat.routes.ts` with `scopedFindOrThrow`.
- [x] Add automated multi-tenant isolation tests for `chat.routes.ts`.
- [x] Implement non-intrusive telemetry tracker (`api/services/legacy-ai-tracker.service.ts`) for old AI routes.

---

### Stage S1: Chat Core & Multi-Tenant Isolation Gate
**Files:**
- Create: `prisma/migrations/*` (Assistant conversation, message, settings, usage tables)
- Create: `api/services/assistant/assistant.repo.ts`
- Create: `api/services/assistant/rls.ts`
- Create: `packages/ai/engine/chat-engine.ts`
- Create: `packages/ai/prompts/assistant.v1.ts`
- Create: `api/services/assistant/orchestrator.ts`
- Create: `api/routes/assistant.routes.ts`
- Create: `api/routes/__tests__/assistant-isolation.test.ts`
- Create: `src/pages/assistant/AssistantPage.tsx`
- Create: `src/components/assistant/AssistantComposer.tsx`
- Create: `src/components/assistant/AssistantThread.tsx`
- Create: `src/components/assistant/AssistantSidebar.tsx`
- Modify: `server.ts` (mount `/api/assistant` behind `FEATURES.assistant`)
- Modify: `src/constants/routes.ts` (add `/assistant/c/:conversationId` etc.)
- Modify: `src/App.tsx` (wire routes)

- [ ] Task 1.1: Prisma schema for AssistantConversation, AssistantMessage, AssistantSettings, AssistantUsage.
- [ ] Task 1.2: Assistant repository (`assistant.repo.ts`) with tenant-scoping and RLS helpers.
- [ ] Task 1.3: Gemini chat engine (`chat-engine.ts`) supporting streaming SSE events.
- [ ] Task 1.4: Orchestrator loop (`orchestrator.ts`) & base system prompt.
- [ ] Task 1.5: REST & SSE routes for `/api/assistant/conversations` and messages.
- [ ] Task 1.6: Comprehensive Cross-Tenant Isolation Suite (Hard Gate before UI).
- [ ] Task 1.7: React 19 Frontend chat interface (`/assistant` and `/assistant/c/:conversationId`).
- [ ] Task 1.8: Verification Gate: verify `tsc`, scoped `eslint`, and `vitest`.

---

### Stage S2: Access Modes & First Tools (CRM)
- [ ] Task 2.1: Implement `AssistantToolCall` audit table.
- [ ] Task 2.2: Mode gate (`api/services/assistant/modes.ts`) enforcing Read-only, Draft, Full autonomy.
- [ ] Task 2.3: Tool registry core + CRM tool handlers (contacts, deals, companies, tasks, notes).
- [ ] Task 2.4: Approval workflow for Draft proposals and Activity page (`/assistant/activity`).
- [ ] Task 2.5: Table-driven mode enforcement & injection test suites.

---

### Stage S3: Whole Platform Tool Coverage
- [ ] Task 3.1: Tool handlers for Tasks/Calendar, Inbox/Conversations, Email Marketing, SMS, Smart Lists, Automations/Workflows, Ads, Leads/SDR.
- [ ] Task 3.2: Tool area selection & routing (`enable_tool_area`).
- [ ] Task 3.3: Hard-stop actions & Workspace Settings page (`/assistant/settings`).

---

### Stage S4: Dual-Store Memory
- [ ] Task 4.1: `AssistantMemoryDoc` schema & memory repository.
- [ ] Task 4.2: Memory tools (`memory_read`, `memory_write`, `memory_delete`) with version concurrency.
- [ ] Task 4.3: Post-turn memory extraction pass on Flash-Lite.
- [ ] Task 4.4: PostgreSQL full-text search across past chats (`search_past_chats`).
- [ ] Task 4.5: Memory management UI (`/assistant/memory`).

---

### Stage S5: Web Search, Files, Data Analysis, Projects
- [ ] Task 5.1: Google Search grounding & sources event streaming.
- [ ] Task 5.2: File upload & extraction pipeline (`AssistantFile`).
- [ ] Task 5.3: Python/Code execution for data analysis on CSV/Excel.
- [ ] Task 5.4: Assistant Projects (`/assistant/projects`).
- [ ] Task 5.5: Assistant Library (`/assistant/library`).

---

### Stage S6: Advanced Modalities & Deployment
- [ ] Task 6.1: Deep research engine & background worker.
- [ ] Task 6.2: Image generation & editing tools.
- [ ] Task 6.3: Voice mode & dictation endpoint.
- [ ] Task 6.4: Scheduled task worker (`FOR UPDATE SKIP LOCKED`).
- [ ] Task 6.5: Chat export & data controls.
- [ ] Task 6.6: Polish pass & verification gate.

---

### Stages S7 - S9: Decommissioning & Cross-Platform Integration
- [ ] Stage S7: Legacy AI usage inventory & gate report.
- [ ] Stage S8: Embed `AssistantLauncher` across platform & toggle `FEATURES.legacyAi`.
- [ ] Stage S9: Remove dead legacy code after confirmation.
