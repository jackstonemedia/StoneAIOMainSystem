import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  User, Palette, Bell, Key, Users, Shield, Save, Check, Building2,
  Plug, Globe, Phone, Mail, Mic, Copy, Eye, EyeOff, Plus, Trash2,
  ChevronRight, Edit2, RefreshCw, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../components/ui/Toast';

const TABS = [
  { id: 'general',       label: 'General',       icon: Building2 },
  { id: 'appearance',    label: 'Appearance',     icon: Palette },
  { id: 'integrations',  label: 'Integrations',   icon: Plug },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'team',          label: 'Team',           icon: Users },
  { id: 'security',      label: 'Security',       icon: Shield },
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
      { key: 'twilio_sid',    label: 'Account SID',    placeholder: 'ACxxxxxxxxxxxxxxxxxx',        type: 'text' },
      { key: 'twilio_token',  label: 'Auth Token',     placeholder: '••••••••••••••••••••••••••••', type: 'password' },
      { key: 'twilio_from',   label: 'From Number',    placeholder: '+1 (555) 000-0000',           type: 'text' },
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
    id: 'retell',
    label: 'Retell AI',
    desc: 'Power your voice agents with Retell conversational AI',
    icon: Mic,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    fields: [
      { key: 'retell', label: 'API Key', placeholder: 'key_xxxxxxxxxxxx', type: 'password' },
    ],
  },
  {
    id: 'google',
    label: 'Google',
    desc: 'Google Calendar sync, My Business reviews, and OAuth',
    icon: Globe,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    fields: [
      { key: 'google_client_id',     label: 'OAuth Client ID',     placeholder: 'xxxx.apps.googleusercontent.com', type: 'text' },
      { key: 'google_client_secret', label: 'OAuth Client Secret', placeholder: 'GOCSPX-xxxxxxxxxxxx',            type: 'password' },
    ],
  },
];

const NOTIF_PREFS = [
  { key: 'new_contact',     label: 'New Contact Added',       desc: 'When a contact is created via form or import' },
  { key: 'deal_won',        label: 'Deal Won',                desc: 'When a deal moves to Won stage' },
  { key: 'task_overdue',    label: 'Task Overdue',            desc: '24h before a task is due with no completion' },
  { key: 'campaign_sent',   label: 'Campaign Sent',           desc: 'When a campaign finishes sending' },
  { key: 'review_received', label: 'New Review',              desc: 'When a new customer review is received' },
  { key: 'apt_created',     label: 'Appointment Booked',      desc: 'When a new appointment is scheduled' },
  { key: 'inbound_sms',     label: 'Inbound SMS',             desc: 'When a contact sends a message' },
  { key: 'weekly_summary',  label: 'Weekly Summary',          desc: 'A weekly digest of key performance metrics' },
];

function fieldInput(props: { type?: string; placeholder?: string; value: string; onChange: (v: string) => void }) {
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
  const [activeTab, setActiveTab] = useState('general');
  const [wsName, setWsName] = useState('Stone AIO');
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIF_PREFS.map(n => [n.key, true]))
  );
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);

  const { data: workspace } = useQuery<any>({
    queryKey: ['settings', 'workspace'],
    queryFn: () => fetch('/api/settings/workspace').then(r => r.ok ? r.json() : null),
    onSuccess: (d: any) => { if (d?.name) setWsName(d.name); }
  } as any);

  const { data: savedKeys = [] } = useQuery<any[]>({
    queryKey: ['settings', 'api-keys'],
    queryFn: () => fetch('/api/settings/api-keys').then(r => r.ok ? r.json() : []),
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ['settings', 'team'],
    queryFn: () => fetch('/api/settings/team').then(r => r.ok ? r.json() : []),
  });

  const saveWorkspace = useMutation({
    mutationFn: () => fetch('/api/settings/workspace', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: wsName }) }).then(r => r.json()),
    onSuccess: () => { toast('success', 'Settings saved!'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => toast('error', 'Failed to save settings'),
  });

  const saveKey = useMutation({
    mutationFn: ({ provider, key }: { provider: string; key: string }) =>
      fetch('/api/settings/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) }).then(r => r.json()),
    onSuccess: () => { toast('success', 'API key saved!'); qc.invalidateQueries({ queryKey: ['settings', 'api-keys'] }); },
    onError: () => toast('error', 'Failed to save key'),
  });

  const isConnected = (id: string) => savedKeys.some((k: any) => k.provider.startsWith(id));

  const tabContent: Record<string, React.ReactNode> = {
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
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shrink-0 select-none">
                {wsName.charAt(0)}
              </div>
              <div>
                <button className="text-[13px] font-semibold text-primary hover:opacity-80 transition-opacity">Upload logo</button>
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
                <input readOnly value="ws_default_stone_aio"
                  className="flex-1 px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[12px] text-text-muted font-mono" />
                <button onClick={() => { navigator.clipboard?.writeText('ws_default_stone_aio'); toast('success', 'Copied!'); }}
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
          <p className="text-[13px] text-text-muted">Connect third-party services to power your platform.</p>
        </div>
        <div className="space-y-3">
          {INTEGRATIONS.map(intg => {
            const connected = isConnected(intg.id);
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
                          <CheckCircle2 className="w-2.5 h-2.5" /> Connected
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-text-muted mt-0.5">{intg.desc}</p>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-text-muted transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
                      <div className="px-5 pb-5 pt-0 border-t border-border space-y-4 mt-0 pt-4">
                        {intg.fields.map(field => (
                          <div key={field.key}>
                            <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1.5">{field.label}</label>
                            {fieldInput({
                              type: field.type,
                              placeholder: field.placeholder,
                              value: keyValues[field.key] || '',
                              onChange: v => setKeyValues(prev => ({ ...prev, [field.key]: v })),
                            })}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const promises = intg.fields.map(f =>
                              keyValues[f.key] ? saveKey.mutateAsync({ provider: f.key, key: keyValues[f.key] }) : Promise.resolve()
                            );
                            Promise.all(promises);
                          }}
                          disabled={saveKey.isPending}
                          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {saveKey.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save {intg.label} Keys
                        </button>
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
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-semibold hover:opacity-90 transition-opacity">
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
            {[
              { label: 'Change Password', desc: 'Update your account password', action: 'Change' },
              { label: 'Two-Factor Authentication', desc: '2FA is not enabled — add extra security', action: 'Enable' },
              { label: 'Active Sessions', desc: 'Manage where you are logged in', action: 'View' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-5 hover:bg-surface-hover/20 transition-colors">
                <div>
                  <div className="text-[13px] font-semibold text-text-main">{item.label}</div>
                  <div className="text-[11px] text-text-muted mt-0.5">{item.desc}</div>
                </div>
                <button className="px-3 py-1.5 border border-border rounded-[6px] text-[12px] font-semibold text-text-muted hover:text-text-main hover:border-primary/40 transition-colors">
                  {item.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[7px] text-[13px] transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                }`}>
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[680px]">
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
  );
}
