import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Server, Search, Inbox, Bell,
  BarChart3, Reply, FileText, FileSpreadsheet, Building2,
  Settings, HelpCircle, PanelLeftClose, ChevronDown, Zap,
  Users, Calendar, Star, Activity, GitBranch, MessageSquare,
  Mic, Sparkles, LogOut, ChevronsUpDown
} from 'lucide-react';
import { useMode } from '../../store/modeStore';

interface SidebarProps {
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const { mode, setMode } = useMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ── Creator Studio Navigation ──
  const creatorMenu = [
    { name: 'Dashboard',     path: '/dashboard',          icon: LayoutDashboard },
    { name: 'AI Agents',     path: '/agents',             icon: Sparkles },
    { name: 'Voice Agents',  path: '/agents?type=voice',  icon: Mic },
    { name: 'Workflows',     path: '/agents?type=workflow',icon: GitBranch },
    { name: 'AI Assistant',  path: '/assistant',          icon: MessageSquare },
    { name: 'Cloud Computer',path: '/computer',           icon: Server },
    { name: 'Templates',     path: '/templates',          icon: FileSpreadsheet },
    { name: 'Marketplace',   path: '/marketplace',        icon: Building2 },
  ];

  // ── Management / Business Navigation ──
  const businessMenu = [
    { name: 'Dashboard',     path: '/business',                   icon: LayoutDashboard },
    { name: 'CRM',           path: '/business/crm/contacts',      icon: Users },
    { name: 'Inbox',         path: '/inbox',                      icon: Inbox },
    { name: 'Campaigns',     path: '/business/campaigns',         icon: Reply },
    { name: 'Calendar',      path: '/business/calendar',          icon: Calendar },
    { name: 'Analytics',     path: '/business/analytics',         icon: BarChart3 },
    { name: 'Forms',         path: '/business/forms',             icon: FileText },
    { name: 'Reputation',    path: '/business/reputation',        icon: Star },
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
            ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] font-semibold'
            : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-hover)]'
        }`}
      >
        <item.icon className="w-[17px] h-[17px] shrink-0" strokeWidth={isActive ? 2 : 1.75} />
        <span className="truncate">{item.name}</span>
      </NavLink>
    );
  };

  const currentMenu = mode === 'creator' ? creatorMenu : businessMenu;

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
        {/* ── Logo Header ── */}
        <div
          className={`h-[54px] flex items-center border-b shrink-0 ${
            collapsed ? 'justify-center' : 'px-4 justify-between'
          }`}
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
            </div>
            {!collapsed && (
              <span
                className="font-bold text-[14.5px] tracking-tight select-none"
                style={{ color: 'var(--text-main)' }}
              >
                Stone AIO
              </span>
            )}
          </div>

          {/* Collapse toggle */}
          {!collapsed ? (
            <button
              onClick={() => setCollapsed(true)}
              className="w-6 h-6 rounded-md flex items-center justify-center transition-colors hidden md:flex"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-main)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <PanelLeftClose className="w-[16px] h-[16px]" strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="absolute -right-3 top-4 w-6 h-6 rounded-full flex items-center justify-center shadow-md z-20 hidden md:flex transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <PanelLeftClose className="w-3 h-3 rotate-180" strokeWidth={1.5} />
            </button>
          )}
        </div>

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

          {/* Inbox + Notifications strip */}
          <div
            className="border-b py-1 shrink-0"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            {[
              { label: 'Inbox', icon: Inbox, count: '12', path: '/inbox' },
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

          {/* ── Mode Switcher ── */}
          {!collapsed ? (
            <div
              className="mx-3 mt-3 mb-1 p-[1.5px] rounded-xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              <div
                className="rounded-[10px] p-0.5 flex"
                style={{ background: 'var(--surface)' }}
              >
                <button
                  onClick={() => { setMode('business'); navigate('/business'); }}
                  className={`flex-1 py-1.5 text-[11.5px] font-bold rounded-[8px] transition-all ${
                    mode === 'business' ? 'shadow-sm' : ''
                  }`}
                  style={{
                    background: mode === 'business' ? 'var(--primary)' : 'transparent',
                    color: mode === 'business' ? 'var(--text-main)' : 'var(--text-muted)',
                  }}
                >
                  Management
                </button>
                <button
                  onClick={() => { setMode('creator'); navigate('/dashboard'); }}
                  className={`flex-1 py-1.5 text-[11.5px] font-bold rounded-[8px] transition-all ${
                    mode === 'creator' ? 'shadow-sm' : ''
                  }`}
                  style={{
                    background: mode === 'creator' ? 'var(--primary)' : 'transparent',
                    color: mode === 'creator' ? 'var(--text-main)' : 'var(--text-muted)',
                  }}
                >
                  Creation
                </button>
              </div>
            </div>
          ) : (
            <div
              className="mx-auto w-9 h-9 mt-3 mb-1 shrink-0 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
              style={{ background: 'var(--primary)', color: 'var(--text-main)' }}
              onClick={() => {
                const newMode = mode === 'creator' ? 'business' : 'creator';
                setMode(newMode);
                navigate(newMode === 'creator' ? '/dashboard' : '/business');
              }}
              title={`Switch to ${mode === 'creator' ? 'Management' : 'Creation'}`}
            >
              <Zap className="w-4 h-4" strokeWidth={1.8} />
            </div>
          )}

          {/* ── Section label ── */}
          {!collapsed && (
            <div className="px-4 pt-3 pb-1.5 shrink-0">
              <span
                className="text-[10px] font-bold tracking-[0.08em] uppercase"
                style={{ color: 'var(--text-muted)', opacity: 0.6 }}
              >
                {mode === 'creator' ? 'Creator Studio' : 'Management'}
              </span>
            </div>
          )}

          {/* ── Navigation items ── */}
          <div className="flex-1">
            {currentMenu.map((item) => <NavItem key={item.name} item={item} />)}
          </div>

          {/* ── Upgrade card ── */}
          {!collapsed ? (
            <div
              className="mx-3 mt-4 mb-2 rounded-xl p-4 shrink-0"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--surface-hover)', border: '1px solid var(--border)' }}
                >
                  <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} strokeWidth={1.8} />
                </div>
                <div className="leading-tight">
                  <div className="text-[10.5px] font-medium" style={{ color: 'var(--text-muted)' }}>Current plan</div>
                  <div className="text-[13px] font-bold" style={{ color: 'var(--text-main)' }}>Pro Trial</div>
                </div>
              </div>
              <p className="text-[11.5px] leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
                Upgrade to unlock all enterprise features.
              </p>
              <button
                className="w-full text-[12.5px] font-semibold py-2 rounded-lg transition-all"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary-hover)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary)')}
              >
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <div className="mx-2 mt-4 mb-2 shrink-0">
              <button
                className="w-full aspect-square rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                }}
                title="Upgrade to Pro"
              >
                <Zap className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
          )}

          {/* ── Utility links ── */}
          <div
            className="border-t pt-1.5 shrink-0"
            style={{ borderColor: 'var(--sidebar-border)' }}
          >
            {[
              { label: 'Settings', icon: Settings, path: '/settings' },
              { label: 'Help',     icon: HelpCircle, path: '#' },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => item.path !== '#' && navigate(item.path)}
                className={`w-full flex items-center transition-colors rounded-lg ${
                  collapsed
                    ? 'justify-center mx-auto w-9 h-9 my-0.5'
                    : 'px-4 py-2 mx-0 gap-3'
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
                <item.icon className="w-[16px] h-[16px] shrink-0" strokeWidth={1.75} />
                {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Profile Footer ── */}
        <div
          className={`h-[56px] border-t flex items-center shrink-0 cursor-pointer transition-colors ${
            collapsed ? 'justify-center px-2' : 'px-4 justify-between gap-3'
          }`}
          style={{ borderColor: 'var(--sidebar-border)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none"
              style={{ background: 'var(--primary)', color: 'var(--text-main)' }}
            >
              JS
            </div>
            {!collapsed && (
              <div className="flex flex-col justify-center leading-tight min-w-0">
                <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                  Jack Stone
                </span>
                <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                  {mode === 'creator' ? 'Creator Studio' : 'Enterprise CRM'}
                </span>
              </div>
            )}
          </div>
          {!collapsed && (
            <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </aside>
    </>
  );
}
