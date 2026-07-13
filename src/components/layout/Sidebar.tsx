import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Bell,
  BarChart3, Reply, FileText,
  Settings, HelpCircle, ChevronDown, Zap,
  Users, Calendar, Star, MessageSquare,
  Mic, LogOut, ChevronsUpDown, List, PanelLeftClose, PanelLeftOpen,
  Building2, Briefcase, AlignEndVertical, ListFilter, Mail, MessageSquareText,
  AppWindow, Share2, CheckSquare, LayoutList, Sparkles, Megaphone,
  Shield, History, Package, Bot, Network, Lock, PaintBucket, Key, Link2, Table2, GitMerge, Play, Target
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

  const navGroups = [
    {
      label: 'Workspace',
      items: [
        { 
          name: 'Dashboard',    
          path: '/dashboard?tab=overview',          
          icon: LayoutDashboard,
          subItems: [
            { name: 'Overview', path: '/dashboard?tab=overview' },
            { name: 'Revenue', path: '/dashboard?tab=revenue' },
            { name: 'Activity', path: '/dashboard?tab=activity' },
            { name: 'Calendar', path: '/dashboard?tab=calendar' },
          ]
        },
        { 
          name: 'CRM',          
          path: '/crm/contacts',       
          icon: Users,
          subItems: [
            { name: 'Contacts', path: '/crm/contacts' },
            { name: 'Opportunities', path: '/crm/pipeline' },
            { name: 'Companies', path: '/crm/companies' },
            { name: 'Tasks', path: '/crm/tasks' },
            { name: 'Documents', path: '/crm/documents' },
            { name: 'Smart Lists', path: '/crm/smart-lists' }
          ]
        },
        { 
          name: 'Inbox',
          path: '/inbox/chat',      
          icon: MessageSquare,
          subItems: [
            { name: 'Inbox', path: '/inbox/chat' },
            { name: 'Manual Actions', path: '/inbox/manual-actions' },
            { name: 'Snippets', path: '/inbox/snippets' },
            { name: 'Trigger Links', path: '/inbox/trigger-links' }
          ]
        },
        { 
          name: 'Ad Manager',   
          path: '/ads/overview',       
          icon: Megaphone,
          subItems: [
            { name: 'Overview', path: '/ads/overview' },
            { name: 'Campaigns', path: '/ads/campaigns' },
            { name: 'Reports', path: '/ads/reports' }
          ]
        },
        { name: 'Calendar',     path: '/business/calendar',  icon: Calendar },
        { name: 'Marketing',  path: '/leads',              icon: Megaphone },
      ]
    },
    {
      label: 'Automation',
      items: [
        { 
          name: 'Workflows',    
          path: '/automations',          
          icon: Zap,
          subItems: [
            { name: 'Workflows', path: '/automations' },
            { name: 'Runs', path: '/automations/runs' },
            { name: 'Connections', path: '/automations/connections' },
            { name: 'Tables', path: '/automations/tables' },
            { name: 'Releases', path: '/automations/releases' },
            { name: 'Settings', path: '/automations/settings' }
          ]
        },
        { name: 'Voice Agents', path: '/voice-agents',       icon: Mic },
      ]
    },
  ];

  const NavItem = ({ item }: { item: { name: string; path: string; icon: any; subItems?: any[] } }) => {
    const [isOpen, setIsOpen] = useState(false);
    const itemRef = useRef<HTMLAnchorElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          itemRef.current && !itemRef.current.contains(e.target as Node) &&
          menuRef.current && !menuRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

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
      if (itemPath.startsWith('/crm/')) return location.pathname.startsWith('/crm/');
      if (itemPath === '/ads/overview') return location.pathname.startsWith('/ads');
      return location.pathname.startsWith(itemPath);
    })();

    if (collapsed) {
      return (
        <NavLink
          ref={itemRef}
          to={item.path}
          onClick={(e) => {
            if (item.subItems) {
              if (isActive) {
                e.preventDefault();
                setIsOpen(!isOpen);
              } else {
                setIsOpen(false);
                setMobileOpen?.(false);
              }
            } else {
              setMobileOpen?.(false);
            }
          }}
          title={item.name}
          className={`flex items-center justify-center w-8 h-8 mx-auto mb-[10px] rounded-lg transition-all duration-150 ${
            isActive || isOpen
              ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)]'
              : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] hover:bg-[var(--sidebar-active)]'
          }`}
        >
          <item.icon className="w-4 h-4" strokeWidth={isActive ? 2 : 1.75} />
        </NavLink>
      );
    }

    return (
      <>
        <NavLink
          ref={itemRef}
          to={item.path}
          onClick={(e) => {
            if (item.subItems) {
              if (isActive) {
                e.preventDefault();
                setIsOpen(!isOpen);
              } else {
                setIsOpen(false);
                setMobileOpen?.(false);
              }
            } else {
              setMobileOpen?.(false);
            }
          }}
          className={`group relative flex items-center justify-between px-2.5 py-[7px] mx-2 mb-[10px] rounded-lg text-[13px] transition-all duration-150 ${
            isActive || isOpen
              ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text-main)] font-semibold'
              : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] hover:bg-[var(--sidebar-active)] font-medium'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive || isOpen ? 2 : 1.75} />
            <span className="truncate">{item.name}</span>
          </div>
          {item.subItems && isActive && (
            <ChevronDown className={`w-3.5 h-3.5 opacity-50 shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
          )}
        </NavLink>

        {isOpen && item.subItems && createPortal(
          <div 
            ref={menuRef}
            className="fixed z-[9999] w-[220px] py-2 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-in fade-in slide-in-from-left-2 duration-200"
            style={{
              top: Math.max(16, Math.min(itemRef.current?.getBoundingClientRect().top || 0, window.innerHeight - 500)),
              left: (itemRef.current?.getBoundingClientRect().right || 0) + 16,
              background: 'var(--sidebar-bg)',
              border: '1px solid var(--sidebar-border)'
            }}
          >
            <div className="px-4 pb-2 mb-2 border-b border-white/5">
              <h3 className="text-[13px] font-bold text-[var(--sidebar-text-main)]">{item.name}</h3>
            </div>
            <div className="flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto">
              {item.subItems.map((sub: any) => (
                <NavLink 
                  key={sub.path} 
                  to={sub.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) => `
                    flex items-center px-4 py-2 mx-2 mb-[6px] rounded-lg text-[13px] transition-colors
                    ${isActive ? 'text-[var(--sidebar-text-main)] font-semibold bg-[var(--sidebar-active)]' : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text-main)] hover:bg-[var(--sidebar-active)]'}
                  `}
                >
                  {sub.name}
                </NavLink>
              ))}
            </div>
          </div>,
          document.body
        )}
      </>
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
          ${collapsed ? 'w-[60px]' : 'w-[200px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
        }}
      >
        {/* ── Header — aligns with CRM tabs row ── */}
        <div
          className={`h-[57px] border-b shrink-0 flex items-center transition-all ${
            collapsed ? 'justify-center px-0' : 'px-4 justify-between'
          }`}
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="min-w-0">
                <p className="text-[14px] font-bold tracking-tight leading-tight truncate" style={{ color: 'var(--sidebar-text-main)' }}>Stone AIO</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--sidebar-active)] shrink-0"
            style={{ color: 'var(--sidebar-text-muted)' }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-[15px] h-[15px]" strokeWidth={1.75} />
              : <PanelLeftClose className="w-[15px] h-[15px]" strokeWidth={1.75} />}
          </button>
        </div>



        {/* ── Scrollable Nav Body ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
          {/* ── Navigation groups ── */}
          <div className="flex-1 pb-2 pt-1">
            {navGroups.map((group, idx) => (
              <div key={group.label}>
                {!collapsed && (
                  <div className={`px-4 pb-1 shrink-0 ${idx === 0 ? 'pt-0' : 'pt-4'}`}>
                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.45 }}>
                      {group.label}
                    </span>
                  </div>
                )}
                {collapsed && idx !== 0 && (
                  <div className="my-2.5 mx-3" style={{ height: '1px', background: 'var(--sidebar-border)', opacity: 0.6 }} />
                )}
                {group.items.map((item) => <NavItem key={item.name} item={item} />)}
              </div>
            ))}
          </div>
        </nav>

        {/* ── Bottom Footer ── */}
        <div className="shrink-0 flex flex-col" style={{ borderTop: '1px solid var(--sidebar-border)' }}>

          {/* Settings / Spacer */}
          {collapsed ? (
            <div className="py-2 flex flex-col items-center gap-1">
              <button
                onClick={() => navigate('/settings')}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--sidebar-active)]"
                style={{ color: 'var(--sidebar-text-muted)' }}
                title="Settings"
              >
                <Settings className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <div className="pt-3" />
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
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--sidebar-text-main)' }}>{fullName}</p>
                  <p className="text-[11px]" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.7 }}>{user?.emailAddresses?.[0]?.emailAddress ?? ''}</p>
                </div>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/crm/smart-lists'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--sidebar-active)]"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                >
                  <List className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Smart Lists
                </button>
                <button
                  onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--sidebar-active)]"
                  style={{ color: 'var(--sidebar-text-muted)' }}
                >
                  <Settings className="w-[14px] h-[14px] shrink-0" strokeWidth={2} /> Settings
                </button>
                <button
                  onClick={() => setProfileMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors hover:bg-[var(--sidebar-active)]"
                  style={{ color: 'var(--sidebar-text-muted)' }}
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
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:text-red-300 transition-colors hover:bg-[var(--sidebar-active)]"
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
                  : 'px-2.5 py-2 hover:bg-[var(--sidebar-active)]'
              }`}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 select-none overflow-hidden shadow-sm"
                style={{ background: 'var(--primary)', color: '#ffffff' }}
              >
                {user?.imageUrl
                  ? <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                  : initial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex flex-col justify-center leading-tight min-w-0 flex-1">
                    <span className="text-[12px] font-semibold truncate" style={{ color: 'var(--sidebar-text-main)' }}>{fullName}</span>
                    <span className="text-[10px] truncate" style={{ color: 'var(--sidebar-text-muted)', opacity: 0.6 }}>Enterprise CRM</span>
                  </div>
                  <ChevronsUpDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--sidebar-text-muted)' }} />
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
