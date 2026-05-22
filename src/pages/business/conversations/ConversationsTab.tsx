import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, X, MessageSquare, Users, Lock,
  Send, Phone, Mail, Paperclip, CheckCheck,
  ExternalLink, Star, Inbox, AtSign, UserCheck,
  ChevronRight, Settings, Check,
  MoreVertical, Clock, Zap, Smartphone,
  Facebook, Instagram, Linkedin, Video,
  Trash2, Edit2, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import type { Conversation as ApiConversation, ConversationChannel, EmailMessageMeta } from '../../../types/conversation';
import { parseEmailMeta } from '../../../types/conversation';
import {
  useConversations, useConversationMessages, useSendMessage,
  usePatchConversation, useMarkRead, useChannelConnections,
  useDisconnectChannel, useCreateConversation, useDeleteConversation,
} from '../../../hooks/useConversations';
import { crmApi } from '../../../lib/api/crm';
import { conversationsApi, channelConnectionsApi } from '../../../lib/api/conversations';

// ─── Types ───────────────────────────────────────────────────

type Channel = ConversationChannel;
type FilterMode = 'all' | 'unread' | 'starred';
type PanelKey = 'contact' | 'team' | 'my-inbox' | 'internal' | 'assigned' | 'starred' | 'settings';

// ─── Helpers ─────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}

function formatEmailDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const CH_LABEL: Record<Channel, string> = {
  sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', chat: 'Live Chat',
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn'
};
const CH_COLOR: Record<Channel, string> = {
  sms: '#7dd3fc', email: '#c4b5fd', whatsapp: '#86efac', chat: '#fbbf24',
  facebook: '#1877F2', instagram: '#E4405F', tiktok: '#ff0050', linkedin: '#0A66C2'
};
const CH_ICON: Record<string, React.ComponentType<any>> = {
  sms: Smartphone, email: Mail, whatsapp: Phone, chat: MessageSquare,
  facebook: Facebook, instagram: Instagram, tiktok: Video, linkedin: Linkedin
};

