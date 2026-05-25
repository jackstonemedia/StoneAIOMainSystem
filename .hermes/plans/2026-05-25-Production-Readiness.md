# StoneAIO Production Readiness Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix critical bugs, implement missing core features (workflow node execution, campaign sending, sequences), tighten security, and get StoneAIO to production-ready state.

**Architecture:** Multi-tenant CRM + business ops platform. Frontend: React 19 + Vite + TailwindCSS v4. Backend: Express.ts with Clerk auth. Database: Prisma (SQLite). Real-time: SSE streaming. Background: Bull queues + node-cron. Native workflow engine (structure exists, needs node implementations — the biggest gap).

**Tech Stack:** TypeScript, React, Vite, TailwindCSS v4, Express, Prisma (SQLite), Clerk Auth, Gemini AI, Bull queues, Retell Voice, SSE

**Codebase:** `/mnt/c/Users/jackx/Desktop/StoneAIO`
**Database schema:** `prisma/schema.prisma` (38 models)

**Key principles:** DRY, YAGNI, TDD. Each task = 2-5 min of focused work. Commit after each task.

---

## Phase 0: Critical Bug Fixes (Do These First — Will Crash in Production)

### Task 0.1: Fix Duplicate Routes in CRM

**Objective:** Remove duplicate `crm.routes.ts` route definitions for `/smart-lists` that cause Express to register handlers twice.

**Files:**
- Modify: `api/routes/crm.routes.ts`

**Steps:**

1. Read `api/routes/crm.routes.ts` — there are two sets of `router.get/post/put/delete('/smart-lists', ...)` routes around lines 278-315 and 460-488. The second set has slightly different signatures.

2. Keep the first complete set, remove the duplicate block entirely.

3. Run the app (`npm run dev:server`) and verify no Express route warnings.

**Step 5: Commit**
```bash
git add api/routes/crm.routes.ts
git commit -m "fix: remove duplicate smart-lists routes in crm.routes.ts"
```

---

### Task 0.2: Fix Workflow Credentials Wrong Field Name

**Objective:** Fix `workflows.ts` writing to wrong Prisma field name — `encryptedData` should be `dataEncrypted`.

**Files:**
- Verify: `api/workflows.ts` lines ~207-213 (credential creation)
- Verify: `prisma/schema.prisma` — check `WorkflowCredential` model field names

**Steps:**

1. Check `prisma/schema.prisma` for the `WorkflowCredential` model — confirm the encrypted data field is `dataEncrypted`.

2. In `api/workflows.ts`, find where `create` or `update` for `WorkflowCredential` uses `encryptedData` as a key and rename to `dataEncrypted`.

3. Run `npx prisma generate` then `npx prisma db push` to verify Prisma types.

**Step 6: Commit**
```bash
git add api/workflows.ts
git commit -m "fix: use correct field name dataEncrypted for WorkflowCredential"
```

---

### Task 0.3: Fix Meta Webhook Workspace Scoping

**Objective:** Meta webhook handler (`server.ts`) does `db.integration.findFirst({ where: { provider } })` without scoping to `workspaceId`. If multiple workspaces connect Meta, all inbound messages route to the first workspace found.

**Files:**
- Modify: `server.ts` — find the Meta webhook handler (line ~114)
- Modify: `api/webhooks/meta.handler.ts` if it exists as a separate file

**Steps:**

1. In `server.ts` Meta webhook handler, the inbound message should include a page ID or IG account ID from the webhook payload. Use that to identify the correct `Integration` record and thus the correct `workspaceId`.

2. Change `db.integration.findFirst({ where: { provider } })` to look up the integration by the external account ID from the webhook payload.

**Verification:** Multiple workspaces can connect Meta accounts without cross-workspace message leakage.

**Step 5: Commit**
```bash
git add server.ts
git commit -m "fix: scope Meta webhook integration lookup to prevent cross-workspace message leakage"
```

---

### Task 0.4: Encrypt API Keys Before Storage

