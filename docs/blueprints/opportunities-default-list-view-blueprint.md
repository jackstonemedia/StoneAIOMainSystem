# Blueprint — Opportunities page defaults to list view

Task: "Opportunities page defaults to list view — Azareth (Coding Agent): CRM"
Row: https://app.notion.com/p/3fbf4f63042c81289ab5e2b5df1d553b
Branch: `agent/opportunities-default-list-view` (from origin/main 374ed22)
Authored from the codebase + Software Map, before any code.

## 1. Goal

Jack wants the CRM Opportunities (deals) page (`/crm/opportunities`) to open in
list view by default instead of the board/kanban view. Default change only —
the board view stays available via the existing Board/List toggle. Nothing else
about the page changes.

## 2. Where it fits

From the codebase (Software Map §1/§2.2: `Deal` = "Opportunity" in the
Opportunities UI/API; `api/routes/opportunities.routes.ts` + service operate on
`Deal`):

- Routed page: `src/pages/opportunities/OpportunitiesPage.tsx` — `App.tsx:215`
  routes `/crm/opportunities` to it (`<OpportunitiesPage />` under the CRM
  section). Aliases `/opportunities` and `/pipeline` redirect to
  `/crm/opportunities`.
- View state: `viewMode` in `OpportunitiesPage.tsx:60`,
  `useState<'board' | 'list'>('board')`.
- Toggle UI: Board/List segmented control (~lines 578–601) — `setViewMode('board')`
  / `setViewMode('list')`, active styling follows `viewMode`.
- Render branch (~line 794): `viewMode === 'board' ? <kanban> : <grouped list>`.
- Saved views: `SavedViewsModal` receives `currentViewType={viewMode}`; applying a
  saved view sets `viewMode` from `view.viewType` (~line 1586). `OpportunitySavedView`
  (`src/types/opportunities.ts:89`) has `viewType: 'board' | 'list' | 'calendar'`
  and `isDefault`, but nothing auto-applies any saved view on load (verified —
  no such `useEffect`; `savedViews` is only fetched for the modal).
- `src/pages/crm/Opportunities.tsx` is a LEGACY, UNROUTED file (no imports
  anywhere; its own default is already `'list'`). It is NOT the page Jack sees.
  Do not touch it.
- Data layer untouched: same `opportunitiesApi.list` query, same pipeline/stage
  resolution, same filters/sort. No API, schema, seed, or migration change.

### Fit-check: saved-preference behavior (recorded on the row BEFORE code)

The page does NOT remember a last-chosen view. `viewMode` is plain component
state with a hardcoded `'board'` initial value. Verified absent: localStorage /
sessionStorage view keys, a `?view=` URL param (`searchParams` is declared but
unused), a server-side preference read on load, and any effect that auto-applies
a saved or default view. The only post-load changes to `viewMode` are explicit
user actions: (1) the Board/List toggle, (2) applying a saved view (sets
`viewMode` from that view's `viewType`), (3) "+ Add New Stage" in list view,
which switches to board because stage-creation UI lives in board view.

Consequence: changing the initial state to `'list'` sets the default for every
fresh page load and overrides NO saved preference — none exists. Saved views
keep working exactly as before when explicitly applied. This is the default-only
change Jack asked for, not a redesign of preference behavior.

## 3. Build steps

1. On branch `agent/opportunities-default-list-view`, change exactly one line in
   `src/pages/opportunities/OpportunitiesPage.tsx:60`:
   `useState<'board' | 'list'>('board')` → `useState<'board' | 'list'>('list')`.
2. Confirm no other site sets the initial view: grep `viewMode` / `'board'` in
   the opportunities pages — only the toggle, the saved-view apply, and the
   Add-New-Stage switch should remain (all intentional, all kept).
3. Do NOT touch: the toggle, the render branches, saved views, the legacy
   `src/pages/crm/Opportunities.tsx`, any other page's view defaults.
4. Run `npm run build` (must PASS) and `npm test` (record result as-is).
5. Evidence: run the dev stack (Vite + API + seeded dev DB, per the screenshots
   task's proven setup), capture in Inbox Dark (theme-inbox-dark):
   - (1) `/crm/opportunities` fresh load (fresh browser context / cleared
     storage so no prior toggle state exists — note: there is no persisted
     state, so any fresh load is a default-state load) showing the grouped
     list view with the List toggle active.
   - (2) Same page after clicking the Board toggle, showing the kanban board,
     proving board is still reachable.
   - DOM-check both shots (list view present / board view present; toggle
     active state matches). Verify screenshots are not blank.
6. Commit app change, push branch, commit evidence docs, push again. Verify
   branch in sync with origin.

## 4. Expected change areas

- `src/pages/opportunities/OpportunitiesPage.tsx` — 1 line (initial state).
- Plus Blueprint + evidence docs (no app behavior).

## 5. Build rules

- Match existing patterns; no new vendor/service; nothing outside scope.
- No migration, no data change, no API change. Revert = revert the 1 line.
- Do not "improve" the toggle, list rendering, saved views, or Add-New-Stage
  flow while here. The list-view Add-New-Stage button switching to board is
  pre-existing intentional behavior (stage creation lives in board view) —
  leave it.

## 6. Acceptance criteria

- [ ] Fresh load of `/crm/opportunities` shows the grouped LIST view; the List
      toggle button shows active.
- [ ] Clicking the Board toggle switches to the kanban board; clicking List
      switches back. Toggle + both views fully intact.
- [ ] Same deals, same pipeline/stages, same filters/sort, same detail
      navigation (click a deal → its detail/drawer as before).
- [ ] Applying a saved view still sets the view from that view's `viewType`.
- [ ] `npm run build` PASS; `npm test` recorded.
- [ ] No other page's view default changed; legacy `crm/Opportunities.tsx`
      untouched.
- [ ] Evidence screenshots (2) embedded in the row's page body and verified
      present; completion update + Status Done in ONE atomic update, verified
      by re-fetch.

## 7. Evidence required

- Screenshot 1: `/crm/opportunities` landing in list view (Inbox Dark, seed
  data), List toggle active.
- Screenshot 2: same page after Board toggle, kanban board visible.
- Evidence log `docs/crm-screenshots/opportunities-default-list-view/evidence-2026-10-16.md`
  with run log + screenshot-log.
- What Changed rundown on the row (summary, changes by area, how it works,
  verification, deviations, known limitations, rollback).

## 8. Test script for Jack

1. Open Opportunities (`/crm/opportunities`) — the page should land on the
   grouped LIST view (deals grouped under stage headings with totals), with
   the List toggle highlighted.
2. Click the Board toggle — the kanban board should appear (stage columns with
   deal cards). Click List again — back to the list.
3. Everything else behaves exactly as before: same deals, filters, sort,
   pipeline switcher, click a deal to open it.

## 9. Out of scope

- Persisting the user's last-chosen view (localStorage / server preference).
  Not requested; Jack asked for a default change only. Flagged as a possible
  follow-up, not built.
- Removing or hiding the board view or the toggle.
- Any change to the legacy unrouted `src/pages/crm/Opportunities.tsx`.
- Any change to other pages' view defaults (Contacts, Companies, Tasks, etc.).
- Saved-view auto-apply / default-view semantics.
- Software Map edit: render-only one-line default change; the Map describes
  Opportunities at route/entity level and nothing about entities, routes, or
  flows changed. Stated explicitly per rule 4.
