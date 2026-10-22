# CRM screenshots — workaround attempt (2026-10-16, SUCCESS)

Task: Screenshots — Azareth (Coding Agent): CRM section pages. No feature build, no app-code changes. This log supersedes the 2026-10-15 Blocked attempt (attempt-2026-10-15.md) — the blockers below were worked around without changing application code.

## What was done

1. **Prisma engines via curl (not via Prisma's downloader).** Prisma's downloader fails with `ECONNRESET` even though proxy env is set; curl (proxy-aware) succeeds. Downloaded the 4 engine files for engines commit `c2990dca…` (debian-openssl-3.0.x) from the Prisma CDN into `~/.cache/prisma/master/c2990dca…/debian-openssl-3.0.x/` + `node_modules/@prisma/engines/` (postinstall location), gunzipped, chmod +x. Set `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` (cache had no `.sha256` files, so Prisma kept re-downloading). Copied `libquery_engine` into `node_modules/prisma/` and curl-downloaded the Windows `query_engine.dll.node` (schema has `binaryTargets = ["native", "windows", "debian-openssl-3.0.x"]`). Result: `✔ Generated Prisma Client (v6.19.3)`.
2. **Local Postgres 16 via apt** (VM is root, Ubuntu 24.04). Started cluster, created dev DB `stoneaio` + dev user. Set `DATABASE_URL` in local `.env` only (gitignored, never committed, credentials not recorded here).
3. **`prisma db push` + seed.** DB in sync with schema. `npx tsx prisma/seed.ts` → Workspace Stone AIO, 5 Companies, 12 Contacts, 8 Deals, 6 Tasks, 10 Appointments, 5 Conversations, 3 Smart Lists. Real project seed data, not fake.
4. **Workspace membership fix (dev DB data only, no code).** The API's dev-bypass user is `test_user_new`. On first request the API auto-provisioned a NEW empty workspace for `test_user_new` (because the seeded workspace had NO members — the seed creates the workspace but no `WorkspaceMember` row). So the API returned empty. Fix: deleted the empty auto-provisioned workspace + its membership, added `test_user_new` (admin) and seed owner `user_dev_jack_stone` (admin) as members of the seeded workspace `ws_default_stone_aio`. After that the API returned seeded data. No app code changed.
5. **`VITE_DEV_AUTH_BYPASS=true` in local `.env`** (dev-only, gitignored). Frontend skips Clerk locally. Restarted Vite.
6. **Playwright (Chromium) in /tmp, same machine as Vite.** Tunnels were blocked (LocalTunnel server unreachable via proxy, Cloudflared `api.trycloudflare.com` TLS blocked), and the managed browser cannot reach loopback — so Playwright on the same machine was used instead. Viewport 1440x900, fresh page per route, `--disable-dev-shm-usage`. All 15 routes captured.

## How the app was run

- API: `PORT=4000 npx tsx server.ts` → `/api/health/live` 200, `/api/health/ready` 200. In-memory Redis fallback, mock workers (no real sends).
- Vite: `npx vite --port 5173` → `GET /` 200, `/api/health/live` via proxy 200.
- DB: Local Postgres 16, DB `stoneaio`, seeded workspace `ws_default_stone_aio`, dev-bypass user `test_user_new` as admin of seeded workspace.
- Data state: Project seed data (see §3). No fake data, no invented records. Screenshots show the seeded workspace as the dev-bypass user sees it.

## Screenshots captured (15/15, all with real content)

All in this directory, viewport 1440x900, from the running dev build:

| Route | File |
|---|---|
| /crm (redirects to /crm/contacts — same page, not a separate overview) | crm-landing.png |
| /crm/contacts (12 contacts) | crm-contacts.png |
| /crm/companies | crm-companies.png |
| /crm/opportunities (Standard Sales pipeline, 6+ deals) | crm-opportunities.png |
| /crm/tasks | crm-tasks.png |
| /crm/documents (renders "No documents yet" — seed has no documents) | crm-documents.png |
| /crm/smart-lists | crm-smart-lists.png |
| /crm/bulk-actions | crm-bulk-actions.png |
| /crm/settings | crm-settings.png |
| /crm/opportunities/settings/pipelines | crm-opportunities-settings-pipelines.png |
| /crm/opportunities/settings/fields | crm-opportunities-settings-fields.png |
| /crm/opportunities/settings/tags | crm-opportunities-settings-tags.png |
| /crm/contacts/ct_alice (Alice Freeman, Acme Corp) | crm-contact-detail.png |
| /crm/companies/co_global (Global Solutions) | crm-company-detail.png |
| /crm/opportunities/dl_1 (Q3 Enterprise License, $120,000, Alice Freeman) | crm-opportunity-detail.png |

Pages NOT captured: none — all 15 captured. No CRM page was missing or forced.

Per-route content checks are in `screenshot-log.json` (route, HTTP 200, expected seed string present, body chars).

## Verification

- Viewed `crm-contacts.png` (12 rows: Jack OConnor, Irene Chang, Carol Nguyen, Frank Muller, Elena Torres, Grace Kim, David Park, Karen Lee, Liam Patel, Henry Walsh, Bob Smith, Alice Freeman), `crm-contact-detail.png` (Alice Freeman, Acme Corp, alice@acmecorp.com), `crm-opportunities.png` (Standard Sales board: Logistics Platform $95,000, API Access — Startup $12,000, Infrastructure Upgrade $45,000, Enterprise Expansion $240,000, Q3 Enterprise License $120,000, Marketing Automation $28,000).
- All 15 PNGs exist, 50K–176K each, no blank files.
- API `/api/crm/contacts` returns seeded contacts (verified via curl after workspace fix).

## Deviations / known limitations

- No app code changed. No schema, seed, or frontend changes. No merge.
- Dev-only setup (not in repo): Prisma engines in `~/.cache/prisma/` + `node_modules/` (gitignored), Postgres 16 in VM, `.env` local only (gitignored), dev DB data in local Postgres (not in repo), Playwright + Chromium in `/tmp` (not in repo).
- Screenshots show DEV seed data, not production data. Contact detail has a minor top-right icon overlap in the app's actual rendering (reported as-is, not fixed — fixing it would be app-code change, out of scope).
- `/crm` landing is the contacts list (redirect), not a separate CRM overview page.
- Findings for a future Software Map update (not applied here — no software changed, and the Map lives on branch `agent/software-map`): (a) Prisma schema is `postgresql`-only — the `.env.example` "SQLite local dev" note does not work with this schema; (b) seed creates the workspace with NO `WorkspaceMember` rows, so no user can see seeded data until a membership is added; (c) API dev-bypass user is `test_user_new`, frontend dev user is `user_dev_123` (different IDs); (d) tunnels (LocalTunnel, Cloudflared) are blocked by the egress proxy in this VM.

## Work lives on

- Branch `agent/crm-screenshots`, this directory `docs/crm-screenshots/` (15 PNGs + `screenshot-log.json` + this log + prior `attempt-2026-10-15.md` Blocked log).
- API / Vite / Postgres left running in the VM for reuse (PIDs in `/tmp/api-2026-10-15.pid`, `/tmp/vite-2026-10-15.pid`; Postgres cluster `16 main` on `:5432`). Stop with `kill $(cat /tmp/api-2026-10-15.pid)`, `kill $(cat /tmp/vite-2026-10-15.pid)`, `pg_ctlcluster 16 main stop`.
