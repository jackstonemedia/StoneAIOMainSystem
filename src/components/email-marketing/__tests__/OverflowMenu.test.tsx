/**
 * Overflow menu test (round 2 follow-up, 2026-11-08) — the section's
 * "tucked" pattern: secondary actions live in the menu, not as buttons
 * scattered over the page. Renders from props only — no network.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OverflowMenu from '../OverflowMenu';

function renderMenu() {
  const onFirst = vi.fn();
  const onSecond = vi.fn();
  const utils = render(
    <OverflowMenu
      ariaLabel="Wait options"
      items={[
        { label: 'Change wait', onClick: onFirst },
        { label: 'Add a branch', onClick: onSecond },
      ]}
    />,
  );
  return { ...utils, onFirst, onSecond };
}

describe('OverflowMenu', () => {
  it('starts closed — only the trigger is visible', () => {
    renderMenu();
    expect(screen.getByRole('button', { name: 'Wait options' })).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('opens on trigger click and fires the chosen item, then closes', () => {
    const { onFirst, onSecond } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Wait options' }));
    const item = screen.getByRole('menuitem', { name: 'Add a branch' });
    expect(item).toBeTruthy();
    fireEvent.click(item);
    expect(onSecond).toHaveBeenCalledTimes(1);
    expect(onFirst).not.toHaveBeenCalled();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('closes when the overlay is clicked without firing anything', () => {
    const { onFirst, onSecond, container } = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Wait options' }));
    expect(screen.getByRole('menuitem', { name: 'Change wait' })).toBeTruthy();
    const overlay = container.querySelector('.fixed.inset-0');
    expect(overlay).toBeTruthy();
    fireEvent.click(overlay as Element);
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(onFirst).not.toHaveBeenCalled();
    expect(onSecond).not.toHaveBeenCalled();
  });

  it('a disabled item does not fire', () => {
    const onRemove = vi.fn();
    render(
      <OverflowMenu
        ariaLabel="Branch options"
        items={[{ label: 'Remove branch', disabled: true, onClick: onRemove }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Branch options' }));
    const item = screen.getByRole('menuitem', { name: 'Remove branch' });
    expect((item as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(item);
    expect(onRemove).not.toHaveBeenCalled();
  });
});