**Objective:** `ApiKey.keyEncrypted` stores raw API keys with no encryption applied. Implement AES-256-GCM encryption (same pattern as channel credentials).

**Files:**
- Modify: `api/routes/settings.ts` (API key CRUD endpoints)
- Check: `api/services/encryption.ts` or similar for existing encryption utility

**Steps:**

1. Find the existing AES encryption utility used for channel credentials (likely in `api/services/channels/`).

2. In the API key creation endpoint (`POST /api/settings/keys`), encrypt the key before storing in `keyEncrypted`. Store the IV alongside it.

3. In the API key retrieval endpoint, decrypt before returning.

4. Verify existing keys work after migration (or add a migration note).

**Verification:** New API keys are stored encrypted in the DB, not in plaintext.

**Step 5: Commit**
```bash
git add api/routes/settings.ts
git commit -m "fix: encrypt API keys before storage using AES-256-GCM"
```

---

## Phase 1: Workflow Engine — Register Node Implementations

The `NodeRegistry` in `api/services/workflow-engine/node-runner.ts` is empty. We need to register all node types that the workflow builder supports. Check `src/constants/workflow.ts` or `NativeNodeLibrary.ts` for the list of available node types.

### Task 1.1: Trigger Nodes — webhook-trigger

**Objective:** Implement the `webhook-trigger` node that starts workflow execution when a webhook HTTP request arrives.

**Files:**
- Create: `api/services/workflow-engine/nodes/trigger-webhook.ts`
- Modify: `api/services/workflow-engine/node-runner.ts` (register the node)

**Implementation:**
```typescript
// api/services/workflow-engine/nodes/trigger-webhook.ts
import { NodeRunner, NodeExecutionContext } from '../node-runner';

export class WebhookTriggerNode extends NodeRunner {
  type = 'webhook-trigger';

  async execute(context: NodeExecutionContext) {
    // The webhook trigger is the entry point — context.input should contain:
    // - webhookPayload: the HTTP request body
    // - webhookHeaders: request headers
    // - webhookUrl: the incoming URL
    // - webhookMethod: HTTP method
    
    const { node, runContext } = context;
    
    // Return the webhook payload as output for downstream nodes
    return {
      body: runContext.triggerData?.body || {},
      headers: runContext.triggerData?.headers || {},
      query: runContext.triggerData?.query || {},
      method: runContext.triggerData?.method || 'POST',
    };
  }
}
```

**Register in `node-runner.ts`:**
```typescript
import { WebhookTriggerNode } from './nodes/trigger-webhook';
// ...in NodeRegistry constructor or init:
this.register(new WebhookTriggerNode());
```

**Step 4: Verify**
```bash
# Run typecheck to ensure everything compiles
npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add api/services/workflow-engine/nodes/trigger-webhook.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register webhook-trigger node in workflow engine"
```

---

### Task 1.2: Trigger Nodes — schedule-trigger & crm-event-trigger

**Objective:** Implement `schedule-trigger` (cron-based) and `crm-event-trigger` (contact/deal created, etc.) nodes.

**Files:**
- Create: `api/services/workflow-engine/nodes/trigger-schedule.ts`
- Create: `api/services/workflow-engine/nodes/trigger-crm-event.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`

**Implementation for schedule-trigger:**
- This node is a trigger (no real execution logic) — the scheduler service (`scheduler.service.ts`) is responsible for finding workflows with `WorkflowSchedule` records and starting their runs at the right cron time.
- The node just returns the current timestamp and scheduled time.

**Implementation for crm-event-trigger:**
- The `trigger-emitter.service.ts` already fires events. This node is a trigger entry point that receives the event data (contactId, eventType, eventData) from the run context.

