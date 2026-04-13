import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Users, CircleDollarSign, Target, Building2, Activity, Phone, GitBranch, Share2, Link2, Zap } from 'lucide-react';

const workspaceNav = [
  { to: 'contacts',       label: 'Contacts',       icon: Users },
  { to: 'deals',          label: 'Deals',           icon: CircleDollarSign },
  { to: 'leads',          label: 'Leads',           icon: Target },
  { to: 'communications', label: 'Communications',  icon: Phone },
  { to: 'pipelines',      label: 'Pipelines',       icon: GitBranch },
  { to: 'accounts',       label: 'Accounts',        icon: Building2 },
  { to: 'activities',     label: 'Activities',      icon: Activity },
];

export default function CrmLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full w-full bg-bg text-sm font-sans text-text-main relative z-0">
      
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between px-8 py-3 shrink-0 bg-white/70 backdrop-blur-xl border-b border-border gap-4 z-10 sticky top-0 shadow-sm">
        {/* Left: Module Navigation */}
        <nav className="flex items-center p-1 gap-1 bg-surface-hover/40 rounded-xl border border-border/40 shadow-inner w-max overflow-x-auto">
          {workspaceNav.map((link) => {
            const isActive = location.pathname.includes(`/crm/${link.to}`);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-primary shadow-sm border border-border/50'
                    : 'text-text-muted hover:text-text-main hover:bg-white/60'
                }`}
              >
                <link.icon className={`w-3.5 h-3.5 ${isActive ? '' : 'opacity-60'}`} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-1 text-[13px] font-medium shrink-0">
          <button
            className="flex items-center gap-2 text-text-muted hover:text-text-main hover:bg-surface-hover px-3 py-1.5 rounded-lg transition-all"
            onClick={() => window.dispatchEvent(new CustomEvent('crm:import'))}
          >
            <Share2 className="w-4 h-4" /> Import
          </button>
          <button className="flex items-center gap-2 text-text-muted hover:text-text-main hover:bg-surface-hover px-3 py-1.5 rounded-lg transition-all">
            <Link2 className="w-4 h-4" /> Integrate
          </button>
          <button className="flex items-center gap-2 text-text-muted hover:text-text-main hover:bg-surface-hover px-3 py-1.5 rounded-lg transition-all">
            <Zap className="w-4 h-4" /> Automate
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden flex flex-col relative w-full bg-bg">
        <Outlet />
      </div>
    </div>
  );
}
