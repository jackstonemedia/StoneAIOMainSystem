import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Search, Bell,
  BarChart3, Reply, FileText,
  Settings, HelpCircle, ChevronDown, Zap,
  Users, Calendar, Star, MessageSquare,
  Mic, LogOut, ChevronsUpDown, List, PanelLeftClose, PanelLeftOpen,
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
    { name: 'Sequences',      path: '/business/sequences',         icon: Zap },
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
          className={`flex items-center justify-center w-8 h-8 mx-auto my-0.5 rounded-lg transition-all duration-150 ${
            isActive
              ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <item.icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.75} />
        </NavLink>
      );
    }

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileOpen?.(false)}
        className={`group relative flex items-center gap-2.5 px-2.5 py-[7px] mx-2 my-px rounded-lg text-[13px] transition-all duration-150 ${
          isActive
            ? 'bg-[var(--sidebar-active)] text-[var(--text-main)] font-semibold'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)] font-medium'
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
        )}
        <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
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
          ${collapsed ? 'w-[60px]' : 'w-[232px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* ── Workspace Header ── */}
        <div
          className={`h-[52px] border-b flex items-center shrink-0 transition-all ${
            collapsed ? 'justify-center px-0' : 'px-3 justify-between'
          }`}
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm"
                style={{ background: 'var(--primary)', color: 'var(--bg)' }}
              >
                S
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-main)' }}>Stone AIO</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Pro Trial</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-[15px] h-[15px]" strokeWidth={1.75} />
              : <PanelLeftClose className="w-[15px] h-[15px]" strokeWidth={1.75} />}
          </button>
        </div>

        {/* ── Search ── */}
        <div
          className={`border-b shrink-0 flex items-center gap-2 transition-all ${
            collapsed ? 'justify-center py-2.5 px-0' : 'px-3 py-2'
          }`}
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          {collapsed ? (
            <button
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
              title="Search"
            >
              <Search className="w-4 h-4" strokeWidth={1.75} />
            </button>
          ) : (
            <div
              className="flex items-center gap-2 flex-1 px-2.5 py-1.5 rounded-lg cursor-text transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <Search className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span className="text-[12px] font-medium flex-1" style={{ opacity: 0.7 }}>Search…</span>
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >⌘K</span>
            </div>
          )}
        </div>

        {/* ── Scrollable Nav Body ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">

          {/* Notifications */}
          <div className="pt-2 pb-1 shrink-0">
            <button
              className={`group w-full flex items-center transition-all rounded-lg mx-2 my-px text-[13px] font-medium ${
                collapsed ? 'justify-center w-8 h-8 p-0 mx-auto' : 'gap-2.5 px-2.5 py-[7px]'
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
              title={collapsed ? 'Notifications' : undefined}
            >
              <div className="relative shrink-0">
                <Bell className="w-4 h-4" strokeWidth={1.75} />
                <span
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center"
                  style={{ background: 'var(--primary)', color: 'var(--bg)' }}
                >5</span>
              </div>
              {!collapsed && <span className="flex-1 text-left">Notifications</span>}
            </button>
          </div>

          <div className="mx-3 mb-2" style={{ height: '1px', background: 'var(--sidebar-border)' }} />

          {/* ── Section label: Workspace ── */}
          {!collapsed && (
            <div className="px-4 pt-1 pb-1 shrink-0">
              <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)', opacity: 0.45 }}>Workspace</span>
            </div>
          )}

          {/* ── Navigation items ── */}
          <div className="flex-1 pb-2">
            {crmMenu.map((item) => <NavItem key={item.name} item={item} />)}

            <div className="my-2.5 mx-3" style={{ height: '1px', background: 'var(--sidebar-border)', opacity: 0.6 }} />

            {!collapsed && (
              <div className="px-4 pb-1 shrink-0">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--text-muted)', opacity: 0.45 }}>Automation</span>
              </div>
            )}
            {automationMenu.map((item) => <NavItem key={item.name} item={item} />)}
          </div>
        </nav>

        {/* ── Bottom Footer ── */}
        <div className="shrink-0 flex flex-col" style={{ borderTop: '1px solid var(--sidebar-border)' }}>

          {/* Upgrade nudge — collapsed icon only */}
          {collapsed ? (
            <div className="py-2 flex flex-col items-center gap-1">
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)' }}
                title="Upgrade to Pro"
              >
                <Zap className="w-4 h-4" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: 'var(--text-muted)' }}
                title="Settings"
              >
                <Settings className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div
              className="mx-3 my-3 rounded-lg overflow-hidden shrink-0"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                onClick={() => setUpgradeExpanded(!upgradeExpanded)}
              >
                <div
                  className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                >
                  <Zap className="w-3 h-3" style={{ color: 'var(--text-muted)' }} strokeWidth={2} />
                </div>
                <div className="leading-tight flex-1 min-w-0">
                  <div className="text-[11px] font-semibold" style={{ color: 'var(--text-main)' }}>Pro Trial</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>Upgrade for full access</div>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${upgradeExpanded ? 'rotate-0' : '-rotate-90'}`}
                  strokeWidth={1.5}
                  style={{ color: 'var(--text-muted)' }}
                />
              </div>
              {upgradeExpanded && (
                <div className="px-3 pb-3 pt-0">
                  <button
                    className="w-full flex justify-center items-center gap-1.5 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all active:scale-95"
                    style={{ background: 'var(--primary)', color: 'var(--bg)' }}
                  >
                    <Zap className="w-3 h-3" /> Upgrade to Pro
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Profile ── */}
          <div className="relative" style={{ padding: collapsed ? '0 0 8px' : '0 12px 12px' }}>
            {profileMenuOpen && !collapsed && (
              <div
                className="absolute bottom-[calc(100%+6px)] left-0 right-0 rounded-xl overflow-hidden py-1 z-50"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 -8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
                }}
              >
                <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-main)' }}>{fullName}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{user?.emailAddresses?.[0]?.emailAddress ?? ''}</p>
                </div>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/crm/smart-lists'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <List className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Smart Lists
                </button>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Settings className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Settings
                </button>
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <HelpCircle className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Help & Support
                </button>
                <div className="my-1" style={{ height: '1px', background: 'var(--border)' }} />
                <button
                  onClick={async () => {
                    setProfileMenuOpen(false);
                    queryClient.clear();
                    await signOut({ redirectUrl: window.location.origin.replace(':4000', ':5173') + '/login' });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:text-red-300 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <LogOut className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Sign out
                </button>
              </div>
            )}

            <div
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`flex items-center gap-2.5 cursor-pointer rounded-xl transition-all shrink-0 ${
                collapsed
                  ? 'justify-center py-1 w-10 mx-auto'
                  : 'px-2.5 py-2 hover:bg-[var(--surface-hover)]'
              }`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none overflow-hidden shadow-sm"
                style={{ background: 'var(--primary)', color: 'var(--bg)' }}
              >
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                  : initial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-col justify-center leading-tight min-w-0 flex-1">
                    <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-main)' }}>{fullName}</span>
                    <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Enterprise CRM</span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
