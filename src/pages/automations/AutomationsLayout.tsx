import { NavLink, Outlet } from 'react-router-dom';
import { Zap, Play, Link2, Table2, GitMerge, Settings, ShieldAlert } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/automations',              label: 'Workflows',   icon: Zap,      end: true },
  { to: '/automations/runs',         label: 'Runs',        icon: Play,     end: false },
  { to: '/automations/connections',  label: 'Connections', icon: Link2,    end: false },
  { to: '/automations/tables',       label: 'Tables',      icon: Table2,   end: false },
  { to: '/automations/releases',     label: 'Releases',    icon: GitMerge, end: false },
  { to: '/automations/settings',     label: 'Settings',    icon: Settings, end: false },
];

export default function AutomationsLayout() {
  return (
    <div className="flex h-full bg-bg">
      {/* Left sidebar — sub-navigation */}
      <aside className="w-48 shrink-0 border-r border-border bg-surface flex flex-col py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          Automations
        </p>
        <nav className="flex-1 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text-main hover:bg-bg'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
        
        {/* Platform Admin link at bottom */}
        <div className="mt-auto pt-4 px-2 border-t border-border">
          <NavLink
            to="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Platform Admin
          </NavLink>
        </div>
      </aside>

      {/* Page content */}
      <div className="flex-1 min-w-0 overflow-auto flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}
