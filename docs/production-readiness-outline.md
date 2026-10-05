<USER_REQUEST>
# Stone AIO — Production Readiness Outline

## 0. Scope & how to use this

This covers the whole app — backend, data layer, infra, and frontend — not just
the onboarding tours from the earlier spec (those are still valid and unrelated
to this doc). Findings below are pulled directly from the current codebase
(`server.ts`, `infrastructure/`, `api/`, `prisma/schema.prisma`, `Dockerfile`,
`railway.json`, `package.json`), not generic checklist filler, so your coding
agent can act on exact file paths.

Items are grouped by priority, not by subsystem, because "production ready"
for a live multi-tenant SaaS is really a triage problem:

- **P0 — Ship blockers.** Security holes, data-loss risk, or things that will
  silently corrupt/lose customer data or leak access. Fix before onboarding
  real paying customers, if you haven't already started.
- **P1 — Reliability & trust.** Won't necessarily cause an incident on day one,
  but will as soon as you have real usage, real scale, or a bad day. Also
  covers "the feature looks done but isn't" gaps.
- **P2 — Polish & scale.** Makes the app good to operate and maintain long
  term; not existential, but compounds if ignored.

---

## P0 — Ship Blockers

### P0.1 Auth dev-bypass can silently run in production
`api/middleware/workspace.ts` (`resolveWorkspace`) falls back to a hardcoded
`test_user_new` identity whenever `CLERK_SECRET_KEY` is unset — the only
signal is a `console.log` warning, not a hard failure. If that env var is ever
missing on a production deploy (typo'd name, Railway variable not copied to a
new environment, etc.), **every request authenticates as the same fake user**
instead of the app refusing to boot.
- Fix: at process startup, if `NODE_ENV === 'production'` and
  `CLERK_SECRET_KEY` is missing, throw and exit immediately rather than boot.
