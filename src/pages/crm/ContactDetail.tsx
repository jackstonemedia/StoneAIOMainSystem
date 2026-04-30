import React, { useState } from 'react';
import { 
  ChevronLeft, ChevronRight, User, Star, Plus, Phone, 
  Clock, CheckCircle2, Edit2, Calendar, Mail, DollarSign, 
  Share2, ChevronDown, Lock, Smile, Tag, FileText, Sparkles,
  ChevronUp, UserPlus, RefreshCw, Send
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ActivityTimeline from '../../components/crm/ActivityTimeline';
import { useToast } from '../../components/ui/Toast';

export default function ContactDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'contact' | 'company'>('contact');
  const [commsTab, setCommsTab] = useState<'sms' | 'email' | 'internal' | 'whatsapp'>('internal');
  const [commsText, setCommsText] = useState('');

  // Fetch the specific contact (mocking from full list if needed, or real endpoint)
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () => fetch('/api/crm/contacts').then(r => r.ok ? r.json().then(d => d.contacts || []) : [])
  });
  const contact = contacts.find((c: any) => c.id === id);

  // Fetch timeline events
  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ['contact-events', id],
    queryFn: () => fetch(`/api/crm/contacts/${id}/events`).then(r => r.ok ? r.json() : [])
  });

  // Add event mutation
  const addEvent = useMutation({
    mutationFn: async ({ type, content }: { type: string; content: string }) => {
      const res = await fetch(`/api/crm/contacts/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: type === 'note' ? 'Left a Note' : `Sent ${type.toUpperCase()}`, content })
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-events', id] });
      setCommsText('');
      toast('success', 'Timeline updated');
    },
    onError: () => toast('error', 'Failed to add activity')
  });

  const handleSend = () => {
    if (!commsText.trim()) return;
    addEvent.mutate({ type: commsTab === 'internal' ? 'note' : commsTab, content: commsText });
  };

  if (!contact) return <div className="p-8 text-center text-text-muted">Loading contact...</div>;

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header section */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-surface shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <Link to="/business/crm" className="flex items-center text-[13px] font-semibold text-text-muted hover:text-text-main transition-colors">
            <ChevronLeft className="w-4 h-4 mr-0.5" /> Back
          </Link>
          <div className="w-[1px] h-4 bg-border/80"></div>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-text-main/10 border border-text-main/20 shadow-sm">
              <span className="text-[12px] font-bold text-text-main">{contact.name.substring(0, 1)}</span>
            </div>
            <h1 className="text-[16px] font-bold text-text-main tracking-tight">{contact.name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 border-r border-border pr-6">
            <button className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[6px] hover:bg-surface-hover transition-colors card-hover-lift bg-surface">
              <div className="w-5 h-5 rounded-[4px] bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">JS</div>
              <span className="text-[13px] font-semibold text-text-main">Jack Stone</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <button className="w-8 h-8 rounded-[6px] border border-dashed border-border flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors bg-surface">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-[6px] shadow-sm overflow-hidden">
              <button className="flex items-center justify-center w-9 h-8 bg-primary text-white hover:opacity-90 transition-opacity">
                <Phone className="w-4 h-4" />
              </button>
              <button className="flex items-center justify-center w-7 h-8 bg-primary/90 text-white border-l border-white/20 hover:opacity-100 transition-opacity">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {[
              { icon: Clock, color: 'text-amber-400' },
              { icon: CheckCircle2, color: 'text-text-muted hover:text-emerald-400' },
              { icon: Edit2, color: 'text-text-muted hover:text-primary' },
              { icon: Calendar, color: 'text-text-muted hover:text-primary' },
              { icon: Mail, color: 'text-text-muted hover:text-primary' }
            ].map((btn, i) => (
              <button key={i} className={`w-8 h-8 rounded-[6px] flex items-center justify-center border border-border bg-surface hover:bg-surface-hover transition-colors card-hover-lift ${btn.color}`}>
                <btn.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main 3-pane layout */}
      <div className="flex-1 overflow-hidden flex">
        
        {/* Left Pane - Info */}
        <div className="w-[320px] flex flex-col border-r border-border shrink-0 bg-surface shadow-[4px_0_24px_rgba(0,0,0,0.06)] z-[5]">
          <div className="px-5 pt-3.5 flex items-center gap-5 border-b border-border bg-surface-hover/30 overflow-x-auto styled-scrollbar">
            {['Contact', 'Company', 'Pipelines', 'Custom'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase() as any)} 
                className={`pb-3 text-[13px] font-bold border-b-[3px] transition-colors whitespace-nowrap ${activeTab === tab.toLowerCase() ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
            <div>
              <div className="flex items-center justify-between bg-bg border border-border px-4 py-2.5 rounded-t-[8px]">
                <span className="text-[12px] font-bold text-text-main uppercase tracking-wider">About</span>
              </div>
              <div className="border border-border border-t-0 rounded-b-[8px] p-5 space-y-4 bg-surface-hover/20">
                {[
                  { label: 'First Name', value: contact.name.split(' ')[0] },
                  { label: 'Last Name', value: contact.name.split(' ').slice(1).join(' ') },
                  { label: 'Email', value: contact.email },
                  { label: 'Phone', value: contact.phone },
                  { label: 'Business name', value: contact.businessName },
                ].map((field, i) => (
                  <div key={i} className="flex flex-col relative group">
                    <label className="text-[11px] font-bold text-text-muted mb-1">{field.label}</label>
                    <input 
                      type="text" 
                      defaultValue={field.value} 
                      placeholder="—"
                      className="w-full bg-transparent border-b border-border/50 text-[13px] font-medium text-text-main pb-1.5 focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/40"
                    />
                  </div>
                ))}
                
                <div className="pt-3 flex justify-end">
                  <button className="px-4 py-2 bg-text-main text-bg rounded-[6px] text-[12px] font-bold hover:opacity-90 transition-colors shadow-sm">Save Changes</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Pane - Comms Center */}
        <div className="flex-1 flex flex-col min-w-[400px] bg-bg relative">
          <div className="px-6 pt-3 flex items-center justify-between border-b border-border bg-surface shrink-0 z-[4]">
            <div className="flex items-center gap-6">
              {[
                { id: 'sms', label: 'SMS', icon: null },
                { id: 'email', label: 'Email', icon: null },
                { id: 'internal', label: 'Internal Note', icon: Lock },
                { id: 'whatsapp', label: 'WhatsApp', icon: null }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setCommsTab(t.id as any)}
                  className={`flex items-center gap-1.5 pb-2.5 text-[13px] font-bold border-b-[3px] transition-colors ${commsTab === t.id ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main'}`}
                >
                  {t.icon && <t.icon className="w-3.5 h-3.5" />}
                  {t.label}
                  {t.id === 'internal' && <span className="text-[10px] uppercase font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-[4px]">Private</span>}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="flex flex-col flex-1 bg-surface border border-border shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-[12px] overflow-hidden">
              
              {/* Header logic (show To/From for email/sms) */}
              {commsTab !== 'internal' && (
                <div className="flex flex-col border-b border-border bg-surface-hover/30">
                  <div className="flex items-center px-5 py-3 border-b border-border text-[13px]">
                    <span className="text-text-muted w-14 font-bold text-[11px] uppercase tracking-wider">From</span>
                    <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                      <span className="font-semibold text-text-main">Jack Stone (+1 555-0000)</span>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                  </div>
                  <div className="flex items-center px-5 py-3 text-[13px]">
                    <span className="text-text-muted w-14 font-bold text-[11px] uppercase tracking-wider">To</span>
                    <div className="flex items-center gap-2 flex-1 cursor-pointer hover:text-primary transition-colors">
                      <span className="font-semibold text-text-main">{contact.name} ({contact.email || contact.phone || 'No contact info'})</span>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex-1 relative bg-surface flex flex-col max-h-[350px]">
                <textarea 
                  value={commsText}
                  onChange={(e) => setCommsText(e.target.value)}
                  className="w-full h-full p-5 text-[14px] text-text-main placeholder:text-text-muted/40 resize-none outline-none bg-transparent styled-scrollbar flex-1 min-h-[160px]"
                  placeholder={commsTab === 'internal' ? "Log a private note or mention teammates..." : `Type your ${commsTab} message here...`}
                />
                
                <div className="flex items-center justify-between p-3 border-t border-border bg-surface shrink-0">
                  <div className="flex items-center gap-1.5 border border-border rounded-[6px] p-0.5 bg-bg">
                    <button className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors font-bold text-[13px]">A</button>
                    <button className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors"><Smile className="w-4 h-4" /></button>
                    <button className="w-7 h-7 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors"><FileText className="w-4 h-4" /></button>
                    <div className="w-[1px] h-4 bg-border/50 mx-0.5" />
                    <button className="w-7 h-7 flex items-center justify-center rounded-[4px] text-primary hover:bg-primary/20 transition-colors"><Sparkles className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-border bg-surface-hover/30 flex items-center justify-between shrink-0">
                <button 
                  onClick={() => setCommsText('')}
                  className="px-4 py-2 rounded-[6px] text-[13px] font-bold text-text-muted hover:text-text-main hover:bg-surface border border-transparent hover:border-border transition-colors">
                  Discard
                </button>
                <div className="flex items-center shadow-sm">
                  <button 
                    onClick={handleSend}
                    disabled={addEvent.isPending || !commsText.trim()}
                    className="px-6 py-2.5 rounded-[6px] text-[13px] font-bold text-white transition-opacity bg-primary hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
                    {addEvent.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : (commsTab === 'internal' ? <FileText className="w-4 h-4" /> : <Send className="w-4 h-4" />)}
                    {commsTab === 'internal' ? 'Save Note' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center text-text-muted/60 text-[12px] font-medium flex items-center justify-center gap-2"><Lock className="w-3.5 h-3.5"/> End-to-end secured workspace</div>
          </div>
        </div>

        {/* Right Pane - Activity Timeline */}
        <div className="w-[360px] flex flex-col border-l border-border shrink-0 bg-surface shadow-[-4px_0_24px_rgba(0,0,0,0.06)] z-[5]">
          <div className="p-5 border-b border-border flex items-center justify-between bg-surface-hover/30">
            <button className="flex items-center gap-2 text-[14px] font-bold text-text-main hover:text-primary transition-colors">
              Activity History <ChevronDown className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 border border-border rounded-[6px] p-0.5 bg-bg">
              {[Clock, Phone, Mail, FileText].map((Icon, i) => (
                <button key={i} className="w-6 h-6 flex items-center justify-center rounded-[4px] text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 bg-surface-hover/10 styled-scrollbar">
            {eventsLoading ? (
              <div className="flex justify-center p-8"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="w-20 h-20 mb-5 relative">
                  <div className="absolute inset-0 border-2 border-dashed border-border rounded-full bg-surface-hover flex items-center justify-center">
                    <Clock className="w-8 h-8 text-border" />
                  </div>
                </div>
                <h3 className="text-[15px] font-bold text-text-main mb-1.5">No activities yet</h3>
                <p className="text-[12px] font-medium text-text-muted max-w-[200px]">Send an email, make a call, or add a note to build the timeline.</p>
              </div>
            ) : (
              <div className="pr-2">
                <ActivityTimeline 
                  activities={events.map((e: any) => ({
                    id: e.id,
                    type: e.type,
                    title: e.title,
                    description: e.content,
                    timestamp: e.createdAt,
                    relatedName: e.metadata?.type ? String(e.metadata.type).charAt(0).toUpperCase() + String(e.metadata.type).slice(1) : undefined
                  }))} 
                  compact={false}
                />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
