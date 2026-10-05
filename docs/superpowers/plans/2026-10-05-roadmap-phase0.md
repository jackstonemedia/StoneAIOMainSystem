# Stone AIO — Phase 0: Safety, Scope & Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all critical multi-tenant security vulnerabilities (C1–C10), IDOR risks, and open redirects; park non-launch modules behind a clean feature toggle; canonicalize Conversations; and establish a cross-tenant isolation test suite.

**Architecture:** 
- Centralized `scopedFindOrThrow` database utility for tenant isolation.
- HMAC-signed tokens for unauthenticated public actions (unsubscribe, email clicks) with destination allow-listing.
- Role-based authorization middleware (`requireRole`) for mutating workspace endpoints.
- Global `FEATURES` configuration parking Ads, SDR, Leads, Agents, Marketplace, Assistant, Projects, and Reputation across UI, routes, crons, and background workers.
- Canonical `/conversations` routing with redirect for `/inbox`.
- Automated cross-tenant isolation test suite with multi-tenant seed fixtures.

**Tech Stack:** Node.js, Express, TypeScript, Prisma, PostgreSQL, Vitest, React, Tailwind CSS.

## Global Constraints

- Every query on tenant data must include `workspaceId` from authenticated context (`req.workspaceId`). No fallbacks to `'default'` or cross-tenant searches.
- No unauthenticated client input can dictate tenant assignment or plan upgrades.
- Parked modules must be toggleable via `FEATURES` config, not permanently deleted.
- All tasks must pass `npm run typecheck`, ESLint, and `vitest run`.
- MIT / Apache-2.0 / BSD dependencies only.

---

### Task 1: Tag Repo & Establish Parking Configuration

**Files:**
- Create: `config/features.ts`
- Create: `src/config/features.ts`
- Modify: `server.ts`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/ui/CommandPalette.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `FEATURES`: `{ ads: boolean; sdr: boolean; leads: boolean; agents: boolean; marketplace: boolean; assistant: boolean; projects: boolean; reputation: boolean; }`

- [ ] **Step 1: Create git tag `ads-parked-v1`**
- [ ] **Step 2: Create backend and frontend `features.ts` config files with parked flags set to false**
- [ ] **Step 3: Update `Sidebar.tsx` and `CommandPalette.tsx` to hide parked items when disabled**
- [ ] **Step 4: Update `server.ts` to skip parked routers, cron jobs, and workers when flags are false**
- [ ] **Step 5: Verify build & typecheck**

---

### Task 2: Eliminate Cross-Tenant Email Send & IDOR Fallbacks (C1 & C5)

**Files:**
- Modify: `api/services/email-marketing/email-send-worker.service.ts`
- Modify: `api/routes/billing.routes.ts`
- Modify: `api/routes/email-copilot.routes.ts`
- Test: `api/services/email-marketing/__tests__/email-send-worker-security.test.ts`

- [ ] **Step 1: Write test verifying that `email-send-worker` strictly fails if workspace has no active Gmail connection, never borrowing another workspace's connection**
- [ ] **Step 2: Remove lines 323–327 in `email-send-worker.service.ts` (cross-workspace fallback)**
- [ ] **Step 3: Remove all `'default'` / `'default-workspace'` fallbacks in `billing.routes.ts` and `email-copilot.routes.ts`**
- [ ] **Step 4: Run tests to ensure pass**

---

### Task 3: Secure Unsubscribe & Click Tracking with HMAC and Allow-list (C4)

**Files:**
- Create: `api/lib/crypto-tokens.ts`
- Modify: `api/services/email-marketing/email-send-worker.service.ts`
- Modify: `api/routes/email-marketing.routes.ts`
- Test: `api/lib/__tests__/crypto-tokens.test.ts`
- Test: `api/routes/__tests__/tracking-security.test.ts`