**Register both in `node-runner.ts`.**

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/trigger-schedule.ts api/services/workflow-engine/nodes/trigger-crm-event.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register schedule-trigger and crm-event-trigger nodes"
```

---

### Task 1.3: Action Nodes — create-contact, update-contact

**Objective:** Implement CRM action nodes that can create or update contacts in the database.

**Files:**
- Create: `api/services/workflow-engine/nodes/action-crm-create-contact.ts`
- Create: `api/services/workflow-engine/nodes/action-crm-update-contact.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`
- Read: `api/services/crm.service.ts` (existing contact CRUD logic)

**Implementation for create-contact:**
```typescript
// Input fields defined in node config:
// - workspaceId (from run context)
// - email, name, phone, company, tags (from workflow node config or previous node output)

export class CreateContactNode extends NodeRunner {
  type = 'create-contact';

  async execute(context: NodeExecutionContext) {
    const { node, runContext } = context;
    const config = this.resolveConfig(node.config, context);
    
    const contact = await runContext.db.contact.create({
      data: {
        workspaceId: runContext.workspaceId,
        email: config.email,
        name: config.name || config.email.split('@')[0],
        phone: config.phone || null,
        company: config.company || null,
        source: 'workflow',
      }
    });
    
    return { contactId: contact.id, contact };
  }
}
```

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/action-crm-create-contact.ts api/services/workflow-engine/nodes/action-crm-update-contact.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register create-contact and update-contact action nodes"
```

---

### Task 1.4: Action Nodes — send-email

**Objective:** Implement `send-email` node that sends emails via a configured provider. Reuse the Gmail service if an email channel is connected, or use a transactional provider (Resend/SendGrid) if configured.

**Files:**
- Create: `api/services/workflow-engine/nodes/action-send-email.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`

**Implementation:**
```typescript
// Input fields: to, subject, body (can be HTML)
// Config: useChannel (true = use connected Gmail/Outlook, false = use transactional provider)

export class SendEmailNode extends NodeRunner {
  type = 'send-email';
  
  async execute(context: NodeExecutionContext) {
    const { node, runContext } = context;
    const config = this.resolveConfig(node.config, context);
    
    // Use Gmail service if channel is connected
    const channel = await runContext.db.channelConnection.findFirst({
      where: { workspaceId: runContext.workspaceId, type: 'gmail', status: 'connected' }
    });
    
    if (channel) {
      return await runContext.gmailService.send({
        to: config.to,
        subject: config.subject,
        html: config.body,
        from: channel.email,
      });
    }
    
    // Fallback: use Resend or SMTP
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      return await resend.emails.send({
        from: 'StoneAIO <noreply@yourdomain.com>',
        to: config.to,
        subject: config.subject,
        html: config.body,
      });
    }
    
    throw new Error('No email provider configured');
  }
}
```

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/action-send-email.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register send-email action node"
```

---

### Task 1.5: Action Nodes — send-sms, create-task, update-deal-stage

**Objective:** Implement three more critical action nodes.

**Files:**
- Create: `api/services/workflow-engine/nodes/action-send-sms.ts`
- Create: `api/services/workflow-engine/nodes/action-create-task.ts`
- Create: `api/services/workflow-engine/nodes/action-update-deal-stage.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`

**send-sms:** Use Twilio channel credentials from `ChannelConnection` (type='twilio'). Check `api/services/channels/` for existing Twilio client initialization.

**create-task:** Use `runContext.db.task.create({ data: { workspaceId, title, assigneeId, contactId, dueDate, description } })`

**update-deal-stage:** Use `runContext.db.deal.update({ where: { id }, data: { stageId, status: config.newStageId } })`

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/action-send-sms.ts api/services/workflow-engine/nodes/action-create-task.ts api/services/workflow-engine/nodes/action-update-deal-stage.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register send-sms, create-task, update-deal-stage action nodes"
```

---

### Task 1.6: Logic Nodes — condition (if/else), delay, loop

**Objective:** Implement logic nodes for branching, waiting, and iteration.

**Files:**
- Create: `api/services/workflow-engine/nodes/logic-condition.ts`
- Create: `api/services/workflow-engine/nodes/logic-delay.ts`
- Create: `api/services/workflow-engine/nodes/logic-loop.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`

