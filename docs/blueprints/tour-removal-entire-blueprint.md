# Blueprint — B-1 Tour removal ENTIRE: remove the product tour completely

Branch: `agent/tour-removal-entire` · Base: `e1a887e` (main after M-3) · Board row: "B-1 Tour removal ENTIRE — Azareth (Coding Agent)"
Author: Azareth (Coding Agent) · 2026-10-17 · Phase 0 approved. Gate verified before code: M-3 Status Done AND merge `e1a887e` confirmed on `origin/main` via git.

## 1. Goal

Jack's decision (2026-10-16): "get rid of the tour for now." Remove the product tour ENTIRELY — not just the buttons (M-3 already removed all 8 TourLauncher render sites), but the auto-launch, the component, the registry, the Command Palette entries, and the onboarding-progress wiring underneath them. After this change, no tour overlay can fire anywhere, for any user, fresh or returning, and no dead tour references remain in code, routes, or schema.

## 2. Where it fits

From the Software Map (Notion copy): the tour is a cross-cutting UI system, not a business entity.

- **UI surface:** `src/components/tour/` (TourLauncher, TourOverlay, TourProvider, TourTooltip), `src/components/dashboard/GettingStartedHub.tsx` (milestone cards that launch tours), `src/components/ui/CommandPalette.tsx` ("Start Tour: …" + "Reset All Product Tours" commands), `src/components/layout/AppShell.tsx` (`<TourProvider>` wraps the whole app), 7 layout files calling `useAutoLaunchTour`.
- **State:** `src/store/useTourStore.ts` (Zustand; localStorage key `stone_aio_tour_progress` + sync to the progress API), `src/hooks/useAutoLaunchTour.ts` (auto-launch on first visit), `src/hooks/useTour.ts` (zero consumers).
- **Content:** `src/lib/tours/` — registry + 6 tour definitions (crm, automations, email-marketing, conversations, ads, business) + `gettingStarted.ts` milestones + `types.ts`.
- **API + data:** `api/routes/onboarding.routes.ts` (the ONLY thing in that file is the three tour-progress endpoints), mounted at `/api` in `server.ts`; Prisma model `UserOnboardingProgress` + `User.onboardingProgress` relation.
- **Targets:** `data-tour="…"` attributes on pages/sidebar that tour steps anchored to. All tour steps are deleted with the definitions, so the anchors become dead markers.
- **NOT the tour:** the first-run `/onboarding` page (`src/pages/Onboarding.tsx`, route `/onboarding`) is a separate workspace-setup flow and never touches the tour store or the progress API. The `onboarding_workspace` test covers workspace/pipeline seeding, not tour progress. The Opportunities page option "Real Estate Deals (Lead, Tour, Offer, Closing)" uses "Tour" to mean a property tour (a pipeline stage), not the product tour.

## 3. Build steps

1. **Delete the tour UI components:** `src/components/tour/` (all 4 components + `__tests__/tour_render.test.tsx`).
2. **Delete the Getting Started hub:** `src/components/dashboard/GettingStartedHub.tsx`. It is tour-only (milestone cards that launch tours + progress display), and it is NOT rendered anywhere in production — zero consumers outside its own deleted test. A neutered shell with no actions would be worse than removal.
3. **Delete the tour state + hooks:** `src/store/useTourStore.ts`, `src/hooks/useAutoLaunchTour.ts`, `src/hooks/useTour.ts` (zero consumers).
4. **Delete the tour content:** `src/lib/tours/` (whole directory: 6 tour definitions, `gettingStarted.ts`, `registry.ts`, `types.ts`).
5. **Strip the 7 auto-launch call sites** — remove the `useAutoLaunchTour` import + call from each layout, nothing else:
   - `src/pages/ads/AdsLayout.tsx` (`useAutoLaunchTour('ads')`)
   - `src/pages/automations/AutomationsLayout.tsx` (`useAutoLaunchTour('automations')`)
   - `src/pages/business/calendar/CalendarLayout.tsx` (`useAutoLaunchTour('business')`)
   - `src/pages/business/BusinessLayout.tsx` (`useAutoLaunchTour('business')`)
   - `src/pages/conversations/ConversationsLayout.tsx` (`useAutoLaunchTour('conversations')`)
   - `src/pages/crm/CrmLayout.tsx` (`useAutoLaunchTour('crm')`)
   - `src/pages/email-marketing/EmailMarketingLayout.tsx` (`useAutoLaunchTour('email-marketing')`)
