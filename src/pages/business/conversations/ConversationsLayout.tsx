import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: 'chat',           label: 'Conversations' },
  { to: 'manual-actions', label: 'Manual Actions' },
  { to: 'snippets',       label: 'Snippets' },
  { to: 'trigger-links',  label: 'Trigger Links' },
];

export default function ConversationsLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg">
      {/* ── Top Navigation Bar ── */}
      <div className="w-full flex items-center px-8 pt-6 pb-0 shrink-0 bg-surface border-b border-border z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-1">
          <h1 className="text-[20px] font-bold text-text-main mr-6 mb-2">Conversations</h1>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isActive =
                location.pathname.endsWith(`/conversations/${tab.to}`) ||
                location.pathname.includes(`/conversations/${tab.to}/`);
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={`pb-3 px-4 text-[13px] font-bold transition-all duration-150 relative whitespace-nowrap ${
                    isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-full shadow-[0_0_8px_var(--primary)]" />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
