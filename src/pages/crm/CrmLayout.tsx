import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, CircleDollarSign, CalendarDays, GitMerge, Settings } from 'lucide-react';

export default function CrmLayout() {
  const navItems = [
    { name: 'Dashboard', path: '/crm', icon: LayoutDashboard, end: true },
    { name: 'Contacts', path: '/crm/contacts', icon: Users },
    { name: 'Companies', path: '/crm/companies', icon: Building2 },
    { name: 'Deals', path: '/crm/deals', icon: CircleDollarSign },
    { name: 'Activities', path: '/crm/activities', icon: CalendarDays },
    { name: 'Pipelines', path: '/crm/pipelines', icon: GitMerge },
    { name: 'Settings', path: '/crm/settings', icon: Settings },
  ];

  return (
    <div className="flex h-full">
      <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-pink-500" />
            CRM
          </h2>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-bg text-text-main shadow-sm border border-border' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-hidden bg-bg">
        <Outlet />
      </main>
    </div>
  );
}
