import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, X, MessageSquare, Lock,
  Send, Phone, Mail, Paperclip, CheckCheck,
  Star,
  Settings, Check,
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

// ─── Conversation Thread ──────────────────────────────────────

function ConversationThread({
  selected, onClose, setSelectedId, showToast,
}: {
  selected: ApiConversation;
  onClose: () => void;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (t: 'success' | 'error' | 'info' | 'warning', msg: string) => void;
}) {
  const isEmail = selected.channel === 'email';

  const [reply, setReply]                     = useState('');
  const [replySubject, setReplySubject]       = useState('');
  const [replyChannel, setReplyChannel]       = useState<Channel | 'note'>(selected.channel as Channel);
  const [emailTo, setEmailTo]                 = useState<string>(selected.contact?.email ?? '');
  const [emailToSearch, setEmailToSearch]     = useState('');
  const [emailToContacts, setEmailToContacts] = useState<any[]>([]);
  const [emailToFocused, setEmailToFocused]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditSubject, setShowEditSubject]   = useState(false);

  const { data: msgs = [] } = useConversationMessages(selected.id);
  const sendMutation        = useSendMessage(selected.id);
  const patchMutation       = usePatchConversation();
  const markReadMutation    = useMarkRead();
  const deleteMutation      = useDeleteConversation();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, selected.id]);

  useEffect(() => {
    setReplyChannel(selected.channel as Channel);
    setReplySubject(selected.subject ? `Re: ${selected.subject}` : '');
  }, [selected.id, selected.channel, selected.subject]);

  useEffect(() => {
    setEmailTo(selected.contact?.email ?? '');
    setEmailToSearch('');
    setEmailToContacts([]);
  }, [selected.id]);

  useEffect(() => {
    if (selected.unreadCount > 0) markReadMutation.mutate(selected.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id]);

  useEffect(() => {
    if (!emailToFocused) { setEmailToContacts([]); return; }
    const t = setTimeout(() => {
      crmApi.getContacts().then((res: any) => {
        const all: any[] = Array.isArray(res) ? res : (res?.contacts ?? []);
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
    }, { onError: (e: any) => showToast('error', e.message ?? 'Failed to send message') });
    setReply('');
  };

  const handleClose = () => {
    patchMutation.mutate({ id: selected.id, data: { status: selected.status === 'open' ? 'closed' : 'open' } });
  };

  const handleDelete = () => {
    deleteMutation.mutate(selected.id, {
      onSuccess: () => { setSelectedId(null); setShowDeleteDialog(false); showToast('info', 'Conversation deleted.'); },
      onError:   () => showToast('error', 'Failed to delete conversation.'),
    });
  };

  const handleSaveSubject = (subject: string) => {
    patchMutation.mutate(
      { id: selected.id, data: { subject } },
      {
        onSuccess: () => { setShowEditSubject(false); showToast('success', 'Subject updated.'); },
        onError:   () => showToast('error', 'Failed to update subject.'),
      }
    );
  };

  const cInitials = contactInitials(selected.contact);
  const cColor    = selected.contact?.color ?? '#7dd3fc';

  return (
    <>
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

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Thread Header — matches Contacts slide-over header ── */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-hover/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-bg shadow-sm"
                style={{ backgroundColor: cColor }}
              >
                {cInitials}
              </div>
              {selected.status === 'open' && (
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-green border-[2px] border-surface" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[16px] font-bold text-text-main leading-tight truncate">{contactDisplayName(selected.contact)}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {React.createElement(CH_ICON[selected.channel as Channel] ?? MessageSquare, { className: 'w-3 h-3 shrink-0', style: { color: CH_COLOR[selected.channel as Channel] ?? '#7dd3fc' } })}
                <span className="text-[11px] font-medium text-text-muted">{CH_LABEL[selected.channel as Channel] ?? selected.channel}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  selected.status === 'open' ? 'bg-accent-green/10 text-accent-green' : 'bg-bg text-text-muted border border-border'
                }`}>
                  {selected.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEmail && (
              <button onClick={() => setShowEditSubject(true)} title="Edit subject"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-surface rounded-[8px] text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shadow-sm">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleClose}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-semibold border transition-colors shadow-sm ${
                selected.status === 'open'
                  ? 'border-border bg-surface text-text-main hover:bg-surface-hover'
                  : 'border-accent-green/30 bg-accent-green/10 text-accent-green hover:bg-accent-green/20'
              }`}>
              {selected.status === 'open' ? 'Close' : 'Reopen'}
            </button>
            <button onClick={() => setShowDeleteDialog(true)} title="Delete"
              className="flex items-center justify-center p-1.5 border border-border bg-surface rounded-[8px] text-text-muted hover:text-accent-red hover:border-red-500/30 hover:bg-red-500/5 transition-colors shadow-sm">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => showToast('info', 'Options opened')}
              className="flex items-center justify-center p-1.5 border border-border bg-surface rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shadow-sm">
              <MoreVertical className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-border mx-1" />
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 styled-scrollbar">
          {msgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-surface border border-border/50 shadow-sm">
                <MessageSquare className="w-5 h-5 text-text-muted/40" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-text-main mb-1">No messages yet</p>
                <p className="text-[11px] font-medium text-text-muted">Start the thread using the composer below.</p>
              </div>
            </div>
          ) : msgs.map((msg: any) => {
            if (isEmail) {
              return (
                <EmailMessageCard key={msg.id} msg={msg} contactColor={cColor} contactInitialsStr={cInitials} />
              );
            }
            const fromUs = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                {!fromUs && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-bg mr-2.5 shrink-0 mt-auto shadow-sm"
                    style={{ backgroundColor: cColor }}
                  >
                    {cInitials}
                  </div>
                )}
                <div className={`max-w-[68%] flex flex-col gap-1 ${fromUs ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm font-medium ${
                    fromUs
                      ? 'bg-primary text-bg rounded-br-sm'
                      : 'bg-surface border border-border/60 text-text-main rounded-bl-sm'
                  }`}>
                    {msg.body}
                  </div>
                  <div className={`flex items-center gap-1 px-1 text-[10px] font-medium ${fromUs ? 'text-text-muted/60' : 'text-text-muted/40'}`}>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {fromUs && msg.status === 'read'      && <CheckCheck className="w-3 h-3 text-primary" />}
                    {fromUs && msg.status === 'delivered' && <CheckCheck className="w-3 h-3" />}
                    {fromUs && msg.status === 'sent'      && <Check className="w-3 h-3" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── Composer ── */}
        <div className="shrink-0 border-t border-border/50 bg-surface/40 backdrop-blur-sm">
          {/* Channel tabs */}
          <div className="flex items-center border-b border-border/40 overflow-x-auto">
            {(['sms', 'email', 'whatsapp', 'chat', 'note'] as const).map(mode => {
              const isActive = replyChannel === mode;
              const Icon = mode === 'note' ? Lock : CH_ICON[mode as Channel];
              return (
                <button key={mode} onClick={() => setReplyChannel(mode)}
                  className={`flex items-center gap-1.5 py-2.5 px-4 text-[10px] font-bold transition-all relative whitespace-nowrap shrink-0 outline-none uppercase tracking-wider ${
                    isActive ? 'text-primary' : 'text-text-muted hover:text-text-main'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" style={isActive ? { color: mode !== 'note' ? CH_COLOR[mode as Channel] : 'var(--primary)' } : {}} />}
                  {mode === 'note' ? 'Note' : CH_LABEL[mode as Channel]}
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />}
                </button>
              );
            })}
          </div>

          {/* Email fields */}
          {replyChannel === 'email' && (
            <>
              <div className="relative px-4 py-2 border-b border-border/40 flex items-center gap-2 bg-bg/20">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest shrink-0 w-14">To:</span>
                <input
                  value={emailTo}
                  onChange={e => { setEmailTo(e.target.value); setEmailToSearch(e.target.value); }}
                  onFocus={() => setEmailToFocused(true)}
                  onBlur={() => setTimeout(() => setEmailToFocused(false), 200)}
                  placeholder="recipient@email.com"
                  className="flex-1 bg-transparent text-[12px] text-text-main focus:outline-none font-medium placeholder:text-text-muted/40"
                />
                {emailToFocused && emailToContacts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border/50 overflow-hidden shadow-luxury z-20 max-h-48 overflow-y-auto bg-surface/90 backdrop-blur-xl">
                    {emailToContacts.map((c: any) => (
                      <button key={c.id}
                        onClick={() => { setEmailTo(c.email ?? ''); setEmailToSearch(''); setEmailToFocused(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-hover transition-colors text-left">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-bg shrink-0"
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
              <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2 bg-bg/20">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest shrink-0 w-14">Subject:</span>
                <input
                  value={replySubject}
                  onChange={e => setReplySubject(e.target.value)}
                  placeholder={selected.subject ? `Re: ${selected.subject}` : 'Email subject...'}
                  className="flex-1 bg-transparent text-[12px] text-text-main focus:outline-none font-medium placeholder:text-text-muted/40"
                />
              </div>
            </>
          )}

          {/* Body */}
          <div className="px-4 pt-3 pb-1">
            <textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && replyChannel !== 'email') { e.preventDefault(); handleSend(); } }}
              placeholder={
                replyChannel === 'note'  ? 'Internal note — invisible to the contact...'
                : replyChannel === 'email' ? 'Compose your email...'
                : `Write a ${CH_LABEL[replyChannel as Channel] ?? replyChannel} reply...`
              }
              rows={replyChannel === 'email' ? 4 : 2}
              className={`w-full bg-transparent text-[13px] resize-none focus:outline-none leading-relaxed font-medium placeholder:text-text-muted/40 transition-colors ${
                replyChannel === 'note' ? 'text-accent-amber' : 'text-text-main'
              }`}
              style={{ maxHeight: '200px' }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 pb-3 pt-1">
            <button onClick={() => showToast('info', 'File browser opened')}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
              <Paperclip className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => showToast('success', 'Snippet inserted')}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
              <Zap className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => showToast('info', 'Schedule modal opened')}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
              <Clock className="w-3.5 h-3.5" />
            </button>
            <div className="flex-1" />
            {reply && (
              <button onClick={() => setReply('')}
                className="px-3 py-1.5 text-[11px] font-semibold text-text-muted hover:text-text-main transition-colors">
                Clear
              </button>
            )}
            <button onClick={handleSend}
              disabled={!reply.trim() || sendMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-bold text-bg bg-primary hover:opacity-90 disabled:opacity-40 transition-all shadow-sm">
              <Send className="w-3.5 h-3.5" />
              {replyChannel === 'note' ? 'Save Note' : sendMutation.isPending ? 'Sending...' : 'Send'}
            </button>
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
  const [showNewModal, setShowNewModal]           = useState(false);
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
    crmApi.getContacts().then((res: any) => setNcAllContacts(Array.isArray(res) ? res : (res?.contacts ?? []))).catch(() => {});
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
    <div className="flex flex-col h-full w-full relative bg-bg">

      {/* ══ TOOLBAR — matches Contacts page ══ */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px] shrink-0">
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          {([
            { id: 'all',     label: 'All' },
            { id: 'unread',  label: 'Unread' },
            { id: 'starred', label: 'Starred' },
          ] as { id: FilterMode; label: string }[]).map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors text-[13px] font-medium ${
                filter === tab.id
                  ? 'text-text-main bg-surface-hover border-border'
                  : 'text-text-muted bg-surface border-border/60 hover:text-text-main hover:bg-surface-hover hover:border-border'
              }`}>
              {tab.label}
              {tab.id === 'unread' && convos.filter(c => c.unreadCount > 0).length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary">
                  {convos.filter(c => c.unreadCount > 0).length}
                </span>
              )}
            </button>
          ))}

          <div className="w-[1px] h-5 bg-border mx-2" />

          <button onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border bg-surface rounded-lg text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shadow-sm">
            <Settings className="w-4 h-4" /> Channels
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search conversations"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          <button onClick={() => setShowNewModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Compose
          </button>
        </div>
      </div>

      {/* ══ CONVERSATION TABLE ══ */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative">
        {convosLoading ? (
          <table className="w-full text-left">
            <thead className="border-b border-border/50 bg-surface/80">
              <tr>
                {[180, 100, 220, 80, 100].map((w, i) => (
                  <th key={i} className="p-3"><div className="skeleton h-3 rounded" style={{ width: w }} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-7 h-7 rounded-full" />
                      <div className="skeleton h-3 w-32 rounded" />
                    </div>
                  </td>
                  <td className="p-3"><div className="skeleton h-3 w-16 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-48 rounded" /></td>
                  <td className="p-3"><div className="skeleton h-5 w-12 rounded-full" /></td>
                  <td className="p-3"><div className="skeleton h-3 w-20 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-20 text-center">
            {connections.length === 0 ? (
              <>
                <div className="w-12 h-12 rounded-[12px] bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-bold text-text-main mb-1">Connect a channel first</p>
                  <p className="text-[13px] text-text-muted">Connect Gmail, SMS, or WhatsApp to start receiving messages.</p>
                </div>
                <button onClick={() => setShowSettingsModal(true)} className="btn-primary">
                  <Settings className="w-4 h-4" /> Connect a Channel
                </button>
              </>
            ) : (
              <>
                <MessageSquare className="w-8 h-8 text-border" />
                <p className="text-[13px] font-bold text-text-muted">No conversations found</p>
                <button onClick={() => setShowNewModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4" /> Compose
                </button>
              </>
            )}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Contact</th>
                <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Channel</th>
                <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Last Message</th>
                <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Status</th>
                <th className="p-3 text-[13px] font-semibold text-text-muted whitespace-nowrap">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(convo => {
                const ConvoIcon = CH_ICON[convo.channel as Channel] ?? MessageSquare;
                const previewText = convo.channel === 'email' && convo.subject
                  ? convo.subject
                  : convo.messages?.[0]?.body ?? '—';
                const isUnread = convo.unreadCount > 0;
                return (
                  <tr key={convo.id}
                    onClick={() => setSelectedId(convo.id)}
                    className={`border-b border-border/50 transition-colors cursor-pointer group ${
                      selectedId === convo.id ? 'bg-primary/5' : 'hover:bg-surface-hover/50'
                    }`}>
                    {/* Contact */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg shadow-sm"
                            style={{ backgroundColor: convo.contact?.color ?? '#7dd3fc' }}>
                            {contactInitials(convo.contact)}
                          </div>
                          {convo.status === 'open' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-green border-[1.5px] border-surface" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] transition-colors hover:text-primary ${isUnread ? 'font-bold text-text-main' : 'font-medium text-text-main'}`}>
                            {contactDisplayName(convo.contact)}
                          </span>
                          {isUnread && (
                            <span className="w-4 h-4 rounded-full bg-primary text-bg text-[9px] font-bold flex items-center justify-center shadow-sm shrink-0">
                              {convo.unreadCount}
                            </span>
                          )}
                          {convo.starred && (
                            <Star className="w-3 h-3 text-accent-amber fill-accent-amber shrink-0" />
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Channel */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
                        <ConvoIcon className="w-3.5 h-3.5 shrink-0" style={{ color: CH_COLOR[convo.channel as Channel] ?? '#7dd3fc' }} />
                        {CH_LABEL[convo.channel as Channel] ?? convo.channel}
                      </div>
                    </td>
                    {/* Preview */}
                    <td className="p-3 max-w-[280px]">
                      <p className={`text-[13px] truncate ${isUnread ? 'font-semibold text-text-main' : 'font-medium text-text-muted'}`}>
                        {previewText}
                      </p>
                    </td>
                    {/* Status */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shadow-sm border ${
                        convo.status === 'open'
                          ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                          : 'border-border bg-bg text-text-muted'
                      }`}>
                        {convo.status}
                      </span>
                    </td>
                    {/* Timestamp */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-medium text-text-muted opacity-60 whitespace-nowrap">
                          {timeAgo(convo.lastMessageAt ?? convo.updatedAt)}
                        </span>
                        <button
                          onClick={e => handleStar(convo.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-accent-amber"
                        >
                          <Star className={`w-3.5 h-3.5 ${convo.starred ? 'fill-accent-amber text-accent-amber' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ FOOTER ══ */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-lg text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60" />
            {filtered.length} {filter === 'all' ? 'Conversations' : filter === 'unread' ? 'Unread' : 'Starred'}
          </span>
        </div>
        <div className="text-[12px] font-medium text-text-muted">
          {convos.filter(c => c.status === 'open').length} open · {convos.filter(c => c.status === 'closed').length} closed
        </div>
      </div>

      {/* ══ CENTERED THREAD MODAL ══ */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              onClick={() => setSelectedId(null)}
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[860px] h-[82vh] bg-surface shadow-2xl z-50 flex flex-col border border-border rounded-xl overflow-hidden"
            >
              <ConversationThread
                key={selected.id}
                selected={selected}
                onClose={() => setSelectedId(null)}
                setSelectedId={setSelectedId}
                showToast={showToast}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ NEW CONVERSATION MODAL ══ */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-[480px] max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-border/50 shadow-luxury overflow-hidden"
            >
              <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b border-border/40">
                <div>
                  <p className="text-[15px] font-bold text-text-main">New Conversation</p>
                  <p className="text-[11px] font-medium text-text-muted mt-0.5">Start a thread with any contact</p>
                </div>
                <button onClick={() => setShowNewModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Contact picker */}
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2">Contact</label>
                  {ncContact ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-bg"
                        style={{ backgroundColor: ncContact.color ?? '#7dd3fc' }}>
                        {((ncContact.firstName?.[0] ?? '') + (ncContact.lastName?.[0] ?? '')).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-text-main truncate">{`${ncContact.firstName ?? ''} ${ncContact.lastName ?? ''}`.trim()}</p>
                        <p className="text-[11px] text-text-muted truncate">{ncContact.email ?? ''}</p>
                      </div>
                      <button onClick={() => setNcContact(null)} className="p-1 rounded-lg text-text-muted hover:text-text-main transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                      <input value={ncSearch} onChange={e => setNcSearch(e.target.value)} placeholder="Search CRM contacts..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted" />
                      {ncFiltered.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border/50 overflow-hidden shadow-luxury z-20 max-h-48 overflow-y-auto bg-surface/90 backdrop-blur-xl">
                          {ncFiltered.map((c: any) => (
                            <button key={c.id} onClick={() => { setNcContact(c); setNcSearch(''); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-hover transition-colors text-left">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-bg shrink-0"
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

                {/* Channel */}
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2">Channel</label>
                  <div className="flex flex-wrap gap-2">
                    {(['email', 'sms', 'whatsapp', 'chat'] as const).map(ch => (
                      <button key={ch} onClick={() => setNcChannel(ch)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                          ncChannel === ch ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border/50 text-text-muted hover:border-border hover:text-text-main'
                        }`}>
                        {React.createElement(CH_ICON[ch] ?? MessageSquare, { className: 'w-3.5 h-3.5', style: { color: ncChannel === ch ? CH_COLOR[ch] : undefined } })}
                        {CH_LABEL[ch]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject (email only) */}
                {ncChannel === 'email' && (
                  <div>
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2">Subject</label>
                    <input value={ncSubject} onChange={e => setNcSubject(e.target.value)} placeholder="Email subject..."
                      className="w-full px-3 py-2.5 rounded-lg border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors placeholder:text-text-muted" />
                  </div>
                )}

                {/* First message */}
                <div>
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-2">
                    First Message <span className="normal-case text-text-muted/50 font-normal">(optional)</span>
                  </label>
                  <textarea value={ncFirstMsg} onChange={e => setNcFirstMsg(e.target.value)} placeholder="Write your opening message..." rows={3}
                    className="w-full px-3 py-2.5 rounded-lg border border-border/50 bg-bg text-[12px] text-text-main focus:outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-text-muted" />
                </div>
              </div>

              <div className="px-6 py-4 flex gap-3 shrink-0 border-t border-border/40 bg-surface/60">
                <button onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-bold border border-border/50 text-text-muted hover:text-text-main hover:border-border transition-colors">
                  Cancel
                </button>
                <button onClick={handleCreateConversation} disabled={!ncChannel || createMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-bold bg-primary text-bg hover:opacity-90 disabled:opacity-40 transition-all shadow-sm">
                  {createMutation.isPending ? 'Creating...' : 'Start Conversation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ SETTINGS MODAL ══ */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-[500px] max-h-[85vh] flex flex-col rounded-2xl bg-surface border border-border/50 shadow-luxury overflow-hidden"
            >
              <div className="px-6 py-5 flex items-center justify-between shrink-0 border-b border-border/40">
                <p className="text-[15px] font-bold text-text-main">Channel Settings</p>
                <button onClick={() => setShowSettingsModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-border/50 text-text-muted hover:text-text-main hover:bg-surface-hover transition-all">
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
