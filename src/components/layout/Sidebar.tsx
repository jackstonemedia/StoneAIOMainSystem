import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  LayoutDashboard, Bot, Store, CreditCard, Settings, LogOut, Server, Users,
  ChevronLeft, ChevronRight, Sparkles, Mic, GitMerge, Palette,
  MessageSquare, BarChart3, Calendar, FileText, Briefcase
} from 'lucide-react';
import { useTheme, type ThemeName } from '../../lib/ThemeContext';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const mainNav = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    { name: 'Projects', path: '/projects', icon: FileText },
    { name: 'Cloud Computer', path: '/computer', icon: Server },
  ];

  const agentNav = [
    { name: 'All Agents', path: '/agents', icon: Bot },
    { name: 'Templates', path: '/templates', icon: Briefcase },
    { name: 'Workflows', path: '/agents?type=workflow', icon: GitMerge },
    { name: 'Voice Agents', path: '/agents?type=voice', icon: Mic },
    { name: 'Autonomous', path: '/agents?type=autonomous', icon: Sparkles },
  ];

  const businessNav = [
    { name: 'CRM', path: '/business/crm', icon: Users },
    { name: 'Campaigns', path: '/business/campaigns', icon: BarChart3 },
    { name: 'Calendar', path: '/business/calendar', icon: Calendar },
    { name: 'Forms', path: '/business/forms', icon: FileText },
  ];

  const bottomNav = [
    { name: 'Marketplace', path: '/marketplace', icon: Store },
    { name: 'Billing', path: '/billing', icon: CreditCard },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const NavItem = ({ item }: { key?: string | number; item: { name: string; path: string; icon: any } }) => {
    // Custom active logic: for paths with query params, match both pathname and params
    const isActive = (() => {
      const [itemPath, itemQuery] = item.path.split('?');
      if (itemQuery) {
        // Has query params — match pathname AND the query param
        const params = new URLSearchParams(itemQuery);
        const paramKey = Array.from(params.keys())[0];
        const paramValue = params.get(paramKey);
        return location.pathname === itemPath && searchParams.get(paramKey!) === paramValue;
      }
      // No query params — use exact match for /agents, startsWith for others
      if (itemPath === '/agents') {
        return location.pathname === '/agents' && !searchParams.get('type');
      }
      if (itemPath === '/dashboard') {
        return location.pathname === '/dashboard';
      }
      return location.pathname.startsWith(itemPath);
    })();

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileOpen?.(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative ${
          isActive
            ? 'nav-active'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
        } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? item.name : undefined}
      >
        <item.icon className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span className="truncate">{item.name}</span>}
      </NavLink>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => {
    if (collapsed) return <div className="my-2 border-t border-border/50" />;
    return (
      <div className="px-3 pt-4 pb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">{label}</span>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen?.(false)}
        />
      )}
      
      <aside 
        className={`bg-[var(--sidebar-bg)] border-r border-border flex flex-col h-full shrink-0 transition-all duration-300 z-50
          fixed md:relative top-0 bottom-0 left-0
          ${collapsed ? 'w-[68px]' : 'w-60'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
      {/* Logo */}
      <div className={`p-4 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="stone-logo w-9 h-9 text-sm shrink-0">S</div>
        {!collapsed && (
          <div className="animate-fade-up">
            <span className="font-semibold text-sm tracking-tight text-text-main">Stone AIO</span>
            <span className="block text-[10px] text-text-muted -mt-0.5">AI Platform</span>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors z-20 shadow-sm"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {/* Main */}
        {mainNav.map((item) => <NavItem key={item.name} item={item} />)}

        {/* Agents */}
        <SectionLabel label="Agents" />
        {agentNav.map((item) => <NavItem key={item.name} item={item} />)}

        {/* Business */}
        <SectionLabel label="Business" />
        {businessNav.map((item) => <NavItem key={item.name} item={item} />)}

        {/* More */}
        <SectionLabel label="More" />
        {bottomNav.map((item) => <NavItem key={item.name} item={item} />)}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-border/50 space-y-1">
        {/* Theme Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors ${collapsed ? 'justify-center' : ''}`}
            title={collapsed ? 'Theme' : undefined}
          >
            <Palette className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="truncate">Theme</span>}
            {!collapsed && (
              <span className="ml-auto text-[10px] uppercase tracking-wider font-medium text-text-muted/70">{theme}</span>
            )}
          </button>

          {/* Theme Popup */}
          {showThemeMenu && (
            <div className={`absolute bottom-full mb-2 ${collapsed ? 'left-full ml-2' : 'left-0 right-0'} bg-surface border border-border rounded-xl shadow-xl p-2 z-50 animate-scale-in min-w-[180px]`}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 px-2 py-1 mb-1">Theme</div>
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setShowThemeMenu(false); }}
                  className={`flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm transition-colors ${
                    theme === t.id ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full border border-border" style={{ background: t.preview.bg }} />
                    <div className="w-3 h-3 rounded-full border border-border" style={{ background: t.preview.primary }} />
                    <div className="w-3 h-3 rounded-full border border-border" style={{ background: t.preview.accent }} />
                  </div>
                  <span className="font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User / Sign Out */}
        <button
          onClick={() => navigate('/login')}
          className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          <div className="w-[18px] h-[18px] rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">J</div>
          {!collapsed && (
            <>
              <span className="truncate">Jack Stone</span>
              <LogOut className="w-4 h-4 ml-auto opacity-50" />
            </>
          )}
        </button>
      </div>
    </aside>
    </>
  );
}