6. **AppShell:** remove the `TourProvider` import + wrapper; keep the children/structure otherwise identical.
7. **CommandPalette:** remove the `useTourStore` / `getAllTours` imports, `startTour`/`resetTour` use, the `tourCommands` block, the two tour entries in the empty-query default results, the `matchedTours` filter, and `matchedTours` from the search results. Prune the now-unused `Compass` + `RotateCcw` icon imports. Leave all contact/deal/action results untouched.
8. **Remove dead `data-tour` anchors** (attribute only; keep the elements/classes): Sidebar `getTourAttr` helper + its 3 `data-tour={…}` props; `Workflows.tsx` (2), `AdsDashboard.tsx` (3), `AdsLayout.tsx` (1), `Automations.tsx` (2), `CalendarSchedulePage.tsx` (1), `ConversationListPane.tsx` (1), `ThreadInfoPanel.tsx` (1), `ThreadPane.tsx` (1), `Contacts.tsx` (3), `CampaignsList.tsx` (1).
9. **Progress API — DROP (decision, see §3a):** delete `api/routes/onboarding.routes.ts`; remove its import + `app.use('/api', onboardingRouter)` mount in `server.ts`; remove the `UserOnboardingProgress` model + `User.onboardingProgress` relation from `prisma/schema.prisma`. No migration file: the repo has no `prisma/migrations/` directory and `prisma/migrations_baseline.sql` does not contain the onboarding table (the model postdates the baseline snapshot), so this is a schema-only removal. A production `user_onboarding_progress` table, if one exists, becomes orphaned/ignored — tour progress data only, no business data; deploy-time note for Jack, no data loss.
10. **Tests:** in `api/routes/__tests__/validation_routes.test.ts`, remove the `onboardingRouter` import + mount, the 2 onboarding-progress tests, and the `userOnboardingProgress` mock block. Keep the billing validation tests. (`onboarding_workspace.test.ts` is kept — it tests workspace seeding, not tour progress.)
11. **Verify:** full grep for dead references (tour identifiers + `data-tour` + `/api/onboarding/progress` + `UserOnboardingProgress`) must return zero live-code matches; `npm run build` PASS; `npm test` PASS with the tour/progress tests removed and no other count change; `tsc --noEmit` 0 errors; dev-server smoke: `GET /api/onboarding/progress` → 404 (endpoint gone); fresh-user run (cleared localStorage, fresh browser context) loads `/crm/contacts` + `/automations` with NO overlay; screenshots per §7.
12. **Evidence + Map:** write the What Changed rundown + evidence log under `docs/tour-removal-entire/`; embed the §7 screenshots in the board row body and verify the image blocks; update the Software Map (Notion § tour/API/model entries; repo copy lives on `agent/software-map` — apply there on sync); atomic completion update + Status Done; re-fetch to verify Done.

### 3a. Keep-or-drop decision: progress API → DROP

The tasking asked for a keep-or-drop decision on the progress API. **DROP.** Reasons, all verified from the code: (a) `api/routes/onboarding.routes.ts` contains ONLY the three tour-progress endpoints (GET progress, PUT progress/:tourKey, POST reset) — there is no other "onboarding API" in that file to keep. (b) Its only client is `useTourStore`, which is deleted. (c) Its only data is `UserOnboardingProgress`, which exists solely for tour progress. (d) The `/onboarding` first-run page and the workspace-seeding test do not use it. Keeping a progress endpoint with no producer and no consumer would be a dead API holding a dead table.

## 4. Expected change areas

- Deleted: `src/components/tour/` (5 files), `src/components/dashboard/GettingStartedHub.tsx`, `src/store/useTourStore.ts`, `src/hooks/useAutoLaunchTour.ts`, `src/hooks/useTour.ts`, `src/lib/tours/` (9 files), `api/routes/onboarding.routes.ts`. Total: 18 files deleted.
- Edited: 7 layouts (import + call each), `AppShell.tsx`, `CommandPalette.tsx`, `Sidebar.tsx`, 10 page/component files (data-tour attrs), `server.ts`, `prisma/schema.prisma`, `api/routes/__tests__/validation_routes.test.ts`.
- New: this Blueprint + `docs/tour-removal-entire/` evidence (log + screenshots).
- Unchanged: `src/pages/Onboarding.tsx`, `onboarding_workspace.test.ts`, Opportunities real-estate "Tour" stage, historical docs.

## 5. Build rules

- Match existing patterns; delete, don't stub — no empty placeholder components, no commented-out tour code, no "tour disabled" flags.
- Nothing outside this scope: no UI redesign, no copy changes beyond removing tour text, no behavior change to any non-tour feature.
- No new vendor/service. No secrets. `.env` never committed. Branch `agent/tour-removal-entire`, never main. Push branch as backup as I go. NO merge without Jack's approval of the finished build.

