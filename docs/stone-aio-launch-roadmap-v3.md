# Stone AIO — Launch Roadmap v3 (Native Outreach & Paying-Customer Edition)

**Goal:** A multi-tenant product that businesses sign up for, pay for, and use successfully without hand-holding. **Email outreach and marketing is the lead product**, powered by an **internal native sending engine** via connected Google Workspace / Gmail (and Outlook) mailboxes with intelligent human pacing and multi-inbox rotation — eliminating all third-party ESP costs, 3-domain limits, and DNS friction for customers.

**Launch modules:** Dashboard · CRM (all pages) · Conversations · Calendar · Email Outreach & Marketing · Automation Workflows · Settings, Billing, Onboarding.  
**Parked:** Ad Manager, Voice/SDR, Lead Studio, Agents, Marketplace, Assistant, Projects, Reputation, Inbox Help Center.

---

## 1. Jack's Personal Action List (What & When)

Because we eliminated Resend and third-party ESPs, **your requirements are much simpler**:

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
   - The queue automatically distributes recipients across all active inboxes belonging to that workspace.
3. **Human Pacing & Jitter:** Enforced 90–180 second delay between each send, strictly within daytime business hours (9:00 AM – 5:00 PM).
4. **Automated Multi-Day Batching:** A campaign of 200 contacts automatically spreads across 5 days (40/day) with clear UI indicators showing daily progress and next scheduled run.
5. **Stop-on-Reply:** When a recipient replies in Gmail, Conversations detects the thread, tags it, and halts any further automated sequence steps for that contact.
6. **Automatic Unsubscribe & Suppression:** HMAC-signed unsubscribe links in the footer instantly flag contacts as `SUPPRESSED` in the database, preventing accidental re-sends across all campaigns.
7. **100% White-Labeled:** Emails send directly from `user@company.com` with real Google headers, zero StoneAIO branding, and maximum primary-inbox deliverability.

---

## 3. Phase Breakdown

### Phase 0 — Safety, Scope Parking & Multi-Tenant Foundation (Immediate)
- 🤖 **Fix C1–C10 Security Vulnerabilities**:
  - **C1**: Remove cross-tenant Gmail send fallback (`email-send-worker.service.ts` ~L323-327). Enforce strict workspace isolation—never borrow another tenant's mailbox.
  - **C2**: Hard-gate `/billing/dev-set-plan` so it is completely blocked in production and requires a secret bypass flag in development.
  - **C3**: IDOR sweep. Build `scopedFindOrThrow(model, id, workspaceId)` and whitelist input fields instead of spreading raw `data: req.body`.
  - **C4**: HMAC-sign unsubscribe links and open/click tracking tokens using `CHANNEL_ENCRYPTION_KEY`. Allow-list redirect targets to eliminate open redirect risks.
  - **C5**: Remove all `'default'` and `'default-workspace'` fallbacks across routes.
  - **C6 & C7**: Stripe webhook is the sole authoritative writer of workspace plans; verify sessions server-side.
  - **C8**: Add `requireRole(['owner', 'admin'])` middleware to mutating workspace and billing routes.
  - **C9 & C10**: Baseline Prisma migrations, add migrate-on-deploy script, and enforce strict production environment validation.
- 🤖 **Park Non-Launch Scope**:
  - Park `Ads`, `SDR`, `Leads`, `Agents`, `Marketplace`, `Assistant`, `Projects`, `Reputation`, and `InboxHelpCenter` behind `FEATURES` config.
  - Remove from Sidebar, AppShell, CommandPalette, server mounts, crons, and background workers.
  - Tag repo `ads-parked-v1`.
- 🤖 **Canonicalize Conversations**:
  - Pick `/conversations` as canonical; redirect `/inbox` to `/conversations`.
  - Safely archive duplicate inbox implementations (`src/pages/inbox`, `src/pages/business/inbox`).
- 🤖 **Multi-Tenant Cross-Workspace Isolation Test Suite**:
  - Automated tests proving Workspace A cannot read, update, or delete Workspace B records across contacts, deals, conversations, campaigns, or mailboxes.

### Phase 1 — Shared UI Primitives & Dead-Button Purge
- 🤖 Standardize UI on CRM/Conversations design patterns: `PageHeader`, `DataTable` (with server pagination, sorting, search, saved views), `EmptyState`, `SlideOverPanel`, `ConfirmDialog`, toasts, and loading skeletons.
- 🤖 Fix or remove dead navigation controls: Calendar sub-pages (Appointments, Booking Links, Availability, Settings), Workflows Runs/Connections, Dashboard layout controls.
- 🤖 Automated Playwright click-audit across all launch routes to ensure zero broken buttons, no-op clicks, or console errors.

### Phase 2 — Native Mailbox Sending Engine & Multi-Inbox Management
- 🤖 **Multi-Inbox Connection Manager**:
  - Settings / Email Outreach tab to connect multiple Google Workspace / Gmail accounts via OAuth.
  - Real-time mailbox health indicator: connected status, daily quota sent (`28/40 sent today`), reset time, and token health.
