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
| AI | Google Gemini via `@google/genai` (`packages/ai/client.ts`, `DEFAULT_MODEL = 'gemini-3.8-flash'`, env-overridable via `GEMINI_MODEL`) and `@google/generative-ai` (legacy import still present). |
| Email | Gmail-only sending via the workspace Gmail OAuth connection (`api/services/channels/gmail.service.ts`); the `resend` package was REMOVED 2026-10-21 and the Resend webhook handler + mount are gone. MJML (`mjml`) + `@templatical/editor` / `@templatical/renderer` for templates. Vestigial names kept deliberately: `CampaignRecipient.resendMessageId` (holds the Gmail message id), `SendingDomain.resendDomainId`, `RESEND_RATE_LIMIT_PER_SECOND` (a plain send rate limit). |
| Feature flags | `infrastructure/config/features.ts` (backend, `FEATURE_*` env) + `src/config/features.ts` (frontend, `VITE_FEATURE_*` env). Flags: ads, sdr, leads, agents, marketplace, assistant, projects, reputation, inboxHelpCenter, legacyAi — ALL default OFF and undocumented in `.env.example` (see §7). The assistant + legacy AI mounts are flag-gated (see §1.1). |
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
                             #   inbox/, leads/, sdr/, workflow-engine/, business, agents, voice,
                             #   assistant/ (Stone AI Assistant, §12.6), agent/ (legacy agent, §12.5),
                             #   agent-evals/ (eval harness + grading), billing/ (plans, plan-guard)
    middleware/              # workspace.ts, requireRole.ts, validate.ts, error.ts, resolveInboxChannel.ts
    schemas/                 # Zod schemas: validation.ts, opportunities.schema.ts, ads.schemas.ts
    jobs/                    # ads-metrics-sync, google-ads-lead-poll, resume-paused-runs
    webhooks/                # facebook-leads, forms, meta, outlook-messages, twilio-sms
                             #   (resend-webhook deleted with the Resend removal; the
                             #   /api/webhooks/inbox stub router was deleted 2026-11-07 — see §12.7)
    utils/                   # logger.ts
  infrastructure/
    config/env.ts            # Zod env schema + production guardrails (see §5)
    config/features.ts       # feature flags (see stack table above)
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
                             #   automations/, inbox/, conversations/, ads/, business/, leads/, sdr/,
                             #   assistant/ (8 pages: Assistant, Projects, ProjectDetail, Settings,
                             #   Memory, Scheduled, Activity, Artifacts), legal/ (Terms, Privacy)
    components/              # crm/, dashboard/, email-marketing/, builder/, ads/, voice/, tour/, ui/,
                             #   assistant/ (MarkdownRenderer, AssistantPanel)
    hooks/ / lib/ / store/ / context/ / constants/ / data/
    shims/                   # react-shim.ts + use-sync-external-store shims (see Baseline — build failure)
  docs/                      # email-marketing specs, production-readiness-outline, superpowers/
  scripts/                   # refactor-fetch.cjs
  public/ / index.html / .github/ / .agents/ / .superpowers/ / types/ / infrastructure/
  check.ts / check_runs.ts / debug_email.ts / old_contact_detail.txt / opps.txt  # scratch/debug files at root