**condition (if/else):**
```typescript
export class ConditionNode extends NodeRunner {
  type = 'condition';
  
  async execute(context: NodeExecutionContext) {
    const { node, runContext } = context;
    const config = this.resolveConfig(node.config, context);
    
    // Evaluate the condition expression
    // config.condition = e.g. "{{previous.output.email}}" or a comparison
    const result = this.evaluateExpression(config.condition, context);
    
    return { condition: result, branch: result ? 'true' : 'false' };
  }
}
```
The engine should use the `.branch` return value to determine which downstream nodes to execute (true branch vs false branch).

**delay:** Use `setTimeout` or `process.env.NODE_ENV === 'test' ? immediate : actual delay`. The engine's pause/resume system (`resumeAt`) is the right way — set `resumeAt = now + delayMs` and return PAUSED status.

**loop:** Iterate over an array input, run child nodes for each item.

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/logic-condition.ts api/services/workflow-engine/nodes/logic-delay.ts api/services/workflow-engine/nodes/logic-loop.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register condition, delay, and loop logic nodes"
```

---

### Task 1.7: AI Nodes — ai-llm (Gemini chat completion)

**Objective:** Implement `ai-llm` node that calls Gemini API with configurable prompt and model.

**Files:**
- Create: `api/services/workflow-engine/nodes/ai-llm.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`
- Read: `packages/ai/` for existing Gemini client setup

**Implementation:**
```typescript
import { GoogleGenAI } from '@google/genai';

export class AiLlmNode extends NodeRunner {
  type = 'ai-llm';
  
  async execute(context: NodeExecutionContext) {
    const { node, runContext } = context;
    const config = this.resolveConfig(node.config, context);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash',
      contents: config.prompt || JSON.stringify(context.previousOutputs),
      config: {
        temperature: config.temperature ?? 0.7,
        maxOutputTokens: config.maxTokens ?? 2048,
      },
    });
    
    return {
      response: response.text,
      candidates: response.candidates,
      usage: response.usageMetadata,
    };
  }
}
```

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/ai-llm.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register ai-llm node for Gemini chat completions"
```

---

### Task 1.8: Data Nodes — http-request, parse-json, transform

**Objective:** Implement nodes for working with external APIs and data transformation.

**Files:**
- Create: `api/services/workflow-engine/nodes/data-http-request.ts`
- Create: `api/services/workflow-engine/nodes/data-parse-json.ts`
- Create: `api/services/workflow-engine/nodes/data-transform.ts`
- Modify: `api/services/workflow-engine/node-runner.ts`

**http-request:** Use `axios` (already a dependency). Config: method, url, headers, body. Return: statusCode, body, headers.

**parse-json:** Parse a JSON string input into an object. Config: path to field (supports dot notation like `response.body.items[0].name`).

**transform:** Simple data transformation using `{{template}}` syntax. Takes an input template string and resolves references like `{{previous.output.name}}` using the expression service.

**Step 4: Commit**
```bash
git add api/services/workflow-engine/nodes/data-http-request.ts api/services/workflow-engine/nodes/data-parse-json.ts api/services/workflow-engine/nodes/data-transform.ts api/services/workflow-engine/node-runner.ts
git commit -m "feat: register http-request, parse-json, transform data nodes"
```

---

### Task 1.9: Node Registry — Wire Up Complete Registry + Verify

**Objective:** Ensure ALL registered nodes are loaded on server startup. Create an initialization function that imports and registers all nodes.

**Files:**
- Modify: `api/services/workflow-engine/node-runner.ts`
- Modify: `server.ts` (ensure node registry init is called at startup)

**Steps:**

1. Create an `initNodes()` or `registerAllNodes()` function that imports all node classes and registers them with the NodeRegistry singleton.

2. Call `registerAllNodes()` during server startup (in `server.ts`, before `app.listen()`).

3. Create a simple test: start the server, create a test workflow via API, trigger it, verify nodes execute.

