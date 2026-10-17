# Blueprint — B-2 Error monitoring install: Sentry on client + server, alerts to Jack

Source: Coding Agent — Setup Game Plan template. Authored from the codebase + Software Map BEFORE any code (G0).
Row: B-2 Error monitoring install — Azareth (Coding Agent): Sentry on client + server, alerts to Jack.
Base: main e43f700 (post-M-2 merge). Branch: agent/sentry-error-monitoring.

## 1. Goal

Install error monitoring per Jack's approved Phase 0 default — Sentry, alerts to Jack only — on BOTH sides
(client app + API server), wired so real errors report with useful context, and verify one test error
end-to-end. Today Winston logs to console only and no monitoring exists, so a real user's first crash is
invisible. This task makes Week-2 verification trustworthy (process D1 pulled it forward for that reason).

## 2. Where it fits

From the codebase (verified in fit-check, 2026-10-17):

- Client entry `src/main.tsx` — plain `createRoot(<App />)`, no Sentry, no global error handlers.
- `src/components/common/ErrorBoundary.tsx` — class boundary wrapping routes in `src/App.tsx`;
  `componentDidCatch` only `console.error`s. This is the client capture point (covers render errors app-wide).
- Server entry `server.ts` (root) — imports `errorHandler` from `./api/middleware/error.js`, registered last
  (line ~304, after all routes). No `unhandledRejection` / `uncaughtException` handlers (only SIGTERM/SIGINT).
- `api/middleware/error.ts` — THE central server error funnel: `AppError` → warn + status JSON;
  anything else → `logger.error` + HTTP 500. This is the server capture point.
- `api/utils/logger.ts` — Winston, console transport only, JSON in prod. Sentry is ADDITIVE; Winston stays.
- `infrastructure/config/env.ts` — Zod env schema; all provider keys optional except production guards.
  Sentry vars must be OPTIONAL so a missing DSN never fails boot (monitoring disabled = no-op, not a crash).
- Production CSP in `server.ts` — `connectSrc` has NO `*.sentry.io` entry, so browser events to Sentry
  ingest would be blocked in production. Must add it.
- `.env.example` — no Sentry vars. `package.json` — no `@sentry/*` deps. Zero `sentry` matches in
  `package.json` / `src` / `server.ts` / `vite.config.ts` / `.env.example` (verified by grep).
- Tests: Vitest, jsdom, `src/**` + `api/**` + `infrastructure/**`. Existing
  `src/components/common/__tests__/ErrorBoundary.test.tsx` must keep passing.

## 3. Build steps

1. Baseline first (on this branch, before changes): `npm run build`, `npm test` — record as-is.
2. `npm install @sentry/react @sentry/node --ignore-scripts` (ignore-scripts avoids the known Prisma-engines
   ECONNRESET failure on full install). Record exact resolved versions.
3. Client module `src/lib/sentry.ts`:
   - `initSentry(dsn?)` — DSN defaults to `import.meta.env.VITE_SENTRY_DSN`; if empty, NO-OP, return false.
     Else `Sentry.init({ dsn, environment: import.meta.env.MODE })`. No tracing,
     no Session Replay (error monitoring only — keep the footprint minimal).
   - `captureClientError(error, context?)` — `Sentry.captureException` only if initialized; else no-op.
   - `isSentryEnabled()` — for tests / callers. DSN param is injectable so tests can pass a dummy DSN
     without touching `import.meta.env`.
4. `src/main.tsx` — call `initSentry()` FIRST, before `createRoot`.
5. `src/components/common/ErrorBoundary.tsx` — in `componentDidCatch`, call
   `captureClientError(error, { componentStack })` (in addition to the existing `console.error`).
6. Server module `api/utils/sentry.ts`:
   - `initSentry(dsn?)` — DSN defaults to `env.SENTRY_DSN`; if empty, NO-OP, return false. Else
     `Sentry.init({ dsn, environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
     tracesSampleRate: 0 })`. The SDK auto-registers `uncaughtException` / `unhandledRejection` capture.
   - `captureServerError(err, context?)` — `Sentry.captureException` only if initialized; returns event id or null.
