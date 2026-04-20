import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Plus, X, MessageSquare, Users, Lock,
  Send, Phone, Mail, Paperclip, MoreHorizontal, CheckCheck,
  ExternalLink, UserCheck, Star, Inbox, AtSign,
  ChevronRight, Settings, Tag, Filter, ChevronDown,
  Bell, BellOff, Archive, Trash2, Check, Copy,
  MoreVertical, Clock, Hash, Zap, Globe, Smartphone,
  ToggleLeft, ToggleRight, Info, List, Facebook, Instagram, Linkedin, Video
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────

type Channel = 'sms' | 'email' | 'whatsapp' | 'chat' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin';

interface ConvContact {
  id: string; name: string; email?: string; phone?: string;
  color: string; initials: string; tags: string[]; dnd: boolean;
}
interface Conversation {
  id: string; contact: ConvContact;
  channel: Channel;
  lastMessage: string; lastAt: string;
  unread: number; status: 'open' | 'closed';
  isNew?: boolean; starred?: boolean;
  assignedTo?: string;
}
interface Message {
  id: string; body: string; direction: 'inbound' | 'outbound';
  createdAt: string; status?: 'sent' | 'delivered' | 'read';
  channel: Channel | 'note';
}

// ─── Demo Data ───────────────────────────────────────────────

const CONTACTS: ConvContact[] = [
  { id: 'c1', name: 'Jack Stone',      email: 'jackxstonee@gmail.com', phone: '(408) 499-7331', color: '#7dd3fc', initials: 'JS', tags: ['vip'],        dnd: false },
  { id: 'c2', name: 'Casey Morgan',    email: 'casey@example.com',     phone: '+16541234567',   color: '#c4b5fd', initials: 'CM', tags: ['follow-up'], dnd: false },
  { id: 'c3', name: 'Taylor Reynolds', email: '',                       phone: '+17865689546',   color: '#93c5fd', initials: 'TR', tags: ['warm-lead'], dnd: true  },
  { id: 'c4', name: 'Jordan Smith',    email: 'jordan@example.com',     phone: '',               color: '#86efac', initials: 'JS', tags: [],            dnd: false },
  { id: 'c5', name: 'Alex Doe',        email: 'alex@business.com',      phone: '+19001234567',   color: '#fca5a5', initials: 'AD', tags: ['client'],    dnd: false },
];

const CONVOS_DATA: Conversation[] = [
  { id: 'v1', contact: CONTACTS[0], channel: 'instagram', lastMessage: 'Loved the reel you posted!',  lastAt: '2026-04-16T18:00:00Z', unread: 1, status: 'open',   isNew: true,  assignedTo: 'Jack Stone' },
  { id: 'v2', contact: CONTACTS[1], channel: 'linkedin',  lastMessage: 'Good connecting with you.',    lastAt: '2026-04-15T12:30:00Z', unread: 0, status: 'open', starred: true,  assignedTo: 'Jack Stone' },
  { id: 'v3', contact: CONTACTS[2], channel: 'tiktok',    lastMessage: 'Where can I buy this?',        lastAt: '2026-04-14T09:00:00Z', unread: 2, status: 'open',                assignedTo: undefined },
  { id: 'v4', contact: CONTACTS[3], channel: 'sms',      lastMessage: 'Thanks for the update.',        lastAt: '2026-04-13T20:00:00Z', unread: 0, status: 'closed',              assignedTo: undefined },
  { id: 'v5', contact: CONTACTS[4], channel: 'facebook',  lastMessage: 'Do you have availability?',    lastAt: '2026-04-12T15:00:00Z', unread: 0, status: 'closed',              assignedTo: undefined },
];

