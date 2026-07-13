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
            primary: '#28364D',
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

  it('defines the global class name used by the Inbox Dark theme', () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Use Inbox Dark' }));

    expect(document.documentElement.classList.contains('theme-inbox-dark')).toBe(true);
  });
});
