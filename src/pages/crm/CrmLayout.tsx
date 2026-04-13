import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Users, CircleDollarSign, Target, Building2,
  Activity, Phone, GitBranch, Share2, Link2, Zap
} from 'lucide-react';

const workspaceNav = [
  { to: 'contacts',       label: 'Contacts',      icon: Users },
  { to: 'deals',          label: 'Deals',          icon: CircleDollarSign },
  { to: 'leads',          label: 'Leads',          icon: Target },
  { to: 'communications', label: 'Comms',          icon: Phone },
  { to: 'pipelines',      label: 'Pipelines',      icon: GitBranch },
  { to: 'accounts',       label: 'Accounts',       icon: Building2 },
  { to: 'activities',     label: 'Activities',     icon: Activity },
];

export default function CrmLayout() {
  const location = useLocation();

  return (
    <div
      className="flex flex-col h-full w-full text-sm font-sans relative z-0"
      style={{ background: 'var(--bg)', color: 'var(--text-main)' }}
    >
      {/* Top Navigation Bar */}
      <div
        className="w-full flex items-center justify-between px-6 py-2.5 shrink-0 border-b z-10 sticky top-0 gap-4"
        style={{
          background: 'rgba(15,26,43,0.92)',
          backdropFilter: 'blur(16px)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Module Tabs */}
        <nav
          className="flex items-center gap-0.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {workspaceNav.map((link) => {
            const isActive = location.pathname.includes(`/crm/${link.to}`);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-150 whitespace-nowrap ${
                  isActive ? 'font-semibold' : ''
                }`}
                style={{
                  background: isActive ? 'var(--surface)' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                }}
              >
                <link.icon
                  className="w-3.5 h-3.5 shrink-0"
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{ opacity: isActive ? 1 : 0.65 }}
                />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 text-[12.5px] font-medium shrink-0">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
            onClick={() => window.dispatchEvent(new CustomEvent('crm:import'))}
          >
            <Share2 className="w-3.5 h-3.5" /> Import
          </button>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <Link2 className="w-3.5 h-3.5" /> Integrate
          </button>
          <button
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-main)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <Zap className="w-3.5 h-3.5" /> Automate
          </button>
        </div>
      </div>

      {/* Page Content */}
      <div
        className="flex-1 overflow-hidden flex flex-col relative w-full"
        style={{ background: 'var(--bg)' }}
      >
        <Outlet />
      </div>
    </div>
  );
}
