import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Server, Search, Bell,
  BarChart3, Reply, FileText, FileSpreadsheet, Building2,
  Settings, HelpCircle, PanelLeftClose, ChevronDown, Zap,
  Users, Calendar, Star, GitBranch, MessageSquare,
  Mic, Sparkles, LogOut, ChevronsUpDown, List, Target
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { IS_DEV_AUTH_BYPASS } from '../../lib/clerkConfig';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [upgradeExpanded, setUpgradeExpanded] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const queryClient = useQueryClient();

  // Access Clerk without hooks so this works both inside and outside ClerkProvider
  const clerkInstance = (window as any).Clerk;
  const user = IS_DEV_AUTH_BYPASS
    ? { firstName: 'Dev', fullName: 'Dev User', emailAddresses: [{ emailAddress: 'dev@stoneaio.com' }], imageUrl: null as string | null }
    : clerkInstance?.user ?? null;

  const signOut = async (opts?: any) => {
    if (IS_DEV_AUTH_BYPASS) { window.location.href = '/login'; return; }
    await clerkInstance?.signOut(opts);
  };

  const initial = user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() || 'U';
  const fullName = user?.fullName || user?.emailAddresses?.[0]?.emailAddress || 'User';

  const crmMenu = [
    { name: 'Dashboard',      path: '/business',                   icon: LayoutDashboard },
    { name: 'CRM',            path: '/crm/contacts',               icon: Users },
    { name: 'Conversations',  path: '/conversations',              icon: MessageSquare },
    { name: 'Campaigns',      path: '/business/campaigns',         icon: Reply },
    { name: 'Calendar',       path: '/business/calendar',          icon: Calendar },
    { name: 'Analytics',      path: '/business/analytics',         icon: BarChart3 },
    { name: 'Forms',          path: '/business/forms',             icon: FileText },
    { name: 'Reputation',     path: '/business/reputation',        icon: Star },
  ];

  const automationMenu = [
    { name: 'Workflows',      path: '/workflows',                  icon: Zap },
    { name: 'Voice Agents',   path: '/agents/voice/new',           icon: Mic },
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
      if (itemPath === '/business') return location.pathname === itemPath;
      if (itemPath === '#') return false;
      return location.pathname.startsWith(itemPath);
    })();

    if (collapsed) {
      return (
        <NavLink
          to={item.path}
          onClick={() => setMobileOpen?.(false)}
          title={item.name}
          className={`flex items-center justify-center w-9 h-9 mx-auto my-1 rounded-lg transition-all duration-150 ${
            isActive
              ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <item.icon className="w-[17px] h-[17px]" strokeWidth={isActive ? 2 : 1.75} />
        </NavLink>
      );
    }

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileOpen?.(false)}
        className={`flex items-center gap-3 px-3 py-2 mx-3 my-0.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-[var(--sidebar-active)] text-[var(--text-main)] font-medium'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <item.icon className="w-[17px] h-[17px] shrink-0" strokeWidth={1.75} />
        <span className="truncate">{item.name}</span>
      </NavLink>
    );
  };



  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={`flex flex-col h-full shrink-0 transition-all duration-300 z-50
          fixed md:relative top-0 bottom-0 left-0
          border-r
          ${collapsed ? 'w-[60px]' : 'w-[240px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* ── Quick Search ── */}
        <div
          className={`h-[40px] border-b flex items-center cursor-text shrink-0 transition-colors ${
            collapsed ? 'justify-center' : 'px-4 gap-2.5'
          }`}
          style={{ borderColor: 'var(--sidebar-border)', color: 'var(--text-muted)' }}
        >
          <Search className="w-[15px] h-[15px] shrink-0" strokeWidth={1.8} />
          {!collapsed && (
            <span className="text-[12.5px] font-medium opacity-75">Quick search…</span>
          )}
        </div>

        {/* ── Scrollable Nav Body ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-2">

          {/* Notifications strip */}
          <div
            className="border-b py-1 shrink-0"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            {[
              { label: 'Notifications', icon: Bell, count: '5', path: '#' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => item.path !== '#' && navigate(item.path)}
                className={`w-full flex items-center transition-colors ${
                  collapsed
                    ? 'justify-center mx-auto w-9 h-9 rounded-lg my-0.5'
                    : 'px-4 py-2 gap-3'
                }`}
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-main)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-[17px] h-[17px] shrink-0" strokeWidth={1.75} />
                {!collapsed && (
                  <>
                    <span className="text-[13px] font-medium flex-1 text-left">{item.label}</span>
                    <span
                      className="text-[10.5px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}
                    >
                      {item.count}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>

          {/* ── Section label ── */}
          {!collapsed && (
            <div className="px-4 pt-3 pb-1.5 shrink-0">
              <span
                className="text-[10px] font-bold tracking-[0.08em] uppercase"
                style={{ color: 'var(--text-muted)', opacity: 0.6 }}
              >
                Workspace
              </span>
            </div>
          )}

          {/* ── Navigation items ── */}
          <div className="flex-1 pb-4">
            {crmMenu.map((item) => <NavItem key={item.name} item={item} />)}
            
            <div className="my-3 mx-4 border-t border-border/50" />
            
            {!collapsed && (
              <div className="px-4 pb-1.5 shrink-0 mt-1">
                <span
                  className="text-[10px] font-bold tracking-[0.08em] uppercase"
                  style={{ color: 'var(--text-muted)', opacity: 0.6 }}
                >
                  Automation Engine
                </span>
              </div>
            )}
            {automationMenu.map((item) => <NavItem key={item.name} item={item} />)}
          </div>
        </nav>

        {/* ── Bottom Anchored Footer ── */}
        <div className="shrink-0 flex flex-col pb-3 pt-2">
          {/* ── Upgrade card ── */}
          {!collapsed ? (
            <div className="mx-3 mb-4 rounded-lg shrink-0 transition-all overflow-hidden bg-surface border border-border shadow-sm">
              {/* Header row — always visible */}
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-surface-hover transition-colors"
                onClick={() => setUpgradeExpanded(!upgradeExpanded)}
              >
                <div className="w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 bg-surface-hover border border-border">
                  <Zap className="w-3 h-3" style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
                </div>
                <div className="leading-tight flex-1 min-w-0">
                  <div className="text-[10px] font-medium text-text-muted">Current plan</div>
                  <div className="text-[12px] font-normal text-text-muted">Pro Trial</div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200 ${upgradeExpanded ? 'rotate-0' : '-rotate-90'}`}
                  strokeWidth={1.5}
                />
              </div>
              {/* Expandable body */}
              {upgradeExpanded && (
                <div className="px-3 pb-3">
                  <p className="text-[11px] leading-relaxed mb-2.5" style={{ color: 'var(--text-muted)' }}>
                    Upgrade to unlock all enterprise features.
                  </p>
                  <button
                    className="w-full flex justify-center items-center gap-2 py-1.5 rounded-[4px] transition-colors bg-surface border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover shadow-sm active:scale-95"
                  >
                    Upgrade to Pro
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-2 mb-4 shrink-0">
              <button
                className="w-full aspect-square rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                title="Upgrade to Pro"
              >
                <Zap className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          )}

          {/* ── Profile Footer Box ── */}
          <div className="relative mx-3">
            {profileMenuOpen && !collapsed && (
              <div className="absolute bottom-[calc(100%+8px)] left-0 w-full bg-surface border border-border shadow-luxury rounded-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">



                {/* Account */}
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/crm/smart-lists'); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                >
                  <List className="w-[15px] h-[15px] shrink-0" strokeWidth={2} />
                  Create Smart List
                </button>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                >
                  <Settings className="w-[15px] h-[15px] shrink-0" strokeWidth={2} />
                  Settings
                </button>
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                >
                  <HelpCircle className="w-[15px] h-[15px] shrink-0" strokeWidth={2} />
                  Help
                </button>
                <div className="w-full h-[1px] bg-border my-1"></div>
                <button
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    queryClient.clear();
                    await signOut({ redirectUrl: window.location.origin.replace(':4000', ':5173') + '/login' });
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-medium text-red-400 hover:text-red-300 hover:bg-surface-hover transition-colors"
                >
                  <LogOut className="w-[15px] h-[15px] shrink-0" strokeWidth={2} />
                  Log out
                </button>
              </div>
            )}
            
            <div
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`flex items-center gap-2.5 cursor-pointer rounded-xl transition-colors border border-border bg-surface hover:border-primary/30 shrink-0 ${
                collapsed ? 'justify-center p-2' : 'px-3 py-2 hover:bg-surface-hover'
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 select-none shadow-sm overflow-hidden"
                style={{ background: 'var(--primary)', color: 'var(--bg)' }}
              >
                {user?.imageUrl ? <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" /> : initial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-col justify-center leading-tight min-w-0 pr-2 flex-1">
                    <span className="text-[13px] font-normal truncate text-text-muted">
                      {fullName}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                      Enterprise CRM
                    </span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 text-text-muted shrink-0" />
                </>
              )}
            </div>
            
            {/* Mobile / Collapsed utilities */}
            {collapsed && (
              <div className="flex flex-col items-center gap-2 mt-3 w-full">
                <button onClick={() => navigate('/settings')} className="text-text-muted hover:text-text-main w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-border" title="Settings"><Settings className="w-[15px] h-[15px]"/></button>
                <button className="text-text-muted hover:text-text-main w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-border" title="Help"><HelpCircle className="w-[15px] h-[15px]"/></button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
