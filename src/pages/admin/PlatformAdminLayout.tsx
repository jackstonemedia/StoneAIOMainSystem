import { NavLink, Outlet } from 'react-router-dom';
import { 
  Building2, Users, Shield, History, Package, Bot, 
  Network, Lock, PaintBucket, Key, ArrowLeft
} from 'lucide-react';

const ADMIN_NAV = [
  { to: '/admin/projects',       label: 'Projects',       icon: Building2 },
  { to: '/admin/users',          label: 'Users',          icon: Users },
  { to: '/admin/roles',          label: 'Project Roles',  icon: Shield },
  { to: '/admin/audit',          label: 'Audit Logs',     icon: History },
  { to: '/admin/pieces',         label: 'Pieces',         icon: Package },
  { to: '/admin/ai',             label: 'AI',             icon: Bot },
  { to: '/admin/infrastructure', label: 'Infrastructure', icon: Network },
  { to: '/admin/security',       label: 'Security',       icon: Lock },
  { to: '/admin/branding',       label: 'Branding',       icon: PaintBucket },
  { to: '/admin/sso',            label: 'SSO / SCIM',     icon: Key },
];

export default function PlatformAdminLayout() {
  return (
    <div className="flex h-full bg-bg font-sans text-text-main">
      {/* Left Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="px-4 py-4 border-b border-border flex flex-col gap-3">
          <NavLink to="/automations" className="text-xs font-medium text-text-muted hover:text-text-main flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to App
          </NavLink>
          <h1 className="text-sm font-bold tracking-wide uppercase text-text-main flex items-center gap-2">
            <Shield className="w-4 h-4 text-red-500" />
            Platform Admin
          </h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {ADMIN_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-red-500/10 text-red-400 font-medium'
                    : 'text-text-muted hover:text-text-main hover:bg-bg'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-bg">
        <Outlet />
      </main>
    </div>
  );
}
