<USER_REQUEST>
# Stone AIO — Email Marketing Build Spec

**Purpose:** Hand this to the AI coding agent (Antigravity Studio / Hermes / Claude Code) building Stone AIO. It defines what to build, in what order, and how it must connect to what already exists. Work phase by phase — do not start Phase 2 until Phase 1 passes verification.

---

## 0. Ground Rules (apply to every phase)

1. **Read before writing.** This spec was written from a point-in-time review of the codebase. Before touching any file listed below, open it and confirm current state — do not assume this spec's description is still 100% accurate.
2. **Tenant isolation is non-negotiable.** Every query and route must scope by `workspaceId` pulled from the authenticated request context. `workspaceId` is **never** accepted from the client payload. This pattern is already established in `api/services/email-marketing/audience.service.ts` — follow it exactly in every new service.
3. **License discipline.** MIT / Apache-2.0 / BSD only. Do not add Listmonk, Typebot, Directus, n8n, Postiz, Shepherd.js, or any other AGPL/FSL/BSL-licensed package. If a new dependency is needed, state its license in the PR/commit description before installing it.
4. **Build on existing services, don't duplicate them.** The backend already has working logic for A/B evaluation, segment filtering, deliverability throttling, MJML compilation, and AI-grounded copy generation. Extend these files; don't write parallel versions:
   - `api/services/email-marketing/campaigns.service.ts`
   - `api/services/email-marketing/audience.service.ts`
   - `api/services/email-marketing/deliverability.service.ts`
   - `api/services/email-marketing/mjml-compiler.service.ts`
   - `api/services/email-marketing/sequence-scheduler.service.ts`
   - `api/services/email-marketing/ai-copilot.service.ts`
   - `api/services/email-marketing/email-send-worker.service.ts`
5. **Verification gate.** Every phase must pass `tsc`, `eslint`, and `vitest` before being reported complete. No task is "done" on the agent's self-report alone — the pre-commit hooks are the source of truth.
6. **Do not touch, this build:**
   - Conversations/Inbox visual design (finalized separately, functional spec only elsewhere)
   - Voice/SDR / Autonomous SDR pages (out of product scope)
   - Opportunities/pipeline module (separate parallel workstream)
7. **ESP is Resend** (`api/webhooks/resend-webhook.handler.ts` already handles bounce/complaint webhooks). All new sending-domain and deliverability work extends Resend's API — do not introduce a second ESP.

---

## 1. Current State (orientation, not spec)

So the agent doesn't rebuild what already exists:

| Area | Status | Key files |
|---|---|---|
| Lists, segments, suppression, CSV import/export | Built, working | `audience.service.ts` |
| Campaigns: broadcast + drip, A/B test w/ auto-rollout | Built, working | `campaigns.service.ts`, `CampaignBuilder.tsx` |
| Automations: visual canvas, 11 step types | Built, working | `AutomationCanvas.tsx` (uses `@xyflow/react`) |
| AI Copilot: 8-question intake grounded in account history | Built, working | `ai-copilot.service.ts`, `AICampaignCopilotModal.tsx` |
| Deliverability: domain throttling, jitter, send windows | Built, working (backend only, no UI) | `deliverability.service.ts` |
| Block → MJML → HTML render engine (9 block types) | Built, working, **not wired to any UI** | `mjml-compiler.service.ts` |
| Template/campaign editor | Raw HTML textarea only — **no visual builder** | `TemplatesList.tsx`, `CampaignBuilder.tsx` |
| Sending domain / DKIM | **Does not exist** — all mail sends from one shared configuration | — |
| Analytics | Open rate + click rate + A/B comparison only | `CampaignAnalytics.tsx` |

Relevant Prisma models already in `prisma/schema.prisma`: `EmailList`, `ContactListMembership`, `Segment`, `EmailTemplate`, `Campaign`, `CampaignRecipient`, `Automation`, `AutomationEnrollment`, `EmailEvent`, `SuppressionEntry`.

---

## PHASE 1 — Foundation (blocks everything else; build this first)

### 1A. Visual drag-and-drop email builder

**Problem:** The backend already compiles a structured block format (`TEXT`, `IMAGE`, `BUTTON`, `DIVIDER`, `SPACER`, `COLUMNS`, `SOCIAL_LINKS`, `HEADER_LOGO`, `FOOTER_UNSUBSCRIBE`) to responsive HTML via `mjml-compiler.service.ts`. Nothing on the frontend produces that structure visually — users hand-type HTML today.