function contactDisplayName(c: ApiConversation['contact']): string {
  if (!c) return 'Unknown';
  const full = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();
  return full || c.email || 'Unknown';
}
function contactInitials(c: ApiConversation['contact']): string {
  if (!c) return '?';
  return ((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || c.email?.[0]?.toUpperCase() || '?';
}

// ─── Shared class constants ───────────────────────────────────

const FROSTED_GLASS_CLASSES = "bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5";
const FROSTED_HEADER_CLASSES = "bg-surface/80 backdrop-blur-md border-b border-border/50";

// ─── Right Nav definition ─────────────────────────────────────

const RIGHT_NAV: { key: PanelKey; icon: any; label: string; badge?: number }[] = [
  { key: 'contact',   icon: UserCheck,  label: 'Contact'    },
  { key: 'team',      icon: Inbox,      label: 'Team Inbox', badge: 3 },
  { key: 'my-inbox',  icon: AtSign,     label: 'My Inbox',   badge: 2 },
  { key: 'internal',  icon: Lock,       label: 'Internal'   },
  { key: 'assigned',  icon: Users,      label: 'Assigned'   },
  { key: 'starred',   icon: Star,       label: 'Starred'    },
  { key: 'settings',  icon: Settings,   label: 'Settings'   },
];

// ─── Email HTML Viewer (sandboxed iframe) ─────────────────────

function EmailHtmlViewer({ html, plain }: { html: string | null; plain: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const [expanded, setExpanded] = useState(false);
  const MAX_COLLAPSED = 220;

  const content = html
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{margin:0;padding:8px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#e2e8f0;background:transparent;word-break:break-word;}
        a{color:#818cf8;}
        img{max-width:100%;height:auto;}
        blockquote{border-left:3px solid #4b5563;margin:8px 0;padding-left:12px;color:#94a3b8;}
        pre,code{background:#1e293b;padding:2px 6px;border-radius:4px;font-size:12px;}
        table{max-width:100%;border-collapse:collapse;}
        td,th{padding:4px 8px;border:1px solid #374151;}
      </style></head><body>${html}</body></html>`
    : null;

  useEffect(() => {
    if (!iframeRef.current || !content) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(content);
    doc.close();
    const resize = () => {
      const h = doc.body?.scrollHeight ?? 120;
      setHeight(h + 16);
    };
    iframe.addEventListener('load', resize);
    setTimeout(resize, 100);
    return () => iframe.removeEventListener('load', resize);
  }, [content]);

  if (!content) {
    // Plain-text fallback — render whitespace-preserved
    return (
      <pre className="whitespace-pre-wrap break-words text-[13px] leading-[1.6] text-text-main font-sans m-0">
        {plain}
      </pre>
    );
  }

  const isLong = height > MAX_COLLAPSED;
  const displayHeight = isLong && !expanded ? MAX_COLLAPSED : height;

  return (
    <div className="relative w-full">
      <div style={{ height: displayHeight, overflow: 'hidden', transition: 'height 0.2s ease' }}>
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin"
          scrolling="no"
          className="w-full border-0 block"
          style={{ height: height, background: 'transparent' }}
          title="email-body"
        />
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-primary hover:opacity-70 transition-opacity"
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Show more</>}
        </button>
      )}
    </div>
  );
}

// ─── Email Message Bubble ─────────────────────────────────────

function EmailMessageCard({
  msg,
  contactColor,
  contactInitialsStr,
}: {
  msg: ApiConversation['messages'] extends (infer M)[] | undefined ? M : never;
  contactColor: string;
  contactInitialsStr: string;
}) {
  const fromUs = (msg as any).direction === 'outbound';
  const meta: EmailMessageMeta | null = parseEmailMeta((msg as any).attachments);
  const subject = meta?.subject;
  const htmlBody = meta?.htmlBody ?? null;
  const fromLabel = fromUs
    ? `To: ${meta?.toEmail ?? 'Unknown'}`
    : `From: ${meta?.fromEmail ?? (msg as any).sender ?? 'Unknown'}`;
  const dateStr = meta?.date
    ? formatEmailDate(meta.date)
    : formatEmailDate((msg as any).createdAt);

  return (
    <div className={`flex flex-col gap-0 animate-fade-up ${fromUs ? 'items-end' : 'items-start'}`}>
      {/* Email card */}
      <div className={`w-full max-w-[92%] rounded-[10px] border overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.15)] ${
        fromUs
          ? 'bg-primary/5 border-primary/25'
          : 'bg-surface border-border'
      }`}>
        {/* Email header bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${fromUs ? 'border-primary/20 bg-primary/10' : 'border-border/60 bg-bg/60'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {!fromUs && (
              <div
                className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[9px] font-bold text-bg shrink-0 shadow-sm border border-border/30"
                style={{ backgroundColor: contactColor }}
              >
                {contactInitialsStr}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-text-muted truncate">{fromLabel}</p>
              {subject && (
                <p className="text-[12px] font-semibold text-text-main truncate leading-tight mt-0.5">{subject}</p>
              )}
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-medium shrink-0 ml-3">{dateStr}</span>
        </div>
        {/* Email body */}
        <div className="px-4 py-3">
          <EmailHtmlViewer html={htmlBody} plain={(msg as any).body ?? ''} />
        </div>
      </div>
      {/* Status row */}
      <div className={`flex items-center gap-1.5 px-1 mt-1 text-[10px] font-bold uppercase tracking-wider ${fromUs ? 'text-text-muted/70' : 'text-text-muted/50'}`}>
        {fromUs && (msg as any).status === 'read'      && <CheckCheck className="w-3.5 h-3.5 text-primary drop-shadow-sm ml-0.5" />}
        {fromUs && (msg as any).status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-main ml-0.5" />}
        {fromUs && (msg as any).status === 'sent'      && <Check className="w-3.5 h-3.5 ml-0.5" />}
        <span>{fromUs ? 'Sent' : 'Received'} · {dateStr}</span>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────

function DeleteConfirmDialog({
  label,
  onConfirm,
  onCancel,
  loading,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`w-[360px] rounded-[16px] p-6 ${FROSTED_GLASS_CLASSES}`}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-accent-red/10 border border-accent-red/20 shrink-0">
            <AlertTriangle className="w-5 h-5 text-accent-red" />
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-bold text-text-main mb-1">Delete conversation?</p>
            <p className="text-[12px] font-medium text-text-muted leading-snug">
              "{label}" and all its messages will be permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold border border-border/50 text-text-muted hover:text-text-main hover:border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold bg-accent-red/90 hover:bg-accent-red text-white border border-accent-red disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Edit Subject Dialog ──────────────────────────────────────

function EditSubjectDialog({
  current,
  onSave,
  onCancel,
  loading,
}: {
  current: string;
  onSave: (subject: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [value, setValue] = useState(current);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className={`w-[420px] rounded-[16px] p-6 ${FROSTED_GLASS_CLASSES}`}
      >
        <p className="text-[15px] font-bold text-text-main mb-4">Edit subject</p>
        <input
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(value); if (e.key === 'Escape') onCancel(); }}
          className="w-full px-3 py-2.5 rounded-[8px] border border-border/50 bg-bg text-[13px] text-text-main focus:outline-none focus:border-primary/50 transition-colors"
          placeholder="Email subject…"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold border border-border/50 text-text-muted hover:text-text-main transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onSave(value)}
            disabled={loading}
            className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold bg-primary text-bg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────

function SettingsPanel({ showToast }: { showToast: (t: 'success' | 'error' | 'info' | 'warning', msg: string) => void }) {
  const { data: connections = [], refetch: refetchConnections } = useChannelConnections();
  const disconnectMutation = useDisconnectChannel();

  // Social integration status (facebook, instagram, etc.) — reserved for future use
  useEffect(() => {
    fetch('/api/integrations').then(r => r.json()).catch(console.error);
  }, []);

  const [showSmsForm, setShowSmsForm]     = useState(false);
  const [smsForm, setSmsForm]             = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [smsConnecting, setSmsConnecting] = useState(false);
  const [smsError, setSmsError]           = useState<string | null>(null);

  const handleConnectSms = async () => {
    setSmsError(null);
    setSmsConnecting(true);
    try {
      await channelConnectionsApi.connectSms(smsForm);
      setShowSmsForm(false);
      setSmsForm({ accountSid: '', authToken: '', phoneNumber: '' });
      refetchConnections();
      showToast('success', 'SMS connected successfully.');
    } catch (e: any) {
      setSmsError(e.message ?? 'Failed to connect.');
    } finally {
      setSmsConnecting(false);
    }
  };

  const smsConnections = connections.filter(c => c.provider === 'twilio');
  const appUrl = window.location.origin;

  return (
    <div className="flex flex-col h-full overflow-y-auto text-[12px]">
      <div className={`px-4 py-4 border-b border-border/40 shrink-0 sticky top-0 z-10 ${FROSTED_HEADER_CLASSES}`}>
        <p className="text-[12px] font-bold text-text-main">Workspace Connections</p>
        <p className="text-[10.5px] text-text-muted mt-1 leading-snug">Connect your email and messaging accounts.</p>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Email</p>

        {/* Gmail */}
        <div className="flex items-center justify-between p-3 border border-border/40 rounded-xl bg-surface/30 hover:border-border transition-all">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-bg shadow-sm" style={{ backgroundColor: CH_COLOR['email'] }}>
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-text-main">Gmail</div>
              <div className={`text-[10px] font-medium mt-0.5 ${connections.some(c => c.provider === 'gmail' && c.isActive) ? 'text-accent-green' : 'text-text-muted'}`}>
                {connections.filter(c => c.provider === 'gmail').map(c => c.email ?? 'Connected').join(', ') || 'Not Connected'}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {connections.filter(c => c.provider === 'gmail').map(conn => (
              <button key={conn.id}
                onClick={() => disconnectMutation.mutate(conn.id, { onSuccess: () => showToast('info', 'Gmail disconnected.') })}
                className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold border border-border/50 text-text-muted hover:border-accent-red/30 hover:text-accent-red hover:bg-accent-red/10 transition-all">
                Disconnect
              </button>
            ))}
            <button onClick={() => channelConnectionsApi.connectGmail()}
              className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold bg-primary text-bg shadow-sm hover:opacity-90 transition-all">
              + Connect
            </button>
          </div>
        </div>

        {/* Outlook */}
        <div className="flex items-center justify-between p-3 border border-border/40 rounded-xl bg-surface/30 hover:border-border transition-all">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-bg shadow-sm" style={{ backgroundColor: '#0078d4' }}>
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[12px] font-bold text-text-main">Outlook</div>
              <div className={`text-[10px] font-medium mt-0.5 ${connections.some(c => c.provider === 'outlook' && c.isActive) ? 'text-accent-green' : 'text-text-muted'}`}>
                {connections.filter(c => c.provider === 'outlook').map(c => c.email ?? 'Connected').join(', ') || 'Not Connected'}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap justify-end">
            {connections.filter(c => c.provider === 'outlook').map(conn => (
              <button key={conn.id}
                onClick={() => disconnectMutation.mutate(conn.id, { onSuccess: () => showToast('info', 'Outlook disconnected.') })}
                className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold border border-border/50 text-text-muted hover:border-accent-red/30 hover:text-accent-red hover:bg-accent-red/10 transition-all">
                Disconnect
              </button>
            ))}
            <button onClick={() => channelConnectionsApi.connectOutlook()}
              className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold bg-primary text-bg shadow-sm hover:opacity-90 transition-all">
              + Connect
            </button>
          </div>
        </div>

        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest pt-2">SMS</p>

        {/* Twilio SMS */}
        <div className="border border-border/40 rounded-xl bg-surface/30 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-bg shadow-sm" style={{ backgroundColor: CH_COLOR['sms'] }}>
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[12px] font-bold text-text-main">SMS / Twilio</div>
                <div className={`text-[10px] font-medium mt-0.5 ${smsConnections.length > 0 ? 'text-accent-green' : 'text-text-muted'}`}>
                  {smsConnections.length > 0 ? smsConnections.map(c => c.twilioPhoneNumber ?? 'Connected').join(', ') : 'Not Connected'}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              {smsConnections.map(conn => (
                <button key={conn.id}
                  onClick={() => disconnectMutation.mutate(conn.id, { onSuccess: () => showToast('info', 'SMS disconnected.') })}
                  className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold border border-border/50 text-text-muted hover:border-accent-red/30 hover:text-accent-red hover:bg-accent-red/10 transition-all">
                  Disconnect
                </button>
              ))}
              <button onClick={() => setShowSmsForm(f => !f)}
                className="px-3 py-1.5 rounded-[6px] text-[11px] font-bold bg-primary text-bg shadow-sm hover:opacity-90 transition-all">
                + Connect
              </button>
            </div>
          </div>
          <AnimatePresence>
            {showSmsForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-2 pt-2 border-t border-border/40">
                  {(['accountSid', 'authToken', 'phoneNumber'] as const).map(field => (
                    <div key={field}>
                      <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        {field === 'accountSid' ? 'Account SID' : field === 'authToken' ? 'Auth Token' : 'Phone Number (E.164)'}
                      </label>
                      <input
                        type={field === 'authToken' ? 'password' : 'text'}
                        value={smsForm[field]}
                        onChange={e => setSmsForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={field === 'phoneNumber' ? '+1234567890' : ''}
                        className="w-full px-3 py-2 rounded-[6px] border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                  ))}
                  {smsError && <p className="text-[11px] text-accent-red font-medium">{smsError}</p>}
                  <button onClick={handleConnectSms} disabled={smsConnecting}
                    className="w-full py-2 rounded-[8px] text-[12px] font-bold bg-primary text-bg hover:opacity-90 disabled:opacity-50 transition-all">
                    {smsConnecting ? 'Connecting…' : 'Connect Twilio'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inbound webhook URLs */}
        <div className="pt-2 space-y-2">
          <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Webhook URLs</p>
          {[
            { label: 'Twilio SMS', path: '/api/hooks/twilio-sms' },
            { label: 'Meta (FB/IG)', path: '/api/hooks/meta' },
          ].map(({ label, path }) => (
            <div key={path} className="flex items-center justify-between p-2.5 rounded-[8px] border border-border/40 bg-bg/50">
              <span className="text-[11px] font-bold text-text-muted">{label}</span>
              <div className="flex items-center gap-1.5">
                <code className="text-[10px] text-text-muted font-mono bg-surface px-1.5 py-0.5 rounded-[4px] max-w-[200px] truncate">{appUrl}{path}</code>
                <button onClick={() => { navigator.clipboard.writeText(`${appUrl}${path}`); showToast('success', 'Copied!'); }}
                  className="text-[10px] font-bold text-primary hover:opacity-70 transition-opacity">Copy</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Right Slide-out Sub Panel ────────────────────────────────

function RightSubPanel({
  panelKey, contact, convos, onSelectConvo, showToast,
}: {
  panelKey: PanelKey;
  contact: ApiConversation['contact'];
  convos: ApiConversation[];
  onSelectConvo: (id: string) => void;
  showToast: (t: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}) {
  const inboxGroups = {
    team:      [{ label: 'Unassigned',   count: 12 }, { label: 'Customer Support', count: 8 }, { label: 'Sales',  count: 3 }],
    'my-inbox':[{ label: 'Assigned to me', count: 5 }, { label: 'Mentions',       count: 2 }],
    internal:  [{ label: 'Team Chat',    count: 4 }, { label: 'Announcements',   count: 1 }],
  };

  if (panelKey === 'settings') return <SettingsPanel showToast={showToast} />;

  if (panelKey === 'contact' && contact) {
    return (
      <div>
        <div className="px-4 py-6 flex flex-col items-center text-center gap-2 border-b border-border/40 relative">
          <div className="w-16 h-16 rounded-[12px] flex items-center justify-center text-[20px] font-bold text-bg shadow-sm"
            style={{ backgroundColor: contact.color ?? '#7dd3fc' }}>{contactInitials(contact)}</div>
          <div className="mt-2">
            <p className="text-[14.5px] font-bold text-text-main">{contactDisplayName(contact)}</p>
            {contact.email && <p className="text-[11px] font-medium text-text-muted mt-0.5">{contact.email}</p>}
          </div>
          <a onClick={() => showToast('info', 'Routing to CRM record...')} className="cursor-pointer flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary hover:opacity-80 transition-opacity">
            View in CRM <ExternalLink className="w-3 h-3" />
          </a>
          <div className="flex gap-2 w-full mt-4">
            <button onClick={() => showToast('success', 'Initiating call...')} className="flex-1 py-1.5 border border-border/50 bg-bg rounded-[8px] text-text-muted hover:text-text-main transition-colors flex items-center justify-center gap-1.5 text-[11px] shadow-sm font-semibold">
              <Phone className="w-3.5 h-3.5" /> Call
            </button>
            <button onClick={() => showToast('success', 'Composing email...')} className="flex-1 py-1.5 border border-border/50 bg-bg rounded-[8px] text-text-muted hover:text-text-main transition-colors flex items-center justify-center gap-1.5 text-[11px] shadow-sm font-semibold">
              <Mail className="w-3.5 h-3.5" /> Email
            </button>
          </div>
        </div>
        <div className="divide-y divide-border/30">
          {[
            { label: 'Email',    value: contact.email  || '—' },
            { label: 'Phone',    value: contact.phone  || '—' },
            { label: 'Owner',    value: 'Unassigned'          },
            { label: 'Platform', value: 'Unified'             },
          ].map(row => (
            <div key={row.label} className="px-5 py-3">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5">{row.label}</p>
              <p className={`text-[12px] font-medium ${row.value === '—' || row.value === 'Unassigned' ? 'text-text-muted italic' : 'text-text-main'}`}>{row.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filtered = convos.filter(c => panelKey === 'assigned' ? !!c.assignedUserId : c.starred);
  if (panelKey === 'assigned' || panelKey === 'starred') {
    return (
      <div className="p-3 space-y-2">
        {filtered.length === 0
          ? <p className="text-[11.5px] text-text-muted italic px-1 font-medium mt-2">No conversations found.</p>
          : filtered.map(c => (
            <button key={c.id} onClick={() => onSelectConvo(c.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] bg-bg border border-border/40 hover:border-border transition-all text-left shadow-sm">
              <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-bold text-bg shrink-0 shadow-sm"
                style={{ backgroundColor: c.contact?.color ?? '#7dd3fc' }}>{contactInitials(c.contact)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-text-main truncate">{contactDisplayName(c.contact)}</p>
                <p className="text-[10px] text-text-muted truncate font-medium">{c.messages?.[0]?.body ?? 'No messages yet'}</p>
              </div>
            </button>
          ))}
      </div>
    );
  }

  const items = inboxGroups[panelKey as keyof typeof inboxGroups] ?? [];
  return (
    <div className="p-3 space-y-1">
      {items.map(item => (
        <button key={item.label}
          className="w-full flex items-center justify-between px-3 py-3 rounded-[8px] text-[12px] font-bold text-text-muted hover:bg-surface-hover/80 hover:text-text-main border border-transparent hover:border-border/50 transition-colors group">
          <span>{item.label}</span>
          <div className="flex items-center gap-2">
            {item.count > 0 && <span className="w-5 h-5 rounded-[6px] bg-primary/20 text-primary text-[10px] font-black flex items-center justify-center shadow-sm">{item.count}</span>}
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Conversation Thread ──────────────────────────────────────

function ConversationThread({
  selected, convos, activePanel, setActivePanel, setSelectedId, showToast,
}: {
  selected: ApiConversation;
  convos: ApiConversation[];
  activePanel: PanelKey | null;
  setActivePanel: React.Dispatch<React.SetStateAction<PanelKey | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (t: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}) {
  const isEmail = selected.channel === 'email';

  // Composer state
  const [reply, setReply]                 = useState('');
  const [replySubject, setReplySubject]   = useState('');
  const [replyChannel, setReplyChannel]   = useState<Channel | 'note'>(selected.channel as Channel);
  const [emailTo, setEmailTo]             = useState<string>(selected.contact?.email ?? '');
  const [emailToSearch, setEmailToSearch] = useState('');
  const [emailToContacts, setEmailToContacts] = useState<any[]>([]);
  const [emailToFocused, setEmailToFocused]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Thread header actions
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditSubject, setShowEditSubject]   = useState(false);

  const { data: msgs = [] }  = useConversationMessages(selected.id);
  const sendMutation         = useSendMessage(selected.id);
  const patchMutation        = usePatchConversation();
  const markReadMutation     = useMarkRead();
  const deleteMutation       = useDeleteConversation();

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, selected.id]);

  // Reset composer when switching conversations
  useEffect(() => {
    setReplyChannel(selected.channel as Channel);
    setReplySubject(selected.subject ? `Re: ${selected.subject}` : '');
  }, [selected.id, selected.channel, selected.subject]);

  useEffect(() => {
    setEmailTo(selected.contact?.email ?? '');
    setEmailToSearch('');
    setEmailToContacts([]);
  }, [selected.id]);

  // Mark as read on open
  useEffect(() => {
    if (selected.unreadCount > 0) markReadMutation.mutate(selected.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  // Contact picker autocomplete
  useEffect(() => {
    if (!emailToFocused) { setEmailToContacts([]); return; }
    const t = setTimeout(() => {
      crmApi.getContacts().then((all: any[]) => {
        const q = emailToSearch.toLowerCase();
        setEmailToContacts(
          !q ? all.slice(0, 8)
             : all.filter((c: any) => `${c.firstName ?? ''} ${c.lastName ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q)).slice(0, 8)
        );
      }).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailToSearch, emailToFocused]);

  const handleSend = () => {
    if (!reply.trim() || sendMutation.isPending) return;
    const isEmailMode = replyChannel === 'email';
    sendMutation.mutate({
      body: reply.trim(),
      ...(replyChannel !== 'note' && { channel: replyChannel as ConversationChannel }),
      ...(isEmailMode && emailTo && { to: emailTo }),
      ...(isEmailMode && replySubject && { subject: replySubject }),
    });
    setReply('');
  };

  const handleClose = () => {
    patchMutation.mutate({ id: selected.id, data: { status: selected.status === 'open' ? 'closed' : 'open' } });
  };

  const handleDelete = () => {
    deleteMutation.mutate(selected.id, {
      onSuccess: () => {
        setSelectedId(null);
        setShowDeleteDialog(false);
        showToast('info', 'Conversation deleted.');
      },
      onError: () => showToast('error', 'Failed to delete conversation.'),
    });
  };

  const handleSaveSubject = (subject: string) => {
    patchMutation.mutate(
      { id: selected.id, data: { subject } },
      {
        onSuccess: () => { setShowEditSubject(false); showToast('success', 'Subject updated.'); },
        onError: () => showToast('error', 'Failed to update subject.'),
      }
    );
  };

  const togglePanel = (key: PanelKey) => setActivePanel(p => p === key ? null : key);

  const cInitials = contactInitials(selected.contact);
  const cColor    = selected.contact?.color ?? '#7dd3fc';

  return (
    <>
      {/* Delete confirmation */}
      <AnimatePresence>
        {showDeleteDialog && (
          <DeleteConfirmDialog
            label={selected.subject ?? contactDisplayName(selected.contact)}
            onConfirm={handleDelete}
            onCancel={() => setShowDeleteDialog(false)}
            loading={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit subject */}
      <AnimatePresence>
        {showEditSubject && (
          <EditSubjectDialog
            current={selected.subject ?? ''}
            onSave={handleSaveSubject}
            onCancel={() => setShowEditSubject(false)}
            loading={patchMutation.isPending}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden min-w-0 gap-6">
        {/* Thread Container */}
        <div className={`flex-1 flex flex-col rounded-[12px] ${FROSTED_GLASS_CLASSES} overflow-hidden min-w-0`}>

          {/* Thread Header */}
          <div className={`px-6 py-4 flex items-center justify-between shrink-0 relative z-10 ${FROSTED_HEADER_CLASSES}`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-bg shadow-sm border border-border/50"
                  style={{ backgroundColor: cColor }}>
                  {cInitials}
                </div>
                {selected.status === 'open' && <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-accent-green border-[2px] border-surface shadow-sm" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <p className="text-[15px] font-bold text-text-main leading-tight truncate">{contactDisplayName(selected.contact)}</p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider shadow-sm border shrink-0 ${selected.status === 'open' ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : 'bg-bg border-border/50 text-text-muted'}`}>
                    {selected.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {React.createElement(CH_ICON[selected.channel as Channel] ?? MessageSquare, { className: 'w-3 h-3 shrink-0', style: { color: CH_COLOR[selected.channel as Channel] ?? '#7dd3fc' } })}
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{CH_LABEL[selected.channel as Channel] ?? selected.channel}</p>
                  {isEmail && selected.subject && (
                    <span className="text-[11px] text-text-muted font-medium truncate max-w-[260px]">
                      · {selected.subject}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Edit subject (email only) */}
              {isEmail && (
                <button onClick={() => setShowEditSubject(true)} title="Edit subject"
                  className="p-2 rounded-[8px] border border-border/50 bg-surface shadow-sm text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
              {/* Close / Reopen */}
              <button onClick={handleClose}
                className={`px-4 py-2 rounded-[8px] text-[12px] font-bold border transition-colors shadow-sm ${selected.status === 'open' ? 'border-border/50 bg-bg text-text-main hover:bg-surface-hover/80 hover:border-border' : 'border-accent-green/30 bg-accent-green/10 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/50'}`}>
                {selected.status === 'open' ? 'Close' : 'Reopen'}
              </button>
              <div className="w-px h-6 bg-border mx-1" />
              {/* Delete */}
              <button onClick={() => setShowDeleteDialog(true)} title="Delete conversation"
                className="p-2 rounded-[8px] border border-border/50 bg-surface shadow-sm text-text-muted hover:text-accent-red hover:border-accent-red/30 hover:bg-accent-red/5 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
              {/* More options */}
              <button onClick={() => showToast('info', 'Options opened')} className="p-2 rounded-[8px] border border-border/50 bg-surface shadow-sm text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {msgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-luxury ring-1 ring-white/5 ${FROSTED_GLASS_CLASSES}`}>
                  <MessageSquare className="w-6 h-6 text-border" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-text-main mb-1">No messages yet</p>
                  <p className="text-[12px] font-medium text-text-muted">Start the thread by composing below.</p>
                </div>
              </div>
            ) : msgs.map((msg: any) => {
              if (isEmail) {
                return (
                  <EmailMessageCard
                    key={msg.id}
                    msg={msg}
                    contactColor={cColor}
                    contactInitialsStr={cInitials}
                  />
                );
              }
              // Non-email: chat bubble
              const fromUs = msg.direction === 'outbound';
              return (
                <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                  {!fromUs && (
                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[9px] font-bold text-bg mr-3 shrink-0 mt-auto border border-border/50 shadow-sm"
                      style={{ backgroundColor: cColor }}>
                      {cInitials}
                    </div>
                  )}
                  <div className={`max-w-[70%] flex flex-col gap-1 ${fromUs ? 'items-end' : 'items-start'}`}>
                    <div className={`px-3.5 py-2.5 rounded-[8px] text-[13px] leading-[1.6] shadow-[0_2px_4px_rgba(0,0,0,0.1)] border font-medium ${
                      fromUs ? 'bg-primary border-primary text-bg rounded-br-[2px]' : 'bg-surface border-border text-text-main rounded-bl-[2px]'
                    }`}>
                      {msg.body}
                    </div>
                    <div className={`flex items-center gap-1.5 px-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider ${fromUs ? 'text-text-muted/70' : 'text-text-muted/50'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {fromUs && msg.status === 'read'      && <CheckCheck className="w-3.5 h-3.5 text-primary drop-shadow-sm ml-0.5" />}
                      {fromUs && msg.status === 'delivered' && <CheckCheck className="w-3.5 h-3.5 text-text-main ml-0.5" />}
                      {fromUs && msg.status === 'sent'      && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* ── Composer ── */}
          <div className={`border-t border-border/50 shrink-0 m-4 rounded-[12px] shadow-luxury overflow-hidden ${FROSTED_GLASS_CLASSES}`}>
            {/* Channel selector tabs */}
            <div className="flex flex-wrap items-center border-b border-border/60 bg-surface/30">
              {(['instagram', 'linkedin', 'tiktok', 'facebook', 'whatsapp', 'sms', 'email', 'note'] as const).map(mode => {
                const isActive = replyChannel === mode;
                const Icon = mode === 'note' ? null : CH_ICON[mode as Channel];
                return (
                  <button key={mode} onClick={() => setReplyChannel(mode)}
                    className={`flex items-center gap-1.5 py-2.5 px-3.5 text-[11px] font-bold transition-all relative whitespace-nowrap outline-none ${isActive ? 'text-primary bg-bg shadow-inner' : 'text-text-muted hover:text-text-main hover:bg-surface/50'}`}>
                    {Icon && <Icon className="w-3.5 h-3.5" style={isActive ? { color: CH_COLOR[mode as Channel] } : {}} />}
                    <span className="uppercase tracking-wider">{mode === 'note' ? 'Int. Note' : CH_LABEL[mode as Channel]}</span>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_var(--primary)]" />}
                  </button>
                );
              })}
            </div>

            {/* Email-only fields: To + Subject */}
            {replyChannel === 'email' && (
              <>
                {/* To: */}
                <div className="relative px-4 py-2 border-b border-border/40 bg-bg/30 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0 w-12">To:</span>
                  <input
                    value={emailTo}
                    onChange={e => { setEmailTo(e.target.value); setEmailToSearch(e.target.value); }}
                    onFocus={() => setEmailToFocused(true)}
                    onBlur={() => setTimeout(() => setEmailToFocused(false), 200)}
                    placeholder="recipient@email.com"
                    className="flex-1 bg-transparent text-[12px] text-text-main focus:outline-none font-medium placeholder:text-text-muted/50"
                  />
                  {emailToFocused && emailToContacts.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-[10px] border border-border/50 overflow-hidden shadow-luxury z-20 max-h-52 overflow-y-auto ${FROSTED_GLASS_CLASSES}`}>
                      {emailToContacts.map((c: any) => (
                        <button key={c.id}
                          onClick={() => { setEmailTo(c.email ?? ''); setEmailToSearch(''); setEmailToFocused(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                          <div className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[10px] font-bold text-bg shrink-0"
                            style={{ backgroundColor: c.color ?? '#7dd3fc' }}>
                            {((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-text-main truncate">{`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Unknown'}</p>
                            <p className="text-[10px] text-text-muted truncate">{c.email ?? ''}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Subject: */}
                <div className="px-4 py-2 border-b border-border/40 bg-bg/30 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider shrink-0 w-12">Subject:</span>
                  <input
                    value={replySubject}
                    onChange={e => setReplySubject(e.target.value)}
                    placeholder={selected.subject ? `Re: ${selected.subject}` : 'Email subject…'}
                    className="flex-1 bg-transparent text-[12px] text-text-main focus:outline-none font-medium placeholder:text-text-muted/50"
                  />
                </div>
              </>
            )}

            {/* Body textarea */}
            <div className="px-4 pt-3 flex-1 bg-bg/40">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && replyChannel !== 'email') { e.preventDefault(); handleSend(); } }}
                placeholder={
                  replyChannel === 'note'  ? 'Internal comment (invisible to contact)…'
                  : replyChannel === 'email' ? 'Compose your email…'
                  : `Draft your ${replyChannel.toUpperCase()} reply…`
                }
                rows={replyChannel === 'email' ? 4 : 2}
                className={`w-full bg-transparent text-[13px] resize-none focus:outline-none placeholder:font-medium leading-relaxed font-semibold transition-colors ${replyChannel === 'note' ? 'text-accent-amber placeholder:text-accent-amber/40' : 'text-text-main placeholder:text-text-muted/60'}`}
                style={{ maxHeight: '260px' }}
                onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 260) + 'px'; }}
              />
            </div>

            {/* Composer actions */}
            <div className="flex items-center gap-2 px-3 pb-3 pt-2 bg-bg/40">
              <button onClick={() => showToast('info', 'File browser opened')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all outline-none"><Paperclip className="w-4 h-4" /></button>
              <button onClick={() => showToast('success', 'Snippet inserted')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all"><Zap className="w-4 h-4" /></button>
              <button onClick={() => showToast('info', 'Schedule modal opened')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all"><Clock className="w-4 h-4" /></button>
              <div className="flex-1" />
              <button onClick={() => setReply('')} className="px-4 py-2 rounded-[8px] text-[11px] font-bold text-text-muted uppercase tracking-wider hover:text-text-main transition-colors outline-none mr-1">Clear</button>
              <button onClick={handleSend} disabled={!reply.trim() || sendMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-[8px] text-[12px] font-bold text-bg disabled:opacity-40 hover:opacity-90 transition-all shadow-sm bg-primary border border-primary outline-none">
                <Send className="w-3.5 h-3.5" />
                {replyChannel === 'note' ? 'Save Note' : sendMutation.isPending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Nav Bar & Slide-outs */}
        <div className="flex shrink-0">
          <AnimatePresence>
            {activePanel && (
              <motion.div key={activePanel}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className={`border-r border-border/50 flex flex-col overflow-hidden rounded-l-[12px] ${FROSTED_GLASS_CLASSES} z-10`}
                style={{ minWidth: 0 }}
              >
                <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${FROSTED_HEADER_CLASSES}`}>
                  <span className="text-[13px] font-bold text-text-main uppercase tracking-widest">
                    {RIGHT_NAV.find(n => n.key === activePanel)?.label}
                  </span>
                  <button onClick={() => setActivePanel(null)} className="w-7 h-7 rounded-[8px] flex items-center justify-center text-text-muted hover:bg-surface hover:text-text-main transition-all border border-transparent hover:border-border shadow-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto styled-scrollbar">
                  <RightSubPanel panelKey={activePanel} contact={selected.contact ?? null} convos={convos}
                    onSelectConvo={id => { setSelectedId(id); setActivePanel(null); }} showToast={showToast} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className={`w-[72px] flex flex-col items-center py-4 gap-2.5 rounded-[12px] ${activePanel ? 'rounded-l-none border-l-0' : ''} ${FROSTED_GLASS_CLASSES} z-0 overflow-hidden shrink-0`}>
            {RIGHT_NAV.map(item => (
              <button key={item.key} onClick={() => togglePanel(item.key)} title={item.label}
                className={`relative w-[50px] flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-[10px] transition-all group outline-none ${
                  activePanel === item.key
                    ? 'bg-primary border border-primary text-bg shadow-[0_2px_12px_var(--primary-glow)] z-10'
                    : 'text-text-muted hover:bg-surface hover:text-text-main border border-transparent hover:border-border'
                }`}>
                <item.icon className="w-5 h-5" strokeWidth={activePanel === item.key ? 2.5 : 1.75} />
                {item.badge && item.badge > 0 && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent-red text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                    {item.badge}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main ConversationsTab ────────────────────────────────────

export default function ConversationsTab() {
  const { toast: showToast } = useToast();
  const { data: convos = [], isLoading: convosLoading } = useConversations();
  const { data: connections = [] } = useChannelConnections();

  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState<FilterMode>('all');
  const [activePanel, setActivePanel] = useState<PanelKey | null>(null);

  // New-conversation modal state
  const [showNewModal, setShowNewModal]     = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [ncContact, setNcContact]   = useState<any | null>(null);
  const [ncChannel, setNcChannel]   = useState<string>('email');
  const [ncSubject, setNcSubject]   = useState('');
  const [ncFirstMsg, setNcFirstMsg] = useState('');
  const [ncSearch, setNcSearch]     = useState('');
  const [ncAllContacts, setNcAllContacts] = useState<any[]>([]);
  const [ncFiltered, setNcFiltered]       = useState<any[]>([]);
  const patchMutation  = usePatchConversation();
  const createMutation = useCreateConversation();

  // Load contacts when modal opens
  useEffect(() => {
    if (!showNewModal) return;
    crmApi.getContacts().then((all: any[]) => setNcAllContacts(all)).catch(() => {});
  }, [showNewModal]);

  // Filter contacts based on search
  useEffect(() => {
    if (!showNewModal) return;
    const t = setTimeout(() => {
      const q = ncSearch.toLowerCase();
      setNcFiltered(
        !q ? ncAllContacts.slice(0, 8)
           : ncAllContacts.filter((c: any) =>
               `${c.firstName ?? ''} ${c.lastName ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q)
             ).slice(0, 8)
      );
    }, 150);
    return () => clearTimeout(t);
  }, [ncSearch, ncAllContacts, showNewModal]);

  const handleCreateConversation = () => {
    createMutation.mutate(
      { contactId: ncContact?.id, channel: ncChannel, subject: ncSubject || undefined },
      {
        onSuccess: (convo) => {
          setSelectedId(convo.id);
          setShowNewModal(false);
          if (ncFirstMsg.trim()) {
            conversationsApi.sendMessage(convo.id, { body: ncFirstMsg.trim(), direction: 'outbound', channel: ncChannel as any })
              .catch(console.error);
          }
          showToast('success', 'Conversation started!');
        },
        onError: (e: any) => showToast('error', e.message ?? 'Failed to create conversation'),
      }
    );
  };

  const selected = convos.find(c => c.id === selectedId) ?? null;

  const filtered = convos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || contactDisplayName(c.contact).toLowerCase().includes(q)
      || (c.subject ?? '').toLowerCase().includes(q);
    const matchFilter = filter === 'all' ? true : filter === 'unread' ? c.unreadCount > 0 : !!c.starred;
    return matchSearch && matchFilter;
  });

  const handleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const convo = convos.find(c => c.id === id);
    if (!convo) return;
    patchMutation.mutate({ id, data: { starred: !convo.starred } });
  };

  return (
    <div className="flex h-full overflow-hidden bg-bg p-6 gap-6 font-sans">

      {/* ══════ LEFT: Conversation List ══════ */}
      <div className={`w-[320px] shrink-0 flex flex-col rounded-[12px] ${FROSTED_GLASS_CLASSES} overflow-hidden`}>
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 space-y-3 ${FROSTED_HEADER_CLASSES}`}>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-text-main">Inbox</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setShowSettingsModal(true)} title="Channel Settings"
                className="w-8 h-8 rounded-[8px] border border-border/50 bg-surface text-text-muted hover:text-text-main hover:border-border transition-all flex items-center justify-center">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-bg hover:opacity-90 transition-all shadow-[0_2px_10px_var(--primary-glow)] bg-primary border border-primary">
                <Plus className="w-3.5 h-3.5" /> Compose
              </button>
            </div>
          </div>
          <div className="relative shadow-sm rounded-[8px] border border-border bg-bg/50 focus-within:border-primary/50 transition-colors">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts or subjects…"
              className="w-full pl-9 pr-3 py-2 bg-transparent rounded-[8px] text-[12px] text-text-main font-medium focus:outline-none transition-all placeholder:text-text-muted" />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-[8px] border border-border/60 bg-surface/80">
            {(['all', 'unread', 'starred'] as FilterMode[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex-1 py-1.5 rounded-[6px] text-[11px] font-bold capitalize transition-all ${filter === f ? 'bg-primary text-bg shadow-sm' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto styled-scrollbar">
          {convosLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-[11px] text-text-muted font-medium">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
              {connections.length === 0 ? (
                <>
                  <div className="w-12 h-12 rounded-[12px] bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-text-main">Connect a channel</p>
                    <p className="text-[11px] text-text-muted mt-1 leading-snug">Connect Gmail or SMS in Settings<br />to start receiving messages.</p>
                  </div>
                  <button onClick={() => setShowSettingsModal(true)}
                    className="px-4 py-2 rounded-[8px] text-[11px] font-bold bg-primary text-bg hover:opacity-90 transition-all shadow-sm">
                    Connect a Channel
                  </button>
                </>
              ) : (
                <>
                  <MessageSquare className="w-8 h-8 text-border" />
                  <p className="text-[12px] text-text-muted font-bold">No conversations yet</p>
                  <button onClick={() => setShowNewModal(true)}
                    className="px-4 py-2 rounded-[8px] text-[11px] font-bold bg-primary text-bg hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Start one
                  </button>
                </>
              )}
            </div>
          ) : filtered.map(convo => {
            const ConvoIcon = CH_ICON[convo.channel as Channel] ?? MessageSquare;
            const previewMsg = convo.messages?.[0];
            // For email, prefer subject line as preview
            const previewText = convo.channel === 'email' && convo.subject
              ? convo.subject
              : previewMsg?.body ?? 'No messages yet';

            return (
              <div key={convo.id}
                className={`relative border-b border-border/40 group transition-all ${selectedId === convo.id ? 'bg-primary/5 border-l-[3px] border-l-primary' : 'hover:bg-surface-hover/50 border-l-[3px] border-l-transparent'}`}>
                <button onClick={() => setSelectedId(convo.id)} className="w-full text-left px-4 py-4 flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-bg shadow-sm border border-border/50"
                      style={{ backgroundColor: convo.contact?.color ?? '#7dd3fc' }}>
                      {contactInitials(convo.contact)}
                    </div>
                    {convo.status === 'open' && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent-green border-[2px] border-surface" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[13px] truncate ${convo.unreadCount > 0 ? 'font-bold text-text-main' : 'font-semibold text-text-main'}`}>
                        {contactDisplayName(convo.contact)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {convo.starred && <Star className="w-3.5 h-3.5 text-accent-amber fill-accent-amber" />}
                        <span className="text-[10px] text-text-muted font-bold tracking-wider">{timeAgo(convo.lastMessageAt ?? convo.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className={`text-[12px] flex-1 truncate ${convo.unreadCount > 0 ? 'font-semibold text-text-main' : 'text-text-muted/80 font-medium'}`}>
                        {previewText}
                      </p>
                      {convo.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-primary text-bg text-[9px] font-bold flex items-center justify-center shadow-sm shrink-0">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <ConvoIcon className="w-3 h-3 opacity-60" style={{ color: CH_COLOR[convo.channel as Channel] ?? '#7dd3fc' }} />
                      <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider">{CH_LABEL[convo.channel as Channel] ?? convo.channel}</span>
                    </div>
                  </div>
                </button>

                {/* Hover actions: star + delete */}
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => handleStar(convo.id, e)} title={convo.starred ? 'Unstar' : 'Star'}
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center bg-surface border border-border/50 shadow-sm text-text-muted hover:text-accent-amber transition-colors">
                    <Star className={`w-3.5 h-3.5 ${convo.starred ? 'fill-accent-amber text-accent-amber' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════ MIDDLE + RIGHT: Thread or Empty State ══════ */}
      {selected ? (
        <ConversationThread
          key={selected.id}
          selected={selected}
          convos={convos}
          activePanel={activePanel}
          setActivePanel={setActivePanel}
          setSelectedId={setSelectedId}
          showToast={showToast}
        />
      ) : (
        <div className={`flex-1 flex flex-col items-center justify-center rounded-[12px] ${FROSTED_GLASS_CLASSES}`}>
          <div className="w-16 h-16 rounded-[18px] flex items-center justify-center mb-4 bg-primary/10 border border-primary/20">
            <MessageSquare className="w-7 h-7 text-primary" />
          </div>
          <p className="text-[16px] font-bold text-text-main mb-2">Select a conversation</p>
          <p className="text-[13px] font-medium text-text-muted mb-6 text-center max-w-[280px] leading-relaxed">
            Choose a thread from the left panel, or compose a new message.
          </p>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13px] font-bold text-bg bg-primary hover:opacity-90 transition-all shadow-sm border border-primary">
            <Plus className="w-4 h-4" /> Compose
          </button>
        </div>
      )}

      {/* ══════ NEW CONVERSATION MODAL ══════ */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className={`w-[520px] max-h-[90vh] flex flex-col rounded-[16px] ${FROSTED_GLASS_CLASSES} overflow-hidden`}
            >
              <div className={`px-6 py-5 flex items-center justify-between shrink-0 ${FROSTED_HEADER_CLASSES}`}>
                <div>
                  <p className="text-[15px] font-bold text-text-main">New Conversation</p>
                  <p className="text-[11px] font-medium text-text-muted mt-0.5">Start a new thread with a contact</p>
                </div>
                <button onClick={() => setShowNewModal(false)} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Contact picker */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Contact</label>
                  {ncContact ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] border border-primary/30 bg-primary/5">
                      <div className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[11px] font-bold text-bg"
                        style={{ backgroundColor: ncContact.color ?? '#7dd3fc' }}>
                        {((ncContact.firstName?.[0] ?? '') + (ncContact.lastName?.[0] ?? '')).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text-main truncate">{`${ncContact.firstName ?? ''} ${ncContact.lastName ?? ''}`.trim()}</p>
                        <p className="text-[11px] text-text-muted truncate">{ncContact.email ?? ''}</p>
                      </div>
                      <button onClick={() => setNcContact(null)} className="p-1 rounded-[6px] text-text-muted hover:text-text-main transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                      <input value={ncSearch} onChange={e => setNcSearch(e.target.value)} placeholder="Search CRM contacts…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-[8px] border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted" />
                      {ncFiltered.length > 0 && (
                        <div className={`absolute top-full left-0 right-0 mt-1 rounded-[10px] border border-border/50 overflow-hidden shadow-luxury z-20 max-h-52 overflow-y-auto ${FROSTED_GLASS_CLASSES}`}>
                          {ncFiltered.map((c: any) => (
                            <button key={c.id} onClick={() => { setNcContact(c); setNcSearch(''); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                              <div className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[10px] font-bold text-bg shrink-0"
                                style={{ backgroundColor: c.color ?? '#7dd3fc' }}>
                                {((c.firstName?.[0] ?? '') + (c.lastName?.[0] ?? '')).toUpperCase() || '?'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-bold text-text-main truncate">{`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Unknown'}</p>
                                <p className="text-[10px] text-text-muted truncate">{c.email ?? ''}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Channel selector */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Channel</label>
                  <div className="flex flex-wrap gap-2">
                    {(['email', 'sms', 'whatsapp', 'chat'] as const).map(ch => (
                      <button key={ch} onClick={() => setNcChannel(ch)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-bold border transition-all ${ncChannel === ch ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border/50 text-text-muted hover:border-border hover:text-text-main'}`}>
                        {React.createElement(CH_ICON[ch] ?? MessageSquare, { className: 'w-3.5 h-3.5', style: { color: CH_COLOR[ch] } })}
                        {CH_LABEL[ch]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject (email only) */}
                {ncChannel === 'email' && (
                  <div>
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">Subject</label>
                    <input value={ncSubject} onChange={e => setNcSubject(e.target.value)} placeholder="Email subject…"
                      className="w-full px-3 py-2.5 rounded-[8px] border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted" />
                  </div>
                )}

                {/* First message */}
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">First Message <span className="normal-case text-text-muted/60 font-normal">(optional)</span></label>
                  <textarea value={ncFirstMsg} onChange={e => setNcFirstMsg(e.target.value)} placeholder="Write your opening message…" rows={3}
                    className="w-full px-3 py-2.5 rounded-[8px] border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-text-muted" />
                </div>
              </div>

              <div className={`px-6 py-4 flex gap-3 shrink-0 border-t border-border/40 ${FROSTED_HEADER_CLASSES}`}>
                <button onClick={() => setShowNewModal(false)} className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold border border-border/50 text-text-muted hover:text-text-main hover:border-border transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreateConversation}
                  disabled={!ncChannel || createMutation.isPending}
                  className="flex-1 py-2.5 rounded-[8px] text-[12px] font-bold bg-primary text-bg hover:opacity-90 disabled:opacity-40 transition-all shadow-sm">
                  {createMutation.isPending ? 'Creating…' : 'Start Conversation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══════ SETTINGS MODAL ══════ */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
              className={`w-[520px] max-h-[85vh] flex flex-col rounded-[16px] ${FROSTED_GLASS_CLASSES} overflow-hidden`}
            >
              <div className={`px-6 py-5 flex items-center justify-between shrink-0 ${FROSTED_HEADER_CLASSES}`}>
                <p className="text-[15px] font-bold text-text-main">Channel Settings</p>
                <button onClick={() => setShowSettingsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-[8px] border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <SettingsPanel showToast={showToast} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