const MESSAGES_DATA: Record<string, Message[]> = {
  v1: [
    { id: 'm1', body: 'Hi! Loved the reel you posted yesterday.', direction: 'inbound', createdAt: '2026-04-16T17:55:00Z', channel: 'instagram' },
    { id: 'm2', body: 'Hey Jack! Thanks so much, really appreciate it.', direction: 'outbound', createdAt: '2026-04-16T17:57:00Z', channel: 'instagram', status: 'read' },
    { id: 'm3', body: "Are you guys accepting new clients for video production?", direction: 'inbound', createdAt: '2026-04-16T17:59:00Z', channel: 'instagram' },
  ],
  v2: [
    { id: 'm4', body: 'Hi Casey. I saw your post on growth loops.', direction: 'inbound',  createdAt: '2026-04-15T12:28:00Z', channel: 'linkedin' },
    { id: 'm5', body: "Good connecting with you. Let's touch base soon.", direction: 'outbound', createdAt: '2026-04-15T12:31:00Z', channel: 'linkedin', status: 'delivered' },
  ],
  v3: [], v4: [], v5: [],
};

// ─── Helpers ─────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
}

const CH_LABEL: Record<Channel, string> = { 
  sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp', chat: 'Live Chat',
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn'
};
const CH_COLOR: Record<Channel, string> = { 
  sms: '#7dd3fc', email: '#c4b5fd', whatsapp: '#86efac', chat: '#fbbf24',
  facebook: '#1877F2', instagram: '#E4405F', tiktok: '#ff0050', linkedin: '#0A66C2'
};
const CH_ICON = {
  sms: Smartphone, email: Mail, whatsapp: Phone, chat: MessageSquare,
  facebook: Facebook, instagram: Instagram, tiktok: Video, linkedin: Linkedin
};

// ─── Shared class components ─────────────────────────────────

const FROSTED_GLASS_CLASSES = "bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5";
const FROSTED_HEADER_CLASSES = "bg-surface/80 backdrop-blur-md border-b border-border/50";

// ─── Right Nav definition ─────────────────────────────────────

type PanelKey = 'contact' | 'team' | 'my-inbox' | 'internal' | 'assigned' | 'starred' | 'settings';

const RIGHT_NAV: { key: PanelKey; icon: any; label: string; badge?: number }[] = [
  { key: 'contact',   icon: UserCheck,    label: 'Contact'    },
  { key: 'team',      icon: Inbox,        label: 'Team Inbox', badge: 3 },
  { key: 'my-inbox',  icon: AtSign,       label: 'My Inbox',   badge: 2 },
  { key: 'internal',  icon: Lock,         label: 'Internal'   },
  { key: 'assigned',  icon: Users,        label: 'Assigned'   },
  { key: 'starred',   icon: Star,         label: 'Starred'    },
  { key: 'settings',  icon: Settings,     label: 'Settings'   },
];

// ─── Settings Panel ───────────────────────────────────────────