**Approach:**
- Use **GrapesJS + `grapesjs-preset-newsletter`** (BSD-3-Clause) — this is already on the vetted open-source list. It's purpose-built for email/newsletter drag-and-drop editing.
- Do **not** let GrapesJS's own export format become the source of truth. Build a thin adapter layer that maps GrapesJS's component tree to the existing `EmailBlock[]` / `BlockJson` shape defined in `mjml-compiler.service.ts`, so that service remains the single, already-tested compiler for final send-time HTML. GrapesJS becomes an authoring surface, not a new rendering pipeline.
- Replace the raw `<textarea>` in `TemplatesList.tsx` and the body editor in `CampaignBuilder.tsx` with the GrapesJS canvas. Keep a "Code" tab alongside it (view/edit the compiled HTML directly) as the manual-control escape hatch — this satisfies the "manual way of doing things" requirement, not just the AI/visual one.
- Merge-tag insertion (`{{contact.first_name | fallback:"there"}}`) must work as a draggable/insertable token inside GrapesJS's text components, using the syntax already defined in `resolveMergeTags()`.

**New/changed files:**
- `src/components/email-marketing/EmailBuilderCanvas.tsx` — GrapesJS wrapper component
- `src/lib/grapesjsToBlockJson.ts` — adapter: GrapesJS tree → `BlockJson`
- `src/lib/blockJsonToGrapesjs.ts` — adapter: `BlockJson` → GrapesJS tree (for loading existing templates/campaigns back into the editor)
- Update `TemplatesList.tsx` and `CampaignBuilder.tsx` to mount the new canvas instead of the textarea

**Definition of done:** A user can drag blocks onto a canvas, edit text/images/buttons inline, switch to a code view and hand-edit the resulting HTML, save, and the saved `blockJson` compiles correctly through the existing `mjml-compiler.service.ts` with merge tags resolving at send time.

### 1B. Custom sending domain + DKIM/SPF verification

**Problem:** No per-workspace sending domain exists. Every tenant currently shares one sender identity — a real trust and deliverability liability for a multi-tenant platform.

**Approach — use Resend's native domain API** (`resend.domains.create`, `resend.domains.verify`, `resend.domains.get`):

1. New Prisma model:
```prisma
model SendingDomain {
  id             String   @id @default(uuid())
  workspaceId    String   @map("workspace_id")
  domain         String
  resendDomainId String   @map("resend_domain_id")
  status         SendingDomainStatus @default(PENDING)
  region         String?
  dnsRecords     Json     @map("dns_records") // SPF TXT, DKIM CNAME/TXT, MX — as returned by Resend
  createdAt      DateTime @default(now()) @map("created_at")
  verifiedAt     DateTime? @map("verified_at")
  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@map("sending_domains")
}

enum SendingDomainStatus {
  PENDING
  VERIFIED
  FAILED
}
```
2. New service `api/services/email-marketing/sending-domain.service.ts`: `createSendingDomain`, `getSendingDomains`, `verifySendingDomain`, `deleteSendingDomain` — all workspace-scoped, wrapping the Resend SDK calls above.
3. New routes in `api/routes/email-marketing.routes.ts`: `POST /domains`, `GET /domains`, `POST /domains/:id/verify`, `DELETE /domains/:id`.
4. Extend `resend-webhook.handler.ts` to handle Resend's `domain.updated` event and sync `SendingDomain.status`.
5. New frontend page (Email Marketing → Settings or Audience → Domains tab): shows the DNS records to add, a "Check DNS" button (calls verify), status badge (Pending / Verified / Failed).
6. `SenderConfig` in `CampaignBuilder.tsx` must let the user pick a verified domain instead of free-typing a from-address. Block sending from an unverified domain.

**Definition of done:** A workspace can add a domain, see the exact SPF/DKIM records to paste into their DNS host, verify it, and send campaigns from `name@theirdomain.com` with that domain's own reputation.

---

## PHASE 2 — Differentiation (build after Phase 1 passes verification)

### 2A. Pre-built automation flow library

- Ship JSON seed templates for: Welcome Series, Lead Follow-up/Nurture, Win-back / Re-engagement, Post-Close Nurture, Cold-Subscriber Sunset Policy.
- Each template is a pre-filled `canvasJson` + `triggerType` + `triggerConfig` using the 11 step types already defined in `AutomationCanvas.tsx` — fully editable after install, not locked.
- New endpoint `GET /automation-templates`, `POST /automations/from-template/:templateId`.
- Add a template gallery as the entry point on `AutomationsList.tsx`, before the blank-canvas option (don't remove blank canvas — that's the manual lane).

