# Software Map — Stone AIO

> Ground truth from the code itself. Document what IS, not what should be. Real names from the code. Anything that could not be determined from the code is marked **unverified** — never guessed.
>
> - Repo: `jackstonemedia/StoneAIOMainSystem` (package name `stone-aio`, version `0.0.0`, `"type": "module"`)
> - Branch for this map: `agent/software-map`
> - Base commit audited: `374ed22` — `refactor(email-marketing): remove GrapesJS block builder and restore plain-email authoring`
> - Map written: 2026-10-15 (from code on `main` at `374ed22`)
> - How to use: briefs and Blueprints must use the entity names, status values, and route names below. If reality and this map disagree, the builder flags it in Deviations and the map gets fixed.

## 1. Tech stack + repo layout

### Stack (from `package.json`, `README.md`, `Dockerfile`, `vite.config.ts`, `prisma/schema.prisma`)

| Layer | What the code uses |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, React Router 7, Tailwind CSS v4 (`@tailwindcss/vite`), Motion, TanStack Query, Zustand, React Flow (`@xyflow/react`), Tiptap, Radix UI |
| Backend API | Node.js 20+ (Docker uses `node:20-slim`), Express 4, TypeScript, Zod request validation, `tsx` for running TS directly |
| Data | PostgreSQL (Prisma ORM, `prisma-client-js`, `binaryTargets = ["native", "windows", "debian-openssl-3.0.x"]`). `DATABASE_URL` is `postgresql://…` in production. `.env.example` also documents SQLite `file:./prisma/dev.db` as a local-dev fallback when `DATABASE_URL` is not set — but `infrastructure/config/env.ts` forbids `file:` / SQLite in production. |
| Queues / realtime | Redis: BullMQ (primary) + legacy `bull` (workflow engine only, see below). SSE via `api/services/channels/realtime.service.ts` with Redis pub/sub, falling back to an in-memory `EventEmitter` when `REDIS_URL` is not set. |
| Auth | Clerk (`@clerk/clerk-react`, `@clerk/express`, JWT `verifyToken`). Dev bypass when `CLERK_SECRET_KEY` is missing — see §7. |
| AI | Google Gemini via `@google/genai` (`packages/ai/client.ts`, `DEFAULT_MODEL = 'gemini-2.5-flash'`) and `@google/generative-ai` (legacy import still present). |
| Email | Resend (`resend` package, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`). MJML (`mjml`) + `@templatical/editor` / `@templatical/renderer` for templates. |
| SMS / Voice | Twilio (`twilio`, `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`), Retell (`retell-sdk`, `retell-client-js-sdk`, `RETELL_API_KEY`). |
| Billing | Stripe (`stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). |
| Ads | Meta (Facebook/Instagram) + Google Ads via `googleapis`, `FACEBOOK_ADS_*`, `GOOGLE_ADS_*` env vars. |
| Config validation | Zod in `infrastructure/config/env.ts` — invalid env exits the process (`process.exit(1)`). |
| Tests | Vitest 4 (`vitest.config.ts`, `jsdom`, `src/test/setup.ts`). Test globs: `src/**/*.{test,spec}.*`, `api/**/*.{test,spec}.*`, `infrastructure/**/*.{test,spec}.*`. |
| Lint / types | ESLint 9 (`eslint.config.js`), `tsc --noEmit` for `npm run typecheck` (root `tsconfig.json`); server types use `tsconfig.server.json` (`module: Node16`, `rootDir: "."`, includes `server.ts`, `api/**`, `infrastructure/**`, `packages/**`, `types/**`). |
| Deploy | Multi-stage `Dockerfile` (builder: `npm install` + `npx prisma generate` + `npm run build`; runner: `npm ci --omit=dev` + `npx prisma migrate deploy && npx tsx server.ts`). `Procfile`, `railway.json`, `render.yaml`, `railpack.toml` also present. `npm start` = `npx prisma migrate deploy && tsx server.ts`. |

### Commands (from `package.json` `scripts`)

- `npm run dev` = `concurrently` Vite + `tsx watch server.ts`. UI on `http://localhost:5173` (Vite proxies `/api` → `http://localhost:4000`), API on `PORT` (default `4000` in `env.ts`, `3000` in `.env.example` — see Landmines).
- `npm run dev:ui` = `vite`. `npm run dev:server` = `tsx watch server.ts`.
- `npm run build` = `vite build` (frontend only — does NOT typecheck the server).
- `npm run start` = `npx prisma migrate deploy && tsx server.ts`.
- `npm run db:migrate` = `prisma migrate deploy`.
- `npm run preview` = `vite preview`. `npm run clean` = `rm -rf dist`.
- `npm run lint` = `eslint src --ext .ts,.tsx --report-unused-disable-directives --max-warnings 0`.
- `npm run typecheck` = `tsc --noEmit`.
- `npm test` = `vitest run`.

### Repo layout (top level + key subtrees)

```
StoneAIOMainSystem/
  server.ts                  # Express entrypoint — mounts ALL /api routers, webhooks, SSE, static hosting
  package.json / package-lock.json
  vite.config.ts             # @ alias → repo root, react shims, /api proxy → :4000
  tsconfig.json / tsconfig.server.json
  vitest.config.ts
  Dockerfile / Procfile / railway.json / render.yaml / railpack.toml
  .env.example               # canonical env list (see §5)
  PRODUCT.md / README.md
  api/
    routes/                  # Express routers, one file per area (see §1.1)
    services/                # business logic: crm, opportunities, ads/, channels/, email-marketing/,
                             #   inbox/, leads/, sdr/, workflow-engine/, business, agents, voice
    middleware/              # workspace.ts, requireRole.ts, validate.ts, error.ts, resolveInboxChannel.ts
    schemas/                 # Zod schemas: validation.ts, opportunities.schema.ts, ads.schemas.ts
    jobs/                    # ads-metrics-sync, google-ads-lead-poll, resume-paused-runs
    webhooks/                # facebook-leads, forms, meta, outlook-messages, resend-webhook, twilio-sms
    utils/                   # logger.ts
  infrastructure/
    config/env.ts            # Zod env schema + production guardrails (see §5)
    database/client.ts       # Prisma client singleton (client.js also exists — see Landmines)
    database/idempotency.ts  # claimWebhookEvent() — ProcessedWebhookEvent dedup
    queue/bullmq.ts          # BullMQ queues/workers + in-memory mock fallback when no REDIS_URL
  prisma/
    schema.prisma            # single source of truth for the data model (§2)
    migrations_baseline.sql
    seed.ts / seed-templates.ts
  packages/ai/               # Gemini client + workflow-gen prompt
  src/
    App.tsx                  # React Router tree (see §1.2)
    pages/                   # route pages: crm/, opportunities via crm/, email-marketing/,
                             #   automations/, inbox/, conversations/, ads/, business/, leads/, sdr/
    components/              # crm/, dashboard/, email-marketing/, builder/, ads/, voice/, tour/, ui/
    hooks/ / lib/ / store/ / context/ / constants/ / data/
    shims/                   # react-shim.ts + use-sync-external-store shims (see Baseline — build failure)
  docs/                      # email-marketing specs, production-readiness-outline, superpowers/
  scripts/                   # refactor-fetch.cjs
  public/ / index.html / .github/ / .agents/ / .superpowers/ / types/ / infrastructure/
  check.ts / check_runs.ts / debug_email.ts / old_contact_detail.txt / opps.txt  # scratch/debug files at root
```

#### 1.1 API routes mounted in `server.ts`

All `/api/*` after the webhook mounts go through `resolveWorkspace` (JWT → `req.workspaceId` / `req.userId`), except the explicitly public webhook mounts. Order in `server.ts`:

- Public (before `resolveWorkspace`): `GET /api/health`, `GET /api/health/ready`, `GET /api/health/live`, `POST /api/hooks/twilio-sms`, `POST /f/:workspaceId` (external form capture), `POST|GET /api/hooks/outlook-messages`, `GET|POST /api/hooks/facebook-leads`, `app.all('/api/hooks/*', webhookHandler)` (workflow webhooks), `GET|POST /api/hooks/meta`, `POST /api/webhooks/resend`, `POST /api/webhooks/stripe` + `/api/stripe/webhook`, `GET /api/email-marketing/track/click`, `GET /api/email-marketing/track/open`.
- Authenticated (`app.use('/api', resolveWorkspace)` then): `/api/ai`, `/api/ai/actions`, `/api/workflow-ai`, `/api/conversations`, `/api/crm/actions`, `/api/agents`, `/api/integrations`, `/api/releases`, `/api/opportunities`, `/api/crm`, `/api/business`, `/api/settings`, `/api/notifications`, `/api/billing` (also mounted at `/api` for Stripe + public forms), `/api` (onboarding progress), `/api/workflows`, `/api/tables`, `/api/channels`, `/api/ads`, `/api/leads`, `/api/inbox` (+ `/api/inbox/copilot`), `/api/widget` (inbox widget, public-ish), `/api/webhooks/inbox`, `/api/email-marketing`, `/api/sdr`.
- `POST /api/dev/seed` exists in non-production (seed endpoint).

File → mount mapping (representative; file name = route file):

| File | Mount |
|---|---|
| `api/routes/crm.routes.ts` | `/api/crm` — contacts, companies, deals, pipelines, tasks, activities, custom-fields, tags, bulk, import, attachments, smart-lists |
| `api/routes/opportunities.routes.ts` | `/api/opportunities` — opportunities, pipelines, stages, reasons, custom-fields, tags, saved-views, line-items |
| `api/routes/business.routes.ts` | `/api/business` |
| `api/routes/settings.routes.ts` | `/api/settings` — workspace, api-keys, integrations, team, password, 2fa, sessions |
| `api/routes/notifications.routes.ts` | `/api/notifications` — list, unread-count, read, read-all, delete, SSE (`/sse`) |
| `api/routes/billing.routes.ts` | `/api/billing` + `/api` — checkout, verify-session, dev-set-plan, portal, subscription-status, invoices, `POST /api/stripe/create-payment-intent`, `POST /api/stripe/webhook` |
| `api/routes/onboarding.routes.ts` | `/api` — onboarding progress (`PUT /api/onboarding/progress/:tourKey` validated) |
| `api/routes/workflows.routes.ts` | `/api/workflows` — workflows, folders, runs, credentials, templates, publish/pause |
| `api/routes/tables.routes.ts` | `/api/tables` — automation tables |
| `api/routes/workflow-ai.routes.ts` | `/api/workflow-ai` |
| `api/routes/ai.routes.ts` | `/api/ai` — Gemini endpoints |
| `api/routes/ai-actions.routes.ts` | `/api/ai/actions` |
| `api/routes/chat.routes.ts` | `/api/conversations` (AI chat) |
| `api/routes/agents.routes.ts` | `/api/agents` — legacy Agent / AgentRun |
| `api/routes/crm-actions.routes.ts` | `/api/crm/actions` |
| `api/routes/integrations.routes.ts` | `/api/integrations` |
| `api/routes/releases.routes.ts` | `/api/releases` |
| `api/routes/ads.routes.ts` | `/api/ads` |
| `api/routes/leads.routes.ts` | `/api/leads` (Lead Studio) |
| `api/routes/sdr.routes.ts` | `/api/sdr` |
| `api/routes/email-marketing.routes.ts` | `/api/email-marketing` — lists, segments, suppression, templates, campaigns, automations, domains, track, unsubscribe |
| `api/routes/inbox.routes.ts` | `/api/inbox` — channels, conversations, messages, labels, teams, contacts, canned-responses, campaigns, reports |
| `api/routes/inbox-copilot.routes.ts` | `/api/inbox/copilot` |
| `api/routes/inbox-widget.routes.ts` | `/api/widget` — public widget |
| `api/routes/inbox-webhooks.routes.ts` | `/api/webhooks/inbox` |
| `api/routes/channels.routes.ts` | `/api/channels` — gmail/outlook/twilio connect + callbacks |
| `api/routes/voice-agents.routes.ts` | (imported? — file exists; mount is via `business`/`agents` flows — see Unverified) |
| `api/routes/email-copilot.routes.ts`, `inbox-copilot.routes.ts`, `workflow-ai.routes.ts`, `tables.routes.ts`, `releases.routes.ts` | as mounted above |

#### 1.2 Frontend routes (`src/App.tsx`)