function SettingsPanel({ showToast }: { showToast: (t: 'success'|'error'|'info'|'warning', msg: string) => void }) {
  const [channels, setChannels] = useState<Record<Channel, boolean>>({
    sms: false, email: false, whatsapp: false, chat: false,
    facebook: false, instagram: false, tiktok: false, linkedin: false
  });
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/integrations').then(res => res.json()).then(data => {
      setChannels(prev => ({ ...prev, ...data }));
    }).catch(console.error);
  }, []);

  const handleConnect = async (ch: Channel) => {
    if (channels[ch]) {
      setSyncing(prev => ({ ...prev, [ch]: true }));
      try {
        await fetch(`/api/integrations/${ch}`, { method: 'DELETE' });
        setChannels(p => ({ ...p, [ch]: false }));
        showToast('info', `${CH_LABEL[ch]} disconnected.`);
      } finally {
        setSyncing(prev => ({ ...prev, [ch]: false }));
      }
      return;
    }
    
    setSyncing(prev => ({ ...prev, [ch]: true }));
    // Using simple redirect for OAuth Mock
    window.location.href = `/api/integrations/auth/${ch}`;
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto text-[12px]">
      {/* Integrations Header */}
      <div className={`px-4 py-4 border-b border-border/40 shrink-0 sticky top-0 z-10 ${FROSTED_HEADER_CLASSES}`}>
        <p className="text-[12px] font-bold text-text-main">Workspace Connections</p>
        <p className="text-[10.5px] text-text-muted mt-1 leading-snug">Connect your social accounts and messaging platforms to aggregate your inbox.</p>
      </div>

      <div className="p-4 space-y-4">
        {(Object.entries(channels) as [Channel, boolean][]).map(([ch, on]) => {
          const Icon = CH_ICON[ch];
          const isSyncing = syncing[ch];
          return (
            <div key={ch} className="flex items-center justify-between p-3 border border-border/40 rounded-xl bg-surface/30 hover:border-border transition-all">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-bg shadow-sm" style={{ backgroundColor: CH_COLOR[ch] }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[12px] font-bold text-text-main">{CH_LABEL[ch]}</div>
                  <div className={`text-[10px] font-medium mt-0.5 ${on ? 'text-accent-green' : 'text-text-muted'}`}>{on ? 'Connected & Active' : 'Not Connected'}</div>
                </div>
              </div>
              <button 
                onClick={() => handleConnect(ch)}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-[6px] text-[11px] font-bold transition-all ${
                  isSyncing ? 'opacity-50 border border-border text-text-muted' :
                  on ? 'border border-border/50 text-text-muted hover:border-accent-red/30 hover:text-accent-red hover:bg-accent-red/10' :
                  'bg-primary text-bg shadow-sm hover:opacity-90'
                }`}
              >
                {isSyncing ? 'Syncing...' : on ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 mt-auto border-t border-border/40">
         <button onClick={() => showToast('success', 'Changes saved successfully!')} 
            className="w-full py-2 bg-primary text-bg font-bold rounded-lg hover:opacity-90 transition-opacity">
            Save Configurations
         </button>
      </div>
    </div>
  );
}

// ─── Right Sub-panel ──────────────────────────────────────────

function RightSubPanel({ panelKey, contact, convos, onSelectConvo, showToast }: {
  panelKey: PanelKey; contact: ConvContact | null;
  convos: Conversation[]; onSelectConvo: (id: string) => void;
  showToast: (t: 'success'|'error'|'info'|'warning', msg: string) => void;
}) {
  const inboxGroups = {
    team:      [{ label: 'Unread', count: 3 }, { label: 'Recents', count: 5 }, { label: 'Starred', count: 1 }, { label: 'All', count: 8 }],
    'my-inbox': [{ label: 'Assigned to me', count: 2 }, { label: 'Recents', count: 2 }, { label: 'Starred', count: 0 }, { label: 'All', count: 2 }],
    internal:  [{ label: 'Unread', count: 0 }, { label: 'All', count: 0 }],
  };

  if (panelKey === 'settings') return <SettingsPanel showToast={showToast} />;

  if (panelKey === 'contact' && contact) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="px-4 py-6 flex flex-col items-center text-center gap-2 border-b border-border/40 relative">
          <div className="absolute top-4 right-4"><span className={`px-2 py-0.5 rounded-[4px] text-[9.5px] font-bold uppercase tracking-wider bg-bg border border-border/50 ${contact.dnd ? 'text-accent-red' : 'text-text-muted'}`}>{contact.dnd ? 'DND ON' : 'DND OFF'}</span></div>
          <div className="w-16 h-16 rounded-[12px] flex items-center justify-center text-[20px] font-bold text-bg shadow-sm"
            style={{ backgroundColor: contact.color }}>{contact.initials}</div>
          <div className="mt-2">
            <p className="text-[14.5px] font-bold text-text-main">{contact.name}</p>
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
            { label: 'Email',    value: contact.email || '—' },
            { label: 'Phone',    value: contact.phone || '—' },
            { label: 'Owner',    value: 'Unassigned' },
            { label: 'Platform', value: 'Unified' },
          ].map(row => (
            <div key={row.label} className="px-5 py-3">
              <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-0.5">{row.label}</p>
              <p className={`text-[12px] font-medium ${row.value === '—' || row.value === 'Unassigned' ? 'text-text-muted italic' : 'text-text-main'}`}>{row.value}</p>
            </div>
          ))}
          <div className="px-5 py-3 border-b border-border/30">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-1.5 flex items-center justify-between">Tags <button onClick={() => showToast('info', 'Adding tags')} className="text-primary"><Plus className="w-3 h-3"/></button></p>
            {contact.tags.length > 0
              ? <div className="flex flex-wrap gap-1.5">{contact.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-[4px] text-[10px] bg-bg border border-border/50 text-primary font-bold shadow-sm">{t}</span>)}</div>
              : <p className="text-[11px] text-text-muted italic">No tags assigned</p>}
          </div>
        </div>
      </div>
    );
  }

  // assigned, starred, etc...
  const assigned = convos.filter(c => panelKey === 'assigned' ? c.assignedTo : c.starred);
  if (panelKey === 'assigned' || panelKey === 'starred') {
    return (
      <div className="p-3 space-y-2">
        {assigned.length === 0 ? <p className="text-[11.5px] text-text-muted italic px-1 font-medium mt-2">No conversations found.</p> : assigned.map(c => (
          <button key={c.id} onClick={() => onSelectConvo(c.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] bg-bg border border-border/40 hover:border-border transition-all text-left shadow-sm">
            <div className="w-8 h-8 rounded-[8px] flex items-center justify-center text-[10px] font-bold text-bg shrink-0 shadow-sm" style={{ backgroundColor: c.contact.color }}>{c.contact.initials}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-text-main truncate">{c.contact.name}</p>
              <p className="text-[10px] text-text-muted truncate font-medium">{c.lastMessage}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }

  // Inbox group panels
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

// ─── Main Export ─────────────────────────────────────────────

type FilterMode = 'all' | 'unread' | 'starred';

export default function ConversationsTab() {
  const { toast } = useToast() || { toast: window.alert };
  const showToast = (t: string, m: string) => { if(typeof toast === 'function') { toast(t as any, m); } else { console.log(m); } };

  const [convos, setConvos]         = useState<Conversation[]>(CONVOS_DATA);
  const [messages, setMessages]     = useState<Record<string, Message[]>>(MESSAGES_DATA);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState<FilterMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>('v1');
  const [reply, setReply]           = useState('');
  const [replyChannel, setReplyChannel] = useState<Channel | 'note'>('instagram');
  const [activePanel, setActivePanel]   = useState<PanelKey | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = convos.find(c => c.id === selectedId) ?? null;
  const msgs     = messages[selectedId ?? ''] ?? [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, selectedId]);
  
  // Set default reply mode based on active conversation channel
  useEffect(() => { if (selected) { setReplyChannel(selected.channel); } }, [selectedId, selected]);

  const filtered = convos.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.contact.name.toLowerCase().includes(q);
    const matchFilter = filter === 'all' ? true : filter === 'unread' ? c.unread > 0 : !!c.starred;
    return matchSearch && matchFilter;
  });

  const handleSend = async () => {
    if (!reply.trim() || !selectedId) return;
    const bodyText = reply.trim();
    const newMsg: Message = {
      id: `m-${Date.now()}`, body: bodyText,
      direction: 'outbound', createdAt: new Date().toISOString(),
      channel: replyChannel,
      status: 'sent',
    };
    setMessages(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] ?? []), newMsg] }));
    setConvos(prev => prev.map(c => c.id === selectedId ? { ...c, unread: 0, lastMessage: bodyText, lastAt: new Date().toISOString() } : c));
    setReply('');
    if (replyChannel !== 'note') {
       try {
         const response = await fetch('/api/integrations/messages/send', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ channel: replyChannel, to: selected?.contact.id, body: bodyText })
         });
         const data = await response.json();
         if (!response.ok) {
           showToast('error', data.error || 'Failed to dispatch message');
           return;
         }
         setMessages(prev => {
            const m = prev[selectedId] || [];
            const idx = m.findIndex(msg => msg.id === newMsg.id);
            if (idx > -1) { m[idx] = { ...m[idx], status: 'delivered' }; }
            return { ...prev };
         });
       } catch (err) {
         showToast('error', 'Network error delivering message');
       }
    }
  };

  const handleClose = () => {
    if (!selectedId) return;
    setConvos(prev => prev.map(c => c.id === selectedId ? { ...c, status: c.status === 'open' ? 'closed' : 'open' } : c));
  };

  const handleStar = (id: string, e: any) => {
    e.stopPropagation();
    setConvos(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));
  };

  const togglePanel = (key: PanelKey) => setActivePanel(p => p === key ? null : key);

  return (
    <div className="flex h-full overflow-hidden bg-bg p-6 gap-6 font-sans">
      
      {/* ══════ LEFT: Conversation List ══════ */}
      <div className={`w-[320px] shrink-0 flex flex-col rounded-[12px] ${FROSTED_GLASS_CLASSES} overflow-hidden`}>

        {/* Header */}
        <div className={`px-5 pt-5 pb-4 space-y-3 ${FROSTED_HEADER_CLASSES}`}>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-bold text-text-main">Inbox</span>
            <button onClick={() => showToast('info', 'Composing new message...')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-bold text-bg hover:opacity-90 transition-all shadow-[0_2px_10px_var(--primary-glow)] bg-primary border bg-primary border-primary">
              <Plus className="w-3.5 h-3.5" /> Compose
            </button>
          </div>
          <div className="relative shadow-sm rounded-[8px] border border-border bg-bg/50 focus-within:border-primary/50 transition-colors">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..."
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

        {/* List */}
        <div className="flex-1 overflow-y-auto styled-scrollbar">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
              <MessageSquare className="w-8 h-8 text-border" />
              <p className="text-[12px] text-text-muted font-bold">No conversations found</p>
            </div>
          ) : filtered.map(convo => {
             const ConvoIcon = CH_ICON[convo.channel];
             return (
               <div key={convo.id}
                 className={`relative border-b border-border/40 group transition-all ${selectedId === convo.id ? 'bg-primary/5 border-l-[3px] border-l-primary' : 'hover:bg-surface-hover/50 border-l-[3px] border-l-transparent'}`}>
                 <button onClick={() => setSelectedId(convo.id)} className="w-full text-left px-4 py-4 flex items-start gap-3">
                   {/* Avatar */}
                   <div className="relative shrink-0 mt-0.5">
                     <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-bg shadow-sm border border-border/50" style={{ backgroundColor: convo.contact.color }}>
                       {convo.contact.initials}
                     </div>
                     {convo.status === 'open' && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-accent-green border-[2px] border-surface" />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center justify-between gap-1 mb-1">
                       <span className={`text-[13px] truncate ${convo.unread > 0 ? 'font-bold text-text-main' : 'font-semibold text-text-main'}`}>{convo.contact.name}</span>
                       <div className="flex items-center gap-1.5 shrink-0">
                         {convo.starred && <Star className="w-3.5 h-3.5 text-accent-amber fill-accent-amber" />}
                         <span className="text-[10px] text-text-muted font-bold tracking-wider">{timeAgo(convo.lastAt)}</span>
                       </div>
                     </div>
                     <div className="flex items-center gap-2 mb-1.5">
                       <p className={`text-[12px] flex-1 truncate ${convo.unread > 0 ? 'font-semibold text-text-main' : 'text-text-muted/80 font-medium'}`}>{convo.lastMessage}</p>
                       {convo.unread > 0 && <span className="w-4 h-4 rounded-full bg-primary text-bg text-[9px] font-bold flex items-center justify-center shadow-sm shrink-0">{convo.unread}</span>}
                     </div>
                     <div className="flex items-center gap-1">
                       <ConvoIcon className="w-3 h-3 opacity-60" style={{ color: CH_COLOR[convo.channel] }} />
                       <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider">{CH_LABEL[convo.channel]}</span>
                     </div>
                   </div>
                 </button>
                 {/* Hover actions */}
                 <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={(e) => handleStar(convo.id, e)} title={convo.starred ? 'Unstar' : 'Star'}
                     className="w-6 h-6 flex items-center justify-center rounded-[6px] text-text-muted hover:text-accent-amber hover:border-accent-amber/50 transition-colors border border-border shadow-sm bg-surface">
                     <Star className={`w-3 h-3 ${convo.starred ? 'fill-accent-amber text-accent-amber' : ''}`} />
                   </button>
                 </div>
               </div>
             );
          })}
        </div>
      </div>

      {/* ══════ CENTER + RIGHT: Thread + Nav ══════ */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden min-w-0 gap-6">

          {/* Thread Container */}
          <div className={`flex-1 flex flex-col rounded-[12px] ${FROSTED_GLASS_CLASSES} overflow-hidden min-w-0`}>

            {/* Thread Header */}
            <div className={`px-6 py-4 flex items-center justify-between shrink-0 relative z-10 ${FROSTED_HEADER_CLASSES}`}>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[12px] font-bold text-bg shadow-sm border border-border/50" style={{ backgroundColor: selected.contact.color }}>
                    {selected.contact.initials}
                  </div>
                  {selected.status === 'open' && <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-accent-green border-[2px] border-surface shadow-sm" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[15px] font-bold text-text-main leading-tight">{selected.contact.name}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider shadow-sm border ${selected.status === 'open' ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : 'bg-bg border-border/50 text-text-muted'}`}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {React.createElement(CH_ICON[selected.channel], { className: "w-3 h-3", style: { color: CH_COLOR[selected.channel] }})}
                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{CH_LABEL[selected.channel]}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleClose}
                  className={`px-4 py-2 rounded-[8px] text-[12px] font-bold border transition-colors shadow-sm ${selected.status === 'open' ? 'border-border/50 bg-bg text-text-main hover:bg-surface-hover/80 hover:border-border' : 'border-accent-green/30 bg-accent-green/10 text-accent-green hover:bg-accent-green/20 hover:border-accent-green/50'}`}>
                  {selected.status === 'open' ? 'Close Issue' : 'Reopen Details'}
                </button>
                <div className="w-px h-6 bg-border mx-1" />
                <button onClick={() => showToast('info', 'Options opened')} className="p-2 rounded-[8px] border border-border/50 bg-surface shadow-sm text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
              {msgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-luxury ring-1 ring-white/5 ${FROSTED_GLASS_CLASSES}`}>
                    <MessageSquare className="w-6 h-6 text-border" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-text-main mb-1">Silence is golden</p>
                    <p className="text-[12px] font-medium text-text-muted">Start the thread by replying below.</p>
                  </div>
                </div>
              ) : msgs.map(msg => {
                const fromUs = msg.direction === 'outbound';
                return (
                  <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                    {!fromUs && (
                      <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[9px] font-bold text-bg mr-3 shrink-0 mt-auto border border-border/50 shadow-sm" style={{ backgroundColor: selected.contact.color }}>
                        {selected.contact.initials}
                      </div>
                    )}
                    <div className={`max-w-[70%] flex flex-col gap-1 ${fromUs ? 'items-end' : 'items-start'}`}>
                      {/* Tightened styling, removed 14px radius, replaced with sharper modern border radius */}
                      <div className={`px-3.5 py-2.5 rounded-[8px] text-[13px] leading-[1.6] shadow-[0_2px_4px_rgba(0,0,0,0.1)] border font-medium ${
                        fromUs
                          ? 'bg-primary border-primary text-bg rounded-br-[2px]'
                          : `bg-surface border-border text-text-main rounded-bl-[2px]`
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

            {/* Composer */}
            <div className={`border-t border-border/50 shrink-0 m-4 rounded-[12px] shadow-luxury overflow-hidden ${FROSTED_GLASS_CLASSES}`}>
              {/* Dynamic Action Tabs driven by Omnichannel options */}
              <div className="flex flex-wrap items-center border-b border-border/60 bg-surface/30">
                {(['instagram', 'linkedin', 'tiktok', 'facebook', 'whatsapp', 'sms', 'email', 'note'] as const).map(mode => {
                  const isActive = replyChannel === mode;
                  const Icon = mode === 'note' ? null : CH_ICON[mode as Channel];
                  return (
                    <button key={mode} onClick={() => setReplyChannel(mode)}
                      className={`flex items-center gap-1.5 py-2.5 px-3.5 text-[11px] font-bold transition-all relative whitespace-nowrap outline-none ${isActive ? 'text-primary bg-bg text-text-main shadow-inner' : 'text-text-muted hover:text-text-main hover:bg-surface/50'}`}>
                      {Icon && <Icon className="w-3.5 h-3.5" style={isActive ? { color: CH_COLOR[mode as Channel] } : {}} />}
                      <span className="uppercase tracking-wider">{mode === 'note' ? 'Int. Note' : CH_LABEL[mode as Channel]}</span>
                      {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_var(--primary)]" />}
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <div className="px-4 pt-3 flex-1 bg-bg/40">
                <textarea value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={replyChannel === 'note' ? 'Jot an internal comment... (invisible to contact)' : `Draft your ${replyChannel.toUpperCase()} response...`}
                  rows={2}
                  className={`w-full bg-transparent text-[13px] resize-none focus:outline-none placeholder:font-medium leading-relaxed font-semibold transition-colors ${replyChannel === 'note' ? 'text-accent-amber placeholder:text-accent-amber/40' : 'text-text-main placeholder:text-text-muted/60'}`}
                  style={{ maxHeight: '140px' }}
                  onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 140) + 'px'; }}
                />
              </div>

              {/* Footer toolbar */}
              <div className="flex items-center gap-2 px-3 pb-3 pt-2 bg-bg/40">
                <button onClick={() => showToast('info', 'File browser opened')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all outline-none"><Paperclip className="w-4 h-4" /></button>
                <button onClick={() => showToast('success', 'Snippet inserted')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all"><Zap className="w-4 h-4" /></button>
                <button onClick={() => showToast('info', 'Schedule modal opened')} className="p-2 rounded-[8px] text-text-muted hover:text-text-main hover:bg-surface hover:shadow-sm border border-transparent hover:border-border transition-all"><Clock className="w-4 h-4" /></button>
                <div className="flex-1" />
                <button onClick={() => setReply('')} className="px-4 py-2 rounded-[8px] text-[11px] font-bold text-text-muted uppercase tracking-wider hover:text-text-main transition-colors outline-none mr-1">Clear</button>
                <button onClick={handleSend} disabled={!reply.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-[8px] text-[12px] font-bold text-bg disabled:opacity-40 hover:opacity-90 transition-all shadow-sm bg-primary border border-primary outline-none">
                  <Send className="w-3.5 h-3.5" /> {replyChannel === 'note' ? 'Save Note' : 'Send'}
                </button>
              </div>
            </div>
          </div>

          {/* ══ Right Nav Bar & Slide-outs ══ */}
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
                    <RightSubPanel panelKey={activePanel} contact={selected.contact} convos={convos} onSelectConvo={id => { setSelectedId(id); setActivePanel(null); }} showToast={showToast} />
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
      ) : (
        <div className={`flex-1 flex flex-col items-center justify-center gap-5 text-center rounded-[12px] ${FROSTED_GLASS_CLASSES}`}>
          <div className={`w-20 h-20 rounded-[16px] flex items-center justify-center shadow-luxury ring-1 ring-white/5 ${FROSTED_GLASS_CLASSES}`}>
            <MessageSquare className="w-8 h-8 text-border" />
          </div>
          <div>
            <p className="text-[16px] font-bold text-text-main mb-1.5">No conversation selected</p>
            <p className="text-[13px] font-medium text-text-muted">Pick a thread to view details.</p>
          </div>
          <button onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-[13px] font-bold text-bg hover:opacity-90 transition-all shadow-[0_2px_10px_var(--primary-glow)] border border-primary bg-primary mt-2">
            <Plus className="w-4 h-4" /> Start New
          </button>
        </div>
      )}

      {/* Modals & Layers */}
      <AnimatePresence>
        {showNewModal && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="fixed inset-0 bg-bg/80 backdrop-blur-md z-50 flex items-center justify-center p-6" onClick={() => setShowNewModal(false)}>
             <motion.div initial={{ scale: 0.96, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
                className={`w-full max-w-sm rounded-[14px] ${FROSTED_GLASS_CLASSES} overflow-hidden shadow-2xl`} onClick={e => e.stopPropagation()}>
                <div className={`p-5 border-b border-border/50 flex justify-between items-center ${FROSTED_HEADER_CLASSES}`}>
                   <h3 className="text-[14px] font-bold text-text-main">Start Conversation</h3>
                   <button onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-[8px] bg-surface flex justify-center items-center text-text-muted hover:text-text-main border border-border"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-6">
                   <p className="text-[12px] font-medium text-text-muted mb-4">You can connect additional accounts in Settings &gt; Integrations.</p>
                   <button onClick={() => { setShowNewModal(false); showToast('info', 'Drafting new message form')}} className="w-full py-2.5 bg-primary rounded-[8px] text-bg font-bold shadow-sm">Compose Draft</button>
                </div>
             </motion.div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