7. `server.ts` — import `./api/utils/sentry.js` FIRST (right after `import 'dotenv/config'`) so init runs at
   boot, before route modules load. Add production CSP `connectSrc: https://*.sentry.io` (Sentry ingest).
8. `api/middleware/error.ts` — in the non-`AppError` branch (true 500s), call
   `captureServerError(err, { method, path })`. `AppError` (expected 4xx, e.g. validation) is NOT sent to
   Sentry — expected errors must not create alert noise. Winston logging unchanged.
9. `infrastructure/config/env.ts` — add optional `SENTRY_DSN` + `SENTRY_ENVIRONMENT` (both `z.string().optional()`).
10. `.env.example` — document `SENTRY_DSN=""`, `VITE_SENTRY_DSN=""`, `SENTRY_ENVIRONMENT="development"`
    with a comment: empty = monitoring disabled; set from the Sentry project DSN. NEVER commit a real DSN.
11. Dev-only test route (Sentry's own verification pattern): `GET /api/_sentry-test` throws
    `Error('Sentry test error')`. Mounted in `server.ts` ONLY when `env.NODE_ENV !== 'production'`
    (404 in prod — no exposure). This gives Jack a one-command end-to-end check once a DSN is set.
    It goes through the normal `errorHandler`, so it also proves the funnel wiring.
12. Tests (no network — capture verified to the SDK boundary):
    - `api/utils/__tests__/sentry.test.ts`: no DSN → init false, capture null, no throw; dummy DSN +
      `beforeSend: () => null` (drops the event before any network) → `beforeSend` receives the error.
    - `src/lib/__tests__/sentry.test.ts`: same shape for the client module (dummy DSN passed in).
    - `api/middleware/__tests__/error.test.ts`: plain Error → 500 + capture called (Sentry module mocked);
      `AppError(400)` → 400 + capture NOT called; Winston behavior unchanged.
    - Existing `ErrorBoundary` test must still pass (capture is a no-op without a DSN).
13. Verify: `npm run build` PASS, `npm test` PASS (or delta vs baseline explained), targeted `tsc` check
    shows no NEW errors in the touched files. Run the dev server + `curl /api/_sentry-test` with a dummy
    DSN/`beforeSend` setup? No — the automated tests cover the funnel; the live-dashboard hop needs a
    real DSN (see §6 / §9). Capture one screenshot of the app running from this branch (smoke: no crash
    with DSN absent) for the evidence package.
14. Software Map: Notion Map page gets a short monitoring note (repo `docs/software-map.md` lives on
    branch `agent/software-map` — same note to be applied there on sync; stated explicitly in completion).

## 4. Expected change areas

- NEW: `src/lib/sentry.ts`, `api/utils/sentry.ts`, `api/utils/__tests__/sentry.test.ts`,
  `src/lib/__tests__/sentry.test.ts`, `api/middleware/__tests__/error.test.ts`,
  `docs/blueprints/sentry-error-monitoring-blueprint.md`, `docs/sentry-error-monitoring/evidence-*.md`.
- EDIT: `src/main.tsx`, `src/components/common/ErrorBoundary.tsx`, `server.ts` (init import + CSP + test route),
  `api/middleware/error.ts`, `infrastructure/config/env.ts`, `.env.example`, `package.json` + `package-lock.json`.
- NO CHANGE: Winston logger, AppError behavior / response shapes, any route, any UI, any schema.

## 5. Build rules

- Match existing patterns: central funnel (`errorHandler`), Winston stays, Zod env stays, no new vendor
  beyond the packet-approved Sentry. No behavior change when DSN is absent (no-op, app runs exactly as today).
- No real secrets in code, docs, or logs. No DSN committed. DSN comes from env only.
- No user-facing "test error" button, no fake monitoring UI. The test route is dev-only (404 in prod).
- No `setupExpressErrorHandler` AND `errorHandler` double-capture: capture lives in `errorHandler` only.
- No user PII attached to Sentry events by our code — only error + method/path (server) /
  component-stack (client) context. DEVIATION (found at typecheck): installed @sentry/* v11 has
  no `sendDefaultPii` init option (tsc TS2353), so the Blueprint's `sendDefaultPii: false` was
  dropped from both init calls; the SDK does not attach user PII by default.

## 6. Acceptance criteria

- [ ] `Sentry.init` runs on client boot and server boot when a DSN is set; does nothing when DSN is absent.
- [ ] A server 500 through `errorHandler` reaches `Sentry.captureException` (proven by test with dropped-event transport).
- [ ] A client render error through `ErrorBoundary` reaches `captureClientError` (proven by test).
- [ ] `AppError` (expected 4xx) does NOT reach Sentry.
- [ ] `uncaughtException` / `unhandledRejection` are captured by the SDK's default integrations (init-level, no custom handlers).
- [ ] Production CSP allows `https://*.sentry.io` in `connectSrc`.
- [ ] `GET /api/_sentry-test` throws through the funnel in dev; 404 in production.
- [ ] `npm run build` PASS; `npm test` PASS (or delta vs baseline explained); no NEW typecheck errors in touched files.
- [ ] No real DSN in the repo. `.env.example` documents the three vars.
- [ ] REAL-ALERT BOUNDARY (Jack-side, NOT verifiable in this task — stated explicitly in completion):
      a real Sentry project + DSN + a dashboard alert rule ("to Jack only") are required before any real
      alert can fire. No Sentry account/credentials were provided, and none are created here. The code path
      is verified to the SDK boundary; the Sentry-cloud → alert-rule → Jack's inbox hop is UNVERIFIED until
      Jack sets a DSN, creates the alert rule, and hits the test route (test script §8).

## 7. Evidence required

- Test output: new Sentry + error-middleware tests passing; full `npm test` counts; `npm run build` PASS.
- One screenshot from my own running build: the app up with Sentry init active and DSN absent (proves no-op boot).
- Evidence log `docs/sentry-error-monitoring/evidence-2026-10-17.md` (commands + results + screenshot log).
- What Changed rundown on the row + test script for Jack (§8).
- Explicitly NOT claimed: no Sentry dashboard screenshot (no project/DSN exists yet — Jack-side).

## 8. Test script for Jack

1. Create a Sentry project at sentry.io (JavaScript + Node) — or use the existing one — and copy its DSN.
2. In the deploy env, set `SENTRY_DSN=<dsn>`, `VITE_SENTRY_DSN=<same dsn>`, `SENTRY_ENVIRONMENT=production`,
   then redeploy. (Client DSN is public by Sentry's design; it is still set via env, never hard-coded.)
3. In Sentry → Alerts, create an alert rule for this project that notifies YOU ONLY (Jack) on new issues.
4. Start the dev server (or use the deployed env with the dev-only route enabled in a non-prod deploy),
   then run: `curl http://localhost:4000/api/_sentry-test` — expect HTTP 500.
5. Check Sentry → Issues: one new issue `Sentry test error` with method/path context. Check your inbox:
   the alert you configured in step 3 should arrive.
6. In the app, cause any real render crash (or wait for one) — it appears in Sentry via the ErrorBoundary path.
7. Remove the DSN from env → restart → app runs exactly as before (monitoring silently off). That is the
   no-DSN no-op guarantee.

## 9. Out of scope

- Creating a Sentry account / project / alert rule (Jack-side; needs Jack's account + where alerts go).
- Performance tracing, Session Replay, profiling, release tracking / source-map upload (error monitoring only).
- Winston transport to Sentry (Sentry is additive; Winston stays console-only).
- Migrating old logs, backfilling issues, or alerting for any other channel (email/Discord/PagerDuty).
- Tour removal (B-1), billing, or any other module work.
- Merging: NO MERGE without Jack's approval of the finished build (G5).
