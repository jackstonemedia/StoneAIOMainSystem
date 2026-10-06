# Stone AIO — Launch Roadmap v3 (Native Outreach & Paying-Customer Edition)

**Goal:** A multi-tenant product that businesses sign up for, pay for, and use successfully without hand-holding. **Email outreach and marketing is the lead product**, powered by an **internal native sending engine** via connected Google Workspace / Gmail (and Outlook) mailboxes with intelligent human pacing and multi-inbox rotation — eliminating all third-party ESP costs, 3-domain limits, and DNS friction for customers.

**Launch modules:** Dashboard · CRM (all pages) · Conversations · Calendar · Email Outreach & Marketing · Automation Workflows · Settings, Billing, Onboarding.  
**Parked:** Ad Manager, Voice/SDR, Lead Studio, Agents, Marketplace, Assistant, Projects, Reputation, Inbox Help Center (gated behind `FEATURES` flag, tagged `ads-parked-v1`).

---

## 1. Jack's Personal Action List (What & When)

Because we eliminated Resend and third-party ESPs, **your external service requirements are significantly simplified**:

### Start This Week (Long Lead Times)

| # | Task | Why Now | What to Give the Agent |
|---|---|---|---|
| **J1** | **Google Cloud OAuth Verification** for Gmail (`gmail.readonly`, `gmail.send`). | Outside paying customers cannot connect their Gmail/Google Workspace inboxes without app verification (otherwise limited to 100 test users with warning screen). | Google Cloud Project, OAuth Client ID & Secret → `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`. (The agent provides privacy policy, scope justification, and demo video script in Phase 8). |
| **J2** | **Microsoft Entra (Azure) App Registration** for Outlook. | For customers connecting Microsoft 365 / Outlook inboxes. | `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_REDIRECT_URI`. |
| **J3** | **Production Domain** (e.g. `stoneaio.com`). | Required for Clerk authentication, OAuth redirect URLs, and legal pages. | Domain name + DNS access. |
| **J4** | **Twilio Account Upgrade** (for SMS in Conversations). | Required if you want US business SMS enabled. Requires A2P 10DLC brand registration. | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`. |
| **J5** | **Physical Business Mailing Address & Support Email**. | Legally required by CAN-SPAM in every outreach email footer. | Physical address string and support email. |

### Before Phase 7 (Billing & Launch)

| # | Task | What to Give the Agent |
|---|---|---|
| **J6** | **Stripe Live Account** activated, customer portal enabled, webhook added. | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable key. |
| **J7** | **Decide Pricing Tiers**: e.g. Starter ($49/mo: 1 connected inbox, 2,500 contacts), Pro ($99/mo: 3 inboxes, 10,000 contacts), Scale ($199/mo: 10 inboxes, 50,000 contacts). | Tier names, prices, limits. |
| **J8** | **Clerk Production Keys**. | Production Publishable Key & Secret Key. |
| **J9** | **Railway Production Environment** (Postgres + Redis with backups). | Environment credentials. |
| **J10** | **Recruit 5–10 Beta Businesses** to test the "first campaign in 10 minutes" flow. | User feedback. |

---

## 2. Core Architecture: The Native Mailbox Sending Engine ("Our Own Resend")

Instead of sending through shared bulk IPs that dump emails into the "Promotions" tab or require non-technical customers to configure complex DNS records, Stone AIO acts as an **intelligent multi-inbox outreach engine** (similar to Instantly, Lemlist, and Apollo):

1. **Strict Safety Limit:** Hard cap of **40 emails / 24 hours per connected Gmail inbox** (maximum safe ceiling of 50/day).
2. **Multi-Inbox Scaling & Round-Robin:**
   - 1 connected inbox = 40 emails/day
   - 2 connected inboxes = 80 emails/day
   - 3 connected inboxes = 120 emails/day
   - Multiple inboxes connected per workspace (unique by `workspaceId + provider + email`).
   - The queue automatically distributes recipients across all active inboxes belonging to that workspace.
3. **Human Pacing & Jitter:** Enforced 90–180 second delay between each send, strictly within daytime business hours (9:00 AM – 5:00 PM).
4. **Automated Multi-Day Batching:** A campaign of 200 contacts automatically spreads across 5 days (40/day) with clear UI indicators showing daily progress and next scheduled run.
5. **Stop-on-Reply:** When a recipient replies in Gmail, Conversations detects the thread, tags it, and halts any further automated sequence steps for that contact.
6. **Automatic Unsubscribe & Suppression:** HMAC-signed unsubscribe links in the footer instantly flag contacts as `SUPPRESSED` in the database, preventing accidental re-sends across all campaigns.
7. **100% White-Labeled:** Emails send directly from `user@company.com` with real Google headers, zero StoneAIO branding, and maximum primary-inbox deliverability.

---

## 3. Detailed Phase Breakdown

### Phase 0 — Safety, Scope Parking & Multi-Tenant Foundation ✅ COMPLETE
- [x] **Fix C1–C10 Security Vulnerabilities**:
  - [x] **C1**: Remove cross-tenant Gmail & Twilio send fallbacks. Enforce strict workspace isolation—never borrow another tenant's mailbox.
  - [x] **C2**: Hard-gate `/billing/dev-set-plan` so it is completely blocked in production and requires secret bypass flag in development.
  - [x] **C3**: IDOR sweep. Built `scopedFindOrThrow(model, id, workspaceId)` and whitelisted input fields instead of spreading raw `data: req.body`.
  - [x] **C4**: HMAC-sign unsubscribe links and open/click tracking tokens using `CHANNEL_ENCRYPTION_KEY`. Allow-list redirect targets to eliminate open redirect risks.
  - [x] **C5**: Removed all `'default'` and `'default-workspace'` fallbacks across routes.
  - [x] **C6 & C7**: Stripe webhook is the authoritative writer of workspace plans; verify sessions server-side.
  - [x] **C8**: Added `requireRole(['owner', 'admin'])` middleware to mutating workspace and billing routes.
  - [x] **C9 & C10**: Production environment checks and clean config.
- [x] **Park Non-Launch Scope**:
  - [x] Park `Ads`, `SDR`, `Leads`, `Agents`, `Marketplace`, `Assistant`, `Projects`, `Reputation`, and `InboxHelpCenter` behind `FEATURES` config.
  - [x] Remove from Sidebar, AppShell, CommandPalette, server mounts, crons, and background workers.
  - [x] Tag repo `ads-parked-v1`.
- [x] **Canonicalize Conversations**:
  - [x] Pick `/conversations` as canonical; redirect `/inbox` to `/conversations`.
  - [x] Safely archive duplicate inbox implementations (`src/pages/_archived/inbox`, `src/pages/_archived/business-inbox`).
- [x] **Multi-Tenant Isolation Test Suite**:
  - [x] Automated tests proving Workspace A cannot read, update, or delete Workspace B records across contacts, deals, conversations, campaigns, or mailboxes (117 tests passing).

---

### Phase 1 — Native Mailbox Outreach Engine Architecture (CURRENT PHASE)
- 🤖 **1.1 Multi-Inbox Schema & Connection Scaling**:
  - Update `ChannelConnection`:
    - Drop restrictive `[workspaceId, userId, provider]` unique constraint; replace with `[workspaceId, provider, email]` to allow connecting multiple mailboxes per workspace.
    - Add quota & health tracking fields: `dailySendLimit` (default 40, max 50), `sentTodayCount` (default 0), `lastSentAt`, `lastResetAt`, `status` (`ACTIVE`, `WARMUP`, `PAUSED`, `DISCONNECTED`, `ERROR`), `consecutiveBounces` (default 0), `minDelaySeconds` (default 90), `maxDelaySeconds` (default 180).
  - Update `Campaign` & `CampaignRecipient`:
    - Add `channelConnectionId` to `CampaignRecipient` for per-send mailbox attribution.
    - Add `scheduledForDate` to `CampaignRecipient` for multi-day drip progression.
    - Add `multiDayProgress` JSON, `sendingWindowStart`, `sendingWindowEnd`, `sendingTimezone` to `Campaign`.
- 🤖 **1.2 Mailbox Pool & Round-Robin Distribution Service**:
  - Create `api/services/email-marketing/mailbox-pool.service.ts`:
    - Query active, healthy mailboxes for workspace with available quota (`sentTodayCount < dailySendLimit`).
    - Round-robin mailbox selector distributing queued sends evenly across inboxes.
    - Atomic send increment and bounce/error tracking with auto-pause on 3 consecutive bounces.
- 🤖 **1.3 Jitter Pacing & Multi-Day Campaign Scheduler**:
  - Create `api/services/email-marketing/outreach-scheduler.service.ts`:
    - Human jitter delay generator (90–180 seconds between sends).
    - Business hours validation (e.g. 9:00 AM – 5:00 PM local time).
    - Multi-day campaign planner: given $N$ recipients and total daily capacity $C$, partitions recipients across $\lceil N / C \rceil$ days and schedules execution.
- 🤖 **1.4 Stop-on-Reply Automation Engine**:
  - Create `api/services/email-marketing/stop-on-reply.service.ts`:
    - Wire into `gmail-poller.ts` inbound message ingestion.
    - When a recipient replies, immediately set `contact.repliedAt`, cancel all pending drip sequence steps and campaign recipient records for that contact, emit `EmailEvent: REPLIED`, and tag the conversation.
- 🤖 **1.5 Daily Quota Reset Worker**:
  - Scheduled midnight UTC cron resetting `sentTodayCount = 0` for all active channels and waking multi-day queued campaigns.
- 🤖 **1.6 Comprehensive Unit & Integration Tests**:
  - Unit tests for mailbox pooling, quota caps, round-robin rotation, jitter calculation, multi-day scheduling, and stop-on-reply.

---

### Phase 2 — Outreach UI, Plain Authoring & Dead-Button Purge
- 🤖 **2.1 Multi-Inbox Connection Management UI**:
  - Dedicated Outreach Mailboxes tab in Settings / Email Outreach:
    - Lists all connected inboxes with real-time health badges, sent today counters (`24 / 40 sent`), reset timer, and reconnect actions.
    - Single-click "Connect Another Gmail / Outlook Mailbox" flow.
- 🤖 **2.2 High-Deliverability Personal Email Composer**:
  - Clean, distraction-free composer optimized for plain-text / personal HTML (no heavy GrapesJS / table boilerplate).
  - Dynamic merge tags toolbar (`{{first_name}}`, `{{company}}`, `{{email}}`, etc.).
  - Instant mobile & desktop previews with sample contact merge preview.
  - Multi-day delivery estimation badge: shows total recipients, active inboxes, and exact day-by-day sending schedule.
- 🤖 **2.3 Shared UI Primitives & Dead-Button Sweep**:
  - Standardize components on `PageHeader`, `DataTable` (server pagination, search, sorting), `EmptyState`, `SlideOverPanel`, `ConfirmDialog`.
  - Fix or remove dead navigation buttons across Calendar (Appointments, Booking Links, Availability), Workflow runs, and Dashboard quick actions.
  - Verify every button has an active handler or clear feedback.

---

### Phase 3 — Drip Sequences & Unified Workflow Automations
- 🤖 **3.1 Multi-Step Outreach Sequences**:
  - Multi-step sequence authoring with configurable delay days/hours and step threading ("Re: {{subject}}").
  - Stop-on-reply toggle per step or sequence.
- 🤖 **3.2 Unified Automation Engine Integration**:
  - Integrate native mailbox sending as first-class action in `/automations`.
  - Condition nodes (if replied, if opened, if clicked, if deal stage changed).
  - Pre-built cold outreach and lead nurture recipes.

---

### Phase 4 — Cross-Module Cohesion & Contact Timelines
- 🤖 **4.1 Unified Contact Timeline**:
  - Email sends, opens, clicks, and replies directly rendered inside the CRM Contact Detail view.
- 🤖 **4.2 Real-time Sync & Notification**:
  - Lead replies surface instantly in `/conversations` with hot-lead badge.
  - Calendar booking automatically marks opportunity won or advances stage, halting nurture sequences.
- 🤖 **4.3 Live Dashboard Metrics**:
  - Dashboard populated with real numbers: Emails Sent Today (across inboxes), Replies Received, Active Campaigns, Pipeline Value.

---

### Phase 5 — CRM & Calendar Completion
- 🤖 **5.1 CRM Import & Management**:
  - Robust CSV import with column mapping, deduplication (by email/phone), and tag assignment.
  - Bulk actions: Add to sequence, assign owner, tag/untag, delete.
- 🤖 **5.2 Calendar Booking**:
  - Public booking link with Google/Outlook calendar conflict detection.
  - Confirmation emails with `.ics` calendar invite attachments.

---

### Phase 6 — Roles, Billing & Team Management
- 🤖 **6.1 Multi-User Workspace & Roles**:
  - Team member invitation flow via email with role assignment (`owner`, `admin`, `member`).
  - Authorization guards on all sensitive operations.
- 🤖 **6.2 Stripe Subscription & Quotas**:
  - Plans structured around contacts, connected inboxes, and active campaigns.
  - Customer self-serve billing portal with automatic upgrade/downgrade handling via webhooks.

---

### Phase 7 — Compliance, Legal & Channel Verification
- 🤖 **7.1 Legal Documents & Privacy**:
  - Terms of Service, Privacy Policy, Anti-Spam Policy (CAN-SPAM/CASL), and DPA.
  - GDPR/CCPA data export and deletion endpoints.
- 🤖 **7.2 Google Cloud Verification Package**:
  - Scope justification documentation, privacy links, and demo video script for Jack to submit to Google for production `gmail.send` approval.

---

### Phase 8 — Production Launch & Beta Onboarding
- 🤖 **8.1 First-Run Onboarding Flow**:
  - 4-step checklist: 1. Connect Mailbox → 2. Import Contacts → 3. Launch First Campaign → 4. Setup Calendar Link.
- 🤖 **8.2 Production Deployment & Smoke Verification**:
  - Railway production deploy with PostgreSQL + Redis.
  - Production smoke testing on live domain.
  - 5–10 beta user onboarding.

---

## 4. Definition of Done (Every Phase)

1. `npm run typecheck` (`tsc --noEmit`) passes with **0 errors**.
2. ESLint passes with **0 errors**.
3. Vitest test suite passes with **100% green tests**.
4. Multi-tenant isolation verified: every database query scopes by authenticated `workspaceId`.
5. No dead ends: Every button works, shows a clear explanation, or is removed.
6. Commit small, one task per commit.
7. Verification report and demo walkthrough presented before moving to the next phase.