**Verification:**
```bash
npm run dev:server
# In another terminal, curl to create and trigger a workflow
curl -X POST http://localhost:4000/api/workflows -H "Content-Type: application/json" -d '{
  "name": "Test Workflow",
  "type": "native",
  "definition": {
    "nodes": [{"id": "1", "type": "webhook-trigger"}],
    "edges": []
  }
}'
```

**Step 5: Commit**
```bash
git add api/services/workflow-engine/node-runner.ts server.ts
git commit -m "feat: wire up complete node registry, initialize on startup"
```

---

## Phase 2: Campaign Engine — Actually Send Emails

### Task 2.1: Implement sendCampaign() with Real Email Sending

**Objective:** Replace the hardcoded stub in `campaign.service.ts` (or wherever `sendCampaign` lives) with real email sending.

**Files:**
- Modify: `api/services/campaign.service.ts` or the file containing `sendCampaign()`
- Read: `api/services/channels/gmail.service.ts` for existing email sending pattern

**Steps:**

1. Find the `Campaign` model and `sendCampaign` function. It currently hardcodes sent counts.

2. Implement actual sending:
   - Fetch all contacts in the campaign's target list (via `SmartList`, `tags`, or explicit contact IDs)
   - For each contact, compose the email (subject + body template with `{{contact.name}}` etc.)
   - Queue emails via Bull queue (use existing queue service from workflow engine) to avoid rate limits
   - Track sent/failed stats on the Campaign model

3. Add support for sending via:
   - Connected Gmail channel (for small campaigns, OAuth-based)
   - Transactional provider (Resend/SendGrid via env var for larger volumes)

**Step 5: Commit**
```bash
git add api/services/campaign.service.ts
git commit -m "feat: implement real email sending for campaigns via Bull queue"
```

---

### Task 2.2: Campaign Status Tracking & Error Handling

**Objective:** Track campaign progress (total, sent, opened, bounced, failed) and handle delivery errors gracefully.

**Files:**
- Modify: `api/services/campaign.service.ts`
- Check: `prisma/schema.prisma` — does Campaign have status/sent/opened fields?

**Steps:**

1. As each email is sent (from the Bull queue worker), update campaign stats: `sentCount++`

2. Handle bounces/failures: if sending fails, increment `failedCount` and log the error.

3. When all emails are processed, set campaign status to `completed`.

4. Add a `GET /api/business/campaigns/:id/stats` endpoint for real-time progress.

**Step 5: Commit**
```bash
git add api/services/campaign.service.ts api/routes/business.routes.ts
git commit -m "feat: add campaign progress tracking and error handling"
```

---

## Phase 3: Sequences — Build the Sequencer

`Sequence` + `SequenceEnrollment` schema exists with `Step`, `StepType` (EMAIL, SMS, TASK, WAIT), but no worker executes the steps.

### Task 3.1: Implement Sequence Worker

**Objective:** Create a worker that processes enrolled contacts through their sequence steps on a schedule.

**Files:**
- Create: `api/services/sequence-engine/worker.ts`
- Create: `api/services/sequence-engine/scheduler.ts`
- Modify: `server.ts` (start sequence worker on boot)

**Implementation:**

The sequence engine processes `SequenceEnrollment` records. Each enrollment tracks:
- `currentStep` — which step is next
- `status` — ACTIVE, PAUSED, COMPLETED, UNENROLLED
- `lastStepAt` — when the last step was executed

**Worker logic (runs every 1 minute via node-cron):**
```typescript
// 1. Find all ACTIVE enrollments where next step is due
//    (waitUntil is null OR waitUntil <= now)
const dueEnrollments = await db.sequenceEnrollment.findMany({
  where: {
    status: 'ACTIVE',
    OR: [{ waitUntil: null }, { waitUntil: { lte: new Date() } }]
  },
  include: { sequence: { include: { steps: { orderBy: { order: 'asc' } } } } }
});

// 2. For each enrollment, execute the current step:
//    - StepType.EMAIL → send email (reuse campaign email sending)
//    - StepType.SMS → send SMS (reuse Twilio service)
//    - StepType.TASK → create task in CRM
//    - StepType.WAIT → set waitUntil to now + waitDuration, advance wait

// 3. Advance to next step, update currentStep and lastStepAt

// 4. If no more steps, set status = 'COMPLETED'
```

