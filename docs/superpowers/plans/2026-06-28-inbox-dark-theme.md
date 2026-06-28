# Inbox Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new selectable `Inbox Dark` theme option that applies the inbox/Chatwoot-style dark palette across the platform.

**Architecture:** Extend the existing client-only theme system. The theme ID is added to `ThemeContext.tsx`, the global token values are defined in `index.css`, and the existing Settings/Onboarding theme pickers consume the new option from the shared `THEMES` array.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4 CSS variables, Vitest, Testing Library.

---

## File Structure

- Create `src/context/__tests__/ThemeContext.test.tsx`
  - Verifies the new theme option, initialization from localStorage, class application, and persistence.
- Modify `src/context/ThemeContext.tsx`
  - Adds `inbox-dark` to the `ThemeName` union, theme metadata, preview colors, and saved-theme allowlist.
- Modify `src/index.css`
  - Adds a `.theme-inbox-dark` variable block matching the inbox palette.

## Task 1: Theme Context Test

**Files:**
- Create: `src/context/__tests__/ThemeContext.test.tsx`
- Modify: `src/context/ThemeContext.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, THEMES, useTheme } from '../ThemeContext';

function ThemeHarness() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div data-testid="current-theme">{theme}</div>
      <button type="button" onClick={() => setTheme('inbox-dark')}>
        Use Inbox Dark
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('includes Inbox Dark as a selectable theme', () => {
    expect(THEMES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'inbox-dark',
          name: 'Inbox Dark',
          preview: expect.objectContaining({
            bg: '#1B1D22',
            surface: '#16191D',
            primary: '#3B82F6',
            accent: '#2C3036',
          }),
        }),
      ]),
    );
  });

  it('initializes from a saved Inbox Dark theme', () => {
    localStorage.setItem('stone-aio-theme', 'inbox-dark');

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('current-theme')).toHaveTextContent('inbox-dark');
    expect(document.documentElement).toHaveClass('theme-inbox-dark');
  });

  it('applies and persists Inbox Dark when selected', () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Inbox Dark' }));

    expect(screen.getByTestId('current-theme')).toHaveTextContent('inbox-dark');
    expect(document.documentElement).toHaveClass('theme-inbox-dark');
    expect(localStorage.getItem('stone-aio-theme')).toBe('inbox-dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/context/__tests__/ThemeContext.test.tsx`

Expected: FAIL because `inbox-dark` is not assignable to `ThemeName` and/or not present in `THEMES`.

- [ ] **Step 3: Write minimal theme context implementation**

Update `src/context/ThemeContext.tsx` so these exact pieces exist:

```tsx
export type ThemeName = 'dark' | 'light' | 'default' | 'inbox-dark';
```

```tsx
const isThemeName = (value: string | null): value is ThemeName =>
  value === 'light' || value === 'dark' || value === 'default' || value === 'inbox-dark';
```

```tsx
{ id: 'inbox-dark',      name: 'Inbox Dark',       preview: { bg: '#1B1D22', surface: '#16191D', primary: '#3B82F6',  accent: '#2C3036' } },
```

Use `isThemeName(saved)` in the localStorage initializer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/context/__tests__/ThemeContext.test.tsx`

Expected: PASS.

## Task 2: Global Theme Tokens

**Files:**
- Modify: `src/index.css`
- Test: `src/context/__tests__/ThemeContext.test.tsx`

- [ ] **Step 1: Write the failing CSS token assertion**

Append this test to `src/context/__tests__/ThemeContext.test.tsx`:

```tsx
  it('defines the global class name used by the Inbox Dark theme', () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Inbox Dark' }));

    expect(document.documentElement.classList.contains('theme-inbox-dark')).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it passes at context level**

Run: `npm test -- src/context/__tests__/ThemeContext.test.tsx`

Expected: PASS. This confirms the class contract before adding CSS variables.

- [ ] **Step 3: Add the CSS variable block**

Add this block to `src/index.css` after `.theme-dark` and before `.theme-light`:

```css
  /* Chatwoot-style Inbox Dark theme */
  .theme-inbox-dark {
    --bg:               #1B1D22;
    --surface:          #16191D;
    --surface-hover:    #2C3036;
    --border:           #2C3036;
    --border-subtle:    rgba(166, 173, 180, 0.16);

    --text-main:        #FFFFFF;
    --text-muted:       #A6ADB4;
    --primary:          #3B82F6;
    --primary-hover:    #60A5FA;
    --primary-light:    #28364D;

    --accent-green:       #22C55E;
    --accent-amber:       #F59E0B;
    --accent-purple:      #8B5CF6;
    --accent-light-purple:#A78BFA;
    --accent-teal:        #14B8A6;
    --accent-red:         #EF4444;
    --accent-blue:        #3B82F6;
    --accent-orange:      #F97316;

    --glow-color:           rgba(59, 130, 246, 0.18);
    --glow-color-strong:    rgba(59, 130, 246, 0.34);

    --sidebar-bg:           #16191D;
    --sidebar-border:       #2C3036;
    --sidebar-active:       #28364D;
    --sidebar-active-text:  #3B82F6;
    --sidebar-text-main:    #FFFFFF;
    --sidebar-text-muted:   #A6ADB4;

    --shadow-luxury:      0 1px 3px rgba(0,0,0,0.45), 0 4px 12px rgba(0,0,0,0.35), 0 16px 40px rgba(0,0,0,0.28);
    --shadow-interactive: 0 4px 16px rgba(59,130,246,0.24), 0 2px 6px rgba(0,0,0,0.32);
    --shadow-card:        0 1px 2px rgba(0,0,0,0.42), 0 4px 16px rgba(0,0,0,0.28);
    --card-gradient:      linear-gradient(145deg, rgba(27,29,34,0.98) 0%, rgba(22,25,29,0.96) 100%);

    --glass-bg:           rgba(22, 25, 29, 0.72);
    --glass-border:       rgba(44, 48, 54, 0.90);
  }
```

- [ ] **Step 4: Run targeted test again**

Run: `npm test -- src/context/__tests__/ThemeContext.test.tsx`

Expected: PASS.

## Task 3: Verification

**Files:**
- No additional code files.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Run targeted test**

Run: `npm test -- src/context/__tests__/ThemeContext.test.tsx`

Expected: all tests in the file pass.