- Same treatment for any other "dev bypass" flags (`VITE_DEV_AUTH_BYPASS` is
  already named for this — confirm it's also hard-blocked in production).

### P0.2 Environment validation doesn't enforce production requirements
`infrastructure/config/env.ts` uses Zod but marks nearly everything
`.optional()` — including `CLERK_SECRET_KEY`, and `DATABASE_URL` defaults to
`file:./prisma/dev.db` (SQLite) if unset. A production deploy with a missing
env var doesn't fail loudly; it silently degrades (see P0.1) or runs against
the wrong database.
- Add a second, stricter schema (or `.superRefine`) applied only when
  `NODE_ENV === 'production'` that requires: `DATABASE_URL` (and rejects a
  `file:` SQLite URL), `CLERK_SECRET_KEY`, `CHANNEL_ENCRYPTION_KEY`,
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` if billing is live, and any
  other integration key that's load-bearing for a feature you're actively
  selling.
- Fail fast on boot with a clear error listing exactly which vars are missing
  — this is the single highest-leverage change in this whole doc, because it
  turns every other missing-secret bug into a deploy-time failure instead of a
  silent production incident.

### P0.3 Confirm Postgres, not SQLite, in the real production environment
`.env.example` documents SQLite as the local-dev default and Postgres
(Neon/Supabase) for production, and the Railway env should already set
`DATABASE_URL` — but there's no code-level guard against SQLite reaching
production (this is the same root cause as P0.2, listed separately because
it's worth its own verification pass: confirm the live Railway service's
`DATABASE_URL` really points at Postgres today, not just that the example file
says it should).

### P0.4 No CORS policy configured at all
Nothing in `server.ts` calls `cors()`. Fine only if frontend and API are
strictly same-origin in every deployment (currently true — Vite build is
served by the same Express app). This becomes a real gap the moment you add a
custom-domain/white-label frontend, a mobile app, or a separate marketing
site that needs to call the API. Add an explicit `cors()` config now with an
allow-list (even an allow-list of one origin) rather than adding it reactively
under time pressure later — implicit same-origin trust is easy to break by
accident (e.g., a webhook route or public capture-form endpoint gets called
cross-origin and nobody notices it "shouldn't" have worked).

### P0.5 Workflow engine bypasses its own queue
`api/services/workflow-engine/queue.service.ts` has a comment: *"Force inline
synchronous execution to bypass Upstash TLS/Queue issues"* — workflow runs
execute inline in the request/trigger path instead of going through
BullMQ/Redis (`infrastructure/queue/bullmq.ts` exists and is used elsewhere,
e.g. email sending, but not here). Practically: no retries on transient
failure, no backpressure if many workflows fire at once, a slow workflow step
blocks whatever triggered it, and a server restart mid-execution loses the run
with no resumption. This is a core product feature (the workflow automation
engine) running without the durability that a workflow engine exists to
provide.
- Fix the underlying Upstash TLS/connection issue and route workflow
  execution through the real queue, OR explicitly document this as an
  accepted limitation with a monitored size cap on how much work can run
  inline. Don't leave it as an undocumented bypass.

### P0.6 No migration step in the deploy path
`Dockerfile`'s runtime stage runs `npx prisma generate` at build time but
nothing runs `prisma migrate deploy` before the server starts (`CMD ["npx",
"tsx", "server.ts"]` goes straight to boot). `package.json` has no
`migrate`/`db:deploy` script either. Unless something outside this repo
(a Railway pre-deploy command, run manually) applies migrations, a schema
change ships as code without its migration — the app boots against a stale
schema, which fails ambiguously (missing column errors at request time,
not at deploy time).
- Add a migration step to the Docker entrypoint or a Railway pre-deploy hook:
  `npx prisma migrate deploy` before `tsx server.ts` starts.

### P0.7 Secrets & encryption key hygiene
`api/services/channels/encryption.ts` correctly validates
`CHANNEL_ENCRYPTION_KEY` as a 64-char hex string, but `api/routes/
workflows.routes.ts` falls back to a *different* var name (`ENCRYPTION_KEY`)
for the same purpose — two names for one secret invites a deploy where one is
set and the other isn't, silently breaking whichever code path uses the unset
one. Consolidate to a single env var name used everywhere credential
encryption happens, and confirm the key that's actually set in Railway today
is the one all code paths read. While in this area: confirm the previously
identified exposed encryption key (from your earlier repo audit) was rotated,
not just removed from source.

---

## P1 — Reliability & Trust

### P1.1 Input validation is built but barely adopted
`api/middleware/validate.ts` (Zod-backed) exists and works, but only 2 of the
29 files in `api/routes/` use it. The other 27 accept whatever shape of body/
query/params arrives. Roll `validate()` out route-by-route, prioritized by
what's reachable pre-auth or mutates data (webhooks, billing, CRM writes,
workflow builder saves) over read-only/internal endpoints.

### P1.2 Webhook idempotency
Stripe, Twilio, Meta, and Resend webhooks all hit this server
(`api/webhooks/*.handler.ts`). Confirm each one is idempotent against
redelivery (all four providers retry on any non-2xx or timeout) — typically a
`processedEventIds` table or a unique constraint on the provider's event ID,
checked before acting. A duplicate Stripe webhook double-crediting an
invoice, or a duplicate Twilio SMS webhook double-logging a conversation, is
the kind of bug that's invisible in testing and only shows up under real
provider retry behavior.

### P1.3 Testing & CI
Only 11 test files exist repo-wide (`vitest` is configured and `npm test`
works — it's just barely used), and there's no `.github/workflows` — nothing
enforces lint/typecheck/test/build before a merge reaches the deploy branch.
- Minimum bar before calling this "production ready": a GitHub Actions
  workflow that runs `npm run lint`, `npm run typecheck`, `npm test`, and
  `npm run build` on every PR, required to pass before merge.
- Test coverage priority order (highest blast-radius first): billing/Stripe
  webhook handling, credential encryption, workflow execution engine, CRM
  bulk actions (data mutation at scale), auth/workspace resolution
  middleware. UI component tests are lower priority than these.

### P1.4 No error monitoring / APM
`winston` logs to console (captured by Railway), but there's no Sentry (or
equivalent) wired on either the Express server or the React app. Console
logs work for "I noticed something's wrong and go dig," not for "tell me
the moment something's wrong." Add error tracking on both sides — the
existing `ErrorBoundary` components in the frontend route tree
(`src/App.tsx`) are a natural place to report caught render errors, and
`errorHandler` in `api/middleware/error.ts` is the natural place to report
server-side exceptions.

### P1.5 Health check doesn't distinguish healthy from degraded for alerting
`/api/health` always returns HTTP 200 even when the DB check fails (returns
`{status: 'degraded'}` in the body) — intentionally, so Railway's own
healthcheck doesn't restart-loop the service. That's reasonable for Railway,
but means any external uptime/alerting tool watching for non-200 responses
will never fire on a real DB outage. If you add real alerting (recommended —
see P1.4), make sure it parses the body's `status` field, not just the HTTP
code.

### P1.6 Feature completeness — stop shipping mock data as if it's real
The ads module audit already surfaced a pattern worth treating as a
repo-wide sweep, not a one-off: Campaign Detail settings buttons with no
`onClick`, Ad Groups/Ads tabs on hardcoded mock arrays with no backing Prisma
model, an Overview chart rendering randomly generated numbers instead of real
`AdMetricSnapshot` rows, a fully-built `KeywordGenerator` component that's
never imported anywhere, a Media Library modal showing hardcoded stock
photos with no real upload path, and a Reports page that's a static
"coming soon" screen.
- Before calling *any* module production-ready, grep it for the same smells:
  hardcoded arrays standing in for API data, buttons with no handler, static
  "coming soon" placeholders, components built but never imported. A UI that
  looks finished but silently does nothing (or shows fake numbers) is worse
  for a paying customer than a visible "not available yet" state, because it
  erodes trust once they notice.
- Where a feature genuinely isn't ready, gate it behind a feature flag or an
  explicit disabled/"coming soon" state rather than leaving it wired to fake
  data that looks real.

---

## P2 — Polish, Performance & Operability

### P2.1 Deployment config inconsistencies
`Dockerfile` has `EXPOSE 4000`, but the app's own default `PORT` (in
`.env.example` and `env.ts`) is `3000`. Railway sets `PORT` itself at runtime
so this likely doesn't break anything today, but it's a latent trap for
local Docker testing or a future non-Railway deploy target. Align them.

### P2.2 README is still the AI-Studio scaffold boilerplate
The current `README.md` is the generic "Run and deploy your AI Studio app"
stub (3 setup steps, mentions only `GEMINI_API_KEY`). For a production app —
especially one where an AI coding agent is doing a lot of the implementation
— replace it with: real architecture overview (frontend/API/queue/DB),
full env var reference (or a pointer to `.env.example`), how to run
migrations, how to run tests, and a deploy runbook. This is also where a
short incident-response note belongs (who/what to check first when the
health check goes degraded).

### P2.3 Workspace-scoped index audit
82 `@@index` declarations across 88 Prisma models, with `workspaceId`
appearing 172 times — likely reasonable, but worth an explicit pass rather
than an assumption: for every model queried by `workspaceId` on a hot path
(contacts, opportunities, conversations, campaigns), confirm there's a
composite index leading with `workspaceId`, not just a bare index on some
other column. This is the kind of thing that's invisible at low data volume
and painful the first time a workspace has tens of thousands of rows.

### P2.4 Connection pooling for serverless-adjacent Postgres providers
If the production `DATABASE_URL` points at Neon or Supabase (as
`.env.example` suggests), confirm Prisma is using a pooled connection string
(e.g., PgBouncer/Neon's pooler endpoint), not a direct connection — Express
on Railway is long-running (not serverless) so this is lower risk than it
would be on Vercel functions, but still worth confirming as connection count
grows with workspace count.

### P2.5 Frontend production concerns
- Bundle size/code-splitting: with this many distinct sections (CRM,
  Automations, Email Marketing, Conversations, Ads, Business), confirm
  route-level lazy-loading (`React.lazy`) is actually splitting the Vite
  build per section rather than shipping one large bundle.
- Empty/loading/error state consistency across list views — this overlaps
  directly with the empty-states section of the onboarding tour spec; treat
  it as one workstream, not two.
- Basic accessibility pass (keyboard navigation through the sidebar/tables,
  focus management in modals/`SlideOverPanel`, color contrast) — worth doing
  once, not per-component as an afterthought.

### P2.6 Rate limit tuning per plan tier
Current limits (`apiLimiter` 300/min, `aiLimiter` 20/min, `webhookLimiter`
600/min) are global per-IP, not per-workspace or per-plan. Once billing tiers
matter, consider scoping limits to `workspaceId` instead of IP (a busy office
NAT’d behind one IP shouldn't share a rate-limit bucket with unrelated
workspaces), and consider higher AI-endpoint limits for paid tiers.

### P2.7 Compliance basics for a paid multi-tenant SaaS
Given Stripe billing is already integrated: confirm ToS/Privacy Policy pages
exist and are linked from signup, and that there's at least a manual process
(even if not self-serve yet) for a customer data export/delete request.
Not urgent if you're pre-launch/early customers, but worth having on the
list before wider signups.

---

## Suggested Phasing

1. **P0 sweep first, in the order listed** — most are small, surgical fixes
   (a few lines in `env.ts`, `workspace.ts`, `server.ts`, the Dockerfile) that
   remove entire classes of silent failure. Do these before anything else in
   this doc, even before finishing the ads module or other feature work.
2. **P1.1–P1.2** (validation rollout + webhook idempotency) alongside
   whichever route files you're already touching for other work — no need
   for a dedicated sprint, but track it so "already touched" files actually
   get it rather than being skipped forever.
3. **P1.3–P1.4** (CI + error monitoring) as a short, dedicated pass — these
   are infrastructure-once, benefit-forever, and cheap relative to the rest
   of this list.
4. **P1.6** (mock-data/dead-button sweep) — do this per-module right before
   you'd otherwise call that module "done," using the ads module findings as
   the template for what to look for.
5. **P2** items opportunistically, prioritizing P2.1–P2.3 (cheap,
   config-level) over P2.5–P2.7 (broader passes) unless a specific one is
   blocking a specific customer or launch milestone.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-05T00:57:04-04:00.
</ADDITIONAL_METADATA>