**Step 5: Commit**
```bash
git add api/services/sequence-engine/worker.ts api/services/sequence-engine/scheduler.ts server.ts
git commit -m "feat: implement sequence worker for automated follow-up sequences"
```

---

### Task 3.2: Sequence Enrollment API

**Objective:** Create endpoints to enroll/unenroll contacts in sequences and view enrollment status.

**Files:**
- Modify: `api/routes/crm.routes.ts` (add `/sequences/:id/enroll` endpoints)
- Create: `api/services/sequence-engine/enrollment.ts` or add to CRM service

**Endpoints:**
- `POST /api/sequences/:id/enroll` — enroll a contact (body: `{ contactId }`)
- `POST /api/sequences/:id/unenroll` — unenroll a contact (body: `{ enrollmentId }`)
- `GET /api/sequences/:id/enrollments` — list all enrollments
- `GET /api/sequences/:id/enrollments/stats` — get enrollment stats

**Step 5: Commit**
```bash
git add api/routes/crm.routes.ts api/services/sequence-engine/enrollment.ts
git commit -m "feat: add sequence enrollment/unenrollment API endpoints"
```

---

### Task 3.3: Sequence UI Wiring (Frontend)

**Objective:** Wire up the existing sequence UI (if any) to the new backend. Or add sequence enrollment to the contact detail view.

**Files:**
- Check: `src/pages/crm/ContactDetail.tsx`
- Check: `src/pages/crm/Sequences.tsx` or similar

**Steps:**

1. Add an "Enroll in Sequence" button to the contact detail slide-over or contact list actions.

2. If a Sequences page exists, show enrollment stats and allow management.

3. If no Sequences page exists, that's okay — sequences can be enrolled via CRM contact actions for now.

**Step 5: Commit**
```bash
git add src/pages/crm/ContactDetail.tsx
git commit -m "feat: add sequence enrollment UI to contact detail"
```

---

## Phase 4: Security Hardening

### Task 4.1: Add .env to .gitignore (Verify) and Create .gitignore Audit

**Objective:** Ensure NO sensitive data leaks. Verify `.env` is properly ignored and no key files are tracked.

**Files:**
- Verify: `.gitignore`

**Steps:**

1. Run `git ls-files | grep -i env` — verify `.env` is not tracked.

2. Verify `_key.txt` is ignored (we already added this in the initial cleanup).

3. Run `git ls-files | grep -E '\.(key|pem|crt|env)'` — check for any accidentally tracked secrets.

4. **Important:** The `.env.example` file should not contain real values — only placeholder values like `AIzaSy...YOUR_KEY` and `GOCSPX-...YOUR_SECRET`.

**Step 4: Commit**
```bash
git add .gitignore
git commit -m "chore: verify .gitignore excludes all secrets"
```

---

### Task 4.2: Add Helmet Security Headers to Express

**Objective:** Add security headers (CSP, X-Frame-Options, HSTS, etc.) to the Express app.

**Files:**
- Modify: `server.ts`

**Steps:**

1. Install `helmet`:
```bash
npm install helmet
npm install -D @types/helmet
```

2. Add to `server.ts`:
```typescript
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    }
  } : false,
}));
```

**Step 4: Commit**
```bash
git add server.ts package.json package-lock.json
git commit -m "chore: add helmet security headers to Express"
```

---

### Task 4.3: Add Rate Limiting to API Routes

**Objective:** Add rate limiting to prevent abuse, especially on public endpoints (form submissions, webhooks).

**Files:**
- Modify: `server.ts`

**Steps:**

1. Install `express-rate-limit`:
```bash
npm install express-rate-limit
```

