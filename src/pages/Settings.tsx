import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Palette, Bell, Users, Shield, Save, Check, Building2,
  Plug, Globe, Phone, Mail, Copy, Eye, EyeOff, Plus,
  ChevronRight, RefreshCw, CheckCircle2, X, Loader2, Upload,
  QrCode, Monitor, Trash2, Code, ExternalLink, Unlink, CreditCard, Bot
} from 'lucide-react';
import Billing from './Billing';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/ui/Toast';
import { apiFetch } from '../lib/apiClient';
import { channelConnectionsApi } from '../lib/api/conversations';

const TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'agent', label: 'AI Agent', icon: Bot },
  { id: 'billing', label: 'Billing & Plans', icon: CreditCard },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'api', label: 'API & Webhooks', icon: Code },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
];

const INTEGRATIONS = [
  {
    id: 'twilio',
    label: 'Twilio',
    desc: 'SMS, voice calls, and messaging for Conversations and Campaigns',
    icon: Phone,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    fields: [
      { key: 'twilio_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxx', type: 'text' },
      { key: 'twilio_token', label: 'Auth Token', placeholder: '••••••••••••••••••••••••••••', type: 'password' },
      { key: 'twilio_from', label: 'From Number', placeholder: '+1 (555) 000-0000', type: 'text' },
    ],
  },
  {
    id: 'resend',
    label: 'Resend',
    desc: 'Transactional and campaign email delivery',
    icon: Mail,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    fields: [
      { key: 'resend', label: 'API Key', placeholder: 're_xxxxxxxxxxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'google',
    label: 'Google & Gmail',
    desc: 'Connect your Gmail account to send & receive customer emails and sync Google services',
    icon: Globe,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    isChannelOAuth: 'gmail',
    fields: [
      { key: 'google_client_id', label: 'OAuth Client ID (Optional override)', placeholder: 'xxxx.apps.googleusercontent.com', type: 'text' },
      { key: 'google_client_secret', label: 'OAuth Client Secret (Optional override)', placeholder: 'GOCSPX-xxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'outlook',
    label: 'Microsoft Outlook',
    desc: 'Connect your Outlook / Microsoft 365 inbox for direct email synchronization',
    icon: Mail,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    isChannelOAuth: 'outlook',
    fields: [
      { key: 'outlook_client_id', label: 'Application (client) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type: 'text' },
      { key: 'outlook_client_secret', label: 'Client Secret', placeholder: '••••••••••••••••••••••••••••', type: 'password' },
    ],
  },
];

const NOTIF_PREFS = [
  { key: 'new_contact', label: 'New Contact Added', desc: 'When a contact is created via form or import' },
  { key: 'deal_won', label: 'Deal Won', desc: 'When a deal moves to Won stage' },
  { key: 'task_overdue', label: 'Task Overdue', desc: '24h before a task is due with no completion' },
  { key: 'campaign_sent', label: 'Campaign Sent', desc: 'When a campaign finishes sending' },
  { key: 'review_received', label: 'New Review', desc: 'When a new customer review is received' },
  { key: 'apt_created', label: 'Appointment Booked', desc: 'When a new appointment is scheduled' },
  { key: 'inbound_sms', label: 'Inbound SMS', desc: 'When a contact sends a message' },
  { key: 'weekly_summary', label: 'Weekly Summary', desc: 'A weekly digest of key performance metrics' },
];

function FieldInput(props: { type?: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const isPass = props.type === 'password';
  return (
    <div className="relative">
      <input
        type={isPass && !show ? 'password' : 'text'}
        placeholder={props.placeholder}
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        className="w-full px-3 py-2 pr-10 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary font-mono placeholder:text-text-muted/50 placeholder:font-sans"
      />
      {isPass && (
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors">
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, themes } = useTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general');
  const [wsName, setWsName] = useState('Stone AIO');
  const [wsId, setWsId] = useState('ws_default_stone_aio');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map(n => [n.key, true]))
  );
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    const connected = searchParams.get('channel_connected');
    if (connected) {
      toast('success', `${connected === 'gmail' ? 'Gmail' : connected === 'outlook' ? 'Outlook' : connected} connected successfully!`);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('channel_connected');
      setSearchParams(nextParams, { replace: true });
    }
    const errorParam = searchParams.get('error');
    if (errorParam) {
      toast('error', errorParam);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('error');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams]);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  // Security modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTwoFAModal, setShowTwoFAModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFASetup, setTwoFASetup] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  useQuery<any>({
    queryKey: ['settings', 'workspace'],
    queryFn: () => apiFetch('/api/settings/workspace').then(r => r.ok ? r.json() : null),
    onSuccess: (d: any) => {
      if (d?.name) setWsName(d.name);
      if (d?.id) setWsId(d.id);
    }
  } as any);

  const { data: savedKeys = [] } = useQuery<any[]>({
    queryKey: ['settings', 'api-keys'],
    queryFn: () => apiFetch('/api/settings/api-keys').then(r => r.ok ? r.json() : []),
  });

  const { data: channelConnections = [] } = useQuery<any[]>({
    queryKey: ['channel-connections'],
    queryFn: () => channelConnectionsApi.list(),
  });

  const disconnectChannel = useMutation({
    mutationFn: (id: string) => channelConnectionsApi.disconnect(id),
    onSuccess: () => {
      toast('info', 'Channel disconnected.');
      qc.invalidateQueries({ queryKey: ['channel-connections'] });
    },
    onError: (err: any) => toast('error', err?.message || 'Failed to disconnect channel'),
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['settings', 'team'],
    queryFn: () => apiFetch('/api/settings/team').then(r => r.ok ? r.json() : []),
  });

  const saveWorkspace = useMutation({
    mutationFn: () => apiFetch('/api/settings/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: wsName }) }).then(r => r.json()),
    onSuccess: () => { toast('success', 'Settings saved!'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast('error', 'Failed to save settings'),
  });

  // Phase 2: AI Agent settings — display name, latitude mode, grants.
  const [agentDisplayName, setAgentDisplayName] = useState('AI Agent');
  const [agentModeSetting, setAgentModeSetting] = useState('approve');
  const [agentGrants, setAgentGrants] = useState<any[]>([]);
  const [agentSaving, setAgentSaving] = useState(false);

  // Phase 5: AI Agent token usage — this month's metered usage + budget.
  const [agentUsage, setAgentUsage] = useState<any>(null);

  // Phase 3: AI Agent memories — distilled facts/corrections the agent keeps.
  const [agentMemories, setAgentMemories] = useState<any[]>([]);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [newMemoryKind, setNewMemoryKind] = useState('fact');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState('');

  const loadAgentSettings = async () => {
    try {
      const s = await apiFetch('/api/agent/settings').then(r => r.ok ? r.json() : null);
      if (s) {
        if (s.name) setAgentDisplayName(s.name);
        if (s.mode) setAgentModeSetting(s.mode);
      }
      const g = await apiFetch('/api/agent/grants').then(r => r.ok ? r.json() : null);
      if (g) setAgentGrants(g.grants ?? []);
      const m = await apiFetch('/api/agent/memories').then(r => r.ok ? r.json() : null);
      if (m) setAgentMemories(m.memories ?? []);
      const u = await apiFetch('/api/agent/usage').then(r => r.ok ? r.json() : null);
      if (u) setAgentUsage(u);
    } catch { /* agent settings stay defaulted */ }
  };

  useEffect(() => {
    if (activeTab === 'agent') loadAgentSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const saveAgentSettings = async () => {
    setAgentSaving(true);
    try {
      const res = await apiFetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: agentDisplayName, mode: agentModeSetting }),
      });
      if (!res.ok) throw new Error('Failed to save agent settings');
      toast('success', 'Agent settings saved!');
    } catch {
      toast('error', 'Failed to save agent settings');
    } finally {
      setAgentSaving(false);
    }
  };

  const revokeAgentGrant = async (id: string) => {
    try {
      const res = await apiFetch(`/api/agent/grants/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke grant');
      setAgentGrants(prev => prev.filter(g => g.id !== id));
      toast('success', 'Grant revoked — the agent will ask again for that kind of thing.');
    } catch {
      toast('error', 'Failed to revoke grant');
    }
  };

  const addAgentMemory = async () => {
    if (!newMemoryContent.trim()) return;
    try {
      const res = await apiFetch('/api/agent/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMemoryContent, kind: newMemoryKind }),
      });
      if (!res.ok) throw new Error('Failed to add memory');
      const body = await res.json();
      setAgentMemories(prev => [body.memory, ...prev]);
      setNewMemoryContent('');
      toast('success', 'Memory saved.');
    } catch {
      toast('error', 'Failed to add memory');
    }
  };

  const saveAgentMemoryEdit = async (id: string) => {
    if (!editingMemoryContent.trim()) return;
    try {
      const res = await apiFetch(`/api/agent/memories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingMemoryContent }),
      });
      if (!res.ok) throw new Error('Failed to save memory');
      const body = await res.json();
      setAgentMemories(prev => prev.map(m => (m.id === id ? body.memory : m)));
      setEditingMemoryId(null);
    } catch {
      toast('error', 'Failed to save memory');
    }
  };

  const deleteAgentMemory = async (id: string) => {
    try {
      const res = await apiFetch(`/api/agent/memories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete memory');
      setAgentMemories(prev => prev.filter(m => m.id !== id));
    } catch {
      toast('error', 'Failed to delete memory');
    }
  };

  const saveKey = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      apiFetch('/api/settings/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) }).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { toast('success', 'API key saved!'); qc.invalidateQueries({ queryKey: ['settings', 'api-keys'] }); },
    onError: () => toast('error', 'Failed to save key'),
  });

  const inviteMember = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      apiFetch('/api/settings/team/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) }).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { toast('success', 'Invitation sent!'); qc.invalidateQueries({ queryKey: ['settings', 'team'] }); setShowInviteModal(false); setInviteEmail(''); },
    onError: () => toast('error', 'Failed to send invitation'),
  });

  const changePassword = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      apiFetch('/api/settings/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }).then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); }),
    onSuccess: () => { toast('success', 'Password updated!'); setShowPasswordModal(false); setPwForm({ current: '', next: '', confirm: '' }); },
    onError: () => toast('error', 'Failed to update password'),
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('error', 'Image must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setLogoPreview(reader.result as string); toast('success', 'Logo updated!'); };
    reader.readAsDataURL(file);
  };

  const isConnected = (id: string) => savedKeys.some((k: any) => k.provider.startsWith(id));

  const tabContent: Record<string, React.ReactNode> = {
    billing: <Billing />,
    agent: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">AI Agent</h2>
          <p className="text-[13px] text-text-muted">Name, latitude mode, and what the agent may do on its own.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Identity</h3>
          </div>
          <div className="p-6 space-y-3">
            <label className="block text-[12px] font-medium text-text-muted">Display name</label>
            <input
              value={agentDisplayName}
              onChange={e => setAgentDisplayName(e.target.value)}
              placeholder="AI Agent"
              className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
            />
            <p className="text-[12px] text-text-muted">The name the agent greets you with in the chat panel.</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Latitude mode</h3>
          </div>
          <div className="p-6 space-y-3">
            {([
              { id: 'approve', label: 'Approve', desc: 'The agent states its plan in chat and does exactly what you approve.' },
              { id: 'autonomy', label: 'Autonomy', desc: 'The agent does granted things on its own. A new kind of thing needs approval once, then joins the granted set. Sends, posts, money, deletes, and exports always need your exact approval.' },
              { id: 'read-only', label: 'Read-only', desc: 'The agent sees everything and drafts, but changes nothing on its own.' },
            ] as const).map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setAgentModeSetting(m.id)}
                className={`w-full text-left rounded-[8px] border px-4 py-3 ${agentModeSetting === m.id ? 'border-primary' : 'border-border'}`}
              >
                <span className="block text-[13px] font-semibold text-text-main">{m.label}</span>
                <span className="block text-[12px] text-text-muted mt-0.5">{m.desc}</span>
              </button>
            ))}
            <button
              onClick={saveAgentSettings}
              disabled={agentSaving || !agentDisplayName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-text-main text-bg disabled:opacity-40"
            >
              {agentSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save agent settings
            </button>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Granted in Autonomy mode</h3>
          </div>
          <div className="p-6 space-y-2">
            {agentGrants.length === 0 ? (
              <p className="text-[13px] text-text-muted">Nothing granted yet. In Autonomy mode, approving a new kind of thing once adds it here. Revoking makes the agent ask again.</p>
            ) : (
              agentGrants.map(g => (
                <div key={g.id} className="flex items-center justify-between rounded-[8px] border border-border px-4 py-3">
                  <div>
                    <span className="block text-[13px] font-medium text-text-main">{g.toolName}</span>
                    <span className="block text-[12px] text-text-muted">Granted {new Date(g.grantedAt).toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => revokeAgentGrant(g.id)}
                    className="px-3 py-1.5 rounded-[6px] text-[12px] border border-border text-text-main hover:bg-black/5"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
            <p className="text-[12px] text-text-muted pt-1">Sends, publishing, money, deletes, and exports never appear here — they always need your exact approval.</p>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Memories</h3>
          </div>
          <div className="p-6 space-y-3">
            <p className="text-[12px] text-text-muted">Distilled facts and corrections the agent keeps and uses in every chat. The agent never stores raw conversation, and never changes a memory on its own — only you edit or delete here. Corrections are used first, newest first.</p>
            <div className="flex gap-2">
              <input
                value={newMemoryContent}
                onChange={e => setNewMemoryContent(e.target.value)}
                placeholder="Something for the agent to remember…"
                className="flex-1 px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
              />
              <select
                value={newMemoryKind}
                onChange={e => setNewMemoryKind(e.target.value)}
                className="px-2 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none"
              >
                {(['fact', 'preference', 'correction', 'decision', 'rule'] as const).map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <button
                onClick={addAgentMemory}
                disabled={!newMemoryContent.trim()}
                className="px-4 py-2 rounded-[6px] text-[13px] font-semibold bg-text-main text-bg disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {agentMemories.length === 0 ? (
              <p className="text-[13px] text-text-muted">No memories yet. Say “remember that …” in chat, or add one here.</p>
            ) : (
              agentMemories.map(m => (
                <div key={m.id} className="rounded-[8px] border border-border px-4 py-3">
                  {editingMemoryId === m.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editingMemoryContent}
                        onChange={e => setEditingMemoryContent(e.target.value)}
                        className="flex-1 px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                      />
                      <button onClick={() => saveAgentMemoryEdit(m.id)} className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-text-main text-bg">Save</button>
                      <button onClick={() => setEditingMemoryId(null)} className="px-3 py-1.5 rounded-[6px] text-[12px] border border-border text-text-main">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-block text-[11px] px-1.5 py-0.5 rounded-md border mr-2" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{m.kind}</span>
                        <span className="text-[13px] text-text-main">{m.content}</span>
                        <span className="block text-[12px] text-text-muted mt-0.5">{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingMemoryId(m.id); setEditingMemoryContent(m.content); }} className="px-2.5 py-1 rounded-[6px] text-[12px] border border-border text-text-main hover:bg-black/5">Edit</button>
                        <button onClick={() => deleteAgentMemory(m.id)} className="px-2.5 py-1 rounded-[6px] text-[12px] border border-border text-text-main hover:bg-black/5">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Token usage</h3>
          </div>
          <div className="p-6 space-y-3">
            {!agentUsage ? (
              <p className="text-[13px] text-text-muted">Usage loads with the rest of this tab.</p>
            ) : (
              <>
                <p className="text-[13px] text-text-main">
                  {agentUsage.used.toLocaleString()} of {agentUsage.budget.toLocaleString()} tokens used in {agentUsage.month}
                  {agentUsage.plan ? ` · plan ${agentUsage.plan}` : ''}
                </p>
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, agentUsage.pct)}%` }} />
                </div>
                <p className="text-[12px] text-text-muted">
                  {agentUsage.input.toLocaleString()} input · {agentUsage.output.toLocaleString()} output · {agentUsage.remaining.toLocaleString()} remaining.
                  Budgets are provisional and reset on the 1st of each month. At 100% the agent pauses new chats until the reset.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    ),
    general: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">General</h2>
          <p className="text-[13px] text-text-muted">Workspace name and basic configuration.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Workspace</h3>
          </div>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0 select-none overflow-hidden">
                {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-cover" /> : wsName.charAt(0)}
              </div>
              <div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                <button onClick={() => logoInputRef.current?.click()} className="flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:opacity-80 transition-opacity">
                  <Upload className="w-3.5 h-3.5" /> Upload logo
                </button>
                <p className="text-[11px] text-text-muted mt-0.5">PNG, JPG or SVG. Max 2MB.</p>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Workspace Name</label>
              <input value={wsName} onChange={e => setWsName(e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Workspace ID</label>
              <div className="flex items-center gap-2">
                <input readOnly value={wsId}
                  className="flex-1 px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[12px] text-text-muted font-mono" />
                <button onClick={() => { navigator.clipboard?.writeText(wsId); toast('success', 'Copied!'); }}
                  className="w-8 h-8 flex items-center justify-center rounded-[6px] border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={() => saveWorkspace.mutate()} disabled={saveWorkspace.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm shadow-primary/20">
                {saveWorkspace.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    ),

    appearance: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">Appearance</h2>
          <p className="text-[13px] text-text-muted">Choose how Stone AIO looks for you.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Theme</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {themes.map((t: any) => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={`p-4 rounded-[10px] border-2 transition-all text-left ${theme === t.id ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-text-muted/50'}`}>
                  <div className="flex gap-1 mb-3">
                    <div className="w-full h-14 rounded-[6px] overflow-hidden flex" style={{ background: t.preview.bg }}>
                      <div className="w-1/4 h-full" style={{ background: t.preview.surface }} />
                      <div className="flex-1 p-2">
                        <div className="h-2 rounded-full w-3/4 mb-1.5" style={{ background: t.preview.primary, opacity: 0.7 }} />
                        <div className="h-1.5 rounded-full w-1/2" style={{ background: t.preview.accent, opacity: 0.5 }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-text-main">{t.name}</span>
                    {theme === t.id && (
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),

    integrations: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">Integrations</h2>
          <p className="text-[13px] text-text-muted">Connect third-party services and email accounts to power your platform.</p>
        </div>
        <div className="space-y-3">
          {INTEGRATIONS.map(intg => {
            const isOAuthProvider = Boolean((intg as any).isChannelOAuth);
            const providerType = (intg as any).isChannelOAuth as string | undefined;
            const activeConns = providerType ? (channelConnections || []).filter((c: any) => c.provider === providerType) : [];
            const connected = isConnected(intg.id) || activeConns.length > 0;
            const isOpen = expandedIntegration === intg.id;
            const Icon = intg.icon;

            return (
              <motion.div key={intg.id} className="bg-surface border border-border rounded-[12px] overflow-hidden"
                animate={{ borderColor: isOpen ? 'var(--primary-border, rgba(82,103,125,0.5))' : 'var(--border)' }}>
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-hover/30 transition-colors"
                  onClick={() => setExpandedIntegration(isOpen ? null : intg.id)}
                >
                  <div className={`w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 ${intg.bg}`}>
                    <Icon className={`w-4.5 h-4.5 ${intg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-bold text-text-main">{intg.label}</span>
                      {connected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" /> {activeConns.length > 0 ? `${activeConns.length} Connected` : 'Connected'}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {activeConns.length > 0
                        ? `Connected as ${activeConns.map((c: any) => c.email || c.label).join(', ')}`
                        : intg.desc}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="px-5 pb-5 pt-0 border-t border-border space-y-5 mt-0 pt-4">
                        {isOAuthProvider ? (
                          <div className="space-y-4">
                            {/* Connected Accounts List */}
                            {activeConns.length > 0 ? (
                              <div className="space-y-2">
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Connected Accounts</p>
                                {activeConns.map((conn: any) => (
                                  <div key={conn.id} className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-bg shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                      <div>
                                        <div className="text-[13px] font-bold text-text-main">{conn.email || conn.label || 'Connected Account'}</div>
                                        <div className="text-[11px] text-emerald-400 font-semibold">Active & Ready (Sending & Receiving)</div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => disconnectChannel.mutate(conn.id)}
                                      disabled={disconnectChannel.isPending}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                      <Unlink className="w-3.5 h-3.5" /> Disconnect
                                    </button>
                                  </div>
                                ))}

                                <div className="pt-2">
                                  <button
                                    onClick={() => providerType === 'gmail' ? channelConnectionsApi.connectGmail() : channelConnectionsApi.connectOutlook()}
                                    className="flex items-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-lg text-[12px] font-bold transition-all shadow-sm"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Connect Another {providerType === 'gmail' ? 'Gmail' : 'Outlook'} Account
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-5 rounded-xl border border-border bg-bg/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                  <div className={`w-11 h-11 rounded-xl ${intg.bg} flex items-center justify-center shrink-0`}>
                                    <Icon className={`w-5 h-5 ${intg.color}`} />
                                  </div>
                                  <div>
                                    <div className="text-[14px] font-bold text-text-main">Connect your {providerType === 'gmail' ? 'Gmail' : 'Outlook'} Account</div>
                                    <div className="text-[12px] text-text-muted mt-0.5">Authorizes Stone AIO to send & receive customer emails securely.</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => providerType === 'gmail' ? channelConnectionsApi.connectGmail() : channelConnectionsApi.connectOutlook()}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-[13px] font-bold shadow-md transition-all shrink-0 cursor-pointer"
                                >
                                  <Mail className="w-4 h-4" /> Connect {providerType === 'gmail' ? 'Gmail' : 'Outlook'}
                                </button>
                              </div>
                            )}

                            {/* Collapsible API Keys Section */}
                            <div className="pt-3 border-t border-border/60">
                              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Custom OAuth Credentials (Optional)</p>
                              <div className="space-y-3">
                                {intg.fields.map(field => (
                                  <div key={field.key}>
                                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">{field.label}</label>
                                    <FieldInput
                                      type={field.type}
                                      placeholder={field.placeholder}
                                      value={keyValues[field.key] || ''}
                                      onChange={v => setKeyValues(prev => ({ ...prev, [field.key]: v }))}
                                    />
                                  </div>
                                ))}
                                <button
                                  onClick={async () => {
                                    try {
                                      const promises = intg.fields.map(f =>
                                        keyValues[f.key] ? saveKey.mutateAsync({ provider: f.key, key: keyValues[f.key] }) : Promise.resolve()
                                      );
                                      await Promise.all(promises);
                                    } catch { toast('error', 'One or more keys failed to save'); }
                                  }}
                                  disabled={saveKey.isPending}
                                  className="flex items-center gap-2 px-3.5 py-1.5 bg-surface-hover border border-border text-text-main rounded-md text-[12px] font-semibold hover:bg-surface transition-colors"
                                >
                                  {saveKey.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                  Save Custom Keys
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {intg.fields.map(field => (
                              <div key={field.key}>
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">{field.label}</label>
                                <FieldInput
                                  type={field.type}
                                  placeholder={field.placeholder}
                                  value={keyValues[field.key] || ''}
                                  onChange={v => setKeyValues(prev => ({ ...prev, [field.key]: v }))}
                                />
                              </div>
                            ))}
                            <button
                              onClick={async () => {
                                try {
                                  const promises = intg.fields.map(f =>
                                    keyValues[f.key] ? saveKey.mutateAsync({ provider: f.key, key: keyValues[f.key] }) : Promise.resolve()
                                  );
                                  await Promise.all(promises);
                                } catch { toast('error', 'One or more keys failed to save'); }
                              }}
                              disabled={saveKey.isPending}
                              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {saveKey.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              Save {intg.label} Keys
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    ),

    api: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">API & Webhooks</h2>
          <p className="text-[13px] text-text-muted">Connect external applications and lead capture forms to your CRM.</p>
        </div>

        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-surface-hover/20">
            <h3 className="text-[13px] font-bold text-text-main">Lead Capture Form Webhook</h3>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-[13px] text-text-muted leading-relaxed">
              Use this webhook URL in your external websites to automatically send new leads into Stone AIO.
              The form should send a <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">POST</code> request with a JSON payload containing <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">firstName</code>, <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">lastName</code>, <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">email</code>, and <code className="text-primary font-mono text-[11px] bg-primary/10 px-1 py-0.5 rounded">phone</code>.
            </p>

            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Webhook URL</label>
              <div className="flex items-center gap-2">
                <input readOnly value={`${window.location.origin}/f/${wsId}`}
                  className="flex-1 px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[12px] text-text-main font-mono focus:outline-none focus:ring-1 focus:ring-primary/50" />
                <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/f/${wsId}`); toast('success', 'Copied URL!'); }}
                  className="w-9 h-9 flex items-center justify-center rounded-[6px] border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors bg-bg shrink-0">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-bg rounded-lg border border-border mt-6 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-hover/30">
                <h4 className="text-[12px] font-bold text-text-main">Example JavaScript Payload</h4>
                <button onClick={() => { 
                  const code = `fetch('${window.location.origin}/f/${wsId}', {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    firstName: 'John',\n    lastName: 'Doe',\n    email: 'john@example.com',\n    phone: '555-0199'\n  })\n});`;
                  navigator.clipboard?.writeText(code); 
                  toast('success', 'Copied code snippet!'); 
                }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border border-border bg-surface text-[11px] font-semibold text-text-muted hover:text-primary hover:border-primary/40 transition-colors">
                  <Copy className="w-3 h-3" /> Copy Code
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="text-[12px] font-mono text-text-muted whitespace-pre">
{`fetch('${window.location.origin}/f/${wsId}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '555-0199'
  })
});`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),

    notifications: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">Notifications</h2>
          <p className="text-[13px] text-text-muted">Control which platform events create notifications.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/20 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-text-main">In-App Notifications</h3>
            <button onClick={() => setNotifPrefs(p => Object.fromEntries(Object.keys(p).map(k => [k, true])))}
              className="text-[11px] text-primary hover:opacity-80 font-semibold">Enable all</button>
          </div>
          <div className="divide-y divide-border/40">
            {NOTIF_PREFS.map(item => (
              <div key={item.key} className="flex items-center justify-between px-6 py-4 hover:bg-surface-hover/20 transition-colors group">
                <div>
                  <div className="text-[13px] font-semibold text-text-main">{item.label}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">{item.desc}</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={notifPrefs[item.key] ?? true}
                    onChange={e => setNotifPrefs(p => ({ ...p, [item.key]: e.target.checked }))} className="sr-only peer" />
                  <div className="w-9 h-5 bg-border rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-surface after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border bg-surface-hover/20">
            <button onClick={() => toast('success', 'Notification preferences saved!')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity">
              <Save className="w-3.5 h-3.5" /> Save Preferences
            </button>
          </div>
        </div>
      </div>
    ),

    team: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">Team</h2>
          <p className="text-[13px] text-text-muted">Manage workspace members and their roles.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-surface-hover/20 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-text-main">Members ({members.length || 1})</h3>
            <button onClick={() => setShowInviteModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Invite Member
            </button>
          </div>
          <div className="divide-y divide-border/40">
            <div className="flex items-center gap-4 px-6 py-4 hover:bg-surface-hover/20 transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">JS</div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-text-main">Jack Stone</div>
                <div className="text-[11px] text-text-muted">jack@stoneaio.com</div>
              </div>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">Admin</span>
            </div>
            {members.length === 0 && (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 bg-surface-hover rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-text-muted" />
                </div>
                <p className="text-[14px] font-semibold text-text-main mb-1">Just you for now</p>
                <p className="text-[12px] text-text-muted">Invite team members to collaborate.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    ),

    security: (
      <div className="space-y-6">
        <div>
          <h2 className="text-[18px] font-bold text-text-main mb-0.5">Security</h2>
          <p className="text-[13px] text-text-muted">Manage password, 2FA, and active sessions.</p>
        </div>
        <div className="bg-surface border border-border rounded-[12px] overflow-hidden">
          <div className="divide-y divide-border/40">
            <div className="flex items-center justify-between px-6 py-5 hover:bg-surface-hover/20 transition-colors">
              <div>
                <div className="text-[13px] font-semibold text-text-main">Change Password</div>
                <div className="text-[11px] text-text-muted mt-0.5">Update your account password</div>
              </div>
              <button onClick={() => setShowPasswordModal(true)} className="px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">Change</button>
            </div>
            <div className="flex items-center justify-between px-6 py-5 hover:bg-surface-hover/20 transition-colors">
              <div>
                <div className="text-[13px] font-semibold text-text-main">Two-Factor Authentication</div>
                <div className="text-[11px] text-text-muted mt-0.5">2FA adds an extra layer of security</div>
              </div>
              <button onClick={() => { apiFetch('/api/settings/2fa/setup').then(r => r.json()).then(d => { setTwoFASetup(d); setShowTwoFAModal(true); }); }} className="px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">Enable</button>
            </div>
            <div className="flex items-center justify-between px-6 py-5 hover:bg-surface-hover/20 transition-colors">
              <div>
                <div className="text-[13px] font-semibold text-text-main">Active Sessions</div>
                <div className="text-[11px] text-text-muted mt-0.5">Manage where you are logged in</div>
              </div>
              <button onClick={() => { apiFetch('/api/settings/sessions').then(r => r.json()).then(d => { setSessions(d); setShowSessionsModal(true); }); }} className="px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">View</button>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  // ── Modals ────────────────────────────────────────────────────────────────
  const modalBase = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  const card = 'bg-surface border border-border rounded-[16px] w-full max-w-md p-6 shadow-2xl';

  return (
    <>
      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className={modalBase} onClick={() => setShowInviteModal(false)}>
          <div className={card} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold text-text-main">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Email Address</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                  className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] focus:outline-none focus:border-primary">
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 px-4 py-2 border border-border rounded-[8px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
              <button onClick={() => { if (inviteEmail) inviteMember.mutate({ email: inviteEmail, role: inviteRole }); }} disabled={!inviteEmail || inviteMember.isPending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {inviteMember.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className={modalBase} onClick={() => setShowPasswordModal(false)}>
          <div className={card} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold text-text-main">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              {(['current', 'next', 'confirm'] as const).map(k => (
                <div key={k}>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                    {k === 'current' ? 'Current Password' : k === 'next' ? 'New Password' : 'Confirm New Password'}
                  </label>
                  <input type="password" value={pwForm[k]} onChange={e => setPwForm(p => ({ ...p, [k]: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] focus:outline-none focus:border-primary" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPasswordModal(false)} className="flex-1 px-4 py-2 border border-border rounded-[8px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
              <button
                onClick={() => {
                  if (pwForm.next !== pwForm.confirm) { toast('error', 'Passwords do not match'); return; }
                  changePassword.mutate({ currentPassword: pwForm.current, newPassword: pwForm.next });
                }}
                disabled={!pwForm.current || !pwForm.next || changePassword.isPending}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
                {changePassword.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</> : 'Update Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Setup Modal */}
      {showTwoFAModal && twoFASetup && (
        <div className={modalBase} onClick={() => setShowTwoFAModal(false)}>
          <div className={card} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold text-text-main">Enable Two-Factor Auth</h3>
              <button onClick={() => setShowTwoFAModal(false)} className="text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[12px] text-text-muted mb-4">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).</p>
            <div className="flex justify-center mb-4">
              <img src={twoFASetup.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 rounded-lg border border-border" />
            </div>
            <p className="text-[11px] text-text-muted text-center mb-4">Manual key: <code className="font-mono text-primary">{twoFASetup.secret}</code></p>
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">Verification Code</label>
              <input type="text" maxLength={6} value={twoFACode} onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000" className="w-full px-3 py-2 bg-bg border border-border rounded-[6px] text-[13px] font-mono tracking-widest text-center focus:outline-none focus:border-primary" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowTwoFAModal(false)} className="flex-1 px-4 py-2 border border-border rounded-[8px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
              <button
                onClick={() => apiFetch('/api/settings/2fa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: twoFACode }) }).then(r => r.json()).then(d => { if (d.success) { toast('success', '2FA enabled!'); setShowTwoFAModal(false); } else toast('error', 'Invalid code'); })}
                disabled={twoFACode.length !== 6}
                className="flex-1 px-4 py-2 bg-primary text-white rounded-[8px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50">
                Verify & Enable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions Modal */}
      {showSessionsModal && (
        <div className={modalBase} onClick={() => setShowSessionsModal(false)}>
          <div className={card} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[16px] font-bold text-text-main">Active Sessions</h3>
              <button onClick={() => setShowSessionsModal(false)} className="text-text-muted hover:text-text-main"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {sessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-[8px]">
                  <Monitor className="w-4 h-4 text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-text-main flex items-center gap-2">
                      {s.device} {s.isCurrent && <span className="text-[10px] font-bold text-green bg-green/10 px-2 py-0.5 rounded-full">Current</span>}
                    </div>
                    <div className="text-[11px] text-text-muted">{s.location} · {s.ip}</div>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => apiFetch(`/api/settings/sessions/${s.id}`, { method: 'DELETE' }).then(() => { setSessions(p => p.filter(x => x.id !== s.id)); toast('success', 'Session revoked'); })} className="text-red hover:bg-red/10 p-1.5 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setShowSessionsModal(false)} className="w-full mt-4 px-4 py-2 border border-border rounded-[8px] text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Close</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden bg-bg">
        {/* Left sidebar */}
        <div className="w-[220px] shrink-0 border-r border-border bg-surface/30 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border">
            <h2 className="text-[15px] font-bold text-text-main">Settings</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Manage workspace preferences</p>
          </div>
          <nav className="p-3 space-y-0.5">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearchParams({ tab: tab.id }, { replace: true });
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-all text-left ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className={activeTab === 'billing' ? 'w-full max-w-6xl mx-auto' : 'max-w-[680px]'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {tabContent[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
