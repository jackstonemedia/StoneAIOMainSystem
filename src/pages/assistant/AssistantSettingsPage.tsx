import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Shield, Sliders, Volume2, Brain,
  Bell, AlertTriangle, Check, Loader2, Sparkles, Download, Trash2
} from 'lucide-react';
import {
  assistantApi,
  type AssistantSettings,
  type AssistantWorkspaceSettings
} from '../../lib/api/assistant';

export default function AssistantSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'personal' | 'workspace'>('personal');

  // Personal state
  const [personalSettings, setPersonalSettings] = useState<AssistantSettings>({
    defaultMode: 'ask',
    thinking: 'auto',
    voice: 'default',
    speed: 1.0,
    memoryEnabled: true,
    pastChatSearch: true,
    notify: {
      research: true,
      scheduled: true,
      approvals: true,
    },
  });

  // Workspace state
  const [workspaceSettings, setWorkspaceSettings] = useState<AssistantWorkspaceSettings>({
    id: '',
    workspaceId: '',
    maxMode: 'full',
    fullAutonomyRoles: ['owner', 'admin'],
    requireApprovalFor: {
      email_send: true,
      bulk_change: true,
      destructive_delete: true,
    },
    bulkThreshold: 25,
    dailyLimits: {
      messages: 200,
      deep_research: 20,
    },
    enabled: true,
    createdAt: '',
    updatedAt: '',
  });

  const [loading, setLoading] = useState(true);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [personalSaved, setPersonalSaved] = useState(false);
  const [workspaceSaved, setWorkspaceSaved] = useState(false);
  const [workspaceAdminAllowed, setWorkspaceAdminAllowed] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingChats, setDeletingChats] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const p = await assistantApi.getSettings();
        if (p) setPersonalSettings(p);
      } catch {
        // use defaults
      }

      try {
        const w = await assistantApi.getWorkspaceSettings();
        if (w) {
          setWorkspaceSettings(w);
          setWorkspaceAdminAllowed(true);
        }
      } catch (err: any) {
        if (err?.response?.status === 403 || err?.status === 403) {
          setWorkspaceAdminAllowed(false);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSavePersonal = async () => {
    setSavingPersonal(true);
    setPersonalSaved(false);
    try {
      await assistantApi.updateSettings(personalSettings);
      setPersonalSaved(true);
      setTimeout(() => setPersonalSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save personal settings:', err);
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveWorkspace = async () => {
    setSavingWorkspace(true);
    setWorkspaceSaved(false);
    try {
      await assistantApi.updateWorkspaceSettings(workspaceSettings);
      setWorkspaceSaved(true);
      setTimeout(() => setWorkspaceSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save workspace settings:', err);
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleExportChats = async () => {
    try {
      const convos = await assistantApi.listConversations();
      const blob = new Blob([JSON.stringify(convos, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stone-ai-chats-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export chats failed:', err);
    }
  };

  const handleDeleteAllChats = async () => {
    if (deleteConfirmText.trim() !== 'DELETE') return;
    setDeletingChats(true);
    try {
      const convos = await assistantApi.listConversations();
      for (const c of convos.items) {
        await assistantApi.deleteConversation(c.id);
      }
      setDeleteConfirmOpen(false);
      setDeleteConfirmText('');
      navigate('/assistant');
    } catch (err) {
      console.error('Delete all chats failed:', err);
    } finally {
      setDeletingChats(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-main text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm">Loading assistant settings...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border/40 px-6 flex items-center justify-between shrink-0 bg-bg-card/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/assistant')}
            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h1 className="font-semibold text-sm">AI Assistant Settings</h1>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-bg-secondary/70 p-0.5 rounded-lg border border-border/40 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`px-3 py-1 rounded-md transition-all ${
              activeTab === 'personal'
                ? 'bg-bg-card text-text-main shadow-xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Personal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'workspace'
                ? 'bg-bg-card text-text-main shadow-xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Shield className="w-3 h-3" />
            <span>Workspace Governance</span>
          </button>
        </div>
      </header>

      {/* Body Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        {activeTab === 'personal' ? (
          /* ── PERSONAL SETTINGS TAB ───────────────────────────────────────── */
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Personal Preferences</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Configure your default interactions, autonomy, voice, and memory for Stone AI.
              </p>
            </div>

            {/* Default Access Mode */}
            <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium">Default Access Mode</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    How much autonomous authority Stone AI has at the start of new conversations.
                  </p>
                </div>
                <Sliders className="w-4 h-4 text-text-muted" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { id: 'ask', label: 'Ask each time', desc: 'Prompts for confirmation before taking action' },
                  { id: 'read_only', label: 'Read-only', desc: 'Can view contacts & analytics, no changes made' },
                  { id: 'draft', label: 'Draft', desc: 'Prepares items as drafts requiring your approval' },
                  { id: 'full', label: 'Full autonomy', desc: 'Takes direct actions immediately when requested' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPersonalSettings({ ...personalSettings, defaultMode: item.id as any })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      personalSettings.defaultMode === item.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/60 hover:bg-bg-secondary/60'
                    }`}
                  >
                    <div className="font-medium text-xs text-text-main">{item.label}</div>
                    <div className="text-[11px] text-text-muted mt-1 leading-snug">{item.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Thinking & Voice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Thinking Mode */}
              <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">Thinking Mode</h3>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Extended thinking provides deep step-by-step reasoning on complex logic and multi-step plans.
                </p>
                <div className="flex gap-2">
                  {(['auto', 'extended'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPersonalSettings({ ...personalSettings, thinking: t })}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        personalSettings.thinking === t
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/60 text-text-muted hover:bg-bg-secondary/60'
                      }`}
                    >
                      {t} Thinking
                    </button>
                  ))}
                </div>
              </section>

              {/* Voice & Speed */}
              <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-medium">Voice & Playback</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Voice Character</label>
                    <select
                      value={personalSettings.voice || 'default'}
                      onChange={(e) => setPersonalSettings({ ...personalSettings, voice: e.target.value })}
                      className="w-full bg-bg-secondary border border-border/60 rounded-xl px-3 py-1.5 text-xs text-text-main outline-none focus:border-primary"
                    >
                      <option value="default">Default System Voice</option>
                      <option value="Rachel">Rachel (Natural, Friendly)</option>
                      <option value="Drew">Drew (Professional, Confident)</option>
                      <option value="Mimik">Mimik (Crisp, Focused)</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                      <span>Speech Speed</span>
                      <span className="font-mono text-text-main">{personalSettings.speed?.toFixed(1) || '1.0'}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.5"
                      step="0.1"
                      value={personalSettings.speed || 1.0}
                      onChange={(e) => setPersonalSettings({ ...personalSettings, speed: parseFloat(e.target.value) })}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Memory & Past Chat Search */}
            <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">Memory & Context</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Controls whether Stone AI remembers cross-chat details and indexes past conversations.
                  </p>
                </div>
                <Brain className="w-4 h-4 text-text-muted" />
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary/40 border border-border/40 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-text-main">Cross-Session Memory</div>
                    <div className="text-[11px] text-text-muted">
                      Remember key facts and user preferences across conversations
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={personalSettings.memoryEnabled}
                    onChange={(e) => setPersonalSettings({ ...personalSettings, memoryEnabled: e.target.checked })}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary/40 border border-border/40 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-text-main">Past Chat History Search</div>
                    <div className="text-[11px] text-text-muted">
                      Allow Stone AI to search prior conversations to answer questions
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={personalSettings.pastChatSearch}
                    onChange={(e) => setPersonalSettings({ ...personalSettings, pastChatSearch: e.target.checked })}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                </label>
              </div>
            </section>

            {/* Notification Preferences */}
            <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium">Notifications</h3>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Choose what asynchronous assistant events alert you in-app.
              </p>

              <div className="space-y-2">
                {[
                  { key: 'research', label: 'Deep research finished', desc: 'When long-running search runs complete' },
                  { key: 'scheduled', label: 'Scheduled task runs', desc: 'When automated background tasks finish' },
                  { key: 'approvals', label: 'Pending action approvals', desc: 'When an action card requires human review' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-bg-secondary/50 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-medium text-text-main">{item.label}</div>
                      <div className="text-[11px] text-text-muted">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean((personalSettings.notify as any)?.[item.key] ?? true)}
                      onChange={(e) =>
                        setPersonalSettings({
                          ...personalSettings,
                          notify: {
                            ...personalSettings.notify,
                            [item.key]: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 accent-primary rounded cursor-pointer"
                    />
                  </label>
                ))}
              </div>
            </section>

            {/* Data Controls & Privacy */}
            <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
              <h3 className="text-sm font-medium">Data Controls & Retention</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Your conversations remain stored securely until you delete them. Deleting a chat permanently deletes its messages and uploaded attachments. Immutable audit logs of executed platform actions are retained for workspace security.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleExportChats}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-bg-secondary hover:bg-bg-secondary/80 border border-border text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export my chats</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete all my chats</span>
                </button>
              </div>
            </section>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {personalSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Saved successfully
                </span>
              )}
              <button
                type="button"
                onClick={handleSavePersonal}
                disabled={savingPersonal}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-60"
              >
                {savingPersonal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        ) : (
          /* ── WORKSPACE GOVERNANCE TAB ─────────────────────────────────────── */
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold tracking-tight">Enterprise Assistant Governance</h2>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Set boundaries, maximum autonomous capabilities, and confirmation policies for all workspace members.
              </p>
            </div>

            {!workspaceAdminAllowed ? (
              <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-text-main space-y-2">
                <div className="flex items-center gap-2 font-medium text-sm text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Admin Access Required</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  Only workspace administrators and owners have authorization to modify assistant governance policies.
                  Please reach out to your workspace administrator if changes are required.
                </p>
              </div>
            ) : (
              <>
                {/* Master Assistant Toggle */}
                <section className="bg-bg-card rounded-2xl border border-border/60 p-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Stone AI Status for Workspace</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      When turned off, the AI Assistant is hidden and inaccessible for all members in this workspace.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={workspaceSettings.enabled}
                      onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-bg-secondary border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </section>

                {/* Maximum Mode Cap */}
                <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Maximum Access Mode Ceiling</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Caps the highest access mode any workspace user can ever select.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'read_only', label: 'Read-only Cap', desc: 'No user can ever write or mutate data via AI' },
                      { id: 'draft', label: 'Draft Cap', desc: 'Users can generate drafts, but full autonomy is blocked' },
                      { id: 'full', label: 'Full Autonomy Allowed', desc: 'Allowed users can operate with zero confirmation gates' },
                    ].map((cap) => (
                      <button
                        key={cap.id}
                        type="button"
                        onClick={() => setWorkspaceSettings({ ...workspaceSettings, maxMode: cap.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          workspaceSettings.maxMode === cap.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-border/60 hover:bg-bg-secondary/60'
                        }`}
                      >
                        <div className="font-medium text-xs text-text-main">{cap.label}</div>
                        <div className="text-[11px] text-text-muted mt-1 leading-snug">{cap.desc}</div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Autonomy Role Gates */}
                <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Who Can Use Full Autonomy</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Restrict hands-free execution to specific organizational roles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      {
                        val: ['owner', 'admin'],
                        label: 'Admins & Owners Only',
                        desc: 'Standard members are capped at Draft mode and cannot execute direct platform mutations.',
                      },
                      {
                        val: ['owner', 'admin', 'member'],
                        label: 'All Workspace Members',
                        desc: 'Every invited member can switch to Full Autonomy if permitted by the ceiling above.',
                      },
                    ].map((rOption, idx) => {
                      const isSelected =
                        workspaceSettings.fullAutonomyRoles.includes('member') ===
                        rOption.val.includes('member');
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/5'
                              : 'border-border/60 hover:bg-bg-secondary/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name="autonomyRoles"
                            checked={isSelected}
                            onChange={() =>
                              setWorkspaceSettings({
                                ...workspaceSettings,
                                fullAutonomyRoles: rOption.val,
                              })
                            }
                            className="mt-0.5 accent-primary cursor-pointer"
                          />
                          <div>
                            <div className="text-xs font-medium text-text-main">{rOption.label}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{rOption.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>

                {/* Mandatory Approval Gates */}
                <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Mandatory Confirmation Gates</h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Actions that always require explicit human confirmation even when running in Full Autonomy.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary/40 border border-border/40 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-text-main">Sending Real Emails & SMS</div>
                        <div className="text-[11px] text-text-muted">Always show preview card before dispatching outbound messages</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceSettings.requireApprovalFor?.email_send !== false}
                        onChange={(e) =>
                          setWorkspaceSettings({
                            ...workspaceSettings,
                            requireApprovalFor: {
                              ...workspaceSettings.requireApprovalFor,
                              email_send: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-xl bg-bg-secondary/40 border border-border/40 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-text-main">Deleting CRM Records</div>
                        <div className="text-[11px] text-text-muted">Always require confirmation before deleting contacts, deals, or workflows</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={workspaceSettings.requireApprovalFor?.destructive_delete !== false}
                        onChange={(e) =>
                          setWorkspaceSettings({
                            ...workspaceSettings,
                            requireApprovalFor: {
                              ...workspaceSettings.requireApprovalFor,
                              destructive_delete: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 accent-primary rounded cursor-pointer"
                      />
                    </label>

                    <div className="p-3 rounded-xl bg-bg-secondary/20 border border-border/40 flex items-center justify-between opacity-80">
                      <div>
                        <div className="text-xs font-medium text-text-main flex items-center gap-1.5">
                          <span>Billing, API Keys & Team Permissions</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold uppercase">
                            Locked
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted">
                          Administrative and security actions can never run without owner approval
                        </div>
                      </div>
                      <input type="checkbox" checked disabled className="w-4 h-4 accent-primary rounded" />
                    </div>
                  </div>
                </section>

                {/* Bulk Threshold */}
                <section className="bg-bg-card rounded-2xl border border-border/60 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Bulk Action Threshold</h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Any operation impacting more than this number of records requires a bulk confirmation card.
                      </p>
                    </div>
                    <span className="font-mono text-sm font-bold text-primary px-3 py-1 bg-primary/10 rounded-lg">
                      {workspaceSettings.bulkThreshold} records
                    </span>
                  </div>

                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={workspaceSettings.bulkThreshold || 25}
                    onChange={(e) =>
                      setWorkspaceSettings({
                        ...workspaceSettings,
                        bulkThreshold: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-primary cursor-pointer mt-2"
                  />
                </section>

                {/* Save Button */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {workspaceSaved && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium animate-in fade-in">
                      <Check className="w-3.5 h-3.5" /> Workspace governance saved
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveWorkspace}
                    disabled={savingWorkspace}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-60"
                  >
                    {savingWorkspace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>Save Governance</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Delete All Chats Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-bg-card border border-border p-5 shadow-xl space-y-4">
            <h3 className="text-base font-semibold text-text-main flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              <span>Delete all conversations?</span>
            </h3>
            <p className="text-xs text-text-muted leading-relaxed">
              This will permanently delete all your assistant chat history across all sessions. This action cannot be undone.
            </p>
            <div>
              <label className="text-[11px] text-text-muted block mb-1">
                Type <strong className="text-rose-500">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-text-main outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteConfirmText('');
                }}
                className="px-3.5 py-1.5 rounded-xl border border-border text-xs font-medium hover:bg-bg-secondary text-text-muted hover:text-text-main transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllChats}
                disabled={deleteConfirmText.trim() !== 'DELETE' || deletingChats}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition-colors disabled:opacity-40"
              >
                {deletingChats ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>Permanently Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
