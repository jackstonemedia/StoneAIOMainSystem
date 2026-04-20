import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Send, Phone, Mail, MessageSquare, Star, MoreVertical, Filter, Plus, X, User, Building2, ArrowUpRight, CheckCheck, Clock, Check, Settings2, Sparkles, MessageCircle, SlidersHorizontal } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';
import { MondayHeader, StatusPill } from '../../components/crm/MondayTable';

const API = '/api/business';
const getConversations = () => fetch(`${API}/conversations`).then(r => r.json());
const getMessages = (id: string) => fetch(`${API}/conversations/${id}/messages`).then(r => r.json());
const postMessage = (id: string, body: any) => fetch(`${API}/conversations/${id}/messages`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());

const channelConfig: Record<string, { icon: any; label: string; color: string }> = {
  email: { icon: Mail,          label: 'Email', color: 'bg-slate-100 text-slate-500' },
  sms:   { icon: Phone,         label: 'SMS',   color: 'bg-slate-100 text-slate-500' },
  chat:  { icon: MessageSquare, label: 'Chat',  color: 'bg-[#00cff4]/10 text-[#00cff4]' },
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
  
  // Settings state
  const [rightPaneView, setRightPaneView] = useState<'contact' | 'settings'>('contact');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [signatureEnabled, setSignatureEnabled] = useState(false);

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
    <div className="flex flex-col h-full w-full bg-white relative">
      <MondayHeader title="Inbox" subtitle="Communications" />
      
      {/* Custom Unified Toolbar mimicking MondayToolbar but fit for Inbox */}
      <div className="flex items-center justify-between px-8 py-3 bg-white border-b border-slate-200/80 shrink-0 z-10 sticky top-[88px]">
        <div className="flex">
          <button className="bg-[#0073ea] hover:bg-[#0060c2] text-white text-[13px] font-medium px-4 py-1.5 rounded transition-colors shadow-sm font-sans flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New message
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
               type="text" 
               placeholder="Search..." 
               value={search} onChange={e => setSearch(e.target.value)}
               className="pl-8 pr-3 py-1.5 text-[13px] border border-slate-200 rounded focus:outline-none focus:border-[#0073ea] text-slate-700 w-48 transition-colors bg-slate-50 focus:bg-white"
            />
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <button 
             onClick={() => setRightPaneView(rightPaneView === 'settings' ? 'contact' : 'settings')}
             className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium transition-colors ${rightPaneView === 'settings' ? 'bg-[#e5f0ff] text-[#0073ea]' : 'text-slate-600 hover:bg-slate-100'}`}
          >
             <Settings2 className="w-4 h-4" /> Settings
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white">
        {/* Pane 1: Conversation list */}
        <div className="w-80 shrink-0 border-r border-slate-200/80 flex flex-col bg-white">
          <div className="flex px-4 py-2 bg-white border-b border-slate-100 gap-1 overflow-x-auto styled-scrollbar shrink-0">
            {(['all','open','closed'] as const).map(f => (
              <button 
                key={f} 
                onClick={() => setFilter(f)} 
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold capitalize transition-all whitespace-nowrap ${filter === f ? 'bg-[#0073ea] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto w-full styled-scrollbar">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[13px] font-medium text-slate-400">No conversations</div>
            ) : filtered.map((c: any) => {
              const ch = channelConfig[c.channel] || channelConfig.chat;
              const initials = c.contact?.name?.substring(0,2).toUpperCase() ?? 'U';
              const isSelected = selectedId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-all relative flex flex-col gap-1 hover:bg-[#f6f7f9] ${isSelected ? 'bg-[#e5f0ff]/40 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-[#0073ea]' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[14px] truncate ${c.unreadCount > 0 ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}>{c.contact?.name ?? 'Unknown'}</span>
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">{timeAgo(c.updatedAt)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${ch.color}`}>
                        <ch.icon className="w-2.5 h-2.5" />{ch.label}
                      </span>
                      {c.status === 'closed' && (
                        <div className="bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 text-[10px] font-bold">Closed</div>
                      )}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#e2445c] text-white text-[9px] font-bold flex items-center justify-center shrink-0">{c.unreadCount}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pane 2: Thread */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selected ? (
            <>
              {/* Thread header */}
              <div className="h-[60px] border-b border-slate-200/80 px-6 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[13px] font-bold text-indigo-700 shadow-sm">
                    {selected?.contact?.name?.substring(0,2).toUpperCase() ?? 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-[15px] text-slate-800 leading-tight">{selected?.contact?.name ?? 'Unknown'}</div>
                    <div className="text-[12px] font-medium text-slate-400 flex items-center gap-1">
                      {(() => { const ch = channelConfig[selected?.channel] || channelConfig.chat; return <><ch.icon className="w-3.5 h-3.5" /> {ch.label} • Open</>; })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded text-[12px] font-bold bg-[#00c875]/10 text-[#00c875] border border-[#00c875]/20 hover:bg-[#00c875]/20 transition-colors">Mark Closed</button>
                  <button className="p-1.5 rounded text-slate-400 hover:text-[#ffcb00] transition-colors"><Star className="w-4 h-4" /></button>
                  <button className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors"><MoreVertical className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 bg-[#f6f7f9]/50 styled-scrollbar">
                {loadingMsgs ? (
                  Array.from({length:3}).map((_,i) => (
                    <div key={i} className={`flex ${i%2===0?'justify-start':'justify-end'}`}>
                      <div className="bg-slate-200 animate-pulse h-12 w-64 rounded-2xl" />
                    </div>
                  ))
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center font-medium">
                      <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-[13px] text-slate-400">No messages yet</p>
                    </div>
                  </div>
                ) : messages.map((msg: any) => {
                  const fromUs = msg.direction === 'outbound';
                  return (
                    <div key={msg.id} className={`flex ${fromUs ? 'justify-end' : 'justify-start'}`}>
                      {!fromUs && (
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mr-2.5 shrink-0 mt-auto drop-shadow-sm">
                          {selected?.contact?.name?.substring(0,1) ?? 'U'}
                        </div>
                      )}
                      <div className={`max-w-xl ${fromUs ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                        <div className={`px-5 py-3 text-[14px] leading-relaxed shadow-sm ${fromUs ? 'bg-[#0073ea] text-white rounded-2xl rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm'}`}>
                          {msg.body}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[10px] font-medium px-1 ${fromUs ? 'text-slate-400' : 'text-slate-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                          {fromUs && <CheckCheck className="w-3.5 h-3.5 text-[#00c875]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply box */}
              <div className="border-t border-slate-200/80 p-5 bg-white shrink-0 z-10 w-full">
                <div className="flex items-end gap-3 bg-white border border-slate-300 rounded-xl p-3 focus-within:border-[#0073ea] focus-within:ring-2 focus-within:ring-[#e5f0ff] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (reply.trim()) sendMutation.mutate(reply.trim()); } }}
                    placeholder={`Reply via ${channelConfig[selected?.channel]?.label ?? 'chat'}…`}
                    rows={1}
                    className="flex-1 bg-transparent text-[14px] text-slate-800 resize-none outline-none placeholder:text-slate-400 font-sans leading-relaxed py-1"
                    style={{ minHeight: '28px', maxHeight: '160px' }}
                    onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 160) + 'px'; }}
                  />
                  <button
                    disabled={!reply.trim() || sendMutation.isPending}
                    onClick={() => reply.trim() && sendMutation.mutate(reply.trim())}
                    className="p-2.5 rounded-lg bg-[#0073ea] text-white disabled:bg-slate-200 disabled:text-slate-400 hover:bg-[#0060c2] transition-colors shrink-0 shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2.5 mt-3 px-1 overflow-x-auto styled-scrollbar">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-bold uppercase shrink-0">
                    <Sparkles className="w-3 h-3" /> Quick Gen:
                  </div>
                  {AI_DRAFTS.map((d, i) => (
                    <button key={i} onClick={() => setReply(d)} className="text-[12px] font-medium text-[#0073ea] border border-[#0073ea]/20 bg-[#e5f0ff]/50 rounded-full px-3 py-1 hover:bg-[#e5f0ff] transition-colors whitespace-nowrap">
                      {d.substring(0, 35)}…
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#f6f7f9]/50">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                <p className="text-[15px] font-bold text-slate-400">Select a conversation</p>
                <p className="text-[13px] text-slate-400 mt-1">Choose an item from the left pane to view.</p>
              </div>
            </div>
          )}
        </div>

        {/* Pane 3: Right Context (Contact / Settings) */}
        <div className="w-[300px] shrink-0 border-l border-slate-200/80 bg-white flex flex-col overflow-y-auto styled-scrollbar">
           {rightPaneView === 'contact' ? (
              selected && contact ? (
                <>
                  <div className="p-6 border-b border-slate-100 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl font-bold text-indigo-700 shadow-sm mb-4">
                      {contact.name?.substring(0,2).toUpperCase()}
                    </div>
                    <div className="font-bold text-[16px] text-slate-800">{contact.name}</div>
                    <div className="text-[13px] text-slate-500 font-medium mb-4">{contact.email}</div>
                    <a href={`/business/crm/contacts/${selected.id}`} className="flex items-center justify-center w-full py-2 bg-white border border-slate-200 rounded font-bold text-[13px] text-[#0073ea] hover:bg-slate-50 transition-colors shadow-sm">
                      Open in CRM <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                    </a>
                  </div>
                  <div className="p-6 space-y-5">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Context</h3>
                    {[
                      { icon: Building2, label: 'Company',    value: 'Acme Corp' },
                      { icon: User,       label: 'Deal Stage', value: 'Proposal' },
                      { icon: Clock,      label: 'Last Active',value: '2m ago' },
                    ].map(({icon: Icon, label, value}) => (
                      <div key={label} className="flex items-start gap-3">
                        <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase">{label}</div>
                          <div className="text-[14px] font-semibold text-slate-800 mt-0.5">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-slate-400 text-[13px] font-medium mt-10">
                   No contact selected.
                </div>
              )
           ) : (
             <div className="flex flex-col h-full w-full">
                <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                   <SlidersHorizontal className="w-5 h-5 text-slate-800" />
                   <h2 className="text-[15px] font-bold text-slate-800">Inbox Settings</h2>
                </div>
                <div className="p-6 space-y-8 flex-1">
                   {/* Setting: Auto Reply */}
                   <div>
                     <div className="flex flex-row items-center justify-between mb-3">
                       <div>
                         <label className="text-[13px] font-bold text-slate-800">Auto-Reply</label>
                         <p className="text-[11px] text-slate-500 font-medium">Send automatic responses.</p>
                       </div>
                       <button onClick={() => setAutoReplyEnabled(!autoReplyEnabled)} className={`w-8 h-4 rounded-full relative transition-colors ${autoReplyEnabled ? 'bg-[#00c875]' : 'bg-slate-200'}`}>
                         <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${autoReplyEnabled ? 'left-4' : 'left-0.5'}`} />
                       </button>
                     </div>
                     {autoReplyEnabled && (
                       <textarea 
                         className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-[13px] text-slate-700 resize-none focus:outline-none focus:border-[#0073ea]" 
                         rows={3} 
                         defaultValue="Thanks for reaching out! We'll get back to you within 24 hours." 
                       />
                     )}
                   </div>

                   <hr className="border-slate-100" />

                   {/* Setting: Signatures */}
                   <div>
                     <div className="flex flex-row items-center justify-between mb-3">
                       <div>
                         <label className="text-[13px] font-bold text-slate-800">Signature appended</label>
                         <p className="text-[11px] text-slate-500 font-medium">Attach to emails automatically.</p>
                       </div>
                       <button onClick={() => setSignatureEnabled(!signatureEnabled)} className={`w-8 h-4 rounded-full relative transition-colors ${signatureEnabled ? 'bg-[#0073ea]' : 'bg-slate-200'}`}>
                         <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${signatureEnabled ? 'left-4' : 'left-0.5'}`} />
                       </button>
                     </div>
                   </div>

                   <hr className="border-slate-100" />
                   
                   {/* Setting: Channels */}
                   <div>
                     <label className="text-[13px] font-bold text-slate-800 mb-3 block">Channel Configurations</label>
                     <div className="space-y-2">
                        {['Email Integration', 'SMS (Twilio)', 'Web Chat Widget'].map(ch => (
                          <div key={ch} className="flex items-center justify-between p-2 border border-slate-100 rounded bg-white">
                            <span className="text-[12px] font-bold text-slate-600">{ch}</span>
                            <span className="text-[10px] bg-[#e5f0ff] text-[#0073ea] font-bold px-2 py-0.5 rounded">Active</span>
                          </div>
                        ))}
                     </div>
                   </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <button className="w-full bg-white border border-slate-300 text-slate-700 font-bold text-[13px] py-2 rounded hover:bg-slate-50 transition-colors shadow-sm">
                    Manage Quick Snippets
                  </button>
                </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
