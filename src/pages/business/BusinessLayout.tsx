import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BarChart3, Calendar, FileText, Users, Star,
  Mail, ChevronRight
} from 'lucide-react';

export default function BusinessLayout() {
  const location = useLocation();
  
  const navItems = [
    { name: 'Overview', path: '/business', icon: LayoutDashboard, end: true },
    { name: 'CRM', path: '/business/crm', icon: Users },
    { name: 'Campaigns', path: '/business/campaigns', icon: Mail },
    { name: 'Calendar', path: '/business/calendar', icon: Calendar },
    { name: 'Forms', path: '/business/forms', icon: FileText },
    { name: 'Analytics', path: '/business/analytics', icon: BarChart3 },
    { name: 'Reputation', path: '/business/reputation', icon: Star },
  ];

  // Build breadcrumb from path
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
    path: '/' + segments.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="flex h-full">
      <aside className="w-56 bg-surface border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Business Hub
          </h2>
          <p className="text-xs text-text-muted mt-1">Manage your operations</p>
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
      <main className="flex-1 overflow-hidden bg-bg flex flex-col">
        {/* Breadcrumb */}
        <div className="px-6 py-3 border-b border-border bg-surface/50 flex items-center gap-1.5 text-xs text-text-muted shrink-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              <span className={i === breadcrumbs.length - 1 ? 'text-text-main font-medium' : ''}>
                {crumb.label}
              </span>
            </span>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