`AppRoutes` uses `BrowserRouter`. Public: `/`, `/login`, `/signup`, `/sso-callback`, `/onboarding`. Inside `<AppShell>`: `/automations` (+ `/automations/:id` → `WorkflowBuilder`, tables, releases, settings; `/workflows` redirects to `/automations`), `/inbox` (chat / manual-actions / snippets / trigger-links), `/business` (index, analytics, reputation), `/business/calendar`, `/calendar` aliases → `/business/calendar`, `/crm` (contacts, contacts/:id, companies, companies/:id, opportunities, opportunities/:id, opportunities/settings/pipelines|fields|tags, tasks, documents, smart-lists, bulk-actions, settings; `/opportunities` aliases → `/crm/opportunities`, `/pipeline` → `/crm/opportunities`), `/marketplace`, `/billing` → `/settings?tab=billing`, `/settings`, `/leads` (Lead Studio), `/email-marketing` (campaigns, campaigns/new, campaigns/:id, automations, automations/new, automations/:id, audience, templates, suppression, analytics), `/inbox` (second mount — `InboxLayout`: index, reports, contacts, help-center, settings/channels|teams|labels|canned-responses — note the duplicate `/inbox` mount in `App.tsx`; first match wins in React Router), `/conversations` (index, :id, settings/channels|templates|tags), `/ads` (overview, campaigns, campaigns/:id, reports, settings). Fullscreen (no sidebar): `/ads/campaigns/new`, `/ads/campaigns/new/:type`, `/ads/campaigns/:id/edit`. Catch-all redirects to `/opportunities`.

Auth gating: `Protect withAuth={withAuth}`; when `VITE_CLERK_PUBLISHABLE_KEY` is absent, `App` renders `AppRoutes withAuth={false}` and login/signup redirect to `/crm`.

## 2. Core data model (from `prisma/schema.prisma`)

All models are workspace-scoped via `workspaceId` except `ProcessedWebhookEvent` (global, keyed by `provider` + `eventId`), `User` (keyed by `clerkId`), and `WorkflowTemplate` (optional `workspaceId`, system templates have `isSystem=true`). IDs are `String` (CUID-style via Prisma default — check `schema.prisma` for `@default(cuid())` per model; the map lists names + key fields, not every scalar).

### 2.1 Tenancy + identity

- `Workspace` — `id, name, ownerId, plan, stripeCustomerId?, stripeSubscriptionId?, subscriptionStatus? (String, free-form — see Billing), creditsUsed, creditsLimit, createdAt, updatedAt`. Relations to nearly every other model (members, agents, contacts, companies, deals, apiKeys, integrations, appointments, conversations, pipelines, tasks, smartLists, notifications, customFields, tags, webhookEndpoints, attachments, wonLostReasons, opportunitySavedViews, opportunityActivityLogs, automationFolders, automationTables, Release, workflows, workflowRuns, workflowCredentials, workflowSchedules, workflowWebhooks, crmTriggerSubscriptions).
- `WorkspaceMember` — `workspaceId, userId, role (String — see §7), createdAt`. Composite key `workspaceId_userId`.
- `User` — `id, clerkId, createdAt, updatedAt`. `UserOnboardingProgress` — `id, userId, tourKey, status (String: not_started | in_progress | completed | skipped — validated in `api/routes/__tests__/validation_routes.test.ts`), stepIndex, completedAt, updatedAt`.

### 2.2 CRM — contacts, companies, deals, pipeline

- `Contact` — `id, workspaceId, companyId?, firstName, lastName, middleName?, suffix?, avatarUrl?, email?, emailsJson?, phone?, phonesJson?, location?, title?, leadScore, healthScore, ownerId?, dndEnabled, preferredChannel, about?, tagsJson, source?, status? (String, free-form — see §3), color, assignedUserId?, customFieldsJson?, lastContactedAt?, dateOfBirth?, preferredName?, socialProfilesJson?, addressesJson?, engagementScore, contactType?, reportingManagerId?, teamId?, createdAt, updatedAt`. Relations: `company, deals (Deal[])`. JSON-string columns (`*Json`) hold arrays/objects as serialized strings — NOT native `Json` columns (see Landmines). `ContactEvent` — `id, contactId, type, title, content?, metadataJson?, createdAt`.
- `Company` — `id, workspaceId, name, logoUrl?, website?, industry?, location?, employees?, revenue?, description?, createdAt, updatedAt, customFieldsJson?`. Relations: `contacts, deals, tasks, activities`.
- `Deal` (called “Opportunity” in the Opportunities UI/API — same table; `api/routes/opportunities.routes.ts` + `api/services/opportunities.service.ts` operate on `Deal`) — `id, workspaceId, companyId?, contactId?, pipelineStageId?, title, amount (Float), probability (Int), priority (String), closeDate?, ownerId?, description?, wonLostReason?, daysInStage, lastActivity?, currency, dealType?, competitor?, probabilityOverride?, createdAt, updatedAt, customFieldsJson?, tagsJson?, source?, status (String: open | won | lost — Zod-validated, see §3), wonLostNotes?`. Relations: `company, contact, pipelineStage, activities, tasks, lineItems (OpportunityLineItem[]), opportunityLogs (OpportunityActivityLog[])`.
- `Pipeline` — `id, workspaceId, name, isDefault, staleThresholdDays, allowStageSkip, enableLineItems, visibleTabsJson?, createdAt, updatedAt`. Relations: `stages, wonLostReasons, savedViews`.
- `PipelineStage` — `id, pipelineId, name, color, order, probability, isWon, isLost, requiredFieldsJson?, createdAt, updatedAt`. `isWon`/`isLost` drive `Deal.status` (see §3).
- `WonLostReason` — `id, workspaceId, pipelineId?, reason, type (String: won | lost | both — see opportunities service templates), createdAt`. `OpportunityLineItem` — `id, dealId, name, description?, quantity, unitPrice, subtotal, createdAt, updatedAt`. `OpportunityActivityLog` — `id, workspaceId, dealId, type (String: stage_change | won_lost | … — see §3), title, description?, userId?, userName?, metadataJson?, createdAt`. `OpportunitySavedView` — `id, workspaceId, pipelineId?, name, isDefault, viewType, filtersJson, sortJson?, columnsJson?, cardConfigJson?, createdAt, updatedAt`.
- `Task` — `id, workspaceId, contactId?, companyId?, dealId?, title, description?, type (String: follow_up | email | call | meeting | task | … — free-form in code/seed), dueDate?, priority (String), status (String: pending | completed | overdue — seed uses `overdue` as a stored value; `crm.service.ts` filters `status: 'pending'` for overdue counts), assigneeId?, createdAt, updatedAt`.
- `Activity` — `id, workspaceId?, dealId?, contactId?, companyId?, type (String: email | call | meeting | note | …), title, notes?, duration?, outcome?, createdAt`.
- `Appointment` — `id, workspaceId, title, description?, type, location?, contactId?, startTime, endTime, status (String — see §3; seed uses `scheduled`), createdAt, updatedAt`.
- `CustomField` — `id, workspaceId, entityType (String: contact | company | deal | …), label, type (String), optionsJson?, required, order, pipelineId?, scope, createdAt`. Values live in `customFieldsJson` on the owning entity, NOT in this table.
- `Tag` — `id, workspaceId, name, color, isShared, entityType, createdAt`. `ContactRelation` — `sourceContactId, targetContactId, relationshipType, createdAt`.
- `SmartList` — `id, workspaceId, name, description?, filtersJson, matchMode, viewMode, columnsJson, author?, createdAt, updatedAt`. `SmartListItem` — `smartListId, contactId, addedAt`.
- `Attachment` — `id, workspaceId, entityType, entityId, fileName, fileUrl, fileSize?, fileType?, createdAt`.

### 2.3 Conversations — two parallel systems (see Landmines)

**Legacy CRM conversations** (`Conversation` / `ConversationMessage`):
- `Conversation` — `id, workspaceId, contactId?, channel (String: email | sms | chat | …), status (String: open | closed — seed uses `open`/`closed`), unreadCount, subject?, externalId?, channelConnectionId?, lastMessageAt?, assignedUserId?, starred, createdAt, updatedAt`. Relations: `contact, messages`.
- `ConversationMessage` — `id, conversationId, sender (String: contact | user | …), body, direction (String: inbound | outbound), externalId?, status (String), channel?, errorMsg?, attachments?, createdAt`.

**New Inbox** (`Inbox*`):
- `InboxChannel` — `id, workspaceId, name, channelType (String), avatarUrl?, welcomeMessage?, awayMessage?, widgetColor, isEnabled, channelConnectionId?, embedToken?, settingsJson (String — serialized JSON), createdAt, updatedAt`. Relations: `conversations, agents (InboxChannelAgent[]), campaigns (InboxCampaign[])`.
- `InboxChannelAgent` — `inboxChannelId, userId, availabilityStatus (String)`. `InboxLabel` — `id, workspaceId, title, description?, color, showOnSidebar, createdAt`. `InboxTeam` — `id, workspaceId, name, description?, createdAt, updatedAt`. `InboxTeamMember` — `teamId, userId, createdAt`.
- `CannedResponse` — `id, workspaceId, name, content, type (String), folder?, createdAt, updatedAt`.
- `InboxContact` — `id, workspaceId, crmContactId?, name?, email?, phone?, avatarUrl?, externalId?, additionalAttributes? (String — serialized JSON), lastActivityAt?, createdAt, updatedAt`.
- `InboxConversation` — `id, workspaceId, inboxChannelId, inboxContactId?, crmContactId?, displayId (Int, per-workspace sequence via `InboxDisplayIdSequence`), status (String: pending | open | resolved | snoozed — see §3), priority?, subject?, assignedUserId?, teamId?, snoozedUntil?, firstReplyAt?, resolvedAt?, waitingSince?, unreadCount, lastActivityAt?, additionalAttributes?, createdAt, updatedAt`. Relations: `inboxChannel, inboxContact?, team?, messages, labels, participants`.
- `InboxMessage` — `id, conversationId, workspaceId, senderType, senderId?, contentType, content, contentAttributes?, private, status (String), externalId?, createdAt, updatedAt`. `InboxConversationLabel` — `conversationId, labelId, createdAt`. `InboxConversationParticipant` — `conversationId, userId, createdAt`. `InboxMention` — `id, messageId, mentionedId, read, createdAt`. `InboxAgentSignature` — `id, workspaceId, userId, body, createdAt, updatedAt`. `InboxDisplayIdSequence` — `workspaceId, lastId`.
- `InboxCampaign` — `id, workspaceId, inboxChannelId, title, message, segmentId, status (String), scheduledAt?, createdAt, updatedAt`.
- `HelpCenterPortal` / `HelpCenterCategory` / `HelpCenterArticle` — portal (`id, workspaceId, name, domain?, color, createdAt, updatedAt`), category (`id, portalId, name, description?, position, createdAt, updatedAt`), article (`id, portalId, categoryId, title, content, status (String), authorId, views, createdAt, updatedAt`).

### 2.4 Workflows / automations — two engines (see Landmines)

**Native workflow engine** (`Workflow` / `WorkflowRun` + supporting tables):
- `Workflow` — `id, workspaceId, name, description?, status (String: draft | published | paused — see §3), triggerType?, folderName?, tags (String), isFavorite, folderId?, lastRunAt?, lastRunStatus?, createdAt, updatedAt, engineType (String: native | …), definitionJson (String — serialized JSON), variablesJson, settingsJson, errorWorkflowId?, executionCount, successCount, failureCount`. Relations: `runs, nativeDefinition, schedules, webhooks, crmTriggerSubscriptions`.
- `WorkflowRun` — `id, workspaceId, workflowId, status (String: RUNNING | SUCCEEDED | FAILED | PAUSED — uppercase, see §3), durationMs?, stepCount, triggerData?, errorMessage?, startedAt, finishedAt?, engineType, runData (String — serialized JSON), waitingNodeId?, resumeAt?, workspace, workflow`.
- `NativeWorkflowDefinition` — `id, workflowId, nodesJson, edgesJson, createdAt, updatedAt`.
- `WorkflowCredential` — `id, workspaceId, name, type, dataEncrypted, createdAt, updatedAt`.
- `WorkflowSchedule` — `id, workspaceId, workflowId, nodeId, cronExpr, timezone, active, lastRunAt?, nextRunAt?, createdAt`. `WorkflowWebhook` — `id, workspaceId, workflowId, nodeId, path, method, secret?, active, createdAt`. `WorkflowTemplate` — `id, name, description?, category, tags, definitionJson, thumbnailUrl?, usageCount, isSystem, workspaceId?, createdAt`. `CrmTriggerSubscription` — `id, workspaceId, workflowId, nodeId, entityType, eventType, filtersJson, active, createdAt`.
- `AutomationFolder` — `id, workspaceId, name, createdAt, updatedAt`. `AutomationTable` — `id, workspaceId, name, createdAt, updatedAt`. `AutomationTableField` — `id, tableId, name, type, options, order, createdAt`. `AutomationTableRecord` — `id, tableId, cells (String — serialized JSON), createdAt, updatedAt`.
- `Release` — `id, workspaceId, name, description?, status (String), createdAt`.