## 6. Acceptance criteria

- [ ] No `useAutoLaunchTour` call or import remains anywhere.
- [ ] No `TourLauncher` / `TourProvider` / `TourOverlay` / `TourTooltip` / `useTourStore` / `useTour` / `getTour` / `getAllTours` / `getTourForRoute` / `GETTING_STARTED_MILESTONES` / `GettingStartedHub` reference remains in live code or tests.
- [ ] No `data-tour` attribute remains in `src/`.
- [ ] No `/api/onboarding/progress` or `/api/onboarding/reset` reference remains in live code; `GET /api/onboarding/progress` returns 404 from the dev server.
- [ ] No `UserOnboardingProgress` / `userOnboardingProgress` / `onboardingRouter` remains in code or schema.
- [ ] No "Product Tour" / "Start Tour" / "Reset All Product Tours" string remains in live UI code.
- [ ] `npm run build` PASS; `npm test` PASS (tour/progress tests removed, no other count change); `tsc --noEmit` 0 errors.
- [ ] Fresh-user run: no tour overlay fires on any visited route; Command Palette shows no tour entries for empty query or for query "tour".
- [ ] `/onboarding` page + workspace seeding still work (untouched); Opportunities real-estate "Tour" stage untouched.
- [ ] Evidence screenshots embedded in the row body and verified (image blocks present); completion update + Status Done in ONE atomic update; re-fetch shows Status Done.

## 7. Evidence required

Screenshots from my own running build, Inbox Dark (theme-inbox-dark), in `docs/tour-removal-entire/` + embedded in the row body:

1. CRM Contacts — no overlay, banner row clean, no tour UI.
2. Opportunities list view — no overlay.
3. Command Palette open, empty query — no "Start Tour" / "Reset All Product Tours" entries.
4. Command Palette, query "tour" — no tour results.
5. Dashboard/home — no Getting Started hub, no crash.
6. Fresh-user load of `/crm/contacts` (cleared localStorage, fresh browser context) — no auto-launch overlay.
7. Fresh-user load of `/automations` — no auto-launch overlay.

Plus the What Changed rundown (Summary, Changes by area, How it works, Screenshots, Verification, Deviations, Known limitations, Rollback) and the verification commands + results (grep zeros, build, tests, typecheck, 404 check).

## 8. Test script for Jack

1. Pull branch `agent/tour-removal-entire`, start the dev server (`npm run dev`).
2. Open the app, log in. Visit CRM → Contacts. You should see: the normal Contacts page, NO popup overlay, NO tour tooltip, NO "Product Tour" button anywhere.
3. Visit Automations, Conversations, Ads, Business Calendar, Email Marketing. Same on each: NO tour overlay fires, pages behave exactly as before.
4. Press Cmd+K (Mac) / Ctrl+K (Windows) to open the command palette. With the box empty you should see Create-contact / Create-deal / Go-to entries — NO "Start Tour" entries, NO "Reset All Product Tours".
5. Type `tour` in the palette. You should see "No results found" (no tour commands).
6. Open the Dashboard. There is no "Getting Started with Stone AIO" checklist card anymore — that card only launched tours.
7. Open `/onboarding` directly. The first-run onboarding page still loads (it is a separate flow, not the tour).
8. Everything else — filters, search, detail clicks, pipelines — works exactly as before. If anything tour-like appears anywhere, that is a bug: report the exact page.

## 9. Out of scope

- Merge into main (needs Jack's approval of the finished build — G5).
- The `/onboarding` first-run page and workspace seeding.
- The real-estate "Tour" pipeline stage in Opportunities.
- Rewriting historical docs that mention the tour (prior blueprints/evidence logs are history).
- Cleaning the stale `stone_aio_tour_progress` localStorage key in existing browsers (inert string, nothing reads it after this change).
- Dropping a production `user_onboarding_progress` table, if one exists (schema removal only; deploy-time note).
- Any new onboarding / getting-started replacement UI. Jack said get rid of the tour "for now" — no replacement is built here.

## Baseline (pre-change, recorded as-is, branch at base e1a887e)

- Tests: `npm test` → 17 files, 74 tests, ALL PASS (2026-10-17 run).
- Build: `npm run build` → PASS (built in 23.29s).
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → PASS, 0 errors (2026-10-17 run).
- Install: `node_modules` present from prior runs on this checkout; no re-install needed for the baseline.
