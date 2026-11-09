/**
 * Overflow menu (round 2 follow-up, 2026-11-08) — the section's "tucked"
 * pattern for secondary actions: one small "⋯" trigger, the actions live
 * in the menu. Follows the CampaignsList Create-menu pattern (open state +
 * fixed overlay closer + absolute item list), styled in the AI assistant's
 * tokens. The "⋯" is a functional affordance, not a decorative icon.
 */

import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export type OverflowMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export default function OverflowMenu({
  items,
  ariaLabel,
  align = 'right',
}: {
  items: OverflowMenuItem[];
  ariaLabel: string;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0" data-testid="overflow-menu">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#343437] bg-[#242426] text-[#8A8A8D] hover:text-[#ECECEC] hover:bg-[#2D2D2E] transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute top-full mt-1 z-50 min-w-[180px] rounded-xl border border-[#343437] bg-[#242426] shadow-luxury overflow-hidden py-1 ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className="w-full px-3 py-2 text-left text-sm text-[#ECECEC] hover:bg-[#2D2D2E] disabled:opacity-50 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
