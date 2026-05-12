import { useState } from 'react';
import { Settings, Save, Github, Copy, Server, Bell } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export default function AutomationsSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'git' | 'mcp' | 'notifications'>('general');

  const handleSave = () => {
    toast('success', 'Settings saved');
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-surface shrink-0">
        <h1 className="text-lg font-bold text-text-main flex items-center gap-2">
          <Settings className="w-4 h-4 text-accent" />
          Project Settings
        </h1>
        <p className="text-xs text-text-muted mt-0.5">Manage configuration for this automation workspace</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Nav */}
        <aside className="w-48 border-r border-border bg-surface/50 p-3 space-y-1">
          <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'general' ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:text-text-main hover:bg-bg'}`}>
            <Settings className="w-4 h-4" /> General
          </button>
          <button onClick={() => setActiveTab('git')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'git' ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:text-text-main hover:bg-bg'}`}>
            <Github className="w-4 h-4" /> Environment
          </button>
          <button onClick={() => setActiveTab('mcp')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'mcp' ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:text-text-main hover:bg-bg'}`}>
            <Server className="w-4 h-4" /> MCP Server
          </button>
          <button onClick={() => setActiveTab('notifications')} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeTab === 'notifications' ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:text-text-main hover:bg-bg'}`}>
            <Bell className="w-4 h-4" /> Notifications
          </button>
        </aside>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-text-main mb-4">General Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">Project Name</label>
                      <input type="text" defaultValue="Stone AIO Automations" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">Max Concurrent Jobs</label>
                      <input type="number" placeholder="Leave blank for platform default" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                </div>
                <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            )}

            {activeTab === 'git' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-semibold text-text-main mb-4">Git Repository</h2>
                  <p className="text-sm text-text-muted mb-4">Connect a Git repository to manage environments, sync changes across projects, and push releases.</p>
                  
                  <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">Remote URL (SSH)</label>
                      <input type="text" placeholder="git@github.com:org/repo.git" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">Branch</label>
                      <input type="text" defaultValue="main" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:border-accent" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">SSH Private Key</label>
                      <textarea rows={4} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..." className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text-main focus:outline-none focus:border-accent resize-none" />
                    </div>
                    <div className="pt-2 flex items-center gap-3">
                      <button onClick={handleSave} className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90">Save Git Settings</button>
                      <button className="px-4 py-2 border border-border text-text-muted text-sm font-medium rounded-lg hover:bg-surface">Test Connection</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-text-main">Model Context Protocol (MCP)</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-medium text-text-muted">Enable MCP Server</span>
                      <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" />
                    </label>
                  </div>
                  <p className="text-sm text-text-muted mb-4">Expose your automation tools, connections, and flows to external AI agents via the MCP standard.</p>
                  
                  <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1.5">Server URL</label>
                      <div className="flex gap-2">
                        <input type="text" readOnly value="https://api.stoneaio.com/v1/mcp/env_123456" className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm font-mono text-text-muted" />
                        <button className="px-3 py-2 bg-surface border border-border text-text-muted rounded-lg hover:bg-bg" title="Copy"><Copy className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-border">
                      <h3 className="text-sm font-medium text-text-main mb-3">Tool Categories</h3>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3"><input type="checkbox" disabled checked className="w-4 h-4 accent-accent opacity-50" /><span className="text-sm text-text-muted">Discovery (Always on)</span></label>
                        <label className="flex items-center gap-3"><input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" /><span className="text-sm text-text-main">Flow Management (Read/Write)</span></label>
                        <label className="flex items-center gap-3"><input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" /><span className="text-sm text-text-main">Testing & Runs</span></label>
                        <label className="flex items-center gap-3"><input type="checkbox" className="w-4 h-4 accent-accent" /><span className="text-sm text-text-main">Tables Access</span></label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-base font-semibold text-text-main mb-4">Notifications</h2>
                <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-main">Failed Runs</p>
                      <p className="text-xs text-text-muted">Send an email when a workflow execution fails</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" />
                  </label>
                  <label className="flex items-center justify-between pt-4 border-t border-border">
                    <div>
                      <p className="text-sm font-medium text-text-main">Connection Expiry</p>
                      <p className="text-xs text-text-muted">Send an email when an OAuth connection is about to expire</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-accent" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