2. Add global rate limiter (100 requests per 15 min for authenticated routes):
```typescript
import rateLimit from 'express-rate-limit';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// Stricter limit for public endpoints
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
});
app.use('/api/forms/:id/submit', publicLimiter);
app.use('/api/hooks/', publicLimiter);
```

**Step 4: Commit**
```bash
git add server.ts package.json package-lock.json
git commit -m "chore: add rate limiting to API routes"
```

---

### Task 4.4: Remove Dev Auth Bypass in Production

**Objective:** The dev auth bypass (`IS_DEV_AUTH_BYPASS = !CLERK_PUBLISHABLE_KEY`) should NEVER activate in production. Add explicit environment check.

**Files:**
- Modify: `src/lib/clerkConfig.ts`
- Modify: `server.ts` (resolveWorkspace middleware)

**Steps:**

1. In `clerkConfig.ts`:
```typescript
// Never bypass auth in production regardless of env vars
const IS_DEV = process.env.NODE_ENV === 'development';
export const IS_DEV_AUTH_BYPASS = IS_DEV && !process.env.VITE_CLERK_PUBLISHABLE_KEY;
```

2. In `server.ts` resolveWorkspace middleware:
```typescript
// Never bypass in production
const IS_DEV_BYPASS = process.env.NODE_ENV === 'development' && !process.env.CLERK_SECRET_KEY;
```

**Step 4: Commit**
```bash
git add src/lib/clerkConfig.ts server.ts
git commit -m "security: prevent dev auth bypass from activating in production"
```

---

## Phase 5: Polish & Completeness

### Task 5.1: Fix Hardcoded Fallback Data in Business Metrics

**Objective:** `getBusinessMetrics` returns hardcoded fallback values (`revenue: 48250, contacts: 2847`) when real data is missing. These should return `0` or proper empty state values, not fake data.

**Files:**
- Modify: `api/services/business.service.ts` or wherever `getBusinessMetrics` lives

**Steps:**

1. Find the fallback/hardcoded values and replace with real zero values or `null`.

2. On the frontend, handle the empty/zero case with a "no data yet" message.

**Step 3: Commit**
```bash
git add api/services/business.service.ts
git commit -m "fix: remove hardcoded fake data from business metrics fallback"
```

---

### Task 5.2: Fix Duplicate Route Detection & Verify All Routes Work

**Objective:** After Phase 0 fix, verify the entire API route structure works without conflicts.

**Files:**
- Multiple route files
- `server.ts`

**Steps:**

1. Start the server and log all registered routes.

2. Verify no duplicate routes exist.

3. Test key endpoints:
   - `GET /api/health`
   - `GET /api/crm/contacts`
   - `GET /api/business/dashboard`
   - `POST /api/workflows`

**Step 4: Commit**
```bash
git add server.ts
git commit -m "chore: verify all API routes work without conflicts"
```

---

### Task 5.3: Add Database Migration Script for Production

**Objective:** SQLite works for dev but production likely needs PostgreSQL. At minimum, ensure migrations exist and work.

**Files:**
- Read: `prisma/migrations/`
- Modify: `prisma/schema.prisma` if needed

**Steps:**

1. Run `npx prisma migrate dev --name initial` to ensure all schema changes are captured.

2. Run `npx prisma migrate status` to verify migration state.

3. Add a note in `.env.example` about `DATABASE_URL` for different environments.

**Step 4: Commit**
```bash
git add prisma/migrations/ prisma/schema.prisma .env.example
git commit -m "chore: ensure Prisma migrations are captured"
```

---

### Task 5.4: Update README.md with Project Documentation

**Objective:** Replace the generic AI Studio README with proper StoneAIO documentation.

**Files:**
- Modify: `README.md`

