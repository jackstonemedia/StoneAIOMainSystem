import { useState } from 'react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Server, Search, Inbox, Bell,
  BarChart, Reply, FileText, FileSpreadsheet, Building2, Trash2,
  Settings, Moon, Palette, HelpCircle, PanelLeftClose, ChevronDown, Zap
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

  // No auto-collapse — user controls sidebar state manually

  // ── Mode-based Navigation Data ──
  const creatorMenu = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: BarChart },
    { name: 'Voice Agents', path: '/agents?type=voice', icon: Reply },
    { name: 'Documentation', path: '/assistant', icon: FileText },
    { name: 'Cloud Computer', path: '/computer', icon: Server },
    { name: 'Workflows', path: '/agents?type=workflow', icon: FileSpreadsheet },
    { name: 'Marketplace', path: '/marketplace', icon: Building2 },
    { name: 'Trash', path: '#', icon: Trash2 },
  ];

  const businessMenu = [
    { name: 'Dashboard', path: '/business', icon: LayoutDashboard },
    { name: 'CRM Contacts', path: '/business/crm/contacts', icon: BarChart },
    { name: 'Campaigns', path: '/business/campaigns', icon: Reply },
    { name: 'Documentation', path: '/business/forms', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Server },
    { name: 'Analytics', path: '/business/analytics', icon: FileSpreadsheet },
    { name: 'Reputation', path: '/business/reputation', icon: Building2 },
    { name: 'Trash', path: '#', icon: Trash2 },
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
            className={`flex items-center justify-center w-10 h-10 mx-auto my-1.5 rounded-md transition-all ${
              isActive 
                ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200 text-slate-800' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            <item.icon className="w-4 h-4" strokeWidth={2}/>
        </NavLink>
      );
    }

    return (
      <NavLink
        to={item.path}
        onClick={() => setMobileOpen?.(false)}
        className={`flex items-center gap-3 px-3 py-2 mx-3 my-0.5 rounded-lg text-[13px] font-medium transition-all ${
          isActive 
            ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200 text-[#1e293b]' 
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
        }`}
      >
        <item.icon className="w-[18px] h-[18px] shrink-0 opacity-80" strokeWidth={1.8} />
        <span className="truncate tracking-tight">{item.name}</span>
      </NavLink>
    );
  };

  const currentMenu = mode === 'creator' ? creatorMenu : businessMenu;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setMobileOpen?.(false)}
        />
      )}

      <aside
        className={`flex flex-col h-full shrink-0 transition-all duration-300 z-50 bg-[#f8fafc] border-r border-[#e2e8f0] text-slate-800
          fixed md:relative top-0 bottom-0 left-0 shadow-[4px_0_24px_rgba(0,0,0,0.01)] md:shadow-none
          ${collapsed ? 'w-[68px]' : 'w-[250px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header Block */}
        <div className={`h-14 flex items-center border-b border-[#e2e8f0] shrink-0 ${collapsed ? 'justify-center mx-0' : 'px-4 justify-between'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-white text-[#4f46e5] rounded flex items-center justify-center font-bold text-[10px] shadow-sm border border-slate-200">
               <Zap className="w-3.5 h-3.5" fill="currentColor" />
            </div>
            {!collapsed && (
              <span className="font-[600] text-[15px] tracking-tight text-slate-800">Stone AIO</span>
            )}
          </div>
          
          {/* Subtle Inline Sidebar Toggle */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors hidden md:flex"
            >
              <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="absolute -right-3 top-4 w-6 h-6 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 shadow-sm transition-all z-20 hidden md:flex"
            >
              <PanelLeftClose className="w-3.5 h-3.5 rotate-180" strokeWidth={1.5}/>
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className={`h-[42px] border-b border-[#e2e8f0] flex items-center text-slate-500 hover:bg-slate-200/30 cursor-text transition-colors shrink-0 ${collapsed ? 'justify-center' : 'px-4 gap-3'}`}>
           <Search className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8}/>
           {!collapsed && (
             <span className="text-[13px] font-medium opacity-90 truncate">Quick search</span>
           )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden styled-scrollbar relative flex flex-col pb-4">
          
          {/* Top Communication Segment */}
          <div className="border-b border-[#e2e8f0] py-2 shrink-0">
             <div className={`flex items-center justify-between text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md' : 'px-4 py-2'}`}>
                <div className="flex items-center gap-3">
                  <Inbox className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {!collapsed && <span>Inbox</span>}
                </div>
                {!collapsed && <span className="text-slate-400 text-[11px] font-semibold">12</span>}
             </div>
             
             <div className={`flex items-center justify-between text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors mt-0.5 ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md' : 'px-4 py-2'}`}>
                <div className="flex items-center gap-3">
                  <Bell className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  {!collapsed && <span>Notifications</span>}
                </div>
                {!collapsed && <span className="text-slate-400 text-[11px] font-semibold">15+</span>}
             </div>
          </div>

          {/* Mode Switcher Widget */}
          {!collapsed ? (
            <div className="mx-4 mt-4 mb-2 p-[2px] rounded-lg bg-gradient-to-br from-[#4f46e5] via-[#a855f7] to-[#ec4899] shadow-[0_2px_8px_rgba(79,70,229,0.2)] shrink-0">
              <div className="bg-white/95 backdrop-blur rounded-[6px] p-0.5 flex">
                <button
                  onClick={() => {
                    setMode('business');
                    navigate('/business');
                  }}
                  className={`flex-1 flex justify-center py-1.5 text-[11px] font-bold rounded transition-all ${mode === 'business' ? 'bg-gradient-to-r from-slate-100 to-white text-[#4f46e5] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Management
                </button>
                <button
                  onClick={() => {
                    setMode('creator');
                    navigate('/dashboard');
                  }}
                  className={`flex-1 flex justify-center py-1.5 text-[11px] font-bold rounded transition-all ${mode === 'creator' ? 'bg-gradient-to-r from-slate-100 to-white text-[#ec4899] shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Creation
                </button>
              </div>
            </div>
          ) : (
             <div className="mx-auto w-10 h-10 mt-4 shrink-0 p-[2px] rounded-lg bg-gradient-to-br from-[#4f46e5] via-[#a855f7] to-[#ec4899] shadow-sm cursor-pointer" onClick={() => {
                 const newMode = mode === 'creator' ? 'business' : 'creator';
                 setMode(newMode);
                 navigate(newMode === 'creator' ? '/dashboard' : '/business');
             }}>
                 <div className="bg-white/95 backdrop-blur rounded-[6px] w-full h-full flex items-center justify-center">
                    <Zap className={`w-4 h-4 ${mode === 'creator' ? 'text-[#ec4899]' : 'text-[#4f46e5]'} fill-current`} />
                 </div>
             </div>
          )}

          {!collapsed && (
            <div className="px-5 pt-3 pb-2 shrink-0">
              <span className="text-[13px] font-medium text-slate-500 tracking-tight">Menu</span>
            </div>
          )}

          {currentMenu.map((item) => <NavItem key={item.name} item={item} />)}

          {/* Upgrade Plan Widget — matching Pointsale reference */}
          {!collapsed ? (
            <div className="mx-4 mt-6 mb-2 rounded-xl bg-gradient-to-br from-[#e8eaff] to-[#f0eeff] p-4 border border-[#dcdaff] shadow-[0_2px_8px_rgba(0,0,0,0.03)] shrink-0">
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-[#4f46e5] border border-[#e0dfff]">
                   <Zap className="w-4 h-4" fill="currentColor" />
                 </div>
                 <div className="flex flex-col justify-center leading-tight">
                   <span className="text-[11px] text-slate-500 font-medium">Current plan:</span>
                   <span className="text-[13px] font-bold text-slate-800 tracking-tight">Pro trial</span>
                 </div>
              </div>
              <p className="text-[12px] text-slate-500 leading-snug mb-4">
                 Upgrade to Pro to get the latest and exclusive features
              </p>
              <button 
                className="w-full bg-white text-[#4f46e5] text-[13px] font-semibold rounded-lg py-2 shadow-sm border border-[#dcdaff] hover:shadow-md transition-shadow flex justify-center items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" fill="currentColor"/>
                Upgrade to Pro
              </button>
            </div>
          ) : (
             <div className="mx-3 mt-6 shrink-0">
               <button 
                 className="w-full aspect-square bg-[#e8eaff] rounded-lg flex items-center justify-center text-[#4f46e5] shadow-sm border border-[#dcdaff] hover:opacity-90"
                 title="Upgrade to Pro"
               >
                 <Zap className="w-4 h-4" fill="currentColor"/>
               </button>
             </div>
          )}

          {/* Utilities */}
          <div className="border-t border-[#e2e8f0] pt-2 mt-4 space-y-0.5 shrink-0">
             <div className={`flex items-center gap-3 text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md' : 'px-4 py-2 mx-2 rounded-lg'}`}>
                <Settings className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {!collapsed && <span>Preferences</span>}
             </div>
             <div className={`flex items-center gap-3 text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md' : 'px-4 py-2 mx-2 rounded-lg'}`}>
                <Moon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {!collapsed && <span>Dark mode</span>}
             </div>
             <div className={`flex items-center gap-3 text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md' : 'px-4 py-2 mx-2 rounded-lg'}`}>
                <Palette className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {!collapsed && <span>Themes</span>}
             </div>
             <div className={`flex items-center gap-3 text-[13px] font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer transition-colors ${collapsed ? 'justify-center mx-auto w-10 h-10 rounded-md mb-2' : 'px-4 py-2 mx-2 rounded-lg mb-2'}`}>
                <HelpCircle className="w-[18px] h-[18px]" strokeWidth={1.8} />
                {!collapsed && <span>Help</span>}
             </div>
          </div>
        </nav>

        {/* Floating Profile Strip at absolute bottom */}
        <div className={`h-[60px] border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center shrink-0 cursor-pointer hover:bg-slate-200/50 transition-colors ${collapsed ? 'justify-center px-0' : 'px-4 justify-between'}`}>
           <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
             <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-300">
               {/* Mock Avatar */}
               <div className="w-full h-full bg-[#d0d3e5] flex items-end justify-center pt-2">
                 <div className="w-4 h-4 rounded-full bg-slate-400 mb-0.5"></div>
               </div>
             </div>
             {!collapsed && (
               <div className="flex flex-col justify-center leading-tight">
                 <span className="text-[13px] font-semibold text-slate-800 tracking-tight">Jack Stone</span>
                 <span className="text-[11px] font-medium text-slate-500">{mode === 'creator' ? 'Creator Studio' : 'Enterprise CRM'}</span>
               </div>
             )}
           </div>
           {!collapsed && (
             <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
           )}
        </div>

      </aside>
    </>
  );
}