### 2B. SMS-in-flow

- The platform already has per-workspace Twilio SMS provisioning in the Conversations module — reuse it, don't rebuild it.
- Add `SEND_SMS` to the `AutomationStepType` enum.
- Add a new node to `AutomationCanvas.tsx` following the existing `NODE_STYLES` pattern.
- Add an execution handler in the workflow engine analogous to `communication-send-email.ts`.
- Respect SMS opt-out status in parallel to the existing email `SuppressionEntry` model — do not send SMS to a contact who has opted out, even if they're email-subscribed.

### 2C. A/B split as an automation node (not just a campaign-level feature)

- Add `SPLIT_TEST` step type: percentage-weighted branch with two outputs.
- Reuse the winner-metric/eval-window logic pattern already built for campaign A/B testing in `campaigns.service.ts`, generalized to operate on an automation branch instead of a full send.

### 2D. AI Copilot 2.0

Extend `ai-copilot.service.ts` and `AICampaignCopilotModal.tsx` — do not build a second AI system:
- In-editor actions: rewrite selected block's copy, generate 3 subject-line variants, one-click auto-fill of the B variant.
- Pre-send scorecard: spam-trigger word scan + subject-line strength score + a predicted open-rate **range** sourced from `getWorkspaceHistoricalPerformance()`, which already exists.
- Per-contact best-send-time suggestion, computed from existing `EmailEvent` open timestamps — no new tracking needed, just a new aggregation.
- Monthly AI digest: a Bull queue job that summarizes the past month's performance and suggests next actions, delivered through the existing in-app notification system (`useUnreadNotificationsCount`).

---

## PHASE 3 — Trust & Retention

### 3A. Deliverability health dashboard

- Surface what `deliverability.service.ts` already computes, plus rolling bounce-rate/complaint-rate aggregates from `EmailEvent`, plus `SendingDomain` status from Phase 1B, in one screen.
- No new tracking infrastructure required — this is a visualization layer on top of data already being collected.

### 3B. Revenue attribution

- Join click-tracked link events (`handleTrackClick`, already implemented) against Opportunity close data within a configurable attribution window (e.g., 30/60/90 days).
- New endpoint: campaign/automation-level revenue summary.
- This is the single hardest thing for a standalone ESP (Mailchimp, Klaviyo) to fake well — Stone AIO already owns both the email data and the deal data in one schema, so this is a join, not an integration.

---

## PHASE 4 — Depth (power-user / "endless customization" layer)

### 4A. Nested segment builder

- Extend `SegmentFilterDefinition` from a flat `rules[]` to a recursive group structure (`{ match: 'ALL'|'ANY', rules: (Rule | Group)[] }`).
- Update `evaluateSegment()` and `buildFilterCondition()` in `audience.service.ts` to recurse.
- Frontend: nested rule-group builder in `ListsAndSegments.tsx` with a live match-count preview (debounced call to the existing `/segments/:id/preview` endpoint).

### 4B. Engagement scoring

- Scheduled job scans `EmailEvent` per contact, computes an engagement tier (hot/warm/cold).
- Store as a computed field on `Contact`, exposed as both a segment filter field and an automation trigger condition.

### 4C. Dynamic / smart content blocks

- Add `SMART_CONTENT` to the `BlockType` union in `mjml-compiler.service.ts` — a block with per-segment child variants, resolved at personalization/send time using the segment evaluation already built in Phase 4A.

---

## Definition of Done (every phase)

- [ ] `tsc`, `eslint`, `vitest` all pass
- [ ] No new AGPL/FSL/BSL dependency introduced
- [ ] Every new query/route scopes by authenticated `workspaceId`; none accept it from client input
- [ ] Conversations UI, Opportunities module, and Voice/SDR pages are untouched
- [ ] Existing campaign send, A/B test, and automation execution flows still work end-to-end (manual regression pass, not just unit tests)

## How to hand this off

Give the agent one phase at a time, not the whole document at once — Phase 1 alone touches enough surface area (new Prisma model + migration, new service, new routes, a new frontend dependency, two rewritten pages) to warrant its own session and its own verification pass before Phase 2 starts. Start every phase by telling the agent to re-read the specific files listed in that phase's section, not to rely on this document's descriptions as ground truth.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-27T14:46:19-04:00.
</ADDITIONAL_METADATA>