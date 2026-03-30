import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Send, Phone, Mail, MessageSquare, Star, MoreVertical, Filter, Plus, X, User, Building2, ArrowUpRight, CheckCheck, Clock } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

const API = '/api/business';
const getConversations = () => fetch(`${API}/conversations`).then(r => r.json());
const getMessages = (id: string) => fetch(`${API}/conversations/${id}/messages`).then(r => r.json());
const postMessage = (id: string, body: any) => fetch(`${API}/conversations/${id}/messages`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());

const channelConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail,          label: 'Email', color: 'text-blue-400 bg-blue-400/10' },
  sms:   { icon: Phone,         label: 'SMS',   color: 'text-purple-400 bg-purple-400/10' },
  chat:  { icon: MessageSquare, label: 'Chat',  color: 'text-teal-400 bg-teal-400/10' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
  return `${Math.floor(diff/86400000)}d`;
}

export default function Inbox() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>('c1');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [reply, setReply] = useState('');

  const { data: conversations = [] } = useQuery<any[]>({ queryKey: ['convos'], queryFn: getConversations });
  const { data: messages = [], isLoading: loadingMsgs } = useQuery<any[]>({
    queryKey: ['msgs', selectedId],
    queryFn: () => getMessages(selectedId!),
    enabled: !!selectedId,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => postMessage(selectedId!, { body, direction: 'outbound' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['msgs', selectedId] });
      qc.invalidateQueries({ queryKey: ['convos'] });
      setReply('');
      toast('success', 'Message sent');
    },
    onError: () => toast('error', 'Failed to send'),
  });

  const filtered = conversations.filter((c: any) => {
    const name = c.contact?.name ?? '';
    return (!search || name.toLowerCase().includes(search.toLowerCase())) &&
      (filter === 'all' || c.status === filter);
  });
  const selected = conversations.find((c: any) => c.id === selectedId);
  const contact = selected?.contact;

  const AI_DRAFTS = [
    'Thank you for reaching out! Happy to help with that.',
    "I'd be happy to schedule a call to discuss this further.",
    "I'll get back to you with more details shortly.",
  ];

  return (
    <div className="h-full flex overflow-hidden bg-bg">
      {/* Pane 1: Conversation list */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col bg-surface/50">
        <div className="px-4 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Inbox
              {conversations.filter((c:any)=>c.unreadCount>0).length > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {conversations.reduce((s:number,c:any)=>s+(c.unreadCount||0),0)}
                </span>
              )}
            </h1>
            <div className="flex gap-1">
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors" title="Filter">
                <Filter className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors" title="New conversation">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input type="text" placeholder="Search conversations…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-text-main placeholder:text-text-muted/50"
            />
          </div>
          <div className="flex bg-bg border border-border rounded-lg p-0.5">
            {(['all','open','closed'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text-main'}`}>{f}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">No conversations</div>
          ) : filtered.map((c: any) => {
            const ch = channelConfig[c.channel] || channelConfig.chat;
            const initials = c.contact?.name?.substring(0,2).toUpperCase() ?? 'U';
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-border/40 hover:bg-surface-hover transition-all relative ${selectedId === c.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-teal/20 border border-border flex items-center justify-center text-xs font-bold text-text-main">{initials}</div>
                    {c.status === 'open' && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-surface" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${c.unreadCount > 0 ? 'font-bold text-text-main' : 'font-medium text-text-main'}`}>{c.contact?.name ?? 'Unknown'}</span>
                      <span className="text-[10px] text-text-muted shrink-0">{timeAgo(c.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ch.color}`}>
                        <ch.icon className="w-2.5 h-2.5" />{ch.label}
                      </span>
                      {c.status === 'closed' && <span className="text-[10px] text-text-muted">Closed</span>}
                    </div>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center shrink-0">{c.unreadCount}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pane 2: Thread */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Thread header */}
          <div className="h-16 border-b border-border px-6 flex items-center justify-between shrink-0 bg-surface/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-teal/20 border border-border flex items-center justify-center text-xs font-bold">
                {selected?.contact?.name?.substring(0,2).toUpperCase() ?? 'U'}
              </div>
              <div>
                <div className="font-semibold text-sm">{selected?.contact?.name ?? 'Unknown'}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-1">
                  {(() => { const ch = channelConfig[selected?.channel] || channelConfig.chat; return <><ch.icon className="w-3 h-3" />{ch.label}</>; })()}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">Mark Closed</button>
              <button className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"><Star className="w-4 h-4" /></button>
              <button className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><MoreVertical className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingMsgs ? (
              Array.from({length:3}).map((_,i) => (
                <div key={i} className={`flex ${i%2===0?'justify-start':'justify-end'}`}>
                  <div className="skeleton h-10 w-48 rounded-2xl" />
                </div>
              ))
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="w-10 h-10 text-border mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No messages yet</p>
                </div>
              </div>
            ) : messages.map((msg: any) => {
              const fromUs = msg.direction === 'outbound';
              return (
                <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'} animate-fade-up`}>
                  {!fromUs && (
                    <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center text-[10px] font-bold text-text-muted mr-2 shrink-0 mt-1">
                      {selected?.contact?.name?.substring(0,1) ?? 'U'}
                    </div>
                  )}
                  <div className={`max-w-sm ${fromUs ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${fromUs ? 'bg-primary text-white rounded-br-sm' : 'bg-surface border border-border text-text-main rounded-bl-sm'}`}>
                      {msg.body}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] ${fromUs ? 'text-text-muted' : 'text-text-muted'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                      {fromUs && <CheckCheck className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply box */}
          <div className="border-t border-border p-4 bg-surface/30 shrink-0">
            <div className="flex items-end gap-3 bg-surface border border-border rounded-2xl p-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (reply.trim()) sendMutation.mutate(reply.trim()); } }}
                placeholder={`Reply via ${channelConfig[selected?.channel]?.label ?? 'chat'}…`}
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder-text-muted/40 leading-relaxed"
                style={{ minHeight: '24px', maxHeight: '128px' }}
                onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }}
              />
              <button
                disabled={!reply.trim() || sendMutation.isPending}
                onClick={() => reply.trim() && sendMutation.mutate(reply.trim())}
                className="p-2 rounded-xl bg-primary text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-primary-hover transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-2.5 px-1 flex-wrap">
              <span className="text-[10px] text-text-muted font-medium">AI drafts:</span>
              {AI_DRAFTS.map((d, i) => (
                <button key={i} onClick={() => setReply(d)} className="text-[10px] text-primary border border-primary/20 bg-primary/5 rounded-full px-2.5 py-1 hover:bg-primary/10 transition-colors">
                  {d.substring(0, 30)}…
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-border" />
            <p className="text-sm font-medium text-text-muted">Select a conversation</p>
          </div>
        </div>
      )}

      {/* Pane 3: Contact Context */}
      {selected && contact && (
        <div className="w-64 shrink-0 border-l border-border bg-surface/40 flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-border">
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Contact Info</div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-teal/30 border border-border flex items-center justify-center text-sm font-bold">
                {contact.name?.substring(0,2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm text-text-main">{contact.name}</div>
                <div className="text-xs text-text-muted">{contact.email}</div>
              </div>
              <a href={`/business/crm/contacts/${selected.id}`} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                Open in CRM <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {[
              { icon: Building2, label: 'Company',    value: 'Acme Corp' },
              { icon: User,       label: 'Deal Stage', value: 'Proposal' },
              { icon: Clock,      label: 'Last Active',value: '2m ago' },
            ].map(({icon: Icon, label, value}) => (
              <div key={label} className="flex items-start gap-2">
                <Icon className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] text-text-muted">{label}</div>
                  <div className="text-xs font-medium text-text-main">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
