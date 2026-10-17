# Blueprint — Remove ALL product tour buttons + banner controls on all CRM pages

Row: "Remove ALL product tour buttons + banner controls on all CRM pages — Azareth (Coding Agent)"
Branch: `agent/remove-all-tour-buttons-banner-controls` (ONE branch for both phases — Phase 1 and Phase 2 both touch `CrmLayout.tsx`, so a single branch avoids a merge collision between the two phases).
Base: `origin/main` @ `374ed22`.

## Goal

Phase 1 (build): remove every remaining Product Tour button/launcher in the app — the shared `TopBar` launcher and the launchers in every section layout — without ripping out the underlying tour system.

Phase 2 (build): align every CRM page's controls to the Contacts pattern — page controls on the top banner row (the `CrmLayout` nav bar, same row as the AI-agent button and the bell icon), via the existing `HeaderPortal` → `#crm-header-actions` mechanism. Every control keeps working exactly as before; only placement changes. Pages whose controls genuinely don't fit are parked for Jack's approval, not forced.

## Where it fits (codebase as it actually works)

- The ONLY thing that renders a "Product Tour" button is `TourLauncher` (`src/components/tour/TourLauncher.tsx` — Compass icon + "Product Tour" text + dropdown of tours). Grep for `TourLauncher` finds 8 render sites + the component + 1 test:
  - `src/components/layout/TopBar.tsx:52` (shared TopBar — Dashboard, Settings, etc.)
  - `src/pages/crm/CrmLayout.tsx:67` (CRM banner)
  - `src/pages/ads/AdsLayout.tsx:127`
  - `src/pages/automations/AutomationsLayout.tsx:66`
  - `src/pages/business/BusinessLayout.tsx:65`
  - `src/pages/business/calendar/CalendarLayout.tsx:70`
  - `src/pages/conversations/ConversationsLayout.tsx:109` (in a header sub-component in that file)
  - `src/pages/email-marketing/EmailMarketingLayout.tsx:105`
- The tour SYSTEM is separate from the buttons and stays: `TourLauncher` component itself, `TourProvider` / `useTourStore`, `lib/tours/registry`, tour definitions, `/api/onboarding/progress`, `data-tour` targets, `CommandPalette` "Product Tour / Reset All" entries, and the first-time-user auto-launch hook (see Known limitation). Removing a `<TourLauncher />` JSX element + its import at each of the 8 sites is the whole Phase 1 change.
- The CRM banner pattern already exists: `CrmLayout` renders the banner (left: AI-assistant button + bell; right: `<div id="crm-header-actions">` portal target) and `HeaderPortal` (`src/components/layout/HeaderPortal.tsx`) portals a page's controls into that target. Six CRM pages already use it. Phase 2 extends that mechanism to the pages that don't — no new layout machinery.
- CORRECTION to the tasking's premise (recorded before code, per Rule 1): Jack's direction says Contacts' "sort and filter … sit on the SAME ROW as the bell icon and the AI agent" and that Opportunities' controls "sit on that row too". Ground truth from the code:
  - Contacts: Search / Import / Add Contact / Manage fields ARE on the banner via `HeaderPortal` — but **Advanced filters + Sort live in the footer paginator bar**, not the banner.
  - Opportunities: its controls sit in their **own in-page header row below the banner**, not on the banner row.
  - So neither page matches the description exactly. The adjusted approach, following the task's own standard ("any CRM page whose controls are NOT on that top banner row gets aligned" + "only the placement changes"), is: **controls move to the banner; page identity (title / pipeline switcher / Back link) stays in-page.** That is the faithful reading of "controls on the banner row", and it avoids deleting titles/Back navigation. Detail-page record actions are the exception (parked, § Fit-check).

## Phase 2 fit-check (per CRM page — also posted on the row BEFORE coding)