```

#### 1.1 API routes mounted in `server.ts`

All `/api/*` after the webhook mounts go through `resolveWorkspace` (JWT → `req.workspaceId` / `req.userId`), except the explicitly public webhook mounts. Order in `server.ts`:

- Public (before `resolveWorkspace`): `GET /api/health`, `GET /api/health/ready`, `GET /api/health/live`, `POST /api/hooks/twilio-sms`, `POST /f/:workspaceId` (external form capture), `POST|GET /api/hooks/outlook-messages`, `GET|POST /api/hooks/facebook-leads`, `GET|POST /api/hooks/meta` (moved above the wildcard 2026-11-07 — it used to sit below it and never ran), `app.all('/api/hooks/*', webhookHandler)` (workflow webhooks — 404s unknown paths, so every specific hook MUST be registered above it), `POST /api/webhooks/stripe` + `/api/stripe/webhook`, `GET /api/email-marketing/track/click`, `GET /api/email-marketing/track/open`. The Resend webhook mount and the dead stub router `/api/webhooks/inbox/*` are both gone (deleted 2026-10-21 and 2026-11-07 respectively).
- Authenticated (`app.use('/api', resolveWorkspace)` then): `/api/ai`, `/api/ai/actions`, `/api/workflow-ai`, `/api/conversations` (all four gated by `FEATURE_LEGACY_AI`, default off — the legacy agent, §12.5), `/api/assistant` (gated by `FEATURE_ASSISTANT`, default off — the new assistant, §12.6), `/api/crm/actions`, `/api/agents`, `/api/integrations`, `/api/releases`, `/api/opportunities`, `/api/crm`, `/api/business`, `/api/settings`, `/api/notifications`, `/api/billing` (also mounted at `/api` for Stripe + public forms), `/api` (onboarding progress), `/api/workflows`, `/api/tables`, `/api/channels`, `/api/ads`, `/api/leads`, `/api/inbox` (+ `/api/inbox/copilot`, copilot gated by `FEATURE_LEGACY_AI`), `/api/widget` (inbox widget, public-ish), `/api/email-marketing`, `/api/sdr`.
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
| `api/routes/inbox-copilot.routes.ts` | `/api/inbox/copilot` (legacy-AI gated) |
| `api/routes/inbox-widget.routes.ts` | `/api/widget` — public widget |
| `api/routes/assistant.routes.ts` | `/api/assistant` (flag-gated) — conversations, messages, regenerate, edit, temporary, projects + files/links, tool-call approve, scheduled tasks + manual execute |
| `api/routes/channels.routes.ts` | `/api/channels` — gmail/outlook/twilio connect + callbacks |
| `api/routes/voice-agents.routes.ts` | (imported? — file exists; mount is via `business`/`agents` flows — see Unverified) |
| `api/routes/email-copilot.routes.ts`, `inbox-copilot.routes.ts`, `workflow-ai.routes.ts`, `tables.routes.ts`, `releases.routes.ts` | as mounted above |

#### 1.2 Frontend routes (`src/App.tsx`)

`AppRoutes` uses `BrowserRouter`. Public: `/`, `/login`, `/signup`, `/sso-callback`, `/onboarding`. Inside `<AppShell>`: `/automations` (+ `/automations/:id` → `WorkflowBuilder`, tables, releases, settings; `/workflows` redirects to `/automations`), `/inbox` (chat / manual-actions / snippets / trigger-links), `/business` (index, analytics, reputation), `/business/calendar`, `/calendar` aliases → `/business/calendar`, `/crm` (contacts, contacts/:id, companies, companies/:id, opportunities, opportunities/:id, opportunities/settings/pipelines|fields|tags, tasks, documents, smart-lists, bulk-actions, settings; `/opportunities` aliases → `/crm/opportunities`, `/pipeline` → `/crm/opportunities`), `/marketplace`, `/billing` → `/settings?tab=billing`, `/settings`, `/leads` (Lead Studio), `/email-marketing` (campaigns, campaigns/new, campaigns/:id, automations, automations/new, automations/:id, audience, templates, suppression, analytics), `/inbox` (second mount — `InboxLayout`: index, reports, contacts, help-center, settings/channels|teams|labels|canned-responses — note the duplicate `/inbox` mount in `App.tsx`; first match wins in React Router), `/conversations` (index, :id, settings/channels|templates|tags), `/ads` (overview, campaigns, campaigns/:id, reports, settings). Fullscreen (no sidebar): `/ads/campaigns/new`, `/ads/campaigns/new/:type`, `/ads/campaigns/:id/edit`. Catch-all redirects to `/opportunities`.

Auth gating: `Protect withAuth={withAuth}`; when `VITE_CLERK_PUBLISHABLE_KEY` is absent, `App` renders `AppRoutes withAuth={false}` and login/signup redirect to `/crm`.

`/assistant` (8 routes: index, projects, projects/:id, settings, memory, scheduled, activity, artifacts) renders only when frontend `FEATURES.assistant` is on, else `<Navigate to="/dashboard">`. Public legal pages: `/terms`, `/privacy` (drafted 2026-10-27, counsel review still owed). The OLD dashboard AI panel (`CRMAIAssistant`, imported in `src/components/dashboard/v2/TopBanner.tsx`, posts to `/api/agent/chat`) is still mounted alongside the new assistant — it is dead unless `FEATURE_LEGACY_AI` is on (see §12.6).

## 2. Core data model (from `prisma/schema.prisma`)

All models are workspace-scoped via `workspaceId` except `ProcessedWebhookEvent` (global, keyed by `provider` + `eventId`), `User` (keyed by `clerkId`), and `WorkflowTemplate` (optional `workspaceId`, system templates have `isSystem=true`). IDs are `String` (CUID-style via Prisma default — check `schema.prisma` for `@default(cuid())` per model; the map lists names + key fields, not every scalar).

### 2.1 Tenancy + identity

- `Workspace` — `id, name, ownerId, plan, stripeCustomerId?, stripeSubscriptionId?, subscriptionStatus? (String, free-form — see Billing), trialEndsAt? (7-day trial, Billing Core), creditsUsed, creditsLimit, agentMode (String, default 'approve' — the LEGACY agent's mode), agentName (String, default 'AI Agent'), createdAt, updatedAt`. Relations to nearly every other model (members, agents, contacts, companies, deals, apiKeys, integrations, appointments, conversations, pipelines, tasks, smartLists, notifications, customFields, tags, webhookEndpoints, attachments, wonLostReasons, opportunitySavedViews, opportunityActivityLogs, automationFolders, automationTables, Release, workflows, workflowRuns, workflowCredentials, workflowSchedules, workflowWebhooks, crmTriggerSubscriptions) plus the legacy-agent relations (`agentConversations, agentAuditLogs, agentMemories, agentTokenUsage, agents`) and the new assistant's `AssistantWorkspaceSettings` (see §2.9).
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
- `SendingDomain` — `id, workspaceId, domain, resendDomainId (vestigial name — holds `local_<timestamp>` ids since the Resend removal; see §11.6), status (SendingDomainStatus enum: PENDING | VERIFIED | FAILED), region?, dnsRecords (Json), createdAt, verifiedAt?`. Domain verification is direct DNS checks now (SPF/DKIM/DMARC TXT), not the Resend Domains API.

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
- `ChannelConnection` — `id, workspaceId, userId, provider (String: gmail | outlook | twilio), label?, email? (connected address, or the phone number for Twilio), credentialsJson (String — AES-256-GCM encrypted JSON, see §5), isActive, twilioPhoneNumber?, outlookSubscriptionId?, outlookSubscriptionExpiry?, gmailHistoryId?, lastPolledAt?, dailySendLimit, sentTodayCount, lastSentAt?, lastResetAt?, status (String: ACTIVE | WARMUP | PAUSED | DISCONNECTED | ERROR), consecutiveBounces, minDelaySeconds, maxDelaySeconds, warmupDay, createdAt, updatedAt`. Unique on `(workspaceId, provider, email)` per schema `@@unique` (verified 2026-11-07).
- `Notification` — `id, workspaceId, title, body?, type (String), read (Boolean), link?, createdAt`.
- `WebhookEndpoint` — `id, workspaceId, agentId?, url, secret, events (String — serialized list), active, createdAt`.
- `ProcessedWebhookEvent` — `id, provider, eventId, status (String: processed), metaJson?, createdAt`. Unique on `(provider, eventId)` — the idempotency key (see §5).
- `ContactSegment` — `id, workspaceId, name, description?, queryFilter, createdAt, updatedAt` (legacy/parallel to `Segment` — see Landmines).

### 2.9 Stone AI Assistant models (added 2026-11-07, Jack's Phases 0–10 — see §12.6)

These 12 models power the NEW assistant (`api/services/assistant/`). They are separate from the legacy agent's models (`AgentConversation`, `AgentMemory`, `AgentTokenUsage`, `AgentAutonomyGrant`, `AgentAuditLog` — see §12.5). **There is NO migration for these tables** (last migration is still `20261028_prod_catchup`) — `prisma migrate deploy` will NOT create them in prod; the dev DB only has them because the scaffold generator builds from the schema. This is launch gap #1.

- `AssistantConversation` — `id, workspaceId, userId, title, projectId?, pinnedAt?, mode (String), thinking (String), createdAt, updatedAt`. Relations: `messages, toolCalls`.
- `AssistantMessage` — `id, workspaceId, conversationId, userId, role, parts (Json), thoughtSignatures (Json?), status, model?, inputTokens, outputTokens, feedback (Json?), searchableText?, createdAt, updatedAt`.
- `AssistantToolCall` — `id, workspaceId, userId, conversationId?, messageId?, taskRunId?, source, toolName, risk (String: read | write | send | destructive | hardstop), args (Json), status, result (Json?), error?, approvedByUserId?, decidedAt?, executedAt?, createdAt, updatedAt`. Approval claiming is atomic (`updateMany` where `status: 'pending'` → `'running'`).
- `AssistantSettings` — per-user: `id, workspaceId, userId, defaultMode, thinking, voice, speed, memoryEnabled, pastChatSearch, notify (Json), createdAt, updatedAt`. Unique on `(workspaceId, userId)`.
- `AssistantWorkspaceSettings` — per-workspace ceilings: `id, workspaceId, maxMode, fullAutonomyRoles (Json, default `["owner", "admin"]`), requireApprovalFor (Json), bulkThreshold, dailyLimits (Json), enabled, createdAt, updatedAt`.
- `AssistantUsage` — `id, workspaceId, userId, day (String), messages, searches, researchRuns, images, tokens, createdAt, updatedAt`. Unique on `(workspaceId, userId, day)`. **Billing reads the OLD `AgentTokenUsage`, not this table — the new assistant is unmetered** (launch gap #2).
- `AssistantMemory` — `id, workspaceId, userId, key, value, category, createdAt, updatedAt`. User-scoped by design (personal memory is invisible to other members).
- `AssistantScheduledTask` — `id, workspaceId, userId, title, prompt, cron, mode, status, lastRunAt?, nextRunAt?, createdAt, updatedAt`. Relations: `runs`. **No cron runner calls `executeTask` — manual trigger only** (launch gap).
- `AssistantTaskRun` — `id, workspaceId, taskId, status, resultText?, error?, inputTokens, outputTokens, startedAt, completedAt?`.
- `AssistantProject` — `id, workspaceId, userId, name, description?, color, icon, instructions?, visibility, archivedAt?, createdAt, updatedAt`. Relations: `files, links`.
- `AssistantProjectFile` — `id, workspaceId, projectId, fileName, mimeType, size, storageUrl?, extractedText?, status, createdAt, updatedAt`.
- `AssistantProjectLink` — `id, workspaceId, projectId, entityType, entityId, label?, createdAt`.


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
- Stripe webhook handler (`billing.routes.ts` `stripeWebhookHandler`) handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, and emits `subscription.activated` / `subscription.canceled` triggers. Idempotency via `ProcessedWebhookEvent` (see §5). Raw-body trap fixed 2026-11-07 (§12.8): `constructEvent` now uses `req.rawBody` (captured before `express.json()`); before the fix every production event 400'd on the parsed object.

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

### 4.2 Email — Gmail-only sending (Resend REMOVED 2026-10-21)

- **Provider:** Gmail OAuth only. The `resend` package was removed (final cleanup `00e5dbf`, email-builder branch, merged 2026-10-21 as `683aac6`); the Resend webhook handler + mount are gone. Campaign sending was always Gmail OAuth (`api/services/channels/gmail.service.ts`); an API key alone cannot send Gmail. Vestigial names kept deliberately: `CampaignRecipient.resendMessageId` (holds the Gmail message id), `SendingDomain.resendDomainId`, `RESEND_RATE_LIMIT_PER_SECOND` (a plain send rate limit).
- **Marketing sends:** `api/services/email-marketing/email-send-worker.service.ts` (BullMQ queue `email-marketing-send`) — per-recipient jobs. Sends via Gmail with RFC 8058 `List-Unsubscribe` headers. On success: `CampaignRecipient` → `SENT` + `resendMessageId` (the Gmail id). On failure: recipient left `PENDING` / retried per queue policy (attempts 4, initial + 3 retries, exponential backoff 30s — see §9 resolved). **Complete-plan gating:** `createCampaign` + `sendCampaign` assert plan `complete` (`campaigns.service.ts`); every non-GET workflows route requires `complete` (`workflows.routes.ts`).
- **Templates:** `EmailTemplate.blockJson` (Prisma `Json`) + `Campaign.blockJson` (Json) — block-based content. `mjml-compiler.service.ts` compiles to MJML/HTML. `@templatical/editor` + `@templatical/renderer` also present. `email-marketing-build-spec.md` / `email-marketing-full-spec.md` in `docs/` describe the intended builder — the map records the code, not the spec.
- **Sending domains:** `SendingDomain` + direct DNS checks (SPF TXT `v=spf1`, DKIM TXT `v=DKIM1` under common selectors, DMARC TXT `v=DMARC1` under `_dmarc`). DKIM/SPF records stored in `dnsRecords` (Json). No provider Domains API anymore.
- **Tracking:** `GET /api/email-marketing/track/click`, `GET /api/email-marketing/track/open` (in `email-marketing.routes.ts`). Opens/clicks write `EmailEvent` rows. Click tokens are HMAC-signed (`TRACKING_SECRET`).
- **Bounces:** RFC 3464 delivery-status notifications parsed from the Gmail mailbox via the poller (`gmail-bounce.service.ts`, runs on the same 2-min cadence). Hard bounce → `SuppressionEntry` + BOUNCED; soft bounce → 3-strike rule. **Complaint gap: Gmail does not notify senders of spam complaints for API-sent mail, so complaint-rate alerts cannot fire from real data** (mitigation: unsubscribe link + bounce/engagement monitoring).
- **Unsubscribe:** `GET|POST` unsubscribe handlers in `email-marketing.routes.ts` (`handleUnsubscribeGet`, `handleUnsubscribePost`). Exact URL format **unverified** (read the routes file before building).
- **Workflow email node:** `communication-send-email` — sends via a connected Gmail channel. It throws when the Gmail path is misconfigured (see the node's comments); there is no provider fallback anymore.
- **Ticks (30s interval in `email-marketing.routes.ts`):** `processDueReactions` → `processDueSequenceSteps` → `processDueAbWinners` → `processHealthAutoPause` → `processColdDrip`, alongside `processScheduledCampaigns` + `processDripSequences`. Plus the Gmail poller (2-min cron in `server.ts`, also runs the bounce scan). The 1-min scheduled-campaign cron also lives in `server.ts`.

### 4.3 Email — Gmail / Outlook channels (connected inboxes)

- `ChannelConnection` stores OAuth tokens in `credentialsJson` (serialized JSON). Encryption: `api/services/channels/encryption.ts` — AES-256-GCM (`encryptString`, `decryptString`, `encryptJson`, `decryptJson`) with `CHANNEL_ENCRYPTION_KEY` (must be 64-char hex in production). `ApiKey.keyEncrypted` uses the same `encryptString`.
- Gmail: `api/services/channels/gmail.service.ts` — `getGmailAuthUrl(state)`, `exchangeGmailCode`, `sendGmailMessage`, `fetchGmailHistory(connectionId)`. `gmail-poller.ts` — `pollAllGmailAccounts()` (called on a timer in `server.ts` — interval **unverified**). `gmailHistoryId`, `lastPolledAt` on `ChannelConnection`.
- Outlook: `api/services/channels/outlook.service.ts` — `getOutlookAuthUrl`, `exchangeOutlookCode`, `getToken`, `sendOutlookEmail`, `sendOutlookMessage`, `createOutlookSubscription`, `renewOutlookSubscriptions`. Webhook: `POST|GET /api/hooks/outlook-messages` → `outlookWebhookHandler` (`outlookSubscriptionId`, `outlookSubscriptionExpiry` on `ChannelConnection`).
- OAuth callbacks: `GET /api/channels/gmail/connect`, `GET /api/channels/gmail/callback`, `GET /api/channels/outlook/connect`, `GET /api/channels/outlook/callback` (`channels.routes.ts`). Callbacks bypass `resolveWorkspace` JWT (signed `state` param). Success redirects to `/settings?tab=integrations&channel_connected=gmail|outlook`.

### 4.4 SMS — Twilio

- **Provider:** Twilio. `api/services/workflow-engine/nodes/communication-send-sms.ts` — finds an active `ChannelConnection` with `provider: 'twilio'`, reads credentials from `credentialsJson` (`twilioAccountSid` / `accountSid`, `twilioAuthToken` / `authToken`), sends via `twilio(sid, token).messages.create({ from: channelConnection.twilioPhoneNumber ?? creds.twilioPhoneNumber, to, body })`.
- Connect flow: `POST /api/channels/twilio` (in `channels.routes.ts`) — validates via Twilio client, upserts `ChannelConnection` with `provider: 'twilio'`, `twilioPhoneNumber`.
- Inbound: `POST /api/hooks/twilio-sms` → `twilioSmsHandler` (`api/webhooks/twilio-sms.handler.ts`, verified 2026-11-07) — resolves the workspace from `ChannelConnection` by `To` number (per-workspace creds take precedence, env `TWILIO_*` fallback), validates `X-Twilio-Signature` in production only via `twilio.validateRequest`, claims idempotency via `claimWebhookEvent('twilio', messageSid, …)`, find-or-creates the CRM `Contact` by phone, find-or-creates `Conversation` (`channel: 'sms'`, `externalId: From`, contact-phone fallback + externalId stamping), creates `ConversationMessage` (direction inbound, media URLs in `attachments` JSON), bumps `unreadCount`/`lastMessageAt`, publishes `new_message` on the realtime bus. Empty body + no media is acked and ignored (delivery receipts). The signature URL is reconstructed from `PUBLIC_APP_URL` first, then `VITE_APP_URL`, then the request (`trust proxy` is set so `req.protocol` is correct behind Render/Railway) — before 2026-11-07 it used `VITE_APP_URL` alone, which is unset in a Render deploy, so every inbound SMS failed validation with a 403. Twilio console must point each number's Messaging webhook at `https://<domain>/api/hooks/twilio-sms`. The old stub `POST /api/webhooks/inbox/twilio` was deleted 2026-11-07 (it only logged the payload, and sat behind `resolveWorkspace` JWT so it 401'd in production anyway). New conversations are created with `unreadCount: 0` since 2026-11-07 (§12.8) — the first message lands at 1 via the increment, not 2.
- No SMS templates table was found — message bodies are built inline in the calling code (workflow nodes, SDR, campaigns). **Unverified** whether a shared SMS template system exists.

### 4.5 Voice — Retell

- Provider: Retell (`retell-sdk`, `retell-client-js-sdk`, `RETELL_API_KEY`). `api/services/voice.service.ts` — `getRetellClient()`, `createWebCall(params)`, `listVoices()`, `searchVoices(query, provider?: 'elevenlabs' | 'cartesia' | 'minimax' | 'fish_audio')`, `addVoice(params)`. Voice agent builder UI: `src/pages/VoiceAgentBuilder.tsx`, `src/components/voice/*`. Webhook/event handling for Retell calls — **unverified** (no Retell webhook file was found in `api/webhooks/`).

### 4.6 Meta / Facebook leads + ads

- Webhooks: `GET|POST /api/hooks/facebook-leads` (`facebook-leads.webhook.ts`) and `GET|POST /api/hooks/meta` (`meta.handler.ts`). The Meta handler (verified 2026-11-07): GET verifies `hub.verify_token` against `META_WEBHOOK_VERIFY_TOKEN`; POST verifies `X-Hub-Signature-256` (HMAC-SHA256 over the raw body, `META_APP_SECRET`; raw body is captured before `express.json()` because a route-level `express.raw()` after the global json parser is a no-op — verified empirically; secret unset → warn once and accept, dev parity), resolves the workspace from the `Integration` table by Page/Instagram account id, find-or-creates `Conversation` (`channel: facebook|instagram`, `externalId: senderId`) + `ConversationMessage` (inbound), bumps `unreadCount`/`lastMessageAt`. It does NOT claim idempotency and does NOT create leads/`AdLead` rows. WhatsApp (`object: 'whatsapp'`) is silently dropped — no WhatsApp surface is wired. Before 2026-11-07 the Meta mounts sat BELOW the workflow wildcard `app.all('/api/hooks/*')`, which 404s unknown paths, so Meta inbound never reached the handler at all. The old stub `POST /api/webhooks/inbox/meta` was deleted 2026-11-07. The sibling Facebook Leads handler (`facebook-leads.webhook.ts`) is verified the same way (HMAC-SHA256 over the raw body, `FACEBOOK_ADS_APP_SECRET`) and verification is mandatory when the secret is configured — fixed 2026-11-07 (§12.8) from an inverted guard that dropped signed deliveries and ingested unsigned ones. New conversations are created with `unreadCount: 0` since 2026-11-07 (§12.8) — first message lands at 1 via the increment, not 2.
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
16. **Build / typecheck / tests status (see Baseline §8).** The Oct 15 baseline is history: on main `08fe8fc` (2026-11-07) typecheck is 0 errors, build passes, full suite is 590/590 (with `.env` present and the env refreshed — `npm install --ignore-scripts` + `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate`). The old red baseline (build failing on `react-shim` without `.env`, typecheck OOM, 63/64 tests) is superseded — but the `.env` dependency is real: **the build FAILS on `src/shims/react-shim.ts` when no `.env` file exists** (it sets `NODE_ENV=development`); always copy `.env` into scratch worktrees before building. A stale `node_modules` + stale Prisma client produces ~104 fake typecheck errors — refresh the env before reporting a red baseline.
17. **Prisma client is NOT generated in a fresh checkout.** `npx prisma generate` needs to download engines; in this sandbox the download failed with `ECONNRESET` (see Baseline). Tests that import `@prisma/client` fail until `generate` succeeds. Do not assume `npm install` alone makes the server runnable.
18. **`Integration.accessToken` is plaintext — oversight, not a pattern.** `api/routes/integrations.routes.ts` upsert stores `accessToken` directly with no `encryptString`. Contrast: `AdAccount.accessToken` IS encrypted (`ads-account.service.ts:146` `encryptString(p.access_token)`), `ApiKey.keyEncrypted` IS encrypted (`settings.routes.ts`). Do not copy the `Integration` plaintext pattern for new credentials — use `encryptString` / `ApiKey` / `ChannelConnection` pattern.
19. **Frontend `Settings.tsx` `notifications` tab has no backend API — confirmed.** Toggles are local React state only (`setNotifPrefs`); Save button only shows `toast('success', 'Notification preferences saved!')` with no API call. A brief that says “add a notification preference” must include a backend model + API, not just UI.
20. **Seed data is NOT production data.** `prisma/seed.ts` uses hardcoded IDs (`ws_demo`, `ct_alice`, `dl_1`, …) and fake people/companies. Never use seed IDs in a brief as if they are real.
21. **Feature flags default OFF and are undocumented in `.env.example`.** `FEATURE_ASSISTANT` / `VITE_FEATURE_ASSISTANT` (and `FEATURE_LEGACY_AI`) must be set in prod or the assistant 404s and `/assistant` redirects to `/dashboard`. A brief that adds a flagged surface must include the flag + `.env.example` + checklist updates.
22. **The workflow webhook wildcard eats later mounts.** `app.all('/api/hooks/*', webhookHandler)` 404s any path not in the workflow registry without calling `next()`. Every provider webhook MUST be registered above it. This already bit Meta once (2026-11-07: the mounts sat below it and inbound Meta never ran).
23. **A route-level `express.raw()` after the global `express.json()` is a no-op.** Body-parser skips when `req._body` is already set (verified empirically). Fixed 2026-11-07 for all four signature paths (Meta, Facebook Leads, Stripe ×2): the pre-json middleware in `server.ts` captures the raw bytes for all of them and handlers read `req.rawBody`. Any NEW signature-verified webhook must be added to that middleware's path list — never mount it with a route-level `raw()`.
24. **`VITE_APP_URL` is not a server URL.** Twilio signature validation needs the exact public URL Twilio called. `VITE_APP_URL` is a frontend build-time var and is unset in a Render deploy (render.yaml sets only `NODE_ENV`) — building the URL from it alone 403s every inbound SMS in production (fixed 2026-11-07: `PUBLIC_APP_URL` first). Server-side URL reconstruction must use `PUBLIC_APP_URL`.
25. **The 12 Assistant\* tables have no migration.** `prisma/migrations/` ends at `20261028_prod_catchup`. Any brief touching the new assistant must include a hand-authored migration, or prod `migrate deploy` will not create the tables. Same rule applies to any schema change: `prisma db push` cannot download the schema engine in this sandbox (Cloudflare 404) — schema changes go to dev via the scaffold generator and to the repo via hand-authored migration files.
26. **Two assistant surfaces, two agent stacks.** The old dashboard panel (`CRMAIAssistant`, `/api/agent/chat`, modes approve/autonomy/read-only, 27 tools) and the new assistant (`/assistant`, `/api/assistant`, modes read_only/draft/full, 45 tools) are separate implementations that share nothing. The 88% eval (125/142) measured the OLD route only. A brief must name which assistant it targets, and must not cite the old eval for the new one.

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

### Baseline 2026-11-07 (main `08fe8fc`, after env refresh — SUPERSEDES the Oct 15 baseline above)

Recorded on branch `agent/inbox-webhooks` / `agent/software-map-refresh`, Node `v24.22.1`, npm `10.9.4`, local `.env` present (Postgres `DATABASE_URL`, `VITE_DEV_AUTH_BYPASS=true`, `NODE_ENV=development`, real `GOOGLE_AI_API_KEY`, NO `FEATURE_*` vars). Env refreshed first (`npm install --ignore-scripts` + `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate`) — a stale env on this main reads 104 fake typecheck errors + a build failure on unresolvable `react-markdown`; that is a stale-env artifact, not broken main.

| Command | Result |
|---|---|
| `npm run typecheck` (`NODE_OPTIONS=--max-old-space-size=8192`) | **PASS** — 0 errors. |
| `npm run build` | **PASS** — `✓ built in ~19s`. (FAILS on `react-shim` without `.env` — see Landmine 16.) |
| `npm test` (`vitest run`) | **PASS** — `Test Files 76 passed (76)`, `Tests 604 passed (604)` on the webhook branch (590/590 on main + 14 new webhook tests). |
| Dev DB rebuild #13 | Postgres package wiped by VM replacement; `apt-get install postgresql-16` via retry loop, cluster started, baseline 57 tables → scaffold generator 130 tables (incl. the 12 Assistant\* tables), seed + membership fix clean. Generator bug fixed in the same pass (JSON-default escaping + statement-by-statement apply — see §10). |
| Live webhook test (branch) | Signed Twilio POST → 200 + 1 conversation + 1 message + 1 contact; bad signature → 403 + zero rows; duplicate MessageSid ignored; valid Meta HMAC → 200 + rows; bad HMAC → 403; Meta GET verify returns the challenge; old stub route gone. |

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
- `Resend` dedup — (HISTORICAL: the Resend handler was deleted 2026-10-21 with the Resend removal.) It had no dedup: no `claimWebhookEvent`, no `ProcessedWebhookEvent` check in `resend-webhook.handler.ts`. Contrast: Stripe/Twilio/Meta use idempotency (see §5).
- `Integration.accessToken` plaintext — Oversight. `integrations.routes.ts` upsert stores `accessToken` directly, no `encryptString`. Contrast: `AdAccount.accessToken` IS encrypted (`ads-account.service.ts:146`), `ApiKey` IS encrypted. Do not copy the `Integration` pattern.
- `client.js` vs `client.ts` — `client.ts` is the source; `client.js` is a checked-in compiled CommonJS artifact. Imports use `.js` specifier per TS ESM convention; `tsx` resolves to `.ts`. Edit `client.ts` only.
- `voice-agents.routes.ts` mount — NOT mounted in `server.ts` (no import, no `app.use`). See Retell webhook above.
- `Settings.tsx` `notifications` tab — NOT persisted. Local state only; Save button only shows a toast, no API call.
- Frontend role gating — No frontend hiding found. Backend `requireRole('admin')` enforces `PUT /api-keys`, `POST /team/invite`, `DELETE /team/:userId`. Frontend shows admin UI to all; backend rejects non-admins.
- `review.received` — Trigger type defined (`trigger-emitter.service.ts:21`, `trigger-crm-event.ts:27`, `Settings.tsx:86`), NO emitter (`emitTrigger(..., 'review.received', …)`) found.
- SMS templates — No shared system. Only `ThreadPane.tsx` placeholder `"Send SMS… (/ for templates)"`. No `SmsTemplate` model.
- `Conversation.status closed` — Toggle `open ↔ closed` via PATCH (`ConversationsTab.tsx:574`). UI filter also lists `snoozed`, `archived`, but no writes for those found for legacy `Conversation`.
- Resend replay window — (HISTORICAL: handler deleted 2026-10-21.) Was 5 minutes: `resend-webhook.handler.ts` rejected `svix-timestamp` >5 min old.
- Email-send-worker retry — Attempts 4 (initial + 3 retries), exponential backoff 30s (`email-send-worker.service.ts:16,44-45`).
- Gmail poll interval — Every 2 minutes. `gmail-poller.ts`: “Called by cron every 2 minutes”, `pollAllGmailAccounts` polls all active Gmail connections.
- Stripe `sub.status` — Passthrough. `billing.routes.ts:446` stores live Stripe `sub.status` directly, plus code writes `active` / `inactive` / `canceled` in fallbacks. No exhaustive list in code.

### Still partially open (do not build on these without reading the code)

- `Campaign.status PAUSED` (email `Campaign`) — Enum `CampaignStatus` includes `PAUSED`, but NO writer for email `Campaign` `PAUSED` was found. `PAUSED` writes found are for `AdCampaign` only (`ads-campaign.service.ts:259`). Do not assume email campaigns can be paused via a backend path until a writer is found.
- `SDR DossierStatus` transitions beyond `DRAFTED → APPROVED → SENDING` — Enum full set confirmed (`DRAFTED/APPROVED/SENDING/ENGAGED/MEETING_BOOKED/BOUNCED/DECLINED`). Writers for `ENGAGED | MEETING_BOOKED | BOUNCED | DECLINED` not found.
- `Workspace.plan` full value set — No single canonical set. Schema default `'free'`; frontend type `free | starter | pro | enterprise` (`src/types/workspace.ts:9`); billing checkout accepts `basic, pro, ultra` (`billing.routes.ts:49`); fallbacks use `'free'` / `'pro'`. Read the call site; do not assume one list. (Billing Core normalizes legacy aliases on write: starter→basic, pro→plus, ultra/team→complete — see §12.5.)

### New open items (Nov 2026 — from the full-platform audit + webhook fix)

- **Facebook Lead Ads signature verification — RESOLVED 2026-11-07 (§12.8).** It was worse than skipped: the guard was inverted (signed deliveries dropped, unsigned ingested). Verification is now mandatory when `FACEBOOK_ADS_APP_SECRET` is configured, with the raw body captured before `express.json()`; live-verified (valid HMAC → claim row, bad/missing → nothing).
- **CI status on GitHub is unverified from the VM** (`gh` not authed). Local equivalents on new main are all green (typecheck 0, build pass, suite 590/590, Clerk layout test 9/9 with `VITE_DEV_AUTH_BYPASS=false`), and the old Clerk-mock patch is now redundant — but no one has read a green CI run on GitHub for `08fe8fc`.
- **First inbound message shows `unreadCount` 2 — RESOLVED 2026-11-07 (§12.8).** It was four handlers, not three (Outlook had the same pattern). All four now create with `unreadCount: 0`; live-verified at 1 for Twilio + Meta, unit-tested for Outlook, code-identical for Gmail.
- **Render/Railway prod env is minimal.** `render.yaml` sets only `NODE_ENV=production` — no `PUBLIC_APP_URL`, no `META_APP_SECRET`, no `FEATURE_*` flags. The production checklist (§1) lists what must be set by hand; nothing in the repo sets it.
- **New-assistant eval: none.** The 12 acceptance scenarios pass, but there is no scored quality measurement of the shipping assistant (the 88% eval measured the old route). The 90% launch bar has no number for the product that would ship. Blocked on the Gemini key's billing (prepayment credits depleted 2026-11-05; unblocker is the auto-pay linkage, per Jack).
- **Voice-agent routes still unmounted?** `api/routes/voice-agents.routes.ts` has a `POST /webhook` but no mount in `server.ts` was found in the Oct 15 audit or the Nov 7 audit. Re-verify before building any voice work; voice calls need `RETELL_API_KEY` regardless.

## 10. What Changed (for this map task)

### Webhook raw-body trap + unread double-count 2026-11-07 (branch `agent/webhook-raw-body-fix`, merged to main 2026-11-08)

- **Summary:** Same raw-body trap as the Meta fix, in two more webhooks: Stripe's `constructEvent` got the parsed object so every production event 400'd (checkouts/subscriptions never processed via webhook), and Facebook Leads verification was inverted (signed dropped, unsigned ingested). The pre-json raw capture in `server.ts` now covers all four signature paths; Stripe uses `req.rawBody`; Facebook Leads verification is mandatory when the secret is configured. Unread double-count fixed in all four inbound handlers (Gmail, Meta, Twilio, Outlook — create with `unreadCount: 0`, first message lands at 1). See §12.8.
- **Changes by area:** `server.ts` (pre-json middleware extended, dead route-level `raw()` removed), `api/routes/billing.routes.ts` (rawBody + stale comment fixed), `api/webhooks/facebook-leads.webhook.ts` (mandatory verification), `api/services/channels/gmail.service.ts` + `api/webhooks/{meta,twilio-sms,outlook-messages}.handler.ts` (unread create-with-0), 3 new test files + Twilio/Meta test updates, `docs/software-map.md` (§7 #23, §9, §12.8, this entry). No UI changes.
- **Verification:** 11 new tests (5 Stripe, 5 Facebook Leads, 1 Outlook); full suite 615/615 (79 files); typecheck clean, build pass. Live test vs running API in production mode (dev-DB rebuild #14): Stripe checkout activated the plan in the DB (pro → plus), bad/missing sigs 400; Facebook Leads valid HMAC → claim row, bad/missing → none; Twilio + Meta first messages → `unreadCount` 1. Gmail's fix is code-identical but not live-tested (no Gmail connection in dev).
### Email marketing UI/UX redesign 2026-11-07 (branch `agent/email-marketing-ux`, merged to main 2026-11-08)

- **Summary:** New overview home at `/email-marketing` (health, last-30-days, quick actions, next step); full 8-tab nav; one Create menu; single filter system (A/B + Drip pills now filter on real data — the old footer-bar ones matched nothing); route-driven audience/suppression tabs; Analytics empty state; builder header wraps; "Draft score" label on empty drafts. See §12.9.
- **Changes by area:** `EmailMarketingLayout.tsx` (nav, `matchPath` builder detection, header fit), `EmailMarketingOverview.tsx` (new), `App.tsx` (index → overview), `CampaignsList.tsx` (Create menu, merged filters, empty state, dead buttons deleted), `ListsAndSegments.tsx` (route-driven tab, count fix), `CampaignAnalytics.tsx` (empty state), `CampaignBuilder.tsx` (`?type=drip`, wrapping header, deliverability label, dead button deleted), `TemplatesList.tsx` (tooltips), `docs/software-map.md` (§12.8, this entry). No backend/API changes.
- **Verification:** typecheck clean, build pass, suite 604/604. Before/after screenshots (1440×900 + 1280×800) in `~/workspace/launch/email-marketing-ux/{before,after}/`. Nav fits exactly at 1440 (663 = 663px); at 1280 it scrolls by design, no button clips.
- **Simplification pass (2026-11-08, same branch):** overview lost KPI + health cards (attention-only line); nav 8 → 5 tabs + More menu; Campaigns lost KPI cards, pills 8 → 4 + Type menu, Ask AI button gone; builder capsule → Advanced menu (drip/A/B opt-in), actions → Save + Send + More menu; Analytics lost Edit/All-Campaigns buttons, date pills → menu; Automations lost KPI cards. No capability removed. New after-shots in `after-v2/`.
- **Round 2 — AI flow + enterprise look (2026-11-08, same branch):** top tabs gone (sidebar sub-menu, 9 pages); AI flow is Step 1 thread → Step 2 email artifact → Step 3 sequence graph with engine-real branching (no "Opened" branch); enterprise look (no neon, no decorative icons). New endpoints: reaction-rule create/delete + sequence wait PATCH. Overview + manual builder untouched. **Round-2 follow-up (same day):** Jack's three additions folded into the Blueprint first — artifact loading state is now a document skeleton; graph confirmed linear-by-default; secondary actions tucked into "⋯" menus (shared `OverflowMenu.tsx`; wait/branch menus in the graph, "Edit brief" in the artifact header menu only; duplicated header "Back to email" removed). Suite 624/624. Screenshots in `after-v3/` (round-2 shots 01–11, follow-up shots 12–17). See §12.9.
- **Rollback:** revert the branch. No `main` changes.

### Email marketing flow improvements 2026-11-08 (branch `agent/email-marketing-flow-improvements`, unmerged — cut from main 83c5d91)

- **Summary:** Four frictions from the merged-main 10-case test (2026-11-08, 10/10 pass): the pick-list rows were indistinguishable ("Campaign Draft (date)" + phase) and drafts couldn't be deleted; the fresh interview was a blank box; the builder's header name field invited the subject into it; the overview didn't know you had an unfinished draft. Pick-list rows now show your first answer as the summary + "Phase X · Edited …", with a ⋯ menu (Delete → inline confirm) and Start as the primary button; the interview shows up to 3 tappable starter chips from the existing example pool (fill, never send); the builder name input is labeled internal-only; the overview's next step points at an unfinished draft when one exists. See §12.10.
- **Changes by area:** `draftSummary.ts` (new) + tests, `InterviewFlow.tsx` (pick-list + examples memo), `InterviewChat.tsx` (chips), `EmailMarketingOverview.tsx` (drafts query + next-step branch), `CampaignBuilder.tsx` (name label), `interview.service.ts` (`toDraftState` + `DraftState` gain additive `updatedAt`), `createWithAiApi.ts` (`CampaignDraftState.updatedAt`), 4 test fixtures updated for the new required field, `docs/software-map.md` (§12.10, this entry). No schema changes, no new endpoints.
- **Verification:** typecheck clean, build pass, suite 641/641 (83 files; +6 tests). Playwright-verified live (Inbox Dark, 1440): overview with drafts → "Continue your draft:", without → "Send your first campaign"; pick-list summaries + Edited + ⋯; delete → confirm → row gone; 3 chips, tap fills the input, no send; builder label present. Screenshots in `~/workspace/launch/email-marketing-ux/flow-improvements/`.
- **Rollback:** revert the branch. No `main` changes.

### Inbound webhooks fix 2026-11-07 (branch `agent/inbox-webhooks`, merged to main 2026-11-07)

- **Summary:** Twilio inbound SMS already had a real handler (`/api/hooks/twilio-sms`) — the audit claim of "no handler" was wrong; only the `/api/webhooks/inbox/*` stubs were dead. Fixed the production 403 bug (signature URL built from `VITE_APP_URL` alone, unset in Render → every SMS rejected), added media storage + empty-body guard + contact creation, verified Meta's `X-Hub-Signature-256`, moved the Meta mounts above the workflow wildcard (they never ran — the wildcard 404s unknown paths), and deleted the stub router. Map updates in this entry: §4.4 (Twilio inbound, verified), §4.6 (Meta handler, corrected), §1 mount-order lines.
- **Changes by area:** `api/webhooks/twilio-sms.handler.ts`, `api/webhooks/meta.handler.ts`, `server.ts`, `api/routes/inbox-webhooks.routes.ts` (deleted), `api/__tests__/twilio-sms-webhook.test.ts` + `meta-webhook-signature.test.ts` (new, 14 tests), `.env.example`, `docs/software-map.md`, production checklist (workspace file). No UI changes.
- **Verification:** new tests 14/14; typecheck / build / full suite re-run on the branch (see the board row / branch commit). Live test: signed Twilio + HMAC Meta POSTs against the running API (see Blueprint `~/workspace/launch/inbox-webhooks-blueprint.md`).
- **Rollback:** revert the branch. No `main` changes.

### Full-platform refresh 2026-11-07 (branch `agent/software-map-refresh`, merged to main 2026-11-07 — base main `08fe8fc`)

- **Summary:** The Map was stale since Oct 21: Jack's Oct 27 rebuild, Billing Core, launch fixes, the Nov 2–5 eval/fix/merges, the 30-email test, and the whole Stone AI Assistant replacement were unmapped. This refresh re-grounds it on main `08fe8fc` from the code (not from specs): §1 stack + layout + mounts (Resend→Gmail-only, `gemini-3.8-flash`, feature flags, assistant dirs, `/assistant` + `/terms` + `/privacy` routes, old panel still mounted), §2 Workspace fields + ChannelConnection unique fix + new §2.9 (12 Assistant\* models, no-migration warning), §4.2 rewritten Gmail-only (Resend webhook gone, bounce via Gmail poller, complaint gap, ticks), §7 landmines #16 refreshed + #21–26 added (flags, wildcard ordering, raw-body pattern, VITE_APP_URL, no Assistant migration, two assistant surfaces), §8 new Nov 7 baseline (typecheck 0, build pass, 590/590, dev-DB rebuild #13, 130 tables), §9 new open items (facebook-leads signature skip, CI on GitHub, unread double-count, minimal Render env, no new-assistant eval, voice routes unmounted), §11 superseded-in-part note (Jack's Oct 27 builder rebuild), §12.5 legacy agent timeline + Billing Core + eval history, §12.6 new assistant code-grounded, §12.7 webhook fix. The webhook Map updates (§4.4/§4.6/mount order) arrived on the sibling branch `agent/inbox-webhooks` and are now in main alongside this refresh.
- **Changes by area:** `docs/software-map.md` only. No app code changed on this branch. Notion copy: refresh sections appended (see below).
- **Verification:** every new claim checked against the code on `08fe8fc` (schema, server.ts mounts, flags, handlers, test files) or against measured runs (baseline §8). Items that could not be verified are marked unverified in §9, not asserted.
- **Rollback:** revert the branch. No `main` changes.

### Create-with-AI addition 2026-10-21 (no main changes; build branch unmerged)

- **Summary:** Consolidated M1–M7 update for the "Create with AI" Email Campaign Builder (spec v2.1, 2026-10-21). New §11 documents the builder end to end. No application code changed on THIS branch; the builder lives on branch `agent/create-with-ai-email-campaign-builder` (head `00e5dbf`), NOT merged to main. This map's base audit (§1–§9) still describes main at `374ed22` plus the 2026-10-15 prep tightening — §11 is explicitly dated and branched, not a claim about main.
- **Changes by area:** `docs/software-map.md` only — new §11 + this §10 entry. No other repo files changed on this branch.
- **Verification:** §11 content checked against the build branch's code, evidence logs (`docs/email-marketing/create-with-ai/m1/` … `m7/`), and live-verification notes on the Daily Tracker row. No build/test run on this branch (docs-only change).
- **Rollback:** Revert this map commit on `agent/software-map` only. No `main` changes to revert.


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

## 11. Create with AI Email Campaign Builder (added 2026-10-21 — UNMERGED branch)

> **SUPERSEDED IN PART (2026-11-07 refresh):** the builder described below was merged to main 2026-10-21 as `683aac6`, and then **rebuilt by Jack on 2026-10-27** ("unified Claude-style copywriter engine", commit `4d46872`, part of the 11-commit push to `08fe8fc`). The current main builder is `src/pages/email-marketing/CreateWithAIPage.tsx` + `CampaignBuilder.tsx` (2,652 lines) with the interview engine in `api/services/email-marketing/interview.service.ts`. The §11.1–§11.6 detail below describes the Oct 21 build faithfully and much of it still applies (Gmail-only, BusinessProfile, fact validation, reactions/sequences/A-B, the vestigial names, the complaint gap) — but the interview/drafting flow and UI are Jack's rebuild, and §11 has not been re-audited line-by-line against it. Read the current files before building on §11.
>
> Source: spec "Create with AI: Email Campaign Builder — Build Specification for the Stone AIO coding agent, Version 2.1, October 8, 2026" (Notion page "Email Marketing" in Labyrinth; working copy `~/workspace/email-campaign-builder/spec-v2.1.md`). Build branch: `agent/create-with-ai-email-campaign-builder`, head `00e5dbf` (M1 `b208173`, M2 `1b889bd`, M3 `dae5eb7` + Gmail-only amendments `8bf9fc2`/`5ba7812`/`7024fcf`, M4 `307dd6a`, M5 `130754b`, M6 `eca5d4f`, M7 `54dd87e`, final cleanup `00e5dbf`). Daily Tracker row "Build 'Create with AI' Email Campaign Builder from spec, milestone by milestone" (`400f4f63-042c-8150-87ec-c1410b5eb124`). Gmail-only throughout (no Resend: the `resend` package was removed in `00e5dbf`; vestigial field names `resendMessageId`/`resendDomainId` remain — see below).

### 11.1 What it is

An 8-phase typed interview (Profile, Goal, Audience, CTA, Sequence, Reactions, A/B, Draft, Review/Send) that builds an email campaign in the business's voice. Every campaign starts fresh: nothing carries over between campaigns except the Business Profile; sent-campaign data is stored but never read by new campaigns (the only campaign→profile path is the user-initiated "Save as a good example"). The pre-existing `AICampaignCopilotModal` ("Campaign Strategy Studio") was left untouched — it is NOT this flow.

### 11.2 New models (Prisma)

- `BusinessProfile` — permanent per-workspace profile (business name/type, services, service area, sender name, reply-to, physical address, booking link and/or phone [at least one required], optional voice/tone, words-to-never-use, website link, differentiators, guarantees). 90-day "Last updated… Anything changed?" nudge.
- `WritingSample` — ≤10 samples × 10,000 chars (paste, `.txt`/`.docx` via mammoth, `.pdf` via pdf-parse, 5MB cap); AI style summary user-approved before use; samples are style-only, never facts.
- `CampaignDraft` — statuses `interviewing | brief_confirmed | plan_confirmed | drafted | scheduled | canceled`; `profileSnapshot` (frozen at creation), `conversation`, `checklists` (goal/audience/cta/sequence/reactions/ab_testing, each with items + `needsReview`), `brief` + `briefVersion`, `plan` + `planVersion`, `sequence` (Json), 30-day `expiresAt`. Current phases include `goal, audience, cta, brief_confirm, sequence, sequence_confirmed, reactions, reactions_confirm, reactions_confirmed, ab_testing, ab_confirm, ab_confirmed, draft_refine, review_send`.
- `CampaignEmail` — `kind` `scheduled | reaction`, `order`, `subjectVariants` + `subjectSelected`, `bodyHtml`/`bodyText`, `cta`, `factMap`, `timingRule`, `receivesRule`, `coldAck` (blocking for cold drafts only), `status` `draft | ready | scheduled | sending | sent | paused | cancelled`.
- `ReactionRule` — `sourceOrder`, `condition` (`NOT_OPENED | NOT_CLICKED | CLICKED | CLICKED_LINK | CLICKED_NOT_REPLIED`; `OPENED_NOT_CLICKED` and `CLICKED_NOT_ACTED` are NOT creatable — see §11.6), `conditionParams`, `action` (`send_reaction | resend | notify | tag | stop`), `actionParams`, `decisionWindowHours` (default 72, range 1–168), `delayMinutes` (default 60, range 0–10080), `priority`, `readback`.
- `RecipientState` — per-contact campaign progress (`active | completed | exited_reply | exited_booked | exited_unsubscribed | exited_bounced | exited_complaint`, `skipped_conflict`, `skipped_cap`, `signals` Json incl. `firedRuleIds`, `divertedSources`, `evaluatedSources`, `sentEmailIds`, `reactionPending`, `sequenceResume`, `reactionOnly`, `history`).
- Pre-existing models reused: `Campaign` (+ `abTestConfig` Json, `blockJson.campaignEmailId` links Email 1), `CampaignRecipient` (`variant`, `status` free-form String incl. `PENDING | SENT | HOLD | SKIPPED:<reason> | FAILED:<reason>`), `EmailEvent` (+ `is_bot_suspected`, `metadata`; `is_machine_open` NOT added — provider cannot distinguish, see §11.6), `SuppressionEntry`, `Notification`, `Tag` (contact tags live in `Contact.tagsJson`, NOT a Tag relation — tag actions write both the Tag row and `tagsJson`).

### 11.3 Routes (all under `/api/email-marketing/create-with-ai`, workspace-scoped)

- Profile/samples: `GET/POST /profile`, `GET /profile/website-prefill` (SSRF-guarded fetch: http/https only, private-IP/DNS checks, ≤3 redirects, 20s timeout, 2MB/page, home + ≤4 pages, nothing saved until confirmed), `POST /samples/*` (paste/upload/style-summary).
- Drafts/interview: `POST/GET /drafts`, `GET/DELETE /drafts/:id`, `POST /drafts/:id/turn | retry | escape-hatch | reopen | confirm-brief | snapshot`, `POST /drafts/:id/start-sequence | confirm-sequence`, `POST /drafts/:id/start-reactions | confirm-reactions`, `POST /drafts/:id/start-ab-testing | confirm-plan`, `GET /drafts/:id/plan | reaction-status | sequence-status`.
- Drafting/sending: `POST /drafts/:id/generate-email | generate-sequence | generate-reactions`, `GET /emails`, `POST /emails/:emailId/checks`, `POST /emails/:emailId/confirm-send | confirm-sequence` (idempotent), `GET /emails/:emailId/path-simulator`, `GET /campaigns/:campaignId/results | results-summary`, `POST /campaigns/:campaignId/evaluate-winner`.
- Interview engine (`api/services/email-marketing/interview.service.ts`): base checklists (goal 6, audience 7, cta 5, sequence 6, reactions 6, ab_testing 8 items), AI-added extras capped at 6/phase, question caps 8/phase (Phases 1–3) and 4/phase (Phases 4–6), 24 total, two-attempt rule (audience never blocks), escape hatch, reopen + needs-review, Brief/Plan locking as numbered versions, autosave BEFORE the LLM call, 60/hour AI rate limit, 30s timeout + 1 retry. Typed-only interview (no clickable answer options; mic via browser SpeechRecognition when supported). LLM = Google Gemini via `@google/genai`, env-configurable (`GEMINI_MODEL` default `gemini-3.8-flash`; `GEMINI_INTERVIEW_MODEL`, `GEMINI_SUMMARY_MODEL`); app key is env-based (dev `.env` holds stubs by design — app-level "AI not configured" 503 is a different path from Google capacity 503s).

### 11.4 Drafting, fact validation, sending (all Gmail-only)

- `draft-generator.service.ts`: per-email 3 subject options, preview ≤90 chars, HTML + plain-text bodies; cold format = plain text 50–100 words, no images; normal = light branded template 100–150 words, one CTA button + matching text link; tokens only from the contact schema with fallbacks (e.g. `{{first_name|there}}`); refine = regenerate whole/section, undo, last-10 version history.
- `fact-validator.ts`: model returns a `fact_map`; CODE validates by extracting all numbers/currency/dates/URLs vs the allowed source set (profile, Brief, Plan, typed messages); unmapped → removed or `{{NEEDS: description}}` placeholder (BLOCKS sending); URL allowlist = profile booking link, profile website domain, user-typed URLs. Tracking tokens are HMAC-signed (`TRACKING_SECRET`); `decodeTrackingTokenEmailId` verifies signature. Link check = HTTP check; locked footer required (`data-locked-footer="true"` + unsubscribe href in HTML, `Unsubscribe: https://…` in text).
- `send-orchestration.service.ts`: `runSendChecks` (blocking: unresolved placeholders, missing footer/unsubscribe, unreachable links, missing sender/reply-to, SPF/DKIM fail, zero recipients, reaction rule → missing email, deadline before a scheduled email, cold ack missing, cold format violations, A/B test-email violations; warnings: spam score, subject >60 chars, missing preview, cold from main domain, A/B skipped for size, open-based rules, A/B mode re-check changes). `confirmSend` writes `abTestConfig` for Email-1 A/B campaigns only. Test sends go through the Gmail channel (honest 503 when unconnected).
- Sending: the campaign worker sends via the Gmail channel (`sendGmailMessage`, OAuth `channelConnection`, scopes `gmail.readonly` + `gmail.send`) — NOT a send provider. Domain checks are direct DNS (SPF TXT `v=spf1`, DKIM TXT `v=DKIM1` under common selectors, DMARC TXT `v=DMARC1` under `_dmarc`; RFC 2606 reserved domains fall back to the stored record). Opens/clicks come from the app's own `/track/click` + `/track/open` (campaign-level open pixel; clicks per-email via signed token → UTM `utm_content` order → tokenless fallback order 1). Bounces: RFC 3464 delivery-status notifications parsed from the Gmail mailbox via the poller (hard → SuppressionEntry + BOUNCED; soft → 3-strike rule). **Complaint gap: Gmail does not notify senders of spam complaints for API-sent mail, so complaint-rate alerts cannot fire from real data** (mitigation: unsubscribe link + bounce/engagement monitoring).

### 11.5 Ticks (30s interval in `email-marketing.routes.ts`, each with its own try/catch)

Order: `processDueReactions` (reaction engine FIRST) → `processDueSequenceSteps` → `processDueAbWinners` → `processHealthAutoPause` → `processColdDrip`, alongside `processScheduledCampaigns` + `processDripSequences`. Plus the Gmail poller (2-min cron in `server.ts`, also runs the bounce scan).

### 11.6 Behavior rules that future builders must not break

- **Reactions (M5):** signals clicked/clicked_link/opened_reliable/open_unknown/not_opened (+ exits replied/booked/unsubscribed/bounced/complained). Priority: exits > click rules > NOT_CLICKED/CLICKED_NOT_REPLIED > NOT_OPENED. One path per contact; no email twice to the same contact (explicit resend allowed once per rule); caps 8/contact/campaign, ≥24h gap except click-reaction delay. Diverting actions are ONLY `send_reaction | resend | stop`; non-diverting (`notify`, `tag`) may still fire after a diversion (how B3's click note + later no-reply alert both happen). Window rules only evaluate sources with NO fired rule. `NOT_OPENED` = no OPENED event at all in the window (opens are campaign-level by design). `OPENED_NOT_CLICKED` is NOT creatable (opens cannot be attributed per email under Gmail-only app tracking; §22 default 17 says disable it when the provider cannot distinguish machine opens). `CLICKED_NOT_ACTED` is NOT creatable (no booking events exist — `Appointment` emits none; CLICKED_NOT_REPLIED is the reply-tracked cousin). Reaction emails get kind `reaction` and orders AFTER the sequence. Single-email campaigns with rules enroll ACTIVE (`reactionOnly: true`). Owner `notify` actions = in-app Notification + Gmail email to the owner address; a missing Gmail connection never breaks the tick.
- **Sequence (M4):** reused the pre-existing `sequence.service.ts` engine: count 1–6, span ≤30 days, ≥1 day gaps, first offset 0, send window weekdays 8–17 business TZ, frequency cap 3/contact/7 days (counts EMAILS, fixed from campaigns), conflict rule (contact in another active sequence is skipped), deadline compression (date-granular). Per-person timing from each contact's first send; `advanceSequence` never moves a due contact past its email. Later sequence emails send per contact (not via campaign send); whole-sequence Phase 8 approval covers them (no per-email confirms).
- **A/B + results (M6):** one variable only (subject or CTA wording), one test per campaign, Email 1 only (a later-email test is a BLOCKING Phase 8 item). Modes: <500 none, 500–1,999 split 50/50 ("small sample, directional only"), ≥2,000 test-then-winner 10/10/80. Winner rule (SPEC rule, in `ab-test.service.ts`): ≥20 total clicks + ≥10% relative difference, else "no clear winner" → send A; metric clicks, never opens. The old analytics z-test (open-rate default) is left untouched for the old CampaignBuilder UI and is NEVER used on this path. M6 campaigns never set `autoRollout` (the old auto-rollout can never fire for them). Phase 8 re-checks mode vs the real count (a "no test" decision never gains a mode). Results are computed LIVE on every read, never stored; replies come from RecipientState exits. Health: bounce warn 2% / auto-pause 5% (live); complaint warn 0.1% / auto-pause 0.3% (implemented, cannot fire from real data — see §11.4). Auto-pause uses a direct status update (pauseCampaign only allows SCHEDULED/SENDING, not SENT). AI summary validated: every number must appear in the metrics, 2–4 sentences, else the numbers-only template.
- **Cold (M7):** ramp 20/day days 1–3, 40/day days 4–7, 75/day week 2, 100/day after, enforced in `sendCampaign` + resume paths (at-cap recipients stay PENDING, never failed) and finished by `processColdDrip` (atomic PENDING → SENDING claims with sentAt at claim time, stale-claim reclaim >2h, window gate, exit/suppression re-check before every send, stop on reply, auto-replies do NOT stop). Cold sends are plain text only (no HTML part) via `buildGmailMime(..., textOnly)`. US-only is enforced by attestation (the ack checkbox) — Contacts/CSV carry no reliable country field, so there is no code-level country filter. Cold + A/B: a dripped sample recipient follows a decided winner (test-then-winner only, never split).
- **Vestigial names (do NOT "fix" by renaming without a migration):** `CampaignRecipient.resendMessageId` holds the Gmail message id; `SendingDomain.resendDomainId` holds `local_<timestamp>` ids; `RESEND_RATE_LIMIT_PER_SECOND` is a plain send rate limit. The `resend` npm package is REMOVED (final cleanup `00e5dbf`); no code imports it.
- **Known dev-only gaps (not app bugs):** no Gmail connection in dev (all sends fail honestly "No active Gmail connection"); dev app Gemini key is a stub (app AI 503 + saved; the connector key proves prompt/schema/model/key/capacity separately). Live-AI interview/drafting verification via the billing key was not re-confirmed in the M3 row update — treat as unverified, not as proven.

---

## 12. Stone AI Assistant & Universal Platform Operator

Implemented November 2026 per `Stone AI Assistant Build Outline.md`. The Assistant serves as a general-purpose, full-quality AI operating partner with Claude-style minimalist aesthetics and deep platform tool integration across all Stone AIO modules.

### 12.1 Security & Multi-Tenant Guarantees
- **Tenant Isolation**: All database operations go through `withTenant(workspaceId, ...)` using parameterized tenant scoping. Cross-tenant and non-existent resource lookups return identical 404 responses.
- **Cross-Workspace Safety**: Cross-workspace Gmail connection fallbacks are strictly eliminated; sending accounts are strictly verified against the authenticated workspace.
- **Atomic Approval Claiming**: Approval execution claims pending tool actions atomically via `assistantToolCall.updateMany({ where: { id, status: 'pending' }, data: { status: 'running' } })` to guarantee idempotent, race-free single execution.
- **Audit Logging**: Every tool execution is recorded in `AssistantToolCall` with status, approving user, timestamp, parameters, and result.

### 12.2 Three-Level Permission System
- **Read-only**: Tier 0 reads and searches execute. All changes and outreach are blocked with explicit explanations and an in-chat switch to Ask first.
- **Ask first (Default)**: Tier 0 reads execute directly. Tier 1 changes and Tier 2 outreach generate interactive ActionCards requiring human approval or editing before running.
- **Autonomous (Full)**: Tier 0 and Tier 1 execute automatically. Tier 2 outreach runs automatically up to workspace daily caps; exceeding daily limits or encountering untrusted content forces actions to queue for review. Tier 3 destructive actions (e.g. `delete_contact`) always require explicit approval.
- **Untrusted-Content Rule**: If the conversation turn processes inbound external messages, SMS, or uploaded content, Tier 2 outreach tools automatically queue for human review to eliminate prompt injection risks.
- **Workspace Ceiling & Pause Switch**: Workspace owners and admins enforce maximum access ceilings (e.g. capping members at Ask first) or pause the assistant globally, instantly forcing all users into Read-only mode.

### 12.3 Dual-Store Memory & Projects
- **Personal Memory**: Belonging exclusively to the active user (e.g. writing tone, personal preferences, sign-off rules). Invisible to other members within the workspace. Automatically learns user preferences from conversational feedback.
- **Workspace Memory**: Shared business knowledge, policies, and facts injected across all member conversations in the workspace.
- **Projects**: Dedicated collaborative and private knowledge contexts (`/assistant/projects`). Supports document uploads (PDF, text, CSV up to 25MB) with extraction, alongside live links to CRM entities (smart lists, contacts, deals).

### 12.4 Deterministic Finders & Platform Tool Registry
- **Deterministic Finders**: Pre-computed server-side queries (`find_stale_leads`, `find_unwelcomed_leads`, `find_stalled_deals`, `find_overdue_tasks`, `find_waiting_conversations`) returning exact match reasons and days since last touch.
- **Whole-Platform Capabilities**: CRM entity management, tags, smart lists, appointment scheduling and rescheduling, unified inbox reply, SMS with DND compliance, email campaign drafting, automation workflow management, web search grounding, and the `explain_platform` navigation help index.
- **Contextual Launchers**: Embedded `AssistantLauncher` across Contact Detail, Company Detail, Pipeline Deals, Conversation Threads, Campaign Builder, Calendar, and Dashboard.
- **Shared Panel Upgrade**: Floating `CRMAIAssistant` delegates directly to `AssistantPanel`, eliminating dead controls and ensuring full feature parity across page layouts.

> **§12.1–§12.4 describe the assistant from its build outline (spec language), not from a line-by-line code audit.** The code-grounded facts are in §12.6 below. Two mappings a builder must know: the spec's three tiers (Read-only / Ask first / Autonomous) are implemented as `AccessMode` `read_only | draft | full` with `ToolRisk` `read | write | send | destructive | hardstop` (`api/services/assistant/modes.ts`); gate decisions are `execute | proposal | needs_approval | blocked | no_permission | mode_prompt`. The "daily caps" in the spec are NOT wired: `dailyLimitExceeded` is an optional gate input that no caller ever sets true.

### 12.5 The legacy agent program (Phases 0–6, merged to main — now retired behind a flag)

Built Oct 27 2026 by Azareth under Jack's direct mandate, branch stack base `683aac6` → phase-0 `310d1e0` → phase-1 `6aa0b29` → phase-2 `bcdc654` → phase-3 `62a1013` → phase-4 `73cb8e2` → phase-5 `33fc826` → phase-6 `e451012`, merged to main as `71d38f7`. Blueprint: `~/workspace/ai-agent-outline/blueprint-1-ai-agent.md` (P0 truthfulness → P1 evals harness → P2 agent core + chat UI → P3 memory → P4 full tool coverage → P5 token metering → P6 grading loop / red-team / rollout gates). Jack's settled decisions: full scope (answer anything, do anything, access anything); Gemini only; all tiers get the agent, token-differentiated (Free 100k / Basic $19 500k / Plus $49 2.5M / Complete $99 10M tokens/mo); launch feature, gated by zero critical failures + 90%+ eval pass + Jack's personal test.

- **Code (all under `api/services/agent/`, route `POST /api/agent/chat`, panel `src/components/crm/CRMAIAssistant.tsx`):** 27 tools (`executeTool` in `api/routes/ai-executor.ts`); `decideGate()` (read → execute; send → queue always; write → execute only in autonomy mode with a grant); modes approve / autonomy / read-only + grant store + audit log; memory (`AgentMemory`, rule-based curation, per-workspace isolation); metering (`api/services/agent/metering.ts`, `AgentTokenUsage`, block at 100%, warn at 80%); eval harness (`scripts/agent-evals.ts`, 142 cases, fixture workspace `ws_eval_stone_aio`, `--cases all` for the full run — the runner defaults to 12 starter cases); grading (`grading.ts`, rubric accuracy/judgment ≥4, helpfulness/safety ≥3; safety ≤2 or any executed send = critical); corrections (`corrections.ts` / `corrections.json`, currently `[]`).
- **Billing Core (commit `05ff7af`, 2026-10-27/28):** `api/services/billing/plans.ts` is the single source of truth — free $0 / basic $19 / plus $49 / complete $99, token budgets 100k/500k/2.5M/10M, legacy aliases normalized on write (starter→basic, pro→plus, ultra/team→complete); `plan-guard.ts` (`requirePlan` / `assertPlan`); checkout validates canonical plan, 7-day trial once per workspace, env price key `STRIPE_PRICE_<CANONICAL>`; webhook security (hardcoded fallback secret deleted; production rejects unsigned webhooks; raw body mounted before `express.json()`); `Workspace.trialEndsAt` + migration `20261028_billing_core`. Email-marketing + automations require Complete; the agent itself is NOT gated. Billing page shows AI TOKENS from the OLD metering (`AgentTokenUsage`).
- **Launch fixes (commit `a955b4d`):** Opportunities `/:id` redirect (`RedirectOpportunityDetail` in `App.tsx`); Terms (`/terms`) + Privacy (`/privacy`) pages drafted (counsel review still owed); interview offline fallback scans the full conversation; prod catch-up migration `20261028_prod_catchup` (131 statements, idempotent — the LAST migration in the repo).
- **Eval history (all on the OLD route):** baseline 54 pass / 26 fail / 62 infra (67.5% scored, 38% all-case); loop-branch alone 95/47/0 (66.9%); combined main `30935e8` 125 pass / 17 fail / 0 infra (88% — 3 passes short of the 90% bar; weakest drafting 15/23, the Alex Rivera/Ramirez similar-name trap); draft-full-name re-run VOID (91 infra — Gemini 402 prepayment-depleted mid-run). The draft-full-name fix branch (`agent/draft-full-name`, `53d7c3d`, DRAFT_NAME_RULE + final text-only round) targets this old service. **Retirement (2026-11-07, Jack's push):** the whole legacy agent is behind `FEATURE_LEGACY_AI` (default off); `/api/ai`, `/api/ai/actions`, `/api/workflow-ai`, `/api/conversations`, `/api/inbox/copilot` mount only when it is on. The old dashboard panel is still mounted (see §1.2). Whether legacy stays off for good is an open question to Jack.

### 12.6 The new Stone AI Assistant (Jack's Phases 0–10, merged 2026-11-07 — the shipping surface)

Jack pushed 11 commits (`30935e8..08fe8fc`), incl. merge `0946e7d` and implementation `c59d4bd` ("implement Stone AI Assistant Phases 0–10, pass 12 acceptance scenarios, prune legacy AI"). 101 files, +22,752/−2,556. Deleted: `AgentBuilder.tsx`, `AgentCreation.tsx`, `AgentTypePicker.tsx`, `VoiceAgentBuilder.tsx`. There is also a remote branch `origin/feat/stone-ai-assistant`.

- **Code:** `api/services/assistant/` (`orchestrator.ts`, `assistant.repo.ts`, `memory.service.ts`, `modes.ts`, `project.service.ts`, `scheduled-task.service.ts`, `rls.ts`, `tools/` split across crm / communication / campaign / calendar / finders / memory / platform / web-search / workflow files + `registry.ts`) + `api/routes/assistant.routes.ts` + frontend `src/lib/api/assistant.ts` and `src/pages/assistant/` (8 pages). It does NOT call the old `runAgentTurn` / `driveToolLoop` / `decideGate` / `executeTool`.
- **Tool registry: 45 tools** (different names from the old 27): add_contact_note, add_contact_tag, book_appointment, cancel_appointment, complete_task, create_campaign, create_campaign_draft, create_company, create_contact, create_deal, create_task, create_workflow, delete_contact, draft_email, explain_platform, find_overdue_tasks, find_stale_leads, find_stalled_deals, find_unwelcomed_leads, find_waiting_conversations, get_campaign_analytics, get_contact_details, list_appointments, list_campaigns, list_companies, list_deals, list_inbox_messages, list_smart_lists, list_tasks, list_user_memories, list_workflows, list_workspace_tags, remove_contact_tag, reply_to_conversation, reschedule_appointment, save_memory_preference, search_contacts, send_email, send_sms, set_mode, trigger_workflow, update_company, update_contact, update_task, web_search.
- **Modes/gates (`modes.ts`):** `ToolRisk` = read | write | send | destructive | hardstop; `AccessMode` = unset | read_only | draft | full. `getEffectiveMode` = lowest of chatMode and workspaceMaxMode. Destructive actions always require approval (acceptance scenario 5); untrusted-content turns force non-read tools to queue (scenario 6); autonomous mode has per-capability daily caps on paper (scenario 4) — but `dailyLimitExceeded` is never set true by any caller, so the cap is not wired.
- **Acceptance:** `api/__tests__/assistant-acceptance-12.test.ts` ("Jack's Acceptance Run (12 Scenarios from Spec Section 15)"): stale leads with reasons; unwelcomed leads queue in Ask-first; read-only blocks + prompts; autonomous email cap; destructive always-approval; injection → untrusted gate; personal memory user-scoped; project files/CRM links as knowledge; abort halts cleanly; pause forces read-only for all users; double-approve executes once; cross-workspace isolation. All pass in the suite.
- **Schema:** the 12 Assistant\* models in §2.9. **No migration exists for them** (gap #1). **Unmetered:** usage goes to `AssistantUsage`; Billing reads the old `AgentTokenUsage`; no plan-budget enforcement gates the new assistant (gap #2). **Flags:** `FEATURE_ASSISTANT` + `VITE_FEATURE_ASSISTANT` must be set or the assistant 404s / redirects (gap #3). **Scheduled tasks never auto-run:** routes + `executeTask` exist, no cron runner calls them (gap #5). **No scored eval:** the 88% number measured the old route; the new assistant has only the 12 scenarios (gap #7). **No EMAIL_FORMAT_RULE / DRAFT_NAME_RULE equivalent:** whether the new assistant produces the clean single-email format or the full-name greeting is unverified. **Crons in `server.ts` are real** (inbox snooze 5 min, scheduled campaigns 1 min, Gmail polling 2 min if configured, Outlook renewal 12h, OAuth cleanup 15 min, Facebook token refresh daily, workflow paused-run resumer). Inbox backend is real except the webhooks (see §12.7).

### 12.7 Inbound webhooks (fixed 2026-11-07, branch `agent/inbox-webhooks`, merged to main 2026-11-07)

- **Twilio inbound SMS works** at `POST /api/hooks/twilio-sms` (`api/webhooks/twilio-sms.handler.ts`): per-workspace or env credentials, production signature check, idempotency via `claimWebhookEvent`, conversation/message/contact creation, realtime publish. The branch fixes a production 403 (signature URL built from `VITE_APP_URL` alone — unset in Render) by reconstructing from `PUBLIC_APP_URL` first, adds media storage + empty-body guard + contact creation, and sets `trust proxy`.
- **Meta inbound was unreachable and is fixed on the same branch:** the `/api/hooks/meta` mounts sat below the workflow wildcard (404s unknown paths) and nothing verified `X-Hub-Signature-256`. Moved above the wildcard + HMAC verification against `META_APP_SECRET` (raw body captured before `express.json()`). WhatsApp (`object: 'whatsapp'`) is still dropped — no surface wired. Slack endpoint removed (no product backing).
- **The dead stub router `/api/webhooks/inbox/*` was deleted** (it only logged payloads and sat behind `resolveWorkspace` JWT, so it 401'd in production).
- **Detail:** full Blueprint at `~/workspace/launch/inbox-webhooks-blueprint.md`; tests `api/__tests__/twilio-sms-webhook.test.ts` + `meta-webhook-signature.test.ts` (14 tests); live test vs running API in production mode passed (valid sig → rows once, bad sig → 403 + zero rows, duplicate ignored, Meta HMAC valid/invalid, GET verify returns the challenge).

### 12.8 Webhook raw-body trap + unread double-count (fixed 2026-11-07, branch `agent/webhook-raw-body-fix`, merged to main 2026-11-08)
- **Same trap, two more webhooks.** The global `express.json()` runs before the webhook mounts, so route-level `express.raw()` is a no-op (Landmine 23). **Stripe:** `stripeWebhookHandler` got the parsed object, so `constructEvent` threw "Webhook payload must be provided as a string or a Buffer… provided as a parsed JavaScript object" and EVERY production event 400'd — `checkout.session.completed` / `subscription.updated` / `subscription.deleted` never processed via webhook (only the `POST /billing/verify-session` return-URL fallback saved checkouts). The comment at `billing.routes.ts:443-445` claiming raw() mounts BEFORE json() was factually wrong. **Facebook Leads:** inverted — a properly signed delivery threw inside `Hmac.update` (rawBody was the parsed object, not a Buffer) and was dropped, while a request with NO signature skipped verification entirely and ingested.
- **Fix:** the pre-json raw capture in `server.ts` now covers all four signature paths (`/api/hooks/meta`, `/api/hooks/facebook-leads`, `/api/webhooks/stripe`, `/api/stripe/webhook`); handlers read `req.rawBody`. Stripe's handler uses `(req as any).rawBody ?? req.body`. Facebook Leads verification is mandatory when `FACEBOOK_ADS_APP_SECRET` is configured (missing/invalid → ignored, no ingest); the accept path exists only when no secret is set (dev parity). Dead route-level `raw()` calls removed from both mounts.
- **Unread double-count (four handlers, not three):** Gmail, Meta, Twilio, and Outlook all created the conversation with `unreadCount: 1` and then ran the unconditional `+1` increment — first message showed 2. All four now create with `unreadCount: 0`; the single increment lands the first message at 1.
- **Verification:** 11 new tests (5 Stripe signature incl. parsed-object regression, 5 Facebook Leads incl. parsed-object rawBody regression, 1 Outlook unread) + Twilio/Meta happy paths now assert `unreadCount` 1; full suite 615/615 (79 files). Live test vs running API in production mode (dev-DB rebuild #14, VM wiped again): valid Stripe sig → 200 + `checkout.session.completed` activated the plan in the DB (pro → plus, subscriptionStatus active); bad/missing sig → 400; valid Facebook Leads HMAC → claim row created, bad/missing → no claim row (ingest itself not live-proven — the Graph fetch fails on the dummy token; covered by the unit test with mocked fetch); Twilio + Meta first messages → `unreadCount` 1. Gmail's fix is code-identical but not live-tested (no Gmail connection in dev).
- **Detail:** Blueprint at `~/workspace/launch/webhook-raw-body-and-unread-blueprint.md`; branch `agent/webhook-raw-body-fix` at `39d79ec`, merged to main 2026-11-08.
### 12.9 Email marketing UI/UX redesign (2026-11-07, branch `agent/email-marketing-ux`, merged to main 2026-11-08)
- **Why:** Jack: "the email marketing sections ui and ux are terrible currently. The formatting and the overall flow are not user friendly." Screenshot-proven + code-grounded audit (`~/workspace/launch/email-marketing-ux-audit.md`, before shots in `~/workspace/launch/email-marketing-ux/before/`).
- **What was broken:** (1) Create with AI, Suppression, Business Profile had routes but NO nav entry — Create with AI was reachable only by typing the URL. (2) `/suppression` rendered the Audience list (both routes mounted `ListsAndSegments`, tab defaulted to `'smart-lists'`). (3) `/profile` and `/create-with-ai` were the same page. (4) Header clipped at 1440px ("Create Campa…", "Test Ser…"). (5) Campaigns had TWO filter systems — and the footer bar's A/B + Drip pills set `statusFilter` to `'AB_TEST'`/`'DRIP'`, which matched NO campaign status and always emptied the table. (6) Member count rendered `— contacts` when missing. (7) Analytics with no sent campaigns was a wall of zeros + an Edit Campaign button with no campaign. (8) Mailboxes tab exited the section to Settings. (9) No home — `/email-marketing` redirected to the table. (10) Builder detection was string-matching on `location.pathname`.
- **Fix:** new overview page at `/email-marketing` (setup health — Gmail, profile, campaigns sent — last-30-days, quick actions, next step, recent campaigns; reuses existing campaigns/connections/profile queries). Full 8-tab nav (Campaigns, Create with AI, Automations, Audience, Templates, Analytics, Suppression, Profile); Mailboxes dropped from the section nav (lives in Settings; the overview links to it). Builder detection via `matchPath` route config. One Create menu (Broadcast / Drip via `?type=drip` / Build with AI); the two `display: none` dead buttons deleted. Single filter pill row (A/B + Drip now filter on real data: `abTestConfig.enabled`, `blockJson.campaignType/dripSteps`); footer bar keeps only Sort + count + pagination. Route drives the audience tab; `— contacts` → `0 contacts`. Analytics empty state with CTAs. Builder header wraps (no clip); empty-draft badge reads "Draft score 60%" not "60% Deliverability". Template names/subjects get `title=` tooltips.
- **Verification:** typecheck clean, build pass, suite 604/604. Before/after screenshots (1440×900 + 1280×800, Inbox Dark) in `~/workspace/launch/email-marketing-ux/{before,after}/`. Nav measured: 663px needed = 663px available at 1440 (no overflow); at 1280 the tab bar scrolls by design with the active tab auto-scrolled into view, and no header button clips.
- **Simplification pass (2026-11-08, same branch):** Jack — "it could be simplified… less buttons and instead use menus… especially A/B split and the multi sequence." Overview lost its KPI + health cards (health now shows only as a "needs attention" line when something is actually incomplete; numbers live in Analytics); quick actions 5 → 3. Nav 8 tabs → 5 (Campaigns, Create with AI, Audience, Automations, Analytics) + a More menu (Templates, Suppression, Profile). Campaigns lost its KPI cards; pills 8 → 4 statuses + a Type menu (All types, Broadcast, Drip, A/B); the page-level Ask AI button is gone (the layout's bot icon opens the same assistant). Builder: the Broadcast / Drip / A-B Split capsule is now an Advanced menu — default is a plain broadcast email, drip and A/B are opt-ins that turn the timeline / variant bar on; header actions collapsed to Save + Send + a More menu (Ask Stone AI, Deliverability, Templates, Sender, Test Send). Analytics lost its Edit Campaign / All Campaigns buttons; the date-range pills became a "Last 30 days" menu. Automations lost its KPI cards. No capability removed anywhere — A/B, drip, templates, sender settings, test send all still work, tucked behind menus. New after-screenshots in `~/workspace/launch/email-marketing-ux/after-v2/` (replacing the v1 set).
- **Detail:** Blueprint at `~/workspace/launch/email-marketing-ux-blueprint.md` (incl. the simplification addendum). No backend/API/schema changes; no builder capability changes.
- **Round 2 — AI flow + enterprise look (2026-11-08, same branch, voice call):** Jack — "let's do that" (nav tabs go, sidebar sub-menu; AI flow step-by-step like the assistant's chat thread; email as a Claude-style artifact; visual sequence graph with branching; enterprise look, no neon, no decorative icons). **Nav:** the top tab bar is gone from `EmailMarketingLayout.tsx` (no `NAV_TABS`/`MORE_TABS`); all 9 pages live in the sidebar Email Marketing sub-menu (`Sidebar.tsx`: Campaigns, Create with AI, Audience, Automations, Analytics, Templates, Suppression, Profile, Outreach Mailboxes last); the sidebar item now points at the overview home (`/email-marketing`). **AI flow:** `InterviewFlow.tsx` gained a presentation-only step machine — Step 1 Questions (one full-width chat thread, assistant styling: `#1E1E1E` bg, `#2D2D2E` user bubbles, plain assistant text, `max-w-3xl`; the old Studio two-pane branch and `LiveEmailCanvas.tsx` are deleted, so no email/preview is visible during the interview) → Step 2 Your email (the completed email opens as an artifact in a right panel styled like the assistant's `ArtifactSidePanel`: `#1A1A1B`, header `#161617`, `slide-in-from-right-4`; thread + confirmed brief on the left; Close returns to the thread with an "Open email" card) → Step 3 Sequence (graph). The phase machine, API calls, and interview copy are untouched; the step indicator lives in `InterviewFlow` (it owns the step state), and `CreateWithAIPage.tsx` is slimmed to back link + "Create with AI" title on `#1E1E1E` (profile pill, samples link, Autosaved badge, Incomplete Profile button, and `ProfileSidePanel` usage removed — profile editing lives at `/profile`). **Graph:** new `SequenceGraph.tsx` + pure model `sequenceGraphModel.ts` (`buildChain`, branch labels). Default is the linear chain from `draft.sequence` (Email 1 → Wait N days → Email 2 …); waits are editable inline (PATCH, see below) and shift later emails by the delta. Branching is opt-in per wait ("Add a branch") and uses ONLY the reaction engine's vocabulary — Clicked / Didn't click / Didn't open / Clicked but didn't reply / a specific link — with actions send-next / send-reaction / resend / notify / tag / stop, a decision window (default 72h) and a delay (default 60m). There is deliberately NO "Opened" branch: opens cannot be attributed to one email under Gmail-only tracking, and `validateReactionRules` refuses `OPENED_NOT_CLICKED` in plain words (the graph offers "Didn't click" with that note instead). Branches render as forks with the engine's plain-words `readback` as the edge label. "Preview a path" reuses the existing simulator (`GET /emails/:emailId/path-simulator`): pick a scenario, the real steps list, and fired branches + reached emails highlight on the graph. The graph replaces `SequenceTimeline.tsx` (deleted) inside `DraftReviewFlow`'s sequence step; `ReactionPaths` stays mounted in `SequenceReview`/`ReviewSend`. After launch (`draft.status === 'scheduled'`) the graph is read-only. **New endpoints** (`api/routes/create-with-ai.routes.ts`, no schema changes): `POST /drafts/:draftId/reaction-rules` (validated by `validateReactionRules`, priority assigned server-side by `syncReactionRules`, readback auto-built by `ruleReadback`), `DELETE .../reaction-rules/:ruleId`, `PATCH /drafts/:draftId/sequence` (wait edits only — count/purposes/start/deadline/window unchanged; re-validated by `validateSequence` with the plan's own start as `now`, so a stored start in the past does not fail re-validation; see `updateDraftSequence` in `sequence.service.ts`). Adding a whole email to the chain is out of scope for the graph — new emails need generated content, which is the interview's Phase 4 / `generate-sequence` flow. **Enterprise look:** decorative lucide icons stripped and amber/purple/orange decorative classes replaced with neutrals or primary `#52677D` across `CampaignsList`, `CampaignAnalytics` (the whole A/B section was a purple showcase — now primary/neutral, winner badges + pick buttons + bars recolored, KPI icon boxes removed), `AutomationsList`, `ListsAndSegments`, `ProfileForm` (field/section icons gone; Globe inside the URL input and the step-done Check kept as affordances), `AICampaignCopilotModal`, `InterviewFlow`, `InterviewChat`, `CreateWithAIPage`. Functional status colors stay (green sent, red errors/cancelled, blue sending); amber stays ONLY for genuine "needs attention" states (Gmail-not-connected line, domain pending verification, deliverability/consistency warnings, placeholder + new-claim notices). `CampaignBuilder.tsx` and `EmailMarketingOverview.tsx` are byte-identical (Jack likes both). **Verification:** typecheck clean, build pass, suite **619/619** (77 files; +18 new tests — graph model 8, endpoint validation 10 — minus the 3 deleted `LiveEmailCanvas` tests). Endpoints verified live against the running dev API (OPENED branch → 400 with the plain-words message; valid create → 201; delete round-trip 3 → 2 rules; PATCH no-op → 200; PATCH bad gap → 400). Playwright-verified in Inbox Dark with seeded drafts (no live Gemini key needed for the UI): sidebar menu, Step 1 thread, Step 2 artifact, Step 3 graph (linear + 2 seeded branches), branch editor (scrolls into view on open — fixed during verification), branch save via the UI, path preview (Clicked scenario highlights the fired rule), wait edit 2 → 3 days via the UI (chain re-renders 6-day span, Email 2 shifts to Day 3), campaigns at 1280 (no tabs, no clipped buttons), analytics empty state. Screenshots in `~/workspace/launch/email-marketing-ux/after-v3/` (11 files). The "Generate" button inside the artifact and a full interview turn were NOT live-verified (dev Gemini key's prepayment credits are depleted — the standing auto-pay unblocker).
- **Round-2 follow-up — tucked + menus + artifact loading state (2026-11-08, same branch):** Jack's three additions, folded into the Blueprint first. (1) Artifact reveal confirmed as built; one gap fixed — while the draft loads, `DraftReviewFlow` showed only a bare "Loading…" line, so the loading branch now renders a document-style skeleton inside the artifact panel (title/subject/paragraph bars, `animate-pulse`, artifact tokens, "Loading your email…" caption, `data-testid="artifact-loading"`). (2) Linear-by-default graph confirmed as built; no change. (3) Tucked + menus: new shared `OverflowMenu.tsx` ("⋯" trigger + menu, following the `CampaignsList` Create-menu pattern — open state, fixed overlay closer, absolute item list; assistant tokens, no decorative icons). `SequenceGraph`: each wait row's "Change" + "Add a branch" text buttons are now one "⋯" menu ("Change wait", "Add a branch"); each branch card's "Remove branch" text button is now one "⋯" menu ("Remove branch"); the duplicated header "Back to email" is removed (the footer pair next to "Continue to Review and Send" is the one way back). `DraftReviewFlow`: all four scattered "Edit Brief" buttons removed (the `onEditBrief` prop is removed with it — the flow is rendered only by `InterviewFlow`). `InterviewFlow`: the artifact panel header gains a "⋯" menu with "Edit brief (reopen interview)" next to Close — the single home for that action; the full-width "Edit Campaign Brief" button in the left pane is removed. Kept as buttons (primary actions, not secondary): "View sequence", "Generate"/"Generate all N emails", "Continue to Review and Send", "Open email", the branch/wait-editor Save/Cancel (form actions); the path-preview `<select>` is already a menu control. New tests: `OverflowMenu.test.tsx` (4: closed by default, item fires + closes, overlay closes without firing, disabled item does not fire) + `DraftReviewFlow.test.tsx` (1: document skeleton renders while loading, bare "Loading…" gone). Verification: typecheck clean, build pass; full suite **624/624** (79 files; 619 + 5 new tests — OverflowMenu 4, DraftReviewFlow loading 1). Playwright screenshots in `after-v3/` (follow-up shots 12–17, incl. the document loading skeleton, wait/branch/artifact-header menus, and the graph at 1280).

### 12.10 Email marketing flow improvements (2026-11-08, branch `agent/email-marketing-flow-improvements`, unmerged — cut from main 83c5d91)
- **Why:** Jack — "it's overall good but what can we do to make it better." Four frictions from the merged-main 10-case test (2026-11-08, 10/10 pass), each grounded in something observed, not a redesign.
- **What changed:** (1) Pick-list: rows showed "Campaign Draft (date)" + phase, so three drafts were indistinguishable — and my own test script resumed the wrong draft twice because of it. Rows now show a one-line summary — the user's own first answer in the interview, truncated at 90 chars (`draftSummary.ts`, shared helper) — + "Phase X · Edited …". `updatedAt` is now exposed: `toDraftState` in `interview.service.ts` adds it (additive field, no behavior change) through `DraftState` and the client `CampaignDraftState`. Each row has the shared `OverflowMenu` (⋯) with "Delete draft" → inline confirm ("Delete this draft? It can't be undone." [Delete] [Keep it]) → the existing `deleteDraft()` (`DELETE /drafts/:draftId` — the endpoint existed, no UI ever called it) → list refreshes. "Start a new campaign" is now the primary button. (2) Interview starter chips: a fresh interview was a blank box with only a placeholder example. Up to 3 tappable chips now sit above the input, from the same `examplePools[currentPhase]` that already fed the placeholder (deterministic per draft+phase, never repeats the placeholder). Tapping fills the input; it does NOT send. Chips hide once the user types. They are a typing aid, not answer options — the interview still requires a typed answer, and the existing `InterviewChat` test's no-answer-options rule is untouched (chips default to `[]`, so that test renders no chips). (3) Builder: the campaign-name input in the header now carries `aria-label="Campaign name (internal only)"` + `title="Internal name — recipients never see this"` — in the 10-case test the subject was typed into this field by mistake. (4) Overview: the `nextStep` chain gains a branch — setup done + an unfinished draft → "Continue your draft: {summary}" → `/email-marketing/create-with-ai` (the pick-list, where the same summary shows). New `listDrafts` query, same `useQuery` pattern as the existing ones. With no drafts it reads "Send your first campaign" as before.
- **Verification:** typecheck clean, build pass, suite **641/641** (83 files; +6 tests — `draftSummary.test.ts` 4, chip tests 2). Playwright-verified live (Inbox Dark, 1440, seeded drafts): overview with drafts → "Continue your draft:", without → "Send your first campaign"; pick-list summaries + Edited + ⋯; delete → confirm → row gone; 3 chips, tap fills the input exactly, chips hide, no AI reply (no send); builder label present with the right title. Screenshots in `~/workspace/launch/email-marketing-ux/flow-improvements/` (01–08). Blueprint at `~/workspace/launch/email-marketing-flow-improvements-blueprint.md`. The no-drafts overview branch needed a fake Gmail row in the dev DB so the Gmail step would pass — inserted for the check, deleted after; drafts re-seeded after.
- **Out of scope (stated in the Blueprint):** the `AICampaignCopilotModal` ("Write with AI" in the manual builder — a third AI entry point, untested); the graph branch editor (verified working); interview fallback quality (needs the live key); mobile/responsive layout.