**Legacy Agent engine** (`Agent` / `AgentRun` / …):
- `Agent` — `id, workspaceId, name, type, status (String: draft | … — `agents.service.ts` defaults `status: 'draft'`), config (String — serialized JSON), createdAt, updatedAt`. Relations: `runs, messages`.
- `AgentRun` — `id, agentId, status (String: running | … — `agents.service.ts` creates with `status: 'running'`), startedAt, completedAt?, triggerData?`. `AgentRunStep` — `id, runId, nodeId, status (String: success | error | … — from `agents.routes.ts` log events), output?, error?, startedAt, duration?`. `AgentMessage` — `id, agentId?, userId, role, content, createdAt`. `AIAction` — `id, workspaceId, toolName, args (Json), label, status (String), result (Json?), chatContext?, createdAt, updatedAt`.

### 2.5 Email marketing

- `EmailList` — `id, workspaceId, name, doubleOptIn, createdAt, updatedAt`. `ContactListMembership` — `id, workspaceId, contactId, listId, status (SubscriptionStatus enum), consentSource (ConsentSource enum), consentTimestamp`. `Segment` — `id, workspaceId, name, filterDefinition (Json — native JSON, unlike most *Json strings), createdAt, updatedAt`.
- `EmailTemplate` — `id, workspaceId, name, blockJson (Json), createdAt, updatedAt`.
- `Campaign` — `id, workspaceId, name, subject, status (CampaignStatus enum), blockJson (Json), listId?, segmentId?, smartListId?, scheduledAtUtc?, sentAtUtc?, abTestConfig (Json?), createdAt, updatedAt`. Relations: `recipients`.
- `CampaignRecipient` — `id, campaignId, contactId, variant?, sentAt?, status (String: PENDING | SENT | HOLD | … — see §3), resendMessageId?`.
- `Automation` (email-marketing automations — distinct from `Workflow`) — `id, workspaceId, name, status (AutomationStatus enum), triggerType (AutomationTriggerType enum), triggerConfig (Json), canvasJson (Json), reentryAllowed, reentryCooldownDays, createdAt, updatedAt`. `AutomationEnrollment` — `id, workspaceId, automationId, contactId, currentStepId?, enrolledAt, exitedAt?, exitReason (EnrollmentExitReason enum?)`.
- `EmailEvent` — `id, workspaceId, contactId, campaignId?, automationEnrollmentId?, eventType (EmailEventType enum), linkUrl?, occurredAt`.
- `SuppressionEntry` — `id, workspaceId, email, reason, createdAt`.
- `SendingDomain` — `id, workspaceId, domain, resendDomainId, status (SendingDomainStatus enum: PENDING | VERIFIED | FAILED), region?, dnsRecords (Json), createdAt, verifiedAt?`.

### 2.6 Ads

- `AdAccount` — `id, workspaceId, platform (AdPlatform: GOOGLE | FACEBOOK), externalAccountId, accountName, accessToken, refreshToken, tokenExpiresAt?, tokenLastRefreshedAt?, facebookPages (String), status (AdAccountStatus: ACTIVE | NEEDS_ATTENTION | DISCONNECTED), connectedAt, connectedByUserId, lastSyncAt?, lastPollAt?, disconnectedAt?, createdAt, updatedAt`. Relations: `campaigns`.
- `AdCampaign` — `id, workspaceId, adAccountId, platform, adType (AdType: GOOGLE_SEARCH | GOOGLE_DISPLAY | FACEBOOK_FEED | FACEBOOK_LEAD), platformCampaignId?, platformAdSetId?, platformAdGroupId?, platformAdId?, name, objective, status (AdCampaignStatus: ACTIVE | PAUSED | DRAFT | ENDED | REJECTED), rejectionReason?, budgetType (BudgetType: DAILY | LIFETIME), budgetAmountCents, scheduleType, startDate?, endDate?, bidStrategy?, targetCpaCents?, targetingJson, creativeJson, cachedSpend30dCents, cachedLeads30d, cachedCtr30d, metricsCachedAt?, createdByUserId, lastEditedByUserId, launchedAt?, createdAt, updatedAt`. Relations: `metrics, leads`.
- `AdMetricSnapshot` — `id, campaignId, date, spendCents, impressions, clicks, leads, ctr, costPerLeadCents?, syncedAt`.
- `AdLead` — `id, workspaceId, campaignId, platform, platformLeadId, facebookFormId?, leadName?, leadEmail?, leadPhone?, rawDataJson, syncStatus (LeadSyncStatus: PENDING | SYNCED | FAILED), syncError?, syncAttempts, syncedAt?, capturedAt, createdAt`. Note: `contact` relation is `Contact?` in schema (unverified — see Unverified).
- `AdWorkspaceSettings` — `id, workspaceId, defaultDailyBudgetCents?, leadNotificationsEnabled, leadNotificationMode (String), aiAssistedCreativeDefault, createdAt, updatedAt`.
- `AdsOAuthState` — `id, state, workspaceId, userId, expiresAt, createdAt`.

### 2.7 Lead Studio + SDR

- `LeadGenerationJob` — `id, workspaceId, userId, status (String: running | completed | failed | expanding — see §3; initial creation value is unverified), niche, area, maxLeads, leadsFound, leadsReturned, searchQuery?, expandedQuery?, progressPct, message?, errorMessage?, queuedAt, startedAt?, completedAt?`. Relations: `leads`.
- `Lead` — `id, jobId, workspaceId, userId, sourceUrl, discoveryEngine?, businessName?, phone?, email?, website?, address?, city?, state?, country?, postalCode?, category?, confidenceScore?, phoneSource?, phoneValidated, isDuplicate, createdAt`.
- `UserLeadHistory` — `id, workspaceId, userId, normalizedName, city, state, phone?, firstSeenAt, lastSeenAt, timesReturned`. `DailyLeadQuota` — `workspaceId, userId, date, leadsUsed, leadsRequested`.
- `AutonomousSdrAgent` — `id, workspaceId, name, targetIcp (Json), valueProposition, primaryOffer, calendarUrl?, mode (SdrMode: COPILOT | AUTOPILOT), status (SdrStatus: ACTIVE | PAUSED | DRAFT), dailyLimit, sequenceConfig (Json), createdAt, updatedAt`. Relations: `dossiers`.
- `SdrLeadDossier` — `id, agentId, contactId?, businessName, websiteUrl?, contactEmail?, contactPhone?, contactName?, websiteSummary, hookAngle, draftedSubject, draftedBody, sequenceSteps (Json), status (DossierStatus: DRAFTED | APPROVED | SENDING | ENGAGED | MEETING_BOOKED | BOUNCED | DECLINED), metrics (Json?), createdAt, updatedAt`.

### 2.8 Billing / misc

- `Workspace.subscriptionStatus` — free-form `String?` (NOT a Prisma enum). Values written in code: `active`, `inactive`, `canceled`, plus raw Stripe `sub.status` (e.g. `trialing`, `past_due`, `unpaid` — unverified, see §3). `plan` is also free-form `String` (`free`, `pro`, … — seed uses `free`; settings fallback uses `pro`).
- `ApiKey` — `id, workspaceId, provider, keyEncrypted, createdAt, updatedAt`. Unique on `(workspaceId, provider)`.
- `Integration` — `id, workspaceId, provider, accessToken, refreshToken?, scopes?, expiresAt?, accountId?, createdAt, updatedAt`.
- `ChannelConnection` — `id, workspaceId, userId, provider (String: gmail | outlook | twilio | …), label?, email?, credentialsJson (String — serialized JSON, encrypted? — see §5), isActive, twilioPhoneNumber?, outlookSubscriptionId?, outlookSubscriptionExpiry?, gmailHistoryId?, lastPolledAt?, createdAt, updatedAt`. Unique on `(workspaceId, userId, provider)` per channels routes (unverified — check `@@unique` in schema).
- `Notification` — `id, workspaceId, title, body?, type (String), read (Boolean), link?, createdAt`.
- `WebhookEndpoint` — `id, workspaceId, agentId?, url, secret, events (String — serialized list), active, createdAt`.
- `ProcessedWebhookEvent` — `id, provider, eventId, status (String: processed), metaJson?, createdAt`. Unique on `(provider, eventId)` — the idempotency key (see §5).
- `ContactSegment` — `id, workspaceId, name, description?, queryFilter, createdAt, updatedAt` (legacy/parallel to `Segment` — see Landmines).

## 3. Every job status value — exactly as named in code + what each transition triggers

“Job” here means every entity with a `status` field, because the board row asks for “every job status value” and the codebase has no single `Job` model. Values are case-sensitive. Lowercase values are plain `String` fields validated by Zod or by convention; UPPERCASE values are Prisma enums or uppercase string literals — do not normalize between them.

### 3.1 Deal / Opportunity — `Deal.status` (String, Zod: `open | won | lost`)

Source: `api/schemas/opportunities.schema.ts` (`status: z.enum(['open','won','lost']).default('open')`), `api/services/opportunities.service.ts`.

| Value | How it is set | What it triggers today |
|---|---|---|
| `open` | Default on create. Also set explicitly when a deal is moved to a non-won/non-lost stage and `raw.status` is not `won`/`lost`. `updateOpportunity` re-derives: `status = stage.isWon ? 'won' : stage.isLost ? 'lost' : (data.status || 'open')`. | `OpportunityActivityLog` row `type: 'stage_change'` on stage moves. `emitTrigger(workspaceId, 'deal.stage_changed', …)` via `trigger-emitter`. |
| `won` | Set when destination `PipelineStage.isWon === true`, OR when caller passes `status: 'won'` in update. `updateOpportunity` also copies `wonLostReason` / `wonLostNotes` when present. | `OpportunityActivityLog` `type: 'won_lost'`, description `Marked as Won — Reason: …`. `emitTrigger(…, 'deal.won', { dealId, title, value, contactId })`. Stage-change log also written if the stage changed in the same call. |
| `lost` | Set when destination `PipelineStage.isLost === true`, OR when caller passes `status: 'lost'`. Same reason/notes handling as `won`. | `OpportunityActivityLog` `type: 'won_lost'`, description `Marked as Lost — Reason: …`. `emitTrigger(…, 'deal.lost', { dealId, title, reason, contactId })`. |

Stage mechanics: `createOpportunity` validates the stage exists and that `requiredFieldsJson` on the stage are present, else throws `Required fields missing for stage "…": …`. Probability is copied from the stage (`stage.probability`) unless the caller overrides it. `moveOpportunityPipeline` moves a deal to another pipeline's first stage (or a named stage), copies that stage's probability, and writes a `stage_change` log. Pipeline templates in `opportunities.service.ts` (used by pipeline creation helpers) include: Standard (`New Lead 20% → Proposal Sent 60% → Closed 100% isWon`), Trial/Demo (`Trial / Demo Request 15% → Product Demo 35% → POC 65% → Security & Legal 85% → Active Subscription (Won) 100% isWon → Churned / Disqualified 0% isLost`), Services (`Initial Inquiry 10% → Scope 30% → SOW 60% → Contract Sent 85% → Engagement Signed 100% isWon → Declined 0% isLost`), Real Estate (`New Prospect 10% → Showing 30% → Offer Submitted 55% → Under Contract 85% → Deal Closed 100% isWon → Terminated 0% isLost`). The Settings-seeded default pipeline (`api/routes/settings.routes.ts`) is different: `Lead → Qualified → Proposal → Negotiation → Won → Lost` with colors only (no explicit probabilities in that seed). Do NOT assume which template a workspace has — read its `Pipeline` + `PipelineStage` rows.

`Deal` also has `PipelineStage` flags `isWon` / `isLost` (Booleans) — those are the source of truth for won/lost, not `Deal.status` alone. Reporting code counts a deal as won if `d.status === 'won' || d.pipelineStage?.isWon`, lost if `d.status === 'lost' || d.pipelineStage?.isLost`.

### 3.2 `PipelineStage` — no `status` field

Stages are ordered by `order`, with `probability`, `color`, `isWon`, `isLost`, `requiredFieldsJson`. No status enum. Stage moves are the transition mechanism for §3.1.

### 3.3 Task — `Task.status` (String, free-form)

Values seen in code/seed: `pending`, `completed`, `overdue`. `crm.service.ts` counts overdue as `status: 'pending' AND dueDate < now`. `completed` is set by updating the row (no dedicated endpoint — generic `PUT /api/crm/tasks/:id`). No state machine, no triggers on transition. `overdue` is a stored value in seed data, NOT derived at read time — do not assume a task becomes `overdue` automatically.

### 3.4 Appointment — `Appointment.status` (String)

Schema: `String @default("scheduled")` (`prisma/schema.prisma`, `Appointment`). No enum.

