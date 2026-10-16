# Blueprint — Remove initial-letter icons: CRM Contacts + Companies lists

Board row: "Remove initial-letter icons — Azareth (Coding Agent): CRM Contacts + Companies lists"
Branch: `agent/remove-initial-letter-icons` (from `origin/main` `374ed22`). No merge without Jack's approval.
Authored from the codebase itself + the Software Map, before any code (Agent Rules rule 1).

## 1. Goal

Jack reviewed the CRM screenshots and wants a small UI change, in his words: on the
Contacts page and the Companies page there are icon boxes with a letter in them — the
first letter of whatever name or company was inputted — sitting next to each name.
Remove those, so there's no icon or logo box next to the names; each row should show
just the contact name / company name. Simple removal, those two pages only.

## 2. Where it fits

From the Software Map (§1.2, §2.2):

- Frontend: React 19 + TypeScript + Vite 6 + React Router 7, Tailwind v4.
- Routes: `/crm/contacts` → `src/pages/crm/Contacts.tsx`; `/crm/companies` →
  `src/pages/crm/Companies.tsx` (both inside `<AppShell>`, under `/crm`).
- Entities: `Contact` (`firstName`, `lastName`, `avatarUrl?`, …) and `Company`
  (`name`, `logoUrl?`, …). No data is deleted or changed — this is render-only.
- The list rows today: checkbox + name cell + data columns; row click navigates to the
  detail page (`/crm/contacts/:id`, `/crm/companies/:id`).

## 3. Build steps

1. **Fit-check (done on paper first):** confirm the icons on the two list pages are
   inline JSX in each page file, NOT a shared avatar component. Verified: they are
   inline (see §4). No shared component is touched, so no other page changes.
2. **Contacts (`src/pages/crm/Contacts.tsx`, ~line 531-536):** in the
   `visibleCols.has('Contact name')` cell, delete the icon `<div>` — the
   `w-7 h-7 rounded-full … bg-white text-zinc-950` box rendering
   `(c.name …).substring(0, 2).toUpperCase()` (or 1 char for `(Example)` names).
   Keep the name `<span>` (`{c.name ?? 'Unknown'}`) and the emailed-count badge
   (`Nx`) exactly as they are, and keep the row-click navigation.
3. **Companies (`src/pages/crm/Companies.tsx`, ~line 337-347):** in the
   `visibleCols.has('Account Name')` cell, delete the whole icon `<div>` — the
   `w-8 h-8 rounded-lg …` box. NOTE: this box has two states — a `<img src={company.logoUrl}>`
   when a logo URL exists, else the initial letter `(company.name[0] || 'C')`.
   Jack's wording is "no icon or logo box next to the names", so the whole box goes,
   logo state included. Keep the name `<span>` (`{company.name}`) and row-click
   navigation exactly as they are.
4. **Deliberately NOT touched:** the loading-skeleton circle in Contacts
   (`src/pages/crm/Contacts.tsx` ~line 345, `skeleton w-7 h-7 rounded-full`) — it is a
   loading placeholder shown before any name loads, not a name icon. Removing it
   would change the loading state, which is out of scope.
5. **Verify:** run the dev stack (existing local Postgres 16 + Prisma client +
   seed from the screenshots task), capture fresh screenshots of both list pages from
   the running build, confirm no icon box renders next to any name and that columns,
   order, and click-through are unchanged. Record baseline vs after for
   `npm run build` / `npm test` (both have known pre-existing failures — see §6).

## 4. Expected change areas

| File | Change |
|---|---|
| `src/pages/crm/Contacts.tsx` | Delete one icon `<div>` (~6 lines) in the Contact name cell. Nothing else. |
| `src/pages/crm/Companies.tsx` | Delete one icon `<div>` (~10 lines, incl. logo `<img>` + initial fallback) in the Account Name cell. Nothing else. |

No API, schema, seed, route, or shared-component changes. No new files except this
Blueprint + evidence screenshots/log.

## 5. Build rules

- Match existing patterns; no new vendor/service.
- Nothing outside the two list pages. In particular, do NOT change the same
  initial-letter pattern anywhere else (see §9) — list those places in the
  completion update so Jack can decide.
- No contact/company data deleted; the name still links wherever it links today.
- Branch `agent/remove-initial-letter-icons`, never `main`. Push as backup as you go.
- No merge / push-as-final without Jack's approval of the exact thing.

## 6. Acceptance criteria

- [ ] `/crm/contacts`: every row shows the contact name as plain text; no icon/
      letter box renders next to any name. Other columns, order, badge, and
      row-click → detail navigation unchanged.
- [ ] `/crm/companies`: every row shows the company name as plain text; no icon/
      logo/initial box renders next to any name — including rows whose company has
      a `logoUrl`. Other columns, order, and row-click → detail navigation unchanged.
- [ ] Fresh screenshots of both pages from the builder's own running build (Inbox
      Dark, the default) show the above.
- [ ] `npm run build` result is no worse than baseline (known pre-existing failure:
      `src/shims/react-shim.ts` default-export error — NOT silently fixed, NOT
      claimed fixed). `npm test` result is no worse than baseline (63/64 pass;
      failures on missing generated Prisma client / ClerkProvider — pre-existing).
- [ ] Completion update (What Changed rundown + evidence) on the board row BEFORE
      Status Done. No merge.

## 7. Evidence required

- Fresh screenshots from the builder's own running build, Inbox Dark
  (`theme-inbox-dark`): `/crm/contacts` after the change,
  `/crm/companies` after the change. Before-shots already exist in
  `docs/crm-screenshots/` (screenshots task) for comparison.
- What Changed rundown on the board row (summary, changes by area, how it works,
  verification, deviations, known limitations, rollback).
- Software Map update if the change warrants it (this change is render-only on two
  pages; if the Map's CRM section already describes these pages accurately, note
  "no Map edit warranted" explicitly rather than silently skipping).

## 8. Test script for Jack

1. Open the Contacts page (`/crm/contacts`). You should see a list of contact names
   with NO little letter box next to any name — just the name (plus the small `Nx`
   badge where a contact has been emailed). Click a name: it still opens that
   contact's detail page.
2. Open the Companies page (`/crm/companies`). You should see company names with NO
   icon, logo, or letter box next to any name — just the name. Click a name: it
   still opens that company's detail page.
3. Everything else on both pages — columns, order, search, filters — looks and
   behaves exactly as before.

## 9. Out of scope

- Detail pages: `ContactDetail.tsx` (~line 242, initial-letter avatar) and
  `CompanyDetail.tsx` (~line 222, initial-letter avatar) — UNCHANGED.
- Opportunities kanban + pickers (`Opportunities.tsx`, `KanbanBoard.tsx`,
  `DealCard.tsx`, `OpportunityFormModal.tsx`, `DealDetailDrawer.tsx`) — UNCHANGED.
- Other initial-letter avatars: `ContactCard.tsx`, `CrmSetup.tsx`, Inbox
  (`InboxContacts.tsx`, `ConversationList.tsx`, `ConversationDetail.tsx`),
  Dashboard (`Dashboard.tsx`, `dashboard/v2/DataTable.tsx`,
  `OverviewPanel.tsx`), Settings (`Settings.tsx` workspace letter),
  `NativeConfigPanel.tsx`, `VoicePickerModal.tsx` — all UNCHANGED. These are
  listed so Jack can decide whether he wants any of them removed in a follow-up.
- No data deletion, no API/schema/seed changes, no theme or layout redesign, no
  loading-state change.
