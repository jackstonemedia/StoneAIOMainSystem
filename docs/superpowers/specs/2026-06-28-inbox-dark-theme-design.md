# Inbox Dark Platform Theme Design

## Goal

Add a new selectable theme option that applies the Chatwoot-style inbox dark palette to the entire Stone AIO platform.

## Assumptions

- "Chatwoot section" refers to the current `/inbox` UI palette: near-black panels, slate borders, muted slate text, and blue active accents.
- The new theme should be an additional option, not a replacement for Default, Light Mode, or Dark Mode.
- The existing theme persistence model should remain unchanged: theme choice is stored in `localStorage` under `stone-aio-theme`.
- This task is about the platform theme template. It should not rewrite the inbox components or refactor unrelated UI.

## Success Criteria

- Settings > Appearance shows a new theme card for the Chatwoot-style dark template.
- Selecting the new theme applies it globally through the existing `ThemeProvider`.
- The selected theme persists across reloads using the existing localStorage key.
- Existing themes continue to work.
- Onboarding picks up the new theme automatically if it renders from the shared `THEMES` list.

## Design

Add a new theme ID, `inbox-dark`, to `ThemeName` and `THEMES` in `src/context/ThemeContext.tsx`.

Add a `.theme-inbox-dark` CSS variable block in `src/index.css`. The variables should map the inbox palette to the platform tokens:

- `--bg`: app canvas, based on `#1B1D22`
- `--surface`: primary panels/sidebar, based on `#16191D`
- `--surface-hover`: hover/selected surfaces, based on `#2C3036`
- `--border`: divider and card borders, based on `#2C3036`
- `--text-main`: white
- `--text-muted`: muted slate, based on `#A6ADB4`
- `--primary`: active/action blue, based on `#3B82F6`
- `--primary-hover`: brighter blue
- `--primary-light`: selected background blue, based on `#28364D`
- sidebar variables aligned with the same palette

No route, API, database, authorization, or backend behavior changes are needed.

## Components And Data Flow

The existing data flow remains:

1. Settings calls `setTheme(t.id)`.
2. `ThemeProvider` stores the theme ID in localStorage.
3. `ThemeProvider` applies `theme-${theme}` to `document.documentElement`.
4. Tailwind theme tokens and CSS variables update platform UI colors.

## Error Handling

The only new invalid state is an old or unknown saved localStorage value. Update the saved-theme allowlist so `inbox-dark` is accepted; unknown values should continue to fall back to `default`.

## Testing

Add or update tests around the theme context so they verify:

- `inbox-dark` exists in `THEMES`.
- a saved `inbox-dark` value is accepted on initialization.
- calling `setTheme('inbox-dark')` applies `theme-inbox-dark` to the root element and persists the value.

Also run the normal project verification commands available in the repo, at minimum targeted tests plus typecheck/build if feasible.

## Out Of Scope

- Rewriting inbox components to consume global theme variables.
- Changing the default platform theme.
- Adding server-side theme persistence.
- Adding custom user theme editing.
