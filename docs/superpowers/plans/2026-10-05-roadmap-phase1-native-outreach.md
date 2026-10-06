# Phase 1 Execution Plan: Native Mailbox Outreach Engine Architecture

**Goal:** Build the complete internal sending engine ("our own Resend") using connected Google Workspace / Gmail (and Outlook) accounts with multi-inbox scaling, strict 40/day safety caps per inbox, human jitter pacing (90–180s delay), automated multi-day scheduling, and stop-on-reply detection.

**Prerequisites:** Phase 0 complete (C1–C10 security fixes, tenant isolation, canonical conversations, 117 tests passing).

---

## Task Breakdown

### Task 1: Multi-Inbox & Quota Tracking Database Schema
- **File:** `prisma/schema.prisma`
- **Changes:**
  - Update `ChannelConnection`:
    - Drop `@@unique([workspaceId, userId, provider])` and replace with `@@unique([workspaceId, provider, email])` to allow a workspace to connect multiple mailboxes across accounts.
    - Add fields:
      - `dailySendLimit Int @default(40) @map("daily_send_limit")`
      - `sentTodayCount Int @default(0) @map("sent_today_count")`
      - `lastSentAt DateTime? @map("last_sent_at")`
      - `lastResetAt DateTime? @map("last_reset_at")`
      - `status String @default("ACTIVE")` // ACTIVE, WARMUP, PAUSED, DISCONNECTED, ERROR
      - `consecutiveBounces Int @default(0) @map("consecutive_bounces")`
      - `minDelaySeconds Int @default(90) @map("min_delay_seconds")`
      - `maxDelaySeconds Int @default(180) @map("max_delay_seconds")`
  - Update `Campaign`:
    - Add `multiDayProgress Json? @map("multi_day_progress")`
    - Add `dailyBatchLimit Int? @map("daily_batch_limit")`
    - Add `sendingWindowStart String? @default("09:00") @map("sending_window_start")`
    - Add `sendingWindowEnd String? @default("17:00") @map("sending_window_end")`
    - Add `sendingTimezone String? @default("America/New_York") @map("sending_timezone")`
  - Update `CampaignRecipient`:
    - Add `channelConnectionId String? @map("channel_connection_id")`
    - Add `scheduledForDate DateTime? @map("scheduled_for_date")`
    - Add `openedAt DateTime? @map("opened_at")`
    - Add `clickedAt DateTime? @map("clicked_at")`
    - Add `repliedAt DateTime? @map("replied_at")`
    - Add `unsubscribedAt DateTime? @map("unsubscribed_at")`
- **Verification:** Run `npx prisma db push` and `npx prisma generate` with zero errors.

---

### Task 2: Multi-Inbox Channel Connection OAuth & Management Routes
- **Files:** `api/routes/channels.routes.ts`, `api/services/channels/gmail.service.ts`
- **Changes:**
  - In `api/routes/channels.routes.ts`:
    - Update `gmail/callback` to upsert by `[workspaceId, provider, email]` so multiple Gmail accounts can be connected without overwriting each other.
    - Update `GET /connections` to return quota statistics (`dailySendLimit`, `sentTodayCount`, `status`, `lastSentAt`).
    - Add `PATCH /connections/:id/settings` to allow configuring `dailySendLimit` (up to safe maximum 50) and toggling pause/resume status.
- **Verification:** Test OAuth upsert logic and endpoint tests.

---

### Task 3: Mailbox Pool & Round-Robin Selector Service
- **File:** `api/services/email-marketing/mailbox-pool.service.ts`
- **Features:**
  - `getAvailableMailboxes(workspaceId)`: Fetches all active, healthy mailboxes for a workspace with `sentTodayCount < dailySendLimit` and `status === 'ACTIVE'`.
  - `getWorkspaceDailyCapacity(workspaceId)`: Returns `{ totalLimit, sentToday, remainingToday, activeMailboxCount }`.
  - `selectNextMailbox(workspaceId)`: Round-robin algorithm that selects the active mailbox with the least sends or rotating cursor.
  - `recordSendSuccess(connectionId)`: Atomically increments `sentTodayCount`, updates `lastSentAt`, resets `consecutiveBounces = 0`.
  - `recordSendBounce(connectionId)`: Increments `consecutiveBounces`. If $\ge 3$, sets `status = 'PAUSED'` and logs warning to protect domain reputation.
  - `resetDailyQuotas()`: Resets `sentTodayCount = 0` for all mailboxes when 24h cycle completes or at midnight.
- **Verification:** Unit test covering mailbox selection, quota limits, and bounce auto-pause.

---

### Task 4: Jitter Pacing & Multi-Day Campaign Scheduler
- **File:** `api/services/email-marketing/outreach-scheduler.service.ts`
- **Features:**
  - `calculateJitterDelay(minSeconds, maxSeconds)`: Returns human randomized delay between 90 and 180 seconds.
  - `isWithinSendingWindow(workspaceTimezone, startHour, endHour)`: Verifies if current time is within business hours (Monday–Friday 9:00 AM – 5:00 PM).
  - `planCampaignMultiDaySchedule(workspaceId, recipientCount)`: Calculates how many days a campaign needs based on active mailboxes $\times$ remaining daily limits. E.g., 120 contacts with 1 mailbox (40/day) = 3 days; with 3 mailboxes (120/day) = 1 day.
  - Updates campaign execution logic to partition and batch recipients across days.
- **Verification:** Unit tests verifying multi-day partitioning, window validation, and jitter delay generation.

---

### Task 5: Stop-on-Reply Engine
- **Files:** `api/services/email-marketing/stop-on-reply.service.ts`, `api/services/channels/gmail.service.ts`
- **Features:**
  - `handleInboundLeadReply({ workspaceId, contactEmail, messageId, threadId, subject, body })`:
    - Locates contact in the workspace.
    - Updates `contact.repliedAt = new Date()`.
    - Updates all pending `CampaignRecipient` records for this contact to `REPLIED`.
    - Emits `EmailEvent` of type `REPLIED` linked to campaign if applicable.
    - Halts any active automated sequence enrollments for this contact.
    - Updates/tags conversation in Conversations.
  - Wire into `gmail.service.ts:fetchGmailHistory` when an incoming email arrives.
- **Verification:** Integration test simulating incoming reply and asserting pending campaign steps are stopped and contact is flagged.

---

### Task 6: Plain-Text / Personal Email Deliverability Compiler
- **File:** `api/services/email-marketing/personal-email-compiler.ts`
- **Features:**
  - Converts markdown/plain text and dynamic merge variables (`{{first_name}}`, `{{company}}`, etc.) into authentic personal email format.
  - Injects HMAC-signed unsubscribe link compliant with RFC standards.
  - Strips heavy marketing HTML bloat so emails land directly in Google Primary inbox.
- **Verification:** Unit tests verifying personal formatting, variable replacement, and unsubscribe signing.

---

### Task 7: Comprehensive Test Suite & Verification Gate
- Run `npx tsc --noEmit`
- Run `npx vitest run` (ensure all tests pass, including new native outreach tests)
- Verify dev servers are healthy.
