# CRM screenshots — Dark Mode (default) — 2026-10-16

Jack: default screenshots to the dark version (changeable in Settings). The earlier light-mode set looked like a super old version — that was the light theme + dev-account data, not an old code version (repo was up to date at main `374ed22`). This set re-captures all 15 CRM pages in Dark Mode. Dark mode is now the default for screenshots.

## Theme used

- **Dark Mode** (`theme-dark`, global dark theme): navy sidebar `#0F1A2B`, dark canvas `#1B1D22`, light text. Set via `localStorage['stone-aio-theme'] = 'dark'` — the same key the Settings UI writes (`src/context/ThemeContext.tsx`, `src/pages/Settings.tsx`). Verified per route: `document.documentElement.className === 'theme-dark'` and stored value `'dark'`.
- **NOT Inbox Dark** (`theme-inbox-dark`, Chatwoot-style near-black `#1B1D22`/`#16191D`, for the Inbox). If Jack meant Inbox Dark instead, re-capture in that theme on request.

## Captured (15/15, all HTTP 200, theme-dark, expected seed content)

All in this directory (`docs/crm-screenshots/dark/`), viewport 1440x900, from the running dev build (API `:4000` + Vite `:5173`, local Postgres, seeded workspace `ws_default_stone_aio`, dev-bypass user `test_user_new` as admin). Same routes/content as the light set, now in Dark Mode:

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

- Viewed `crm-contacts.png`: dark content area, 12 contacts (Jack OConnor, Irene Chang, Carol Nguyen, Frank Muller, Elena Torres, Grace Kim, David Park, Karen Lee, Liam Patel, Henry Walsh, Bob Smith, Alice Freeman). No white/light canvas.
- All 15 PNGs exist, 47K–191K each, no blanks.

## Notes

- Light-mode set preserved in parent `docs/crm-screenshots/` (original deliverable). Dark set is now the default.
- No app-code changes, no merge. This is a re-capture in a different theme only.
- Notion: dark-mode images prepended to the Screenshots row page as a "CRM screenshots — Dark Mode (default)" section; light-mode images remain below as the earlier set.
