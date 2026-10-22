# CRM screenshots — Inbox Dark (correct dark mode) — 2026-10-16

Jack: the Dark Mode set was the wrong dark mode. The correct one is **Inbox Dark** (`theme-inbox-dark`) — the other dark mode in Settings → Appearance → Theme. This set re-captures all 15 CRM pages in Inbox Dark. Inbox Dark is now the default for screenshots.

## How the dark modes were located

Settings → Appearance → Theme (`src/pages/Settings.tsx`) offers exactly 4 themes (`src/context/ThemeContext.tsx`): Default, Light Mode, **Dark Mode** (`dark`, navy `#0F1A2B` / `#1C2E4A`), **Inbox Dark** (`inbox-dark`, near-black `#1B1D22` / `#16191D`, Chatwoot-style). No other dark theme exists in the codebase (no midnight/obsidian/amoled/system/auto). Dark Mode (navy) was wrong; Inbox Dark (neutral near-black) is the correct one.

## Theme used

- **Inbox Dark** (`theme-inbox-dark`): near-black canvas `#1B1D22`, surface `#16191D`, neutral gray buttons (not navy/blue). Set via `localStorage['stone-aio-theme'] = 'inbox-dark'` — the same key the Settings UI writes. Verified per route: `document.documentElement.className === 'theme-inbox-dark'` and stored value `'inbox-dark'`.

## Captured (15/15, all HTTP 200, theme-inbox-dark, expected seed content)

All in this directory (`docs/crm-screenshots/inbox-dark/`), viewport 1440x900, from the running dev build (API `:4000` + Vite `:5173`, local Postgres, seeded workspace `ws_default_stone_aio`, dev-bypass user `test_user_new` as admin). Same routes/content as the Dark Mode and light sets, now in Inbox Dark:

| Route | File |
|---|---|
| /crm (redirects to /crm/contacts) | crm-landing.png |
| /crm/contacts (12 contacts) | crm-contacts.png |
| /crm/companies | crm-companies.png |
| /crm/opportunities (Standard Sales, 8 deals) | crm-opportunities.png |
| /crm/tasks | crm-tasks.png |
| /crm/documents (genuine empty) | crm-documents.png |
| /crm/smart-lists | crm-smart-lists.png |
| /crm/bulk-actions | crm-bulk-actions.png |
| /crm/settings | crm-settings.png |
| /crm/opportunities/settings/pipelines | crm-opportunities-settings-pipelines.png |
| /crm/opportunities/settings/fields | crm-opportunities-settings-fields.png |
| /crm/opportunities/settings/tags | crm-opportunities-settings-tags.png |
| /crm/contacts/ct_alice (Alice Freeman) | crm-contact-detail.png |
| /crm/companies/co_global (Global Solutions) | crm-company-detail.png |
| /crm/opportunities/dl_1 (Q3 Enterprise License) | crm-opportunity-detail.png |

Per-route log: `screenshot-log.json` (http, theme class, stored theme, expected-text match, size, body chars).

## Verification

- Viewed `crm-contacts.png`: near-black content area (not navy), neutral gray buttons, 12 contacts (Jack OConnor, Irene Chang, Carol Nguyen, Frank Muller, Elena Torres, Grace Kim, David Park, Karen Lee, Liam Patel, Henry Walsh, Bob Smith, Alice Freeman). Visibly distinct from Dark Mode (navy) — no blue tint.
- All 15 PNGs exist, 47K–194K each, no blanks.

## Notes

- Dark Mode set (`docs/crm-screenshots/dark/`) was the wrong dark mode — superseded by this Inbox Dark set, kept for history. Light-mode set (`docs/crm-screenshots/`) also kept.
- No app-code changes, no merge. Re-capture in a different theme only.
- Notion: Inbox Dark images prepended to the Screenshots row page as the top "CRM screenshots — Inbox Dark (correct dark mode)" section; Dark Mode and light-mode images remain below.