Values written in code (`api/services/business.service.ts`):
- `scheduled` — default on create (`createAppointment`: `status: status ?? 'scheduled'`).
- `cancelled` — via `updateAppointment` passthrough; on `prev.status !== new status` + `status === 'cancelled'`, emits `appointment.cancelled`.
- `completed` — via `updateAppointment` passthrough; emits `appointment.completed`.
- `no_show` — excluded (with `cancelled`) from slot-engine availability (`status: { notIn: ['cancelled', 'no_show'] }`), but no writer for `no_show` was found — value exists in filter only.

`pending` is NOT an `Appointment.status` value in code (the earlier map draft mis-attributed a `crm.service.ts` filter type for a different model). Booking writes `scheduled`; cancelling/completing write the status AND emit the trigger.

### 3.5 Contact — `Contact.status` (String, free-form)

Default on create: `'Lead'` (capital L) in `crm.service.ts` (`status: data.status ?? 'Lead'`) and CSV import (`status ? … : 'Lead'`). Seed uses lowercase temperature labels: `hot`, `warm`, `neutral`, `cold`. Frontend `Contacts.tsx` creates with `status: 'Lead'`; `NewContactSlideOver` lifecycle stages are `['Lead', 'Prospect', 'Client']`. There is NO enforced enum — any string can be stored. Briefs must NOT call `Contact.status` an enum. `healthScore` (0–100) drives a Hot/Warm/Cold badge in `ContactHealthScore.tsx` (≥70 Hot, ≥40 Warm, else Cold) but does NOT write `Contact.status`.

### 3.6 Conversation (legacy) — `Conversation.status` (String)

Schema: `String @default("open")`. Values: `open` (default), `closed` (via UI toggle — `src/pages/business/inbox/ConversationsTab.tsx:574` PATCHes `status: open ↔ closed`). `ConversationListPane.tsx:66` also lists `snoozed`, `archived` as filter options, but no writes for `snoozed`/`archived` were found — do not assume those transitions exist for legacy `Conversation`. `ConversationMessage.status` is a free-form `String` with no values found in code — **unverified**.

### 3.7 InboxConversation — `InboxConversation.status` (String)

Values: `pending`, `open`, `resolved`, `snoozed` (from `inbox-conversation.service.ts`, `inbox-report.service.ts`, `inbox-message.service.ts`).

| Transition | Trigger |
|---|---|
| → `open` | When a new `InboxMessage` arrives and the conversation is `pending`, `inbox-message.service.ts` sets `status = 'open'` and updates `lastActivityAt`. |
| → `resolved` | Caller sets `status: 'resolved'`; `inbox-conversation.service.ts` then sets `resolvedAt = new Date()` if not already set. |
| `resolved` → `open` | Caller sets `status: 'open'`; service clears `resolvedAt = null`. |
| → `snoozed` | Caller sets `status: 'snoozed'` (with `snoozedUntil`) — exact UI/API path **unverified**. |
| `pending` | Initial state for a new conversation (inferred from the `pending → open` transition; initial creation value not read in full — **unverified**). |

`InboxMessage.status` — `String @default("sent")` (`prisma/schema.prisma`). `inbox-message.service.ts` `createMessage` never sets `status`, so it is always `sent` in practice. No other writes found.

`InboxChannel.isEnabled` is a Boolean, not a status. `InboxCampaign.status` — `String @default("draft")`, schema comment `draft | active | completed` (`prisma/schema.prisma`, `InboxCampaign`).

### 3.8 Workflow (native) — `Workflow.status` (String, lowercase)

Values: `draft`, `published`, `paused`.

| Transition | Trigger |
|---|---|
| → `draft` | Default on create (`workflows.routes.ts` creates with `status: 'draft'`), on duplicate/copy, on template instantiate. |
| `draft` → `published` | `POST /api/workflows/:id/publish` (routes) sets `status: 'published', engineType: 'native'`. Engine refuses to run in `production` mode unless `workflow.status === 'published'` (`engine.service.ts`). `CrmTriggerSubscription` dispatch only fires for `workflow.status === 'published' AND engineType === 'native'`. |
| `published` → `paused` | `POST /api/workflows/:id/pause` sets `status: 'paused'`. |
| `paused` → `published` | Re-publish (same publish endpoint) — **unverified** whether pause→publish is the only path back. |
| `archived` | **Not a `Workflow.status` value.** `archived` appears as a `WorkflowRun` filter / UI string in some places, but `Workflow.status` in code is only `draft | published | paused`. Do not write `archived` for a workflow. |

### 3.9 WorkflowRun — `WorkflowRun.status` (String, UPPERCASE)

Values: `RUNNING`, `SUCCEEDED`, `FAILED`, `PAUSED`.

| Transition | Trigger |
|---|---|
| → `RUNNING` | `engine.service.ts` creates the run with `status: 'RUNNING'`. Resume (`resumePausedRun`) also sets `status: 'RUNNING', resumeAt: null, waitingNodeId: null`. |
| `RUNNING` → `SUCCEEDED` | Engine completes all nodes without error (`status: 'SUCCEEDED'`). |
| `RUNNING` → `FAILED` | Engine throws / node fails (`status: 'FAILED'`, `errorMessage` set). |
| `RUNNING` → `PAUSED` | A `logic-wait` node pauses the run (waiting for resume time / event); `resume-paused-runs.job.ts` (BullMQ, 1-min interval) resumes due runs. `engine.service.ts` checks `currentRun?.status === 'PAUSED'` before resuming. |

`WorkflowRun` also has `waitingNodeId`, `resumeAt`, `durationMs`, `stepCount`, `errorMessage`, `runData` (serialized JSON).

### 3.10 Agent (legacy) — `Agent.status` / `AgentRun.status` / `AgentRunStep.status`

- `Agent.status` — free-form `String`, default `'draft'` on create (`agents.service.ts`). Observed writes: `'draft'` (default), `'active'` (VoiceAgentBuilder `src/pages/VoiceAgentBuilder.tsx:133-134` sends `status: 'active'` when saving). No `archived` write found. `updateAgent` allows arbitrary passthrough.
- `AgentRun.status` — free-form `String`. Created as `'running'` (`createAgentRun`). Terminal values in `api/routes/agents.routes.ts`: `'success'` (`:212`) / `'failed'` (`:205`) via `updateAgentRun`, which also sets `completedAt`.
- `AgentRunStep.status` — values in `api/routes/agents.routes.ts:201`: `'success'` / `'failed'` (correction: earlier draft said `success|error`; code uses `failed`, not `error`).
- `AIAction.status` — free-form `String`, default `'pending'`, schema comment `pending | approved | rejected` (`prisma/schema.prisma`, `AIAction`).

### 3.11 Email marketing — Campaign / Recipient / Automation