**Content:**
```markdown
# StoneAIO

All-in-one CRM and business operations platform for small businesses.

## Features

- **CRM**: Contacts, Companies, Deals, Pipeline, Smart Lists, Tags, Custom Fields
- **Communications**: Unified inbox (Email + SMS + Social), multi-channel conversations
- **Campaigns**: Email campaigns with targeting and analytics
- **Sequences**: Automated follow-up sequences with email, SMS, tasks
- **Automations**: Native workflow engine with triggers, actions, AI nodes
- **AI Chat**: Gemini-powered assistant with CRM tools

## Tech Stack

- Frontend: React 19, Vite, Tailwind CSS v4, TanStack Query
- Backend: Express.js, TypeScript
- Database: Prisma ORM, SQLite (dev)
- Auth: Clerk
- AI: Google Gemini 2.5
- Voice: Retell AI
- Real-time: SSE streaming
- Background: Bull queues (Redis), node-cron

## Getting Started

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your keys
3. `npx prisma migrate dev`
4. `npm run dev`

## Environment Variables

See `.env.example` for all required variables.

### Required
- `GOOGLE_AI_API_KEY` — Gemini API key
- `DATABASE_URL` — Prisma database URL (sqlite:./dev.db for dev)
- `CLERK_SECRET_KEY` and `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth (omit for dev bypass)

### Optional (channel integrations)
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` — Gmail OAuth
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — Twilio SMS
- `REDIS_URL` — Bull queue (falls back to in-memory if not set)
- `RETELL_API_KEY` — Retell voice agents
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Billing
```

**Step 5: Commit**
```bash
git add README.md
git commit -m "docs: update README with StoneAIO project documentation"
```

---

## Phase 6: Verification & Ship

### Task 6.1: Full Build Verification

**Objective:** Verify the project builds successfully with zero errors.

**Steps:**

1. Run typecheck:
```bash
npm run typecheck
```

2. Run lint:
```bash
npm run lint
```

3. Run build:
```bash
npm run build
```

4. Fix any errors until all three pass cleanly.

**Step 4: Commit**
```bash
git add .
git commit -m "chore: fix remaining type errors and build issues"
```

---

### Task 6.2: Dev Server Smoke Test

**Objective:** Start the full dev server and verify key workflows.

**Steps:**

1. Start `npm run dev`
2. Verify frontend loads at `http://localhost:5173`
3. Verify backend is healthy at `http://localhost:4000/api/health`
4. Test CRM: navigate to contacts, create a contact
5. Test pipeline: navigate to Opportunities, drag a deal
6. Test conversations: check inbox loads

**Step 3: Commit** — no code changes, just mark phase complete.

---

### Task 6.3: Final Push to GitHub

**Objective:** Push all completed work to GitHub.

**Steps:**

```bash
cd /mnt/c/Users/jackx/Desktop/StoneAIO
git push origin main
```

**Verification:**
```bash
curl -s https://api.github.com/repos/jackstonemedia/StoneAIOMainSystem/commits/main | python3 -c "
import sys, json
c = json.load(sys.stdin)
print(f'Latest commit: {c[\"sha\"][:7]} — {c[\"commit\"][\"message\"].split(chr(10))[0]}')
print(f'Date: {c[\"commit\"][\"author\"][\"date\"]}')
"
```

---

## Summary of All Phases

| Phase | Focus | Key Deliverable | Risk Level |
|-------|-------|-----------------|------------|
| 0 | Critical Bugs | No crashes, correct field names, scoped webhooks, encrypted keys | 🔴 High |
| 1 | Workflow Engine | 15+ node types registered, workflows actually execute | 🔴 High |
| 2 | Campaign Engine | Real emails sent via Bull queue, progress tracking | 🟡 Medium |
| 3 | Sequences | Automated follow-ups with email/SMS/task steps | 🟡 Medium |
| 4 | Security | Rate limiting, CSP headers, no dev bypass in prod | 🟡 Medium |
| 5 | Polish | No fake data, clean README, proper migrations | 🟢 Low |
| 6 | Ship | Build passes, smoke test passes, pushed to GitHub | 🟢 Low |

---

**Total estimated tasks: ~25 individual bite-sized steps across 6 phases.**

Each task is 2-5 minutes of focused work. Phases should be executed in order — later phases may depend on earlier ones.
