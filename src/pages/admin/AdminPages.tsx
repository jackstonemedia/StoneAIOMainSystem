import { useState } from 'react';
import { 
  Plus, Search, Building2, Users, Shield, History, 
  Package, Bot, Network, Lock, PaintBucket, Key, MoreHorizontal,
  Edit2, Trash2, ShieldAlert
} from 'lucide-react';

export function AdminProjects() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-main">Projects</h1>
          <p className="text-xs text-text-muted mt-0.5">Manage workspaces and their members</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90">
          <Plus className="w-4 h-4" /> Create Project
        </button>
      </div>
      <div className="p-6">
        <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center text-center">
          <Building2 className="w-12 h-12 text-accent mb-4 opacity-50" />
          <h2 className="text-base font-semibold text-text-main">No projects found</h2>
          <p className="text-sm text-text-muted mt-1">Create a project to start automating.</p>
        </div>
      </div>
    </div>
  );
}

export function AdminUsers() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-surface flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-main">Users</h1>
          <p className="text-xs text-text-muted mt-0.5">Manage platform access and global roles</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90">
          <Plus className="w-4 h-4" /> Invite User
        </button>
      </div>
      <div className="p-6">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
              <th className="w-12 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-surface/50">
              <td className="px-4 py-3">
                <p className="font-medium text-text-main">Admin User</p>
                <p className="text-xs text-text-muted">admin@stoneaio.com</p>
              </td>
              <td className="px-4 py-3"><span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full">Super Admin</span></td>
              <td className="px-4 py-3"><span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">Active</span></td>
              <td className="px-4 py-3 text-right">
                <button className="p-1 text-text-muted hover:text-text-main"><MoreHorizontal className="w-4 h-4" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Stub out the rest of the views
export function AdminRoles() { return <Placeholder icon={Shield} title="Project Roles" desc="Define granular permission sets" />; }
export function AdminAudit() { return <Placeholder icon={History} title="Audit Logs" desc="Track all platform activity" />; }
export function AdminPieces() { return <Placeholder icon={Package} title="Pieces" desc="Manage installed integrations" />; }
export function AdminAI() { return <Placeholder icon={Bot} title="AI Providers" desc="Configure LLM endpoints and API keys" />; }
export function AdminInfra() { return <Placeholder icon={Network} title="Infrastructure" desc="Manage webhooks and event destinations" />; }
export function AdminSecurity() { return <Placeholder icon={Lock} title="Security" desc="Configure Secret Managers (Vault, AWS)" />; }
export function AdminBranding() { return <Placeholder icon={PaintBucket} title="Branding" desc="Customize platform appearance" />; }
export function AdminSSO() { return <Placeholder icon={Key} title="SSO / SCIM" desc="Enterprise identity management" />; }

function Placeholder({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <h1 className="text-lg font-bold text-text-main">{title}</h1>
        <p className="text-xs text-text-muted mt-0.5">{desc}</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Icon className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-main">{title}</h2>
          <p className="text-sm text-text-muted mt-2">This module is currently in development per the spec.</p>
        </div>
      </div>
    </div>
  );
}
