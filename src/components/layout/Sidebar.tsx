import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Bot, Store, CreditCard, Settings, LogOut, Server,
  Users, ChevronLeft, ChevronRight, Sparkles, Mic, GitMerge, Palette,
  MessageSquare, BarChart3, Calendar, FileText, Briefcase, Inbox,
  TrendingUp, Star, Zap, Building2, Cpu
} from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { useMode, type AppMode } from '../../store/modeStore';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ── Creator Studio Navigation ──
  const creatorMainNav = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Assistant', path: '/assistant', icon: MessageSquare },
    { name: 'Projects', path: '/projects', icon: FileText },
    { name: 'Cloud Computer', path: '/computer', icon: Server },
  ];

  const creatorAgentNav = [
    { name: 'All Agents', path: '/agents', icon: Bot },
    { name: 'Voice Agents', path: '/agents?type=voice', icon: Mic },
    { name: 'Workflows', path: '/agents?type=workflow', icon: GitMerge },
    { name: 'Templates', path: '/templates', icon: Briefcase },
  ];

  // ── Business Hub Navigation ──
  const businessMainNav = [
    { name: 'Dashboard', path: '/business', icon: LayoutDashboard },
    { name: 'Inbox', path: '/inbox', icon: Inbox },
    { name: 'CRM', path: '/business/crm', icon: Users },
    { name: 'Campaigns', path: '/business/campaigns', icon: Zap },
    { name: 'Calendar', path: '/business/calendar', icon: Calendar },
    { name: 'Forms', path: '/business/forms', icon: FileText },
    { name: 'Reputation', path: '/business/reputation', icon: Star },
    { name: 'Analytics', path: '/business/analytics', icon: TrendingUp },
  ];

  const businessBottomNav = [
    { name: 'Marketplace', path: '/marketplace', icon: Store },
  ];

  const sharedBottomNav = [
    { name: 'Billing', path: '/billing', icon: CreditCard },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const NavItem = ({ item }: { item: { name: string; path: string; icon: any } }) => {
    const isActive = (() => {
      const [itemPath, itemQuery] = item.path.split('?');
      if (itemQuery) {
        const params = new URLSearchParams(itemQuery);
        const paramKey = Array.from(params.keys())[0];
        const paramValue = params.get(paramKey);
        return location.pathname === itemPath && searchParams.get(paramKey!) === paramValue;
      }
      if (itemPath === '/agents') return location.pathname === '/agents' && !searchParams.get('type');
      if (itemPath === '/dashboard' || itemPath === '/business') return location.pathname === itemPath;
      return location.pathname.startsWith(itemPath);
    })();

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileOpen?.(false)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group relative ${
          isActive ? 'nav-active' : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
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

  const ModeToggle = () => {
    if (collapsed) {
      return (
        <div className="px-3 py-2 flex flex-col gap-1">
          <button
            onClick={() => setMode('creator')}
            title="Creator Studio"
            className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all duration-300 ${
              mode === 'creator'
                ? 'bg-primary/20 text-primary shadow-[0_0_12px_rgba(67,97,238,0.3)] border border-primary/30'
                : 'text-text-muted hover:bg-surface-hover'
            }`}
          >
            <Cpu className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMode('business')}
            title="Business Hub"
            className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all duration-300 ${
              mode === 'business'
                ? 'bg-amber/20 text-amber shadow-[0_0_12px_rgba(251,191,36,0.3)] border border-amber/30'
                : 'text-text-muted hover:bg-surface-hover'
            }`}
          >
            <Building2 className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="px-3 py-2">
        {/* Mode label */}
        <div className="text-[9px] font-bold uppercase tracking-widest text-text-muted/50 mb-2 px-1">Workspace</div>

        {/* Toggle pill */}
        <div className="relative bg-bg border border-border rounded-xl p-1 flex gap-1">
          {/* Animated sliding background */}
          <div
            className={`absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-in-out ${
              mode === 'creator'
                ? 'left-1 right-[calc(50%+2px)] bg-primary/15 border border-primary/25 shadow-[0_0_10px_rgba(67,97,238,0.2)]'
                : 'left-[calc(50%+2px)] right-1 bg-amber/15 border border-amber/25 shadow-[0_0_10px_rgba(251,191,36,0.15)]'
            }`}
          />

          <button
            onClick={() => setMode('creator')}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors duration-200 ${
              mode === 'creator' ? 'text-primary' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Creator</span>
          </button>

          <button
            onClick={() => { setMode('business'); navigate('/business'); }}
            className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors duration-200 ${
              mode === 'business' ? 'text-amber' : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Business</span>
          </button>
        </div>

        {/* Mode subtitle */}
        <div className={`text-[9px] font-medium text-center mt-1.5 transition-colors duration-300 ${
          mode === 'creator' ? 'text-primary/60' : 'text-amber/60'
        }`}>
          {mode === 'creator' ? 'Creator Studio' : 'Business Hub'}
        </div>
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
        <div className={`p-4 pb-2 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
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

        {/* ── MODE TOGGLE ── */}
        <div className="border-b border-border/50 pb-2 mb-1">
          <ModeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {mode === 'creator' ? (
            <>
              {creatorMainNav.map((item) => <NavItem key={item.name} item={item} />)}
              <SectionLabel label="Agents" />
              {creatorAgentNav.map((item) => <NavItem key={item.name} item={item} />)}
              <SectionLabel label="More" />
              <NavItem item={{ name: 'Marketplace', path: '/marketplace', icon: Store }} />
            </>
          ) : (
            <>
              {businessMainNav.map((item) => <NavItem key={item.name} item={item} />)}
              <SectionLabel label="More" />
              {businessBottomNav.map((item) => <NavItem key={item.name} item={item} />)}
            </>
          )}

          {/* Shared bottom nav */}
          <SectionLabel label="Account" />
          {sharedBottomNav.map((item) => <NavItem key={item.name} item={item} />)}
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
