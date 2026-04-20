import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Settings, GitBranch } from 'lucide-react';

const workspaceNav = [
  { to: 'contacts',    label: 'Contacts' },
  { to: 'companies',   label: 'Companies' },
  { to: 'tasks',       label: 'Tasks' },
  { to: 'smart-lists', label: 'Smart Lists' },
  { to: 'bulk-actions',label: 'Bulk Actions' },
];

export default function CrmLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full w-full text-sm font-sans relative z-0 bg-bg">
      {/* Top Navigation Bar */}
      <div className="w-full flex items-center justify-between px-8 pt-6 pb-0 shrink-0 bg-surface border-b border-border z-10 sticky top-0 relative shadow-sm">
        <div className="flex items-center">
          <nav className="flex items-center gap-6">
            {workspaceNav.map((link) => {
              const isActive =
                location.pathname.endsWith(`/crm/${link.to}`) ||
                location.pathname.includes(`/crm/${link.to}/`);
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`pb-3 text-[14px] font-medium transition-all duration-150 relative whitespace-nowrap ${
                    isActive ? 'text-text-main' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="h-5 w-[1px] bg-border mx-6 relative bottom-1.5" />

          <NavLink
            to="settings"
            className="pb-3 text-text-muted hover:text-text-main transition-colors relative"
          >
            <Settings className="w-[18px] h-[18px]" strokeWidth={2} />
            {location.pathname.includes('/crm/settings') && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
            )}
          </NavLink>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 overflow-auto flex flex-col relative w-full bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