- [ ] **Step 1: Write unit tests for HMAC token generation and verification**
- [ ] **Step 2: Implement HMAC token signing & verification in `api/lib/crypto-tokens.ts` using `CHANNEL_ENCRYPTION_KEY`**
- [ ] **Step 3: Update `buildUnsubscribeUrl` in `email-send-worker.service.ts` to emit HMAC-signed tokens**
- [ ] **Step 4: Update `handleUnsubscribeGet` and `handleUnsubscribePost` to verify HMAC signature before processing unsubscribe**
- [ ] **Step 5: Add URL allow-list validation in `handleTrackClick` to prevent open redirects (only HTTP/HTTPS to known/verified domains or relative paths)**
- [ ] **Step 6: Run tests to verify token forgery and open redirect protection**

---

### Task 4: Hard-Gate Dev Plan Switcher & Enforce Webhook-Only Plan Updates (C2 & C7)

**Files:**
- Modify: `api/routes/billing.routes.ts`
- Test: `api/routes/__tests__/billing-security.test.ts`

- [ ] **Step 1: Write test verifying `/api/billing/dev-set-plan` returns 404/403 in production and requires dev authorization**
- [ ] **Step 2: Guard `/billing/dev-set-plan` so it is completely disabled in production (`NODE_ENV === 'production'`) and requires `ENABLE_DEV_BILLING_BYPASS === 'true'` in local dev**
- [ ] **Step 3: Refactor `/billing/verify-session` to retrieve the Stripe session via Stripe API directly, verify workspace ownership from metadata, and remove client-controlled plan writing**
- [ ] **Step 4: Run billing test suite**

---

### Task 5: Implement `scopedFindOrThrow` & Role Authorization (C3 & C8)

**Files:**
- Create: `api/middleware/tenant-guard.ts`
- Modify: `api/routes/crm.routes.ts`
- Modify: `api/routes/workflows.routes.ts`
- Modify: `api/routes/opportunities.routes.ts`
- Modify: `api/routes/settings.routes.ts`
- Test: `api/middleware/__tests__/tenant-guard.test.ts`

- [ ] **Step 1: Implement `scopedFindOrThrow(model, id, workspaceId)` and `requireRole(['owner', 'admin'])` middleware**
- [ ] **Step 2: Apply `requireRole` on mutating workspace settings, team member deletion, and billing routes**
- [ ] **Step 3: Replace unscoped `stageId` / pipeline stage queries and workflow cloning with `scopedFindOrThrow`**
- [ ] **Step 4: Replace open `data: req.body` spreads with explicit allow-listed properties**
- [ ] **Step 5: Run tests**

---

### Task 6: Canonicalize Conversations & Deprecate Duplicate Inbox Pages

**Files:**
- Modify: `src/App.tsx`
- Modify: `server.ts`
- Test: `src/components/__tests__/conversations-routing.test.tsx`

- [ ] **Step 1: Ensure `/inbox` redirects immediately to `/conversations`**
- [ ] **Step 2: Verify all internal navigation links point to `/conversations`**
- [ ] **Step 3: Move unused duplicate inbox folders (`src/pages/inbox`, `src/pages/business/inbox`) to `src/pages/_archived/`**
- [ ] **Step 4: Run typecheck and linting**

---

### Task 7: Multi-Tenant Cross-Workspace Isolation Test Suite

**Files:**
- Create: `api/__tests__/multi-tenant-isolation.test.ts`

- [ ] **Step 1: Create fixture creating Workspace A and Workspace B with mock contacts, deals, conversations, campaigns, and workflows**
- [ ] **Step 2: Write tests proving Workspace A cannot read Workspace B records (returns 404 or empty list)**
- [ ] **Step 3: Write tests proving Workspace A cannot update or delete Workspace B records (returns 404 or 403)**
- [ ] **Step 4: Run full vitest suite and verify all isolation assertions pass**

---

### Task 8: Verification Gate & Phase 0 Sign-Off Report

- [ ] **Step 1: Run `npm run typecheck` (`tsc --noEmit`)**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `vitest run`**
- [ ] **Step 4: Verify dev server endpoints and health check**
- [ ] **Step 5: Present Phase 0 completion report and script to user for sign-off**