| Page | Controls today, where they sit | Verdict → where they land |
|---|---|---|
| Contacts | Banner (portal): Search, Import, Add Contact, Manage fields, Save/Cancel when pending edits. Footer: Advanced filters, Sort (dropdown opens upward). In-page: bulk toolbar when rows selected, column-header click-sort. | BUILD: move footer Advanced filters + Sort into the portal (Sort dropdown flipped to open downward). Footer keeps pagination only. Bulk toolbar + column sort stay (selection-context / in-table, not header controls). |
| Companies | Banner (portal): Search, Export, Add Account, Manage fields. Footer: Advanced filters, Sort (opens upward). | BUILD: same as Contacts — footer Advanced filters + Sort into portal, dropdown flipped downward. |
| Opportunities | In-page header row: title + pipeline switcher (left) \| Search, Board/List toggle, Filter (badge), Sort, Import, Export, New Opportunity, overflow menu (Manage Pipelines/Fields/Tags, Saved Views, Customize Cards). | BUILD: move ALL 8 action groups + pipeline switcher is identity → pipeline switcher STAYS in-page with the title (it says which pipeline you're viewing, like a title); the 8 action groups move into `HeaderPortal`. In-page header becomes a slim title + pipeline row. |
| Tasks | Banner (portal): Search, New Task, Manage Columns. In-page tabs row: status tabs (All / Due Today / Upcoming / Completed) + Custom Filter Rule (badge). Footer: Advanced filters, Sort (opens upward). | BUILD: move footer Sort + Custom Filter Rule into portal; DELETE footer Advanced filters — it opens the exact same filter panel as Custom Filter Rule (both `setPanelOpen('filter')`), so keeping both in the banner would be a duplicate. Status tabs STAY in-page (sub-navigation row, like detail-page tabs; moving them would crowd the banner past fit — see Crowding). |
| Documents | Banner (portal): Search, New Document. In-page: sidebar "All Documents" + new-doc icon button. | ALREADY ALIGNED — no change. |
| Smart Lists | Banner (portal): Search, Create Smart List. Filter builder is the create/edit panel, not a toolbar control. | ALREADY ALIGNED — no change. |
| Bulk Actions | Banner (portal): Search (uncontrolled input, decorative — no state, filters nothing). | ALREADY ALIGNED — no change. Search input left as-is (touching it would change behavior; out of scope). |
| CRM Settings | In-page header: title + subtitle only, NO controls. Save Changes lives inside expanded section cards (form button). | NO CHANGE — nothing to move. |
| Pipelines settings | In-page header: Back + title + subtitle \| New Pipeline button. In-page: Add Stage / Add Reason forms. | BUILD: move New Pipeline button into portal. Back + title stay in-page (navigation/identity, not controls). |
| Custom Fields settings | In-page header: Back + title + subtitle \| New Field button. | BUILD: move New Field button into portal. Back + title stay. |
| Tags settings | In-page header: Back + title + subtitle \| Merge Tags button. In-page: Create New Tag card form. | BUILD: move Merge Tags button into portal. Back + title stay. |
| Contact detail | Fixed overlay bar `fixed top-2.5 right-6` (Call / Email / Schedule / Tasks icon buttons) + in-page Back + identity header + tabs + form Save. | PARK — Needs Jack's approval. Record-specific actions intertwined with the record's identity header; moving them into the shared banner couples detail state to the layout. Recommendation: leave as-is. (Note: the overlay already sits ON the banner row — that is why it collided with the tour button before.) |
| Company detail | In-page header: Back + logo + name + industry \| Visit Website, New Opportunity (both record-specific). | PARK — Needs Jack's approval. Same reason as Contact detail. Recommendation: leave as-is. |
| Opportunity detail | In-page header: breadcrumbs + inline-editable title + stage-pill dropdown + (deal actions below). | PARK — Needs Jack's approval. Record-specific (title edit, stage change). Recommendation: leave as-is. |

### Crowding (why Tasks tabs stay, why nothing else is parked for width)

- Banner usable width ≈ viewport − sidebar − left icons (~120px) − padding. At 1440×900 (evidence viewport): Opportunities' 8 action groups ≈ 1060px — fits, verified by screenshot. Contacts/Companies with filter+sort added ≈ 800px — fits. Tasks with filter+sort added (tabs NOT moved) ≈ 750px — fits. Moving Tasks' 4 status tabs (~450px) as well would push Tasks past fit, so tabs stay.
- `CrmLayout` banner z-index: `z-10` → `z-30`. Reason: the moved Sort dropdowns open downward from the banner over the page's scroll area; the tables' sticky `thead` is also `z-10` and later in DOM, so it would paint over the dropdowns. Raising the banner (the top bar) above page content fixes it. ContactDetail's fixed action bar is `z-[60]` and stays above.

## Build steps

### Phase 1
1. In each of the 8 files, delete the `<TourLauncher />` JSX line + its `import { TourLauncher }` line. Nothing else in those files.
2. Grep `TourLauncher` across `src/` — expect only the component definition + the standalone render test to remain.
3. Grep `Product Tour` text — expect only `TourLauncher.tsx` internals + `CommandPalette` entries (both kept: the component stays alive, the palette entry is a command-menu entry, not a banner button).

### Phase 2
4. OpportunitiesPage: wrap the 8 action groups in `<HeaderPortal>` (add import); keep title + pipeline switcher in a slim in-page row; delete the old in-page header wrapper.
5. Contacts / Companies / Tasks: move footer Advanced filters + Sort (Contacts, Companies) / Custom Filter Rule + Sort (Tasks) into the existing `<HeaderPortal>` block; flip each moved Sort dropdown from `bottom-full mb-2` (opens up) to `top-full mt-2` (opens down). Tasks: delete the footer Advanced filters button (duplicate of Custom Filter Rule — same panel).
6. Pipelines / Custom Fields / Tags settings: move the single header action button (New Pipeline / New Field / Merge Tags) into `<HeaderPortal>`; keep Back + title row.
7. CrmLayout: banner `z-10` → `z-30` (dropdown overlay fix above). Also removes TourLauncher (Phase 1) from the same file.
8. No changes to detail pages, Documents, Smart Lists, Bulk Actions, CRM Settings.

## Expected change areas

- 8 layout files (Phase 1, 2 lines each) — incl. `CrmLayout.tsx` (+1 line for the z-index).
- 6 CRM pages (Phase 2): `OpportunitiesPage.tsx`, `Contacts.tsx`, `Companies.tsx`, `CrmTasks.tsx`, `PipelineSettingsPage.tsx`, `CustomFieldsSettingsPage.tsx`, `TagsSettingsPage.tsx`.
- Docs only: this Blueprint + evidence log.
- NOT touched: `TourLauncher.tsx` component, tour store/provider/registry/definitions, `useAutoLaunchTour` calls, `CommandPalette`, detail pages, `data-tour` attributes.

## Build rules

- Branch `agent/remove-all-tour-buttons-banner-controls`, never main. Push as backup as I go. No merge without Jack's approval.
- No behavior change to any moved control: same handlers, same state, same dropdown contents, same modals/panels. Only the JSX location (portal vs in-page/footer) and the Sort dropdown open direction change.
- No tour-system removal. No data/model/API change. No dependency change.
- Evidence screenshots from my own running build, Inbox Dark, 1440×900.

## Acceptance criteria

- Phase 1: grep `TourLauncher` in `src/` shows no render site outside the component + test; every section's top-right shows no Product Tour button in screenshots/DOM checks.
- Phase 2: on Contacts, Companies, Tasks, Opportunities, Pipelines/Fields/Tags settings, the moved controls render inside `#crm-header-actions` (DOM check) on the banner row with the bell + AI agent; the old locations (footer / in-page header) no longer contain them; every moved control still opens its dropdown/panel/modal (spot-checked live); detail pages untouched.
- `npm run build` PASS. `npm test` — all suites pass (tour render test still renders `TourLauncher` standalone).

## Evidence required

- Phase 1 screenshots (Inbox Dark): `/settings` (TopBar), `/conversations`, `/email-marketing`, `/crm/contacts` (CRM banner), plus one of Ads/Automations/Business — top-right clean, DOM 0 "Product Tour" text.
- Phase 2 screenshots (Inbox Dark): Opportunities (full action cluster on banner), Contacts (Filter + Sort on banner), Companies (Filter + Sort on banner), Tasks (Custom Filter Rule + Sort on banner), Pipelines settings (New Pipeline on banner). One screenshot showing a moved Sort dropdown OPEN from the banner (proves the z-index fix).
- Evidence log `docs/crm-screenshots/remove-all-tour-buttons-banner-controls/evidence-2026-10-16.md` + `screenshot-log.json`.
- All screenshots embedded in the row's page body and VERIFIED in the body before the atomic Done update (Text + Status in one call, then re-fetch to verify Status == Done).

## Test script for Jack

1. Open Contacts — banner (top row, same row as bell + AI agent) shows Search / Import / Add Contact / Manage fields / Advanced filters / Sort. Click Sort → dropdown opens downward, pick an option → list re-sorts. Click Advanced filters → filter panel opens.
2. Open Companies — same check: Search / Export / Add Account / Manage fields / Advanced filters / Sort on the banner.
3. Open Opportunities — banner shows Search / Board-List toggle / Filter / Sort / Import / Export / New Opportunity / overflow (…); title + pipeline switcher stay in a slim row below. Toggle Board/List, open Filter, open Sort — all work as before.
4. Open Tasks — banner shows Search / New Task / Manage Columns / Custom Filter Rule / Sort; status tabs still sit in-page above the table.
5. Open Pipeline settings — New Pipeline button is on the banner; Back + title stay in-page. Same for Fields (New Field) and Tags (Merge Tags).
6. Open Settings (non-CRM), Conversations, Email Marketing, Ads, Automations, Business — NO Product Tour button anywhere in the top-right.
7. Open a contact detail page — its Call/Email/Schedule/Tasks icons are unchanged (parked, not moved).

## Out of scope

- Removing the tour system, `useAutoLaunchTour` auto-launch hooks, `CommandPalette` tour entries, or `data-tour` targets. (Jack decides separately whether the first-time-user auto-launch goes too.)
- Moving detail-page record actions (parked for Jack).
- Moving Tasks status tabs (stay in-page — crowding, see above).
- Bulk Actions' decorative search input (no behavior to preserve; left as-is).
- Any merge to main.