**`Campaign.status`** — Prisma enum `CampaignStatus`: `DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `PAUSED`, `CANCELLED`.

| Transition | Trigger |
|---|---|
| → `DRAFT` | Default on create. Also: editing a `SENT` campaign resets it to `DRAFT` (`campaigns.service.ts`: `...(campaign.status === SENT ? { status: DRAFT } : {})`). |
| `DRAFT` → `SCHEDULED` | `POST /campaigns/:id/schedule` — only when `status === DRAFT`; sets `scheduledAtUtc`. |
| `DRAFT`/`SCHEDULED` → `CANCELLED` | `POST /campaigns/:id/cancel` — only when `status IN (DRAFT, SCHEDULED)`. |
| `SCHEDULED` → `SENDING` | Scheduler (`triggerScheduledCampaigns`, 1-min interval in `server.ts`) picks up campaigns whose `scheduledAtUtc` has passed and sets `SENDING`, then enqueues one BullMQ job per recipient. |
| `SENDING` → `SENT` | Send worker completes; `campaigns.service.ts` sets `status: SENT, sentAtUtc: now`. Direct `POST /campaigns/:id/send` also goes `SENDING → SENT` (with guards: `CANCELLED` throws, `SENDING` and `SENT` have their own guards — see code). |
| `PAUSED` | Enum value exists but no transition code was read that writes `PAUSED` for a `Campaign` — **unverified** how/whether it is used. |

**`CampaignRecipient.status`** — free-form `String` (NOT an enum): `PENDING`, `SENT`, `HOLD`, plus lowercase `'testing'` / `'completed'` inside `abTestConfig` (different field — do not confuse). Transitions: created as `PENDING`; A/B hold logic sets `HOLD` for the losing-variant pool; send worker sets `SENT` + `resendMessageId` via `markRecipientSent`; A/B winner selection flips `HOLD → PENDING` for the winner's held recipients. `SENT` recipients are counted for analytics; `HOLD` recipients are excluded until released.

**`Automation.status`** — Prisma enum `AutomationStatus`: `DRAFT`, `ACTIVE`, `PAUSED`, `ARCHIVED`. `POST /email-marketing/automations` (`api/routes/email-marketing.routes.ts:431`) creates with `status || 'DRAFT'`; `PATCH /email-marketing/automations/:id` (`:457`) allows `status` passthrough (any enum value, no state-machine enforcement). No dedicated activate/pause endpoint — transitions are via generic PATCH. Do NOT assume the `Workflow` publish/pause endpoints apply to `Automation`.

**`AutomationEnrollment.exitReason`** — Prisma enum `EnrollmentExitReason`: `COMPLETED_ALL_STEPS`, `GOAL_MET`, `MANUALLY_REMOVED`, `UNSUBSCRIBED`, `SUPPRESSED`, `CONTACT_DELETED`. `AutomationStepType` enum (step kinds, not statuses): `SEND_EMAIL`, `WAIT`, `CONDITION_BRANCH`, `ADD_TAG`, `REMOVE_TAG`, `UPDATE_FIELD`, `ADD_TO_LIST`, `REMOVE_FROM_LIST`, `WEBHOOK_CALL`, `GOAL_CHECK`, `EXIT_AUTOMATION`. `AutomationTriggerType` enum: `CONTACT_CREATED`, `TAG_ADDED`, `TAG_REMOVED`, `FORM_SUBMITTED`, `LIST_JOINED`, `DEAL_STAGE_CHANGED`, `CUSTOM_FIELD_CHANGED`, `DATE_BASED`, `EMAIL_OPENED`, `EMAIL_LINK_CLICKED`, `MANUAL_ENROLLMENT`, `API_EVENT`.

**`EmailEvent.eventType`** — Prisma enum `EmailEventType`: `SENT`, `DELIVERED`, `DELIVERY_DELAYED`, `OPENED`, `CLICKED`, `BOUNCED`, `COMPLAINED`, `UNSUBSCRIBED`. Written by the Resend webhook handler (see §5) and by the send worker. Hard bounce → `SuppressionEntry` created; soft bounce → not suppressed; spam complaint → suppressed; unsubscribe event → contact unsubscribed.

**`ContactListMembership.status`** — Prisma enum `SubscriptionStatus`: `SUBSCRIBED`, `UNSUBSCRIBED`, `BOUNCED`, `COMPLAINED`, `PENDING_CONFIRMATION`. `ConsentSource` enum: `MANUAL_ADD`, `CSV_IMPORT`, `FORM_SUBMISSION`, `API`, `AUTOMATION`.

**`SendingDomain.status`** — Prisma enum `SendingDomainStatus`: `PENDING`, `VERIFIED`, `FAILED`. `PENDING` on create (Resend `domains.create`, or `mock_dom_…` when no `RESEND_API_KEY`); `domain.updated` webhook sets `VERIFIED` or `FAILED`; `POST /domains/:id/verify` calls `resend.domains.verify` + `domains.get`.

### 3.12 Ads

- `AdAccountStatus` (Prisma enum): `ACTIVE`, `NEEDS_ATTENTION`, `DISCONNECTED`.
- `AdCampaignStatus` (Prisma enum): `ACTIVE`, `PAUSED`, `DRAFT`, `ENDED`, `REJECTED`. `rejectionReason` is set when `REJECTED`.
- `AdType` (enum): `GOOGLE_SEARCH`, `GOOGLE_DISPLAY`, `FACEBOOK_FEED`, `FACEBOOK_LEAD`. `BudgetType`: `DAILY`, `LIFETIME`. `AdPlatform`: `GOOGLE`, `FACEBOOK`.
- `LeadSyncStatus` (Prisma enum): `PENDING`, `SYNCED`, `FAILED`. `syncAttempts`, `syncError`, `syncedAt` track retries.
- `AdWorkspaceSettings` has no status; `leadNotificationMode` is a free-form `String`.

### 3.13 Lead Studio

- `LeadGenerationJob.status` — free-form `String` in schema, `String @default("queued")`, comment `queued | running | completed | failed | expanding` (`prisma/schema.prisma`, `LeadGenerationJob`). Values written in `lead-worker.service.ts`: `running` (on start, with `startedAt`, `progressPct: 5`), `expanding` (during niche expansion, `progressPct: 70`), `completed` (on success), `failed` (on error, with `errorMessage`). Initial creation value is `queued` (schema default).
- `Lead` has no status field. Dedup uses `isDuplicate`, `UserLeadHistory`, `DailyLeadQuota`.

### 3.14 SDR

- `AutonomousSdrAgent.status` — Prisma enum `SdrStatus`: `ACTIVE`, `PAUSED`, `DRAFT`. `SdrMode`: `COPILOT`, `AUTOPILOT`.
- `SdrLeadDossier.status` — Prisma enum `DossierStatus`: `DRAFTED`, `APPROVED`, `SENDING`, `ENGAGED`, `MEETING_BOOKED`, `BOUNCED`, `DECLINED` (`prisma/schema.prisma` + `api/services/sdr/sdr-store.ts:39`). Transitions in `sdr-orchestrator.service.ts`: new dossiers are `DRAFTED` in Copilot mode, `APPROVED` in Autopilot mode (`isAutopilot ? 'APPROVED' : 'DRAFTED'`); approval flow moves `DRAFTED → APPROVED`; sending moves to `SENDING`; `dossiersToApprove = all.filter(d => d.status === 'DRAFTED')`. Writers for `ENGAGED | MEETING_BOOKED | BOUNCED | DECLINED` were not found — enum values confirmed, transition paths for those four remain **unverified**.

### 3.15 Billing / Workspace subscription

- `Workspace.subscriptionStatus` — free-form `String?`. Values written: `active` (checkout verify, portal/webhook success), `inactive` (when normalized plan is `free`), `canceled` (Stripe `customer.subscription.deleted` webhook), plus raw Stripe `sub.status` passthrough on webhook update (`billing.routes.ts:446` `subscriptionStatus: sub.status` — Stripe values like `trialing`, `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused` can land here; no exhaustive list in code because it is passthrough).
- `Workspace.plan` — free-form `String`, schema default `'free'`. No single canonical set in code — three observed sets conflict: schema/frontend type `free | starter | pro | enterprise` (`src/types/workspace.ts:9`); billing checkout accepts `basic, pro, ultra` (`billing.routes.ts:49` `Invalid plan ID: Supported: basic, pro, ultra`); fallbacks use `'free'` / `'pro'` (`settings.routes.ts` returns `plan: 'pro'` on error; `billing.routes.ts` normalizes to `'free'`). Briefs must NOT assume one plan list — read the call site.
- Stripe webhook handler (`billing.routes.ts` `stripeWebhookHandler`) handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and emits `subscription.activated` / `subscription.canceled` triggers. Idempotency via `ProcessedWebhookEvent` (see §5).

### 3.16 Other status fields (no state machine found)

- `UserOnboardingProgress.status` — `String`: `not_started`, `in_progress`, `completed`, `skipped` (from validation test). `PUT /api/onboarding/progress/:tourKey` validates against those four.
- `Release.status` — `String @default("PUBLISHED")`, schema comment `PUBLISHED, ARCHIVED` (`prisma/schema.prisma`, `Release`).
- `HelpCenterArticle.status` — `String @default("draft")`, schema comment `draft | published` (`prisma/schema.prisma`, `HelpCenterArticle`).
- `InboxCampaign.status` — `String @default("draft")`, schema comment `draft | active | completed` (`prisma/schema.prisma`, `InboxCampaign`).
- `Notification` — no status; `read: Boolean`.
- `WebhookEndpoint.active`, `WorkflowSchedule.active`, `WorkflowWebhook.active`, `CrmTriggerSubscription.active`, `ChannelConnection.isActive`, `InboxChannel.isEnabled` — Booleans, not statuses.

## 4. Notifications / messaging — how it works right now

### 4.1 In-app notifications (internal)

- `Notification` table (`id, workspaceId, title, body?, type (String), read, link?, createdAt`). API: `GET /api/notifications` (latest 50, `createdAt desc`), `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`, `DELETE /api/notifications/:id`.
- SSE: `GET /api/notifications/sse` — `text/event-stream`, 15s `ping` events, per-client registry in `notifications.routes.ts` (`sseClients` Set, `broadcastSSE(event, data)`). Frontend hook: `src/hooks/useNotificationsSSE.ts` (+ `useUnreadNotificationsCount.ts`).
- Workflow node `notification-send-internal` (`api/services/workflow-engine/nodes/notification-send-internal.ts`) writes a `Notification` row. No push/email digest for in-app notifications was found — **unverified**.

### 4.2 Email — Resend (transactional + marketing)

- **Provider:** Resend. Client: `new Resend(env.RESEND_API_KEY)` (in `sending-domain.service.ts`; email-send worker uses Resend for sends). Rate limit: `RESEND_RATE_LIMIT_PER_SECOND` (default `10`).
- **Marketing sends:** `api/services/email-marketing/email-send-worker.service.ts` (BullMQ queue `email-marketing-send`) — per-recipient jobs. Sends via Resend with RFC 8058 `List-Unsubscribe` headers. On success: `CampaignRecipient` → `SENT` + `resendMessageId`. On failure: recipient left `PENDING` / retried per queue policy — exact retry policy **unverified**.
- **Templates:** `EmailTemplate.blockJson` (Prisma `Json`) + `Campaign.blockJson` (Json) — block-based content. `mjml-compiler.service.ts` compiles to MJML/HTML. `@templatical/editor` + `@templatical/renderer` also present. `email-marketing-build-spec.md` / `email-marketing-full-spec.md` in `docs/` describe the intended builder — the map records the code, not the spec.
- **Sending domains:** `SendingDomain` + Resend Domains API (`domains.create`, `domains.verify`, `domains.get`, `domains.remove`). DKIM/SPF records stored in `dnsRecords` (Json). `mock_dom_…` IDs are used when `RESEND_API_KEY` is missing (dev fallback — see Landmines).
- **Tracking:** `GET /api/email-marketing/track/click`, `GET /api/email-marketing/track/open` (in `email-marketing.routes.ts`). Opens/clicks write `EmailEvent` rows.
- **Inbound / delivery webhooks:** `POST /api/webhooks/resend` → `resendWebhookHandler` (`api/webhooks/resend-webhook.handler.ts`). Verifies Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) against `RESEND_WEBHOOK_SECRET` — skipped in dev when secret is missing, rejected in production when missing; rejects timestamps older than the replay window (exact window **unverified**). Event map (`RESEND_EVENT_MAP`): Resend `email.sent|delivered|delivery_delayed|opened|clicked|bounced|complained|unsubscribed` → `EmailEventType` enum. Resolves `workspaceId` by looking up `CampaignRecipient.resendMessageId` — NEVER trusts tenant identity from the payload. Hard bounce → `SuppressionEntry`; soft bounce → not suppressed; complaint → suppressed; unsubscribe → membership → `UNSUBSCRIBED`. `domain.updated` → `SendingDomain.status` → `VERIFIED` / `FAILED`.
- **Unsubscribe:** `GET|POST` unsubscribe handlers in `email-marketing.routes.ts` (`handleUnsubscribeGet`, `handleUnsubscribePost`). Exact URL format **unverified** (read the routes file before building).
- **Workflow email node:** `communication-send-email` — sends via a connected Gmail channel (preferred) or Resend (fallback). It does NOT silently fall through to Resend in all cases — it throws when the Gmail path is misconfigured (see the node's comments).

### 4.3 Email — Gmail / Outlook channels (connected inboxes)

- `ChannelConnection` stores OAuth tokens in `credentialsJson` (serialized JSON). Encryption: `api/services/channels/encryption.ts` — AES-256-GCM (`encryptString`, `decryptString`, `encryptJson`, `decryptJson`) with `CHANNEL_ENCRYPTION_KEY` (must be 64-char hex in production). `ApiKey.keyEncrypted` uses the same `encryptString`.
- Gmail: `api/services/channels/gmail.service.ts` — `getGmailAuthUrl(state)`, `exchangeGmailCode`, `sendGmailMessage`, `fetchGmailHistory(connectionId)`. `gmail-poller.ts` — `pollAllGmailAccounts()` (called on a timer in `server.ts` — interval **unverified**). `gmailHistoryId`, `lastPolledAt` on `ChannelConnection`.
- Outlook: `api/services/channels/outlook.service.ts` — `getOutlookAuthUrl`, `exchangeOutlookCode`, `getToken`, `sendOutlookEmail`, `sendOutlookMessage`, `createOutlookSubscription`, `renewOutlookSubscriptions`. Webhook: `POST|GET /api/hooks/outlook-messages` → `outlookWebhookHandler` (`outlookSubscriptionId`, `outlookSubscriptionExpiry` on `ChannelConnection`).
- OAuth callbacks: `GET /api/channels/gmail/connect`, `GET /api/channels/gmail/callback`, `GET /api/channels/outlook/connect`, `GET /api/channels/outlook/callback` (`channels.routes.ts`). Callbacks bypass `resolveWorkspace` JWT (signed `state` param). Success redirects to `/settings?tab=integrations&channel_connected=gmail|outlook`.

### 4.4 SMS — Twilio

- **Provider:** Twilio. `api/services/workflow-engine/nodes/communication-send-sms.ts` — finds an active `ChannelConnection` with `provider: 'twilio'`, reads credentials from `credentialsJson` (`twilioAccountSid` / `accountSid`, `twilioAuthToken` / `authToken`), sends via `twilio(sid, token).messages.create({ from: channelConnection.twilioPhoneNumber ?? creds.twilioPhoneNumber, to, body })`.
- Connect flow: `POST /api/channels/twilio` (in `channels.routes.ts`) — validates via Twilio client, upserts `ChannelConnection` with `provider: 'twilio'`, `twilioPhoneNumber`.
- Inbound: `POST /api/hooks/twilio-sms` → `twilioSmsHandler` (`api/webhooks/twilio-sms.handler.ts`) — validates Twilio signature, claims idempotency via `claimWebhookEvent('twilio', messageSid, …)`, then creates/updates `Conversation` / `ConversationMessage` (exact mapping **unverified** — read the handler before building).
- No SMS templates table was found — message bodies are built inline in the calling code (workflow nodes, SDR, campaigns). **Unverified** whether a shared SMS template system exists.

### 4.5 Voice — Retell

- Provider: Retell (`retell-sdk`, `retell-client-js-sdk`, `RETELL_API_KEY`). `api/services/voice.service.ts` — `getRetellClient()`, `createWebCall(params)`, `listVoices()`, `searchVoices(query, provider?: 'elevenlabs' | 'cartesia' | 'minimax' | 'fish_audio')`, `addVoice(params)`. Voice agent builder UI: `src/pages/VoiceAgentBuilder.tsx`, `src/components/voice/*`. Webhook/event handling for Retell calls — **unverified** (no Retell webhook file was found in `api/webhooks/`).

### 4.6 Meta / Facebook leads + ads

- Webhooks: `GET|POST /api/hooks/facebook-leads` (`facebook-leads.webhook.ts`), `GET|POST /api/hooks/meta` (`meta.handler.ts`). Both verify the Meta verify token, claim idempotency, and create leads / `AdLead` rows. Exact mapping **unverified**.
- Ads services: `api/services/ads/` — `ads-account.service.ts`, `ads-campaign.service.ts`, `ads-metrics.service.ts`, `ads-lead.service.ts`, `ads-settings.service.ts`, `ads-ai.service.ts`, `facebook-ads.service.ts`, `google-ads.service.ts`. Background jobs: `ads-metrics-sync.job.ts`, `google-ads-lead-poll.job.ts` (both BullMQ workers).

### 4.7 Realtime / SSE (internal messaging bus)

- `api/services/channels/realtime.service.ts` — `initRealtime()` (called in `startServer` after listen). If `REDIS_URL` is set: Redis pub/sub (`ioredis`, two clients). If not: in-memory `EventEmitter` fallback (`localEmitter`, max 100 listeners).
- Channels: `workspace:{workspaceId}:conversations`, `workspace:{workspaceId}:inbox`, `widget:{conversationId}:inbox`. Publishers: `publishConversationEvent`, `publishInboxEvent`, `publishWidgetEvent`. Subscribers: `subscribeToWorkspace`, `subscribeToInbox`, `subscribeToWidget` (with ref-counted Redis subscribe/unsubscribe).
- Notifications SSE is separate (`notifications.routes.ts` `sseClients` Set) — NOT the same bus as `realtime.service.ts`. Do not conflate them.

### 4.8 Internal trigger bus (workflow triggers)

- `api/services/trigger-emitter.service.ts` — `emitTrigger(workspaceId, event, payload)` (never throws). Event names (`StoneAIOEvent`): `contact.created|updated|deleted|tag_added|health_score_changed`, `deal.created|updated|stage_changed|won|lost`, `form.submitted`, `conversation.message_received|message_sent`, `appointment.booked|cancelled|completed`, `review.received`, `campaign.sent|opened|clicked`, `agent.call_started|call_ended`, `payment.received|failed`, `subscription.activated|canceled`, `sequence.enrolled|completed`, `task.created|completed`.
- Dispatch: looks up `CrmTriggerSubscription` rows (`workspaceId, entityType, eventType, active: true`), filters by `workflow.status === 'published'` + `engineType === 'native'` + optional `filtersJson.pipelineId|stageId|tagName`, then enqueues via `queueService.enqueue({ workspaceId, workflowId, triggerData: { event, entityType, eventType, data: payload }, mode: 'production' })`.
- `review.received` is an event name with no known emitter — **unverified** whether any code emits it today. This matters for the Google-review-requests feature: there is NO existing “review request sent” flow, and NO existing “job completed → review request” trigger. The feature must be built from the job-completion moment (Deal/Task/Appointment completion — see the Blueprint), not from `review.received`.

### 4.9 Webhook idempotency

- `infrastructure/database/idempotency.ts` — `claimWebhookEvent(provider, eventId, meta?)`. Creates `ProcessedWebhookEvent { provider, eventId, status: 'processed', metaJson }`. On Prisma `P2002` / unique-constraint error → returns `false` (duplicate, caller must skip). On other errors → logs and returns `true` (fail-open, so a transient DB error does not drop webhooks). Providers seen: `stripe`, `twilio`, `meta`, `resend`, `outlook`.
- Stripe webhook (`billing.routes.ts`) also uses this. Twilio SMS handler claims by `messageSid`. Resend handler does NOT use `claimWebhookEvent` (it resolves by `resendMessageId` and always returns 200 quickly) — **unverified** whether Resend duplicate deliveries are deduped elsewhere.

### 4.10 AI / Copilots (messaging-adjacent)

- Gemini: `packages/ai/client.ts` (`GoogleGenAI`, `DEFAULT_MODEL = 'gemini-2.5-flash'`). `api/routes/ai.routes.ts` — unified Gemini endpoints with CRM function declarations. `api/services/email-marketing/ai-copilot.service.ts`, `api/services/inbox/copilot.service.ts`, `api/routes/email-copilot.routes.ts`, `api/routes/inbox-copilot.routes.ts`, `src/components/crm/CRMAIAssistant.tsx`, `src/components/ai/AIAssistant.tsx`.
- SDR: `api/services/sdr/` — `sdr-orchestrator.service.ts`, `reply-classifier.service.ts`, `sdr-store.ts`. Dossier flow in §3.14.
- Workflow AI: `api/routes/workflow-ai.routes.ts`, `packages/ai/prompts/workflow-gen.v1.ts`.

## 5. Settings structure + how to add a new setting

### 5.1 There is NO central `Settings` table

Settings are scattered across five places. A brief that says “add a setting to Settings” must name which of these it means:

| Settings surface | Where it lives in code | How it is read/written |
|---|---|---|
| **Workspace settings** | `Workspace` fields (`name, plan, stripeCustomerId, stripeSubscriptionId, subscriptionStatus, creditsUsed, creditsLimit`) | `GET /api/settings/workspace`, `PUT /api/settings/workspace` (creates the workspace + seeds a default pipeline if none exists). Frontend: `src/pages/Settings.tsx` tab `general`. |
| **API keys** | `ApiKey` (`workspaceId, provider, keyEncrypted`) — AES-256-GCM via `encryptString`, `CHANNEL_ENCRYPTION_KEY`. Unique `(workspaceId, provider)`. | `GET /api/settings/api-keys` (returns `••••` + last 4), `PUT /api/settings/api-keys` (`requireRole('admin')`, body `{ provider, key }`). Frontend: Settings tab `api` / `integrations` (see below). |
| **Integrations** | `Integration` (`workspaceId, provider, accessToken, refreshToken?, scopes?, expiresAt?, accountId?`) + `ChannelConnection` (OAuth channels — Gmail/Outlook/Twilio, see §4.3–4.4) | `GET /api/settings/integrations` (returns `{ provider, connected: true, accountId }`). Channel connect flows in `api/routes/channels.routes.ts`. Frontend: Settings tab `integrations`. |
| **Per-feature settings tables** | `AdWorkspaceSettings` (ads), `InboxChannel.settingsJson` (inbox widget — serialized JSON string), `Workflow.settingsJson` / `variablesJson` (workflows), `Automation.triggerConfig` / `canvasJson` (email automations), `Campaign.abTestConfig` | Each feature's own routes/services. No shared settings API. |
| **Team / security** | `WorkspaceMember` (roles), plus stub endpoints in `settings.routes.ts` (see §5.3) | `GET /api/settings/team`, `POST /api/settings/team/invite` (`requireRole('admin')`), `DELETE /api/settings/team/:userId` (`requireRole('admin')`), `PUT /api/settings/password`, `GET /api/settings/2fa/setup`, `POST /api/settings/2fa/verify`, `GET /api/settings/sessions`, `DELETE /api/settings/sessions/:sessionId`. |

### 5.2 Settings UI — `src/pages/Settings.tsx`

Tabs (`TABS`): `general`, `billing` (Billing & Plans), `appearance`, `integrations`, `api` (API & Webhooks), `notifications`, `team`, `security`. Tab is driven by `?tab=` query param. `INTEGRATIONS` list in the same file includes Twilio (fields `twilio_sid`, `twilio_token`, `twilio_from`), Resend (`resend` API key), Google & Gmail, plus others (read the file for the full list). The `notifications` tab has NO backend settings API — it renders `Notification` list / preferences UI only (exact persistence **unverified**).

### 5.3 How to add a NEW setting (the pattern to follow)

1. **Decide where it lives.** Business-level toggle/value (e.g. “Automatic review requests” + Google review link + message template): the codebase has no generic key-value settings table, so the correct pattern is one of:
   - (a) Add columns to an existing settings-holding model (e.g. new fields on `Workspace` for workspace-wide settings, or on the feature's own settings model like `AdWorkspaceSettings`), with a Prisma migration; OR
   - (b) Add a new dedicated model (e.g. `WorkspaceReviewSettings`) if the setting has its own lifecycle / relations; OR
   - (c) Store it in an existing `*Json` serialized-JSON column (e.g. `InboxChannel.settingsJson`, `Workflow.settingsJson`) — ONLY if the setting belongs to that entity and the team accepts string-JSON storage (see Landmines).
   - Do NOT invent a generic `Settings` table without checking with the Blueprint — there is no such table today, and a new one is a schema decision.
2. **Prisma migration.** Add the field(s) to `prisma/schema.prisma`, run `npx prisma migrate dev` (dev) / `prisma migrate deploy` (prod via `npm start` / Dockerfile). Regenerate the client (`npx prisma generate`).
3. **API.** Add `GET` / `PUT` handlers in the owning routes file (e.g. `api/routes/settings.routes.ts` for workspace-level, or the feature's routes file for feature-level). Follow the existing pattern: `resolveWorkspace` provides `req.workspaceId`; guard writes with `requireRole('admin')` when the setting is admin-only (see `PUT /api/settings/api-keys`); validate with Zod (`api/middleware/validate.ts` + `api/schemas/*`); return the workspace-scoped value, never another workspace's.
4. **Frontend.** Add the UI to the owning Settings tab in `src/pages/Settings.tsx` (or the feature's settings page, e.g. `src/pages/ads/AdsSettings.tsx`, `src/pages/crm/Settings.tsx`, `src/pages/automations/AutomationsSettings.tsx`). Follow the tab's existing field pattern (label, input, save → `PUT`).
5. **Defaults.** New booleans default OFF unless the Blueprint says otherwise (the Google-review-requests spec says default OFF — that matches the pattern of `doubleOptIn`, `isEnabled`, etc.). New text fields default empty. Backfill: existing workspaces get the default on first read (or via migration default) — do not assume a migration backfills unless the migration sets a `@default`.
6. **Secrets.** If the setting is a credential / API key, store it via `encryptString` (AES-256-GCM, `CHANNEL_ENCRYPTION_KEY`) in `ApiKey` / `ChannelConnection`, NEVER plaintext. Never log it. Never return it in full from `GET` (return `••••` + last 4, as `GET /api/settings/api-keys` does).

### 5.4 Env / config settings (deploy-time, NOT user settings)

`infrastructure/config/env.ts` (Zod) is the ONLY place for deploy-time config. Production guardrails (`NODE_ENV === 'production'`): `DATABASE_URL` must be `postgresql://`/`postgres://` (never `file:`/SQLite); `CLERK_SECRET_KEY` required; `CHANNEL_ENCRYPTION_KEY` must be exactly 64-char hex. Full env list in `.env.example` (see §1). Adding a new env var means: add it to `envSchema` in `env.ts` + `.env.example` + `Dockerfile`/`railway.json`/`render.yaml` docs if needed. Do NOT read `process.env.X` directly in feature code — import `env` from `infrastructure/config/env.ts`.

### 5.5 Stub / fake settings endpoints (do not build on these)

`api/routes/settings.routes.ts` contains several validated stubs that return hardcoded / fake data: `PUT /api/settings/password` (validated stub, does not change a Clerk password), `GET /api/settings/2fa/setup` (returns a deterministic fake TOTP secret + `api.qrserver.com` QR URL), `POST /api/settings/2fa/verify` (accepts any 6-digit code), `GET /api/settings/sessions` (returns a single hardcoded `session_current` / `Chrome on Windows` / `127.0.0.1`), `DELETE /api/settings/sessions/:sessionId` (always `{ success: true }`). Treat all of these as **not implemented**. A brief that says “use the 2FA/session settings” must budget for a real implementation.

## 6. Users, roles, permissions (brief)

- **Identity:** Clerk is the identity provider. `User.clerkId` is the Clerk user ID (`payload.sub` from `verifyToken`). `User.id` is the internal Prisma ID. Frontend uses `@clerk/clerk-react` (`ClerkProvider`, `SignedIn`, `useAuth`); backend verifies the JWT in `resolveWorkspace`.
- **Workspace resolution:** `api/middleware/workspace.ts` (`resolveWorkspace`). Every authenticated `/api/*` request resolves `req.userId` + `req.workspaceId` from `WorkspaceMember` (`where: { userId }`, first match). If no membership exists, it atomically creates `User` (upsert by `clerkId`) + `Workspace` (`name: 'My Stone AIO Workspace'`, `plan: 'free'`, `ownerId: userId`) + `WorkspaceMember` (`role: 'admin'`) in a transaction. `req.workspaceId` is then used for ALL queries — multi-tenant isolation is by `workspaceId` filter, not by row-level security.
- **Dev bypass:** If `CLERK_SECRET_KEY` is missing and `NODE_ENV !== 'production'`, `resolveWorkspace` sets `req.userId = 'test_user_new'` and still looks up membership (so dev can test provisioning). In production with no `CLERK_SECRET_KEY`, it returns `500` (and `env.ts` would already have exited). SSE clients pass the JWT as `?token=` query param (EventSource cannot set headers) — accepted as fallback only, never for mutating requests (per the middleware comment).
- **Roles:** `WorkspaceMember.role` is a free-form `String`. Values seen in code: `admin` (default for a new workspace owner, required for `PUT /api/settings/api-keys`, `POST /api/settings/team/invite`, `DELETE /api/settings/team/:userId`), `member` (default in `POST /api/settings/team/invite` when `role` is omitted), `owner` (mentioned only in `requireRole` docstring example: `requireRole('admin', 'owner')` — no code was found that assigns `owner` as a stored role — **unverified** whether `owner` is a real role or just a doc example). `Workspace.ownerId` is a separate field (the Clerk user ID of the workspace creator) and is NOT the same as `WorkspaceMember.role`.
- **Enforcement:** `api/middleware/requireRole(...roles)` — must run AFTER `resolveWorkspace`. Looks up `WorkspaceMember` by `(workspaceId, userId)`; `401` if workspace context missing, `403` if not a member, `403` with `{ required, current }` if role is not in the allowed list. Most routes do NOT use `requireRole` — they rely on `resolveWorkspace` + `workspaceId` scoping alone. Do not assume a route is admin-only unless it explicitly uses `requireRole`.
- **Frontend gating:** `Protect` wrapper in `App.tsx` (with `withAuth` flag). No role-based UI gating was read in full — **unverified** whether the frontend hides admin-only UI for non-admins.
- **Secrets / encryption:** `CHANNEL_ENCRYPTION_KEY` (AES-256-GCM, 64-char hex in prod) encrypts `ApiKey.keyEncrypted`, `ChannelConnection.credentialsJson` (via `encryptJson`/`decryptJson`), `WorkflowCredential.dataEncrypted`. Never log decrypted credentials. `Integration.accessToken` / `refreshToken` are stored as plaintext `String` in the DB (no encryption call found) — **unverified** whether that is intentional; treat as a landmine, not a pattern to copy.

## 7. Landmines for brief-writers

1. **“Job” is not a model.** There is no `Job` table. “When a job is marked complete” in a brief means one of: `Deal` (Opportunity) → `won`/`lost` via stage, `Task` → `completed`, `Appointment` → completed (status value unverified), `WorkflowRun` → `SUCCEEDED`, `LeadGenerationJob` → `completed`, or a job in the queue sense (BullMQ). A Blueprint must name which one. The Google-review-requests brief says “when a job is marked complete” — the Blueprint must pin this to `Deal` stage → `won` (or `Task`/`Appointment`, per Jack's intent) and say so explicitly.
2. **Two conversations systems, two workflow engines, two “Automation” concepts.** Legacy `Conversation` vs new `InboxConversation`; legacy `Agent`/`AgentRun` vs native `Workflow`/`WorkflowRun`; email-marketing `Automation` vs native `Workflow` vs `AutomationTable` (unrelated tables feature). Briefs that say “conversation”, “automation”, or “workflow” without qualifying which one will be misbuilt. Use the table names.
3. **Two “opportunities” APIs.** `api/routes/crm.routes.ts` (`/api/crm/deals`) and `api/routes/opportunities.routes.ts` (`/api/opportunities`) both operate on `Deal`. They are NOT two tables. Prefer `/api/opportunities` for pipeline/stage/reason/custom-field work (it has the stage/required-field logic); `/api/crm/deals` is the older CRUD path.
4. **String-JSON columns are NOT `Json` columns.** Most `*Json` fields (`tagsJson`, `customFieldsJson`, `definitionJson`, `settingsJson`, `targetingJson`, `creativeJson`, `filtersJson`, `cells`, …) are `String` columns holding serialized JSON. They must be `JSON.parse` / `JSON.stringify`’d in code. Only a few fields are native Prisma `Json` (`AIAction.args/result`, `Segment.filterDefinition`, `EmailTemplate.blockJson`, `Campaign.blockJson/abTestConfig`, `Automation.triggerConfig/canvasJson`, `AutonomousSdrAgent.targetIcp/sequenceConfig`, `SdrLeadDossier.sequenceSteps/metrics`, `SendingDomain.dnsRecords`). A brief that says “query by JSON field” must say which kind.
5. **`Deal.status` vs `PipelineStage.isWon/isLost`.** `Deal.status` (`open|won|lost`) is derived from the stage flags on create/update/move. Do not set `Deal.status` directly without also moving the stage (or the UI and the status will disagree). Reporting counts a deal as won if EITHER `status === 'won'` OR `stage.isWon`.
6. **Case matters for statuses.** `Deal.status` is lowercase (`open|won|lost`). `WorkflowRun.status` is UPPERCASE (`RUNNING|SUCCEEDED|FAILED|PAUSED`). `Campaign.status` is UPPERCASE enum. `CampaignRecipient.status` is UPPERCASE string. `InboxConversation.status` is lowercase. `Contact.status` is free-form with both `Lead` (capital) and `hot|warm|cold` in use. Never normalize case in a brief.
7. **`Contact.status` is NOT an enum.** Any string is allowed. `Lead` is the default, `hot|warm|cold|neutral` are seed/UI conventions, `Prospect|Client` are `NewContactSlideOver` lifecycle labels. Do not write “Contact.status must be one of …” unless the Blueprint adds a Zod enum + migration.
8. **Settings are scattered (see §5).** There is no `Settings` table. “Add a setting” must name the owning model + API + UI tab.
9. **Stub endpoints look real.** Password / 2FA / sessions in `settings.routes.ts` return fake data (see §5.5). Do not build on them.
10. **Mock fallbacks when env is missing.** `SendingDomain` uses `mock_dom_…` IDs when `RESEND_API_KEY` is missing. `bullmq.ts` uses in-memory mock queues/workers when `REDIS_URL` is missing. `realtime.service.ts` falls back to an in-memory emitter when `REDIS_URL` is missing. `settings.routes.ts` `GET /workspace` returns a fake `{ name: 'Stone AIO', plan: 'pro' }` on DB error. These fallbacks mean “it worked locally” does NOT prove the real provider path works.
11. **`PORT` mismatch.** `env.ts` defaults `PORT` to `4000`; `.env.example` sets `PORT=3000` and `VITE_APP_URL=http://localhost:3000`. Vite dev server is `5173` with `/api` proxy → `:4000`. A brief that says “the app is on port 3000” is ambiguous — name the process (Vite vs API) and the port.
12. **`infrastructure/database/client.js` exists alongside `client.ts`.** `client.ts` is the source (TS, `PrismaClient`, global `__prisma`). `client.js` is a checked-in compiled CommonJS artifact (`"use strict"`, `require("@prisma/client")`). Imports in code use `client.js` specifier per TS ESM convention (`import { db } from '.../client.js'`); with `tsconfig.server.json` (`module: Node16`) + `tsx`, that resolves to `client.ts`. Do NOT edit `client.js` — edit `client.ts` only.
13. **Root scratch files.** `check.ts`, `check_runs.ts`, `debug_email.ts`, `old_contact_detail.txt`, `opps.txt` at repo root are scratch/debug artifacts. Do not import them or treat them as specs.
14. **Duplicate `/inbox` mount in `App.tsx`.** Two `<Route path="/inbox">` entries exist (Conversations vs Inbox layouts). First match wins. A brief that says “the /inbox page” must say which layout.
15. **`review.received` trigger is defined but has no emitter.** `trigger-emitter.service.ts:21` lists `'review.received'`, `trigger-crm-event.ts:27` offers it as “Review Received”, `Settings.tsx:86` has a `review_received` notification pref — but no `emitTrigger(..., 'review.received', …)` call was found. Do not build a review feature on `review.received` — there is no code that emits it today. Build from the job-completion moment.
16. **Build / typecheck / tests status (see Baseline §8 + Prep re-run).** Original baseline: `npm run build` FAILED on `react-shim`; `typecheck` OOMed. Prep re-run 2026-10-15: `npm run build` PASSED twice (exit 0, `✓ built in 22-28s`, no `react-shim` error — discrepancy vs baseline, no code changed, cause not fully determined, watch on next run); `typecheck` with `NODE_OPTIONS=--max-old-space-size=8192` completed with 207 real TS errors (exit 2, mostly `TS7006` implicit `any` + `TS2305` missing Prisma exports because client not generated); `npm test` still 63/64 pass, 4 files fail (3 Prisma suites + 1 Clerk test). A Blueprint that says “run build/tests to verify” must budget for the pre-existing typecheck + test failures — they are NOT caused by new work. Dev server: Vite UI serves (HTTP 200 on `:5173`), API does NOT start (Prisma client missing — `PrismaClient` export error).
17. **Prisma client is NOT generated in a fresh checkout.** `npx prisma generate` needs to download engines; in this sandbox the download failed with `ECONNRESET` (see Baseline). Tests that import `@prisma/client` fail until `generate` succeeds. Do not assume `npm install` alone makes the server runnable.
18. **`Integration.accessToken` is plaintext — oversight, not a pattern.** `api/routes/integrations.routes.ts` upsert stores `accessToken` directly with no `encryptString`. Contrast: `AdAccount.accessToken` IS encrypted (`ads-account.service.ts:146` `encryptString(p.access_token)`), `ApiKey.keyEncrypted` IS encrypted (`settings.routes.ts`). Do not copy the `Integration` plaintext pattern for new credentials — use `encryptString` / `ApiKey` / `ChannelConnection` pattern.
19. **Frontend `Settings.tsx` `notifications` tab has no backend API — confirmed.** Toggles are local React state only (`setNotifPrefs`); Save button only shows `toast('success', 'Notification preferences saved!')` with no API call. A brief that says “add a notification preference” must include a backend model + API, not just UI.
20. **Seed data is NOT production data.** `prisma/seed.ts` uses hardcoded IDs (`ws_demo`, `ct_alice`, `dl_1`, …) and fake people/companies. Never use seed IDs in a brief as if they are real.

## 8. Baseline build / test results (recorded BEFORE any code change)

Recorded on branch `agent/software-map`, base `374ed22`, Node `v24.20.0`, npm `10.9.4`, in this sandbox (no `DATABASE_URL`, no `REDIS_URL`, no provider keys, no `.env` — only `.env.example`).

| Command | Result |
|---|---|
| `npm install` (full, with postinstall) | **FAIL** — `npm error code 1`, `path …/node_modules/@prisma/engines`, `command sh -c node scripts/postinstall.js`, `Error: aborted … code: 'ECONNRESET', attemptNumber: 1, retriesLeft: 2` (Prisma engines download aborted by network). Repeated twice, same failure. |
| `npm install --ignore-scripts` | **PASS** — `added 984 packages in 20s` (plus deprecation warnings for `whatwg-encoding`, `uuid@8`, `scmp`, `node-domexception`, `glob@10/11`). Used as the install baseline. |
| `npm run typecheck` (`tsc --noEmit`) | **FAIL (environment)** — `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` after ~50s (`Scavenge 2040MB`, `Mark-Compact 2042MB`). No type errors were reported before OOM. Not a code fix — do NOT “fix” by changing code; re-run with more heap if a type baseline is needed. |
| `npm run build` (`vite build`) | **FAIL (pre-existing)** — `✓ 3034 modules transformed`, then `✗ Build failed in 29.74s`, `src/shims/react-shim.ts (3:7): "default" is not exported by "node_modules/react/cjs/react.development.js", imported by "src/shims/react-shim.ts"`. The shim does `import ReactDev from '../../node_modules/react/cjs/react.development.js'` and `(ReactDev as any).default || ReactDev`. |
| `npm test` (`vitest run`) | **PARTIAL FAIL (pre-existing)** — `Test Files 4 failed | 13 passed (17)`, `Tests 1 failed | 63 passed (64)`, duration `34.63s`. Failed suites (all pre-existing): `api/webhooks/__tests__/resend-domain-webhook.test.ts` (`Error: Cannot find module '.prisma/client/default'` — Prisma client not generated), `api/services/email-marketing/__tests__/sending-domain.service.test.ts` (same Prisma error), `api/services/sdr/__tests__/sdr-orchestrator.test.ts` (same Prisma error, via `infrastructure/database/client.js`). Failed test: `src/components/tour/__tests__/tour_render.test.tsx > renders AppShell without crashing` (`Error: @clerk/clerk-react: SignedIn can only be used within the <ClerkProvider />`). Passing suites include `calendar`, `emailDeliverabilityUtils`, `env_validation`, `abTestUtils`, `workspace_security`, `validation_routes`, `onboarding_workspace`, `sequenceScheduler`, `crm.service`, `ThemeContext`, `idempotency`, `button`, `ErrorBoundary`. |
| Dev server (`npm run dev`) / DB migrations | **NOT RUN** — no database, no env, Prisma client not generated. Do NOT claim the server was run. A future Blueprint that needs a running server must provision Postgres + Redis + `DATABASE_URL`/`REDIS_URL` + `npx prisma generate` + `npx prisma migrate deploy` first. |

No code was changed to fix any baseline failure. All failures above are pre-existing.

### Prep re-run 2026-10-15 (same branch, same base `374ed22`, `.env` created from `.env.example` with safe dev defaults: SQLite `file:./prisma/dev.db`, `NODE_ENV=development`, empty/dummy keys, `VITE_DEV_AUTH_BYPASS=false`, `REDIS_URL=""`)

| Command | Result |
|---|---|
| `npx prisma generate` | **FAIL** — `Error: aborted … code: 'ECONNRESET', attemptNumber: 1, retriesLeft: 2` (same Prisma engines download failure). Engines cache `~/.cache/prisma/master/.../debian-openssl-3.0.x/` is empty. `node_modules/.prisma/` still does not exist. No code changed. |
| `npm test` (`vitest run`) | **PARTIAL FAIL (same as baseline)** — `Test Files 4 failed | 13 passed (17)`, `Tests 1 failed | 63 passed (64)`, duration `64.39s`. Same 3 Prisma suites (`resend-domain-webhook`, `sending-domain.service`, `sdr-orchestrator` — `Cannot find module '.prisma/client/default'`) + same 1 Clerk test (`tour_render` `SignedIn can only be used within <ClerkProvider />`). |
| `npm run build` (`vite build`) | **PASS (differs from baseline — discrepancy noted)** — `✓ built in 27.85s` (first run) and `✓ built in 22.46s` (re-run, true exit `0`), no `react-shim` error. No app code changed between baseline and re-run. Cause of baseline-vs-rerun difference not fully determined (possible: `node_modules` state / Vite cache / `.env` presence). Watch on next run; do NOT claim the baseline failure is fixed. |
| `npm run typecheck` with `NODE_OPTIONS=--max-old-space-size=8192` | **FAIL (real type errors, not OOM)** — true exit `2`, 207 `error TS` lines across 21 files. Top: `campaigns.service.ts` 42, `business.service.ts` 42, `ads-metrics.service.ts` 27, `crm.service.ts` 21, `opportunities.service.ts` 18. Mostly `TS7006` implicit `any` + `TS2305` missing Prisma exports (`PrismaClient`, `EmailEventType`, `SubscriptionStatus`, `SendingDomainStatus`, `CampaignStatus`, `Prisma`) because the Prisma client is not generated. Plain `npm run typecheck` (no heap flag) OOMs as in baseline. No code changed. |
| Dev server smoke (`npm run dev`) | **PARTIAL** — Vite UI on `:5173` serves `GET /` → HTTP `200`, 2582 bytes HTML. API on `:4000` does NOT start: `SyntaxError: The requested module '@prisma/client' does not provide an export named 'PrismaClient'` (`infrastructure/database/client.ts:1`), so `GET /api/health/live` and `GET /api/health/ready` fail (connection refused, HTTP `000`). Server stopped cleanly after test. No screenshots captured (API down, UI only serves shell). |

## 9. Unverified — do not build on these without reading the code first

Prep update 2026-10-15: 26 of 29 §9 sub-items were resolved by reading the code (see “Resolved in prep” below). 3 remain partially open. Do not treat the resolved items as unverified anymore — cite the file:line in Blueprints.

### Resolved in prep 2026-10-15 (verified from code)

- `AdLead.contact` — 1-to-1, `Contact` owns the FK (`Contact.adLeadId`). `syncLeadToCrm` (`api/services/ads/ads-lead.service.ts:104-150`): if a `Contact` with this `adLeadId` exists → mark `SYNCED`, no new `Contact`; else if email matches an existing `Contact` → update that `Contact` with `source` + `adLeadId`, mark `SYNCED`; else create a new `Contact` (`source` `GOOGLE_ADS`/`FACEBOOK_ADS`, `status: 'Lead'`, `adLeadId`), mark `SYNCED`.
- `VoiceAgentBuilder` / Retell webhook — `api/routes/voice-agents.routes.ts` HAS `POST /webhook`: `call_started` → `agent.call_started`, `call_ended` → `agent.call_ended` (with transcript/summary/sentiment). BUT the router is NOT mounted in `server.ts` (no import, no `app.use`) — webhook is dead until mounted. Frontend calls `/api/voice-agents/*` will 404.
- `Appointment.status` — `String @default("scheduled")`. Writes: `scheduled` (default, `business.service.ts:179`), `cancelled`/`completed` via `updateAppointment` passthrough (emits `appointment.cancelled` / `appointment.completed` on status change). `no_show` appears only in slot-engine exclusion filter. No `pending` write for `Appointment`.
- `Automation.status` — enum `DRAFT/ACTIVE/PAUSED/ARCHIVED`, default `DRAFT`. `POST /email-marketing/automations` creates with `status || 'DRAFT'`; `PATCH` allows `status` passthrough, no state-machine enforcement.
- `Agent.status` — `String @default("draft")`. Observed: `draft`, `active` (`VoiceAgentBuilder.tsx:133-134` sends `status: 'active'`). No `archived` write found.
- `AgentRun.status` — create `'running'`; terminal `'success'` / `'failed'` (`api/routes/agents.routes.ts:205,212`).
- `AgentRunStep.status` — `'success'` / `'failed'` (`agents.routes.ts:201`). Correction: code uses `failed`, not `error`.
- `AIAction.status` — `String @default("pending")`, comment `pending | approved | rejected`.
- `InboxMessage.status` — `String @default("sent")`. `createMessage` never sets it — always `sent` in practice.
- `InboxCampaign.status` — `String @default("draft")`, comment `draft | active | completed`.
- `Release.status` — `String @default("PUBLISHED")`, comment `PUBLISHED, ARCHIVED`.
- `HelpCenterArticle.status` — `String @default("draft")`, comment `draft | published`.
- `LeadGenerationJob.status` — `String @default("queued")`, comment `queued | running | completed | failed | expanding`. Initial = `queued`.
- `Workflow` `paused → published` — `Workflow.status`: `draft` (create) → `published` (`POST /:id/publish-native`, `workflows.routes.ts:625`) / `paused` (`POST /:id/pause-native`, sets `status: 'paused'`, deactivates schedules/webhooks/CRM subs). `paused → published` = re-publish (re-activates schedules/webhooks/subs).
- `WorkflowRun` `PAUSED` resume — `RUNNING` → `SUCCEEDED` (all nodes ok) / `FAILED` (`failRun`) / `PAUSED` (`logic-wait` node, `resumeAt = now + durationMs`). Resume: `resume-paused-runs.job.ts` queries `status: 'PAUSED', resumeAt <= now`, engine resume sets `RUNNING, resumeAt: null, waitingNodeId: null`.
- `Resend` dedup — No dedup in Resend handler: no `claimWebhookEvent`, no `ProcessedWebhookEvent` check in `resend-webhook.handler.ts`. Contrast: Stripe/Twilio/Meta use idempotency (see §5).
- `Integration.accessToken` plaintext — Oversight. `integrations.routes.ts` upsert stores `accessToken` directly, no `encryptString`. Contrast: `AdAccount.accessToken` IS encrypted (`ads-account.service.ts:146`), `ApiKey` IS encrypted. Do not copy the `Integration` pattern.
- `client.js` vs `client.ts` — `client.ts` is the source; `client.js` is a checked-in compiled CommonJS artifact. Imports use `.js` specifier per TS ESM convention; `tsx` resolves to `.ts`. Edit `client.ts` only.
- `voice-agents.routes.ts` mount — NOT mounted in `server.ts` (no import, no `app.use`). See Retell webhook above.
- `Settings.tsx` `notifications` tab — NOT persisted. Local state only; Save button only shows a toast, no API call.
- Frontend role gating — No frontend hiding found. Backend `requireRole('admin')` enforces `PUT /api-keys`, `POST /team/invite`, `DELETE /team/:userId`. Frontend shows admin UI to all; backend rejects non-admins.
- `review.received` — Trigger type defined (`trigger-emitter.service.ts:21`, `trigger-crm-event.ts:27`, `Settings.tsx:86`), NO emitter (`emitTrigger(..., 'review.received', …)`) found.
- SMS templates — No shared system. Only `ThreadPane.tsx` placeholder `"Send SMS… (/ for templates)"`. No `SmsTemplate` model.
- `Conversation.status closed` — Toggle `open ↔ closed` via PATCH (`ConversationsTab.tsx:574`). UI filter also lists `snoozed`, `archived`, but no writes for those found for legacy `Conversation`.
- Resend replay window — 5 minutes. `resend-webhook.handler.ts`: `svix-timestamp` >5 min old → reject.
- Email-send-worker retry — Attempts 4 (initial + 3 retries), exponential backoff 30s (`email-send-worker.service.ts:16,44-45`).
- Gmail poll interval — Every 2 minutes. `gmail-poller.ts`: “Called by cron every 2 minutes”, `pollAllGmailAccounts` polls all active Gmail connections.
- Stripe `sub.status` — Passthrough. `billing.routes.ts:446` stores live Stripe `sub.status` directly, plus code writes `active` / `inactive` / `canceled` in fallbacks. No exhaustive list in code.

### Still partially open (do not build on these without reading the code)

- `Campaign.status PAUSED` (email `Campaign`) — Enum `CampaignStatus` includes `PAUSED`, but NO writer for email `Campaign` `PAUSED` was found. `PAUSED` writes found are for `AdCampaign` only (`ads-campaign.service.ts:259`). Do not assume email campaigns can be paused via a backend path until a writer is found.
- `SDR DossierStatus` transitions beyond `DRAFTED → APPROVED → SENDING` — Enum full set confirmed (`DRAFTED/APPROVED/SENDING/ENGAGED/MEETING_BOOKED/BOUNCED/DECLINED`). Writers for `ENGAGED | MEETING_BOOKED | BOUNCED | DECLINED` not found.
- `Workspace.plan` full value set — No single canonical set. Schema default `'free'`; frontend type `free | starter | pro | enterprise` (`src/types/workspace.ts:9`); billing checkout accepts `basic, pro, ultra` (`billing.routes.ts:49`); fallbacks use `'free'` / `'pro'`. Read the call site; do not assume one list.

## 10. What Changed (for this map task)

### Prep update 2026-10-15 (no app code changed)

- **Summary:** Prep to be the best Coding Agent for Stone AIO. Resolved 26 of 29 §9 unverified sub-items from code, re-ran baseline with `.env` + heap flag, wrote playbooks in `~/workspace/coding-agent-playbooks/` (workspace only, NOT in repo). No app code changed. No board rows touched. No merge to main.
- **Changes by area:** `docs/software-map.md` only — §3 status values corrected (§3.4, §3.6, §3.7, §3.10, §3.11 Automation, §3.13, §3.14, §3.15, §3.16), §7 landmines updated (§7 items 12, 15, 16, 18, 19), §8 baseline + prep re-run, §9 resolved/partially-open rewrite, this §10 entry. No other repo files changed. `.env` created locally from `.env.example` (safe dev defaults, SQLite, empty keys) — gitignored, not committed.
- **How it works:** Map is now tighter for Blueprints: status values cite file:line, `voice-agents` unmounted + `Integration` plaintext flagged as real findings, `Workspace.plan` conflict called out.
- **Screenshots:** None — docs + baseline work, no UI build. Dev server smoke: Vite UI HTTP 200 on `:5173`, API down (Prisma client missing) — no screenshots claimed.
- **Verification:** `npx prisma generate` FAIL `ECONNRESET` (engines cache empty). `npm test` 63/64 pass, 4 files fail (same as baseline). `npm run build` PASS twice (exit 0) — differs from baseline FAIL, discrepancy noted, no code changed. `typecheck` with 8GB heap: exit 2, 207 TS errors (mostly `TS7006` + `TS2305` missing Prisma exports). Dev smoke: UI 200, API connection refused.
- **Deviations:** None from prep brief. Did NOT fix `react-shim`, type errors, Prisma generate, or any app code. Did NOT create board rows. Did NOT merge.
- **Known limitations:** 3 §9 items remain partially open (`Campaign PAUSED` writer, SDR `ENGAGED+` transition writers, `Workspace.plan` canonical set). Build baseline discrepancy (FAIL → PASS) needs watching. Prisma client still not generated — API cannot start until engines download succeeds.
- **Rollback:** Revert this map commit on `agent/software-map` only (`git revert` / reset). No `main` changes to revert. Delete local `.env` if needed (it is gitignored).

### Original map task (2026-10-15)

- **Summary:** Added the Software Map (`docs/software-map.md`) on branch `agent/software-map`. No application code changed. No feature work.
- **Changes by area:** `docs/software-map.md` (new file, this map). No other files changed.
- **How it works:** The map is a read-only audit. Blueprints must cite its entity names, status values, and route names. When reality disagrees, the builder flags it in Deviations and updates the map.
- **Screenshots:** None — this task is a docs audit, not a UI build. No screenshots were required by the board row.
- **Verification:** Baseline in §8 (`npm install --ignore-scripts` pass; `npm install` full fail on Prisma engines; `typecheck` OOM; `build` fail on `react-shim`; `tests` 63/64 pass with 3 Prisma suites failing). No code was changed to fix failures.
- **Deviations:** (1) Clone used HTTPS (`https://github.com/jackstonemedia/StoneAIOMainSystem.git`) instead of SSH (`git@github.com:…`) because outbound SSH is blocked in this sandbox (`muse: Outbound SSH is turned off for this assistant… switch ssh from Deny to Ask` + `Connection reset by 198.19.0.1 port 3128`). The SSH deploy key was confirmed “Key added” by Jack, but the sandbox permission blocks SSH. HTTPS clone succeeded and was used read-only for the audit. (2) `npm install` full fails on Prisma engines download; `--ignore-scripts` was used to get a working `node_modules` for the audit. (3) Branch push to GitHub is blocked by the same SSH restriction (see board row note) — the branch exists locally and the map is in Notion; push is pending Jack enabling SSH in Muse settings.
- **Known limitations:** Map covers the code as read; items in §9 are marked unverified. Dev server was not run (no DB/Redis/env). Push to GitHub pending SSH permission.
- **Rollback:** Delete branch `agent/software-map` locally (`git branch -D agent/software-map`) and delete the Notion “Software Map” page. No `main` changes to revert.