- 🤖 **Intelligent Sending Queue**:
  - Enforce 40 emails/day cap per inbox.
  - Multi-inbox round-robin distribution.
  - Human jitter pacing (90–180s delay).
  - Business hours sending window (e.g., 9:00 AM – 5:00 PM).
  - Multi-day campaign progression: auto-pause when daily cap is reached and resume next morning.
- 🤖 **Unsubscribe & Anti-Spam Compliance**:
  - RFC-compliant HMAC-signed footer unsubscribe link.
  - Instant contact suppression upon unsubscribe.
  - Physical mailing address footer (J5).

### Phase 3 — Email Outreach & Campaign Module
- 🤖 **Focused Plain-Email Authoring**:
  - Fast, responsive personal email composer with paragraph formatting.
  - Dynamic merge variable insertion chips (`+ First Name`, `+ Company`, `+ Email`, etc.).
  - Real-time personalized preview (Desktop & Mobile).
- 🤖 **Audience Selection**:
  - Filter recipients from CRM Smart Lists, Tags, or direct CSV upload.
  - Pre-send validation: shows total recipients, excluded/suppressed count, and estimated multi-day schedule (e.g., "120 recipients will send over 3 days across your 1 connected inbox; connect a 2nd inbox to finish in 2 days").
- 🤖 **Guided AI Copilot**:
  - Full-screen intake modal: goal, target audience, tone, offer, and call to action.
  - Generates 3 punchy subject lines + authentic personal email copy using Gemini.
- 🤖 **Campaign Analytics**:
  - Sent, opened, clicked, replied, bounced, and unsubscribed metrics.
  - Revenue attribution: links email engagement to closed deals in the CRM.

### Phase 4 — Drip Nurture & Workflow Automations
- 🤖 **Unified Workflow Engine**:
  - Single engine at `/automations` powering all automated sequences.
  - First-class email action nodes powered by our Native Mailbox engine.
  - **Stop-on-Reply**: Automatically halts sequence when the lead replies in Gmail/Conversations.
  - Delay steps (wait N days/hours, wait until specific weekday/time).
  - Branching conditions (if opened, if clicked, if deal stage changed, if tagged).
- 🤖 **Pre-Built Sequence Recipes**:
  - New Lead Welcome + Nurture.
  - No-Reply Follow-up (3-step stop-on-reply).
  - Cold Lead Re-engagement.
  - Post-Booking Reminder Sequence.

### Phase 5 — Cross-Module Cohesion & Timelines
- 🤖 Unified Contact Timeline: Displays email sends, opens, clicks, and replies directly inside the CRM Contact Detail view.
- 🤖 Real-time synchronization: Replies appear instantly in Conversations tagged with the relevant campaign/sequence.
- 🤖 Calendar booking automatically updates Opportunity pipeline stage and halts sales follow-up sequences.
- 🤖 Dashboard widgets populated with live cross-module data (New Leads, Sent Today, Replies Waiting, Upcoming Appointments, Pipeline Value).

### Phase 6 — CRM Completion & Calendar Completion
- 🤖 **CRM Completion**:
  - CSV import with field mapping and deduplication/merge logic.
  - GoHighLevel export import mapping.
  - Working CRM Bulk Actions (tag/untag, assign owner, add to sequence, delete).
  - Custom fields across contacts and companies.
- 🤖 **Calendar Completion**:
  - Public booking links with availability rules, buffer times, and minimum notice.
  - Two-way Google/Outlook calendar sync with real Google Meet links.
  - Automated attendee confirmation and reminder emails with downloadable `.ics` calendar files.

### Phase 7 — Accounts, Roles, Billing & Team Management
- 🤖 Team member invites via email with accept/join flows.
- 🤖 Role-based authorization (`owner`, `admin`, `member`) enforced on all server routes.
- 🤖 Stripe billing integration:
  - Plans structured around contacts, connected inboxes, and active sequences.
  - Customer self-serve billing portal for upgrades/downgrades/cancellations.
  - Webhook-only authoritative plan state management.
  - Usage meter in UI.

### Phase 8 — Compliance, Security & Channel Verification
- 🤖 Draft legal documents: Terms of Service, Privacy Policy, Anti-Spam / AUP, DPA.
- 🤖 Privacy tooling: GDPR/CCPA data export and deletion endpoints.
- 🤖 Google Cloud verification package for Jack: scope justification write-up, privacy policy links, demo video script for `gmail.send`.
- 🤖 Security hardening: CSP headers, rate limiting, and zero PII logging.

### Phase 9 — Production Launch & Beta Readiness
- 🤖 Guided first-run setup checklist: 1. Connect Inbox → 2. Import Contacts → 3. Launch First Sequence → 4. Share Booking Link.
- 🤖 Public landing page and pricing table.
- 🤖 Sentry error monitoring and health check alerts.
- 🤖 Beta onboarding with 5–10 real businesses.

---

## 4. Definition of Done (Every Phase)

1. `npm run typecheck` (`tsc --noEmit`) passes with **0 errors**.
2. ESLint passes with **0 errors**.
3. Vitest test suite passes with **100% green tests**.
4. Multi-tenant isolation verified: every database query scopes by authenticated `workspaceId`.
5. No dead ends: Every button works, shows a clear explanation, or is removed.
6. Commit small, one task per commit.
7. Verification report and demo walkthrough presented before moving to the next phase.
