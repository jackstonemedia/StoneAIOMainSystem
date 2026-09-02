import { useState, useEffect } from 'react';
import { X, Mail, MessageSquare, Search, Plus, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { conversationsApi, channelConnectionsApi } from '../../../lib/api/conversations';
import { crmApi } from '../../../lib/api/crm';
import { queryKeys } from '../../../lib/queryKeys';
import { useConversationsCtx } from '../context/ConversationsContext';

type Step = 'channel' | 'compose';

export default function NewConversationModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { setSelectedId } = useConversationsCtx();
  const [step, setStep] = useState<Step>('channel');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');

  // Recipient
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [rawRecipient, setRawRecipient] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Compose fields
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [fromConnectionId, setFromConnectionId] = useState('');

  // Channel connections
  const { data: connections = [] } = useQuery({
    queryKey: queryKeys.conversations.channelConnections(),
    queryFn: channelConnectionsApi.list,
  });

  const emailConnections = Array.isArray(connections) ? connections.filter(c => c.provider === 'gmail' || c.provider === 'outlook') : [];
  const smsConnections = Array.isArray(connections) ? connections.filter(c => c.provider === 'twilio') : [];

  // Contact search
  const { data: rawContacts } = useQuery({
    queryKey: ['conversations', 'all-contacts'],
    queryFn: () => crmApi.getContacts(),
    staleTime: 60_000,
  });

  const allContacts: any[] = Array.isArray(rawContacts)
    ? rawContacts
    : Array.isArray((rawContacts as any)?.contacts)
    ? (rawContacts as any).contacts
    : [];

  const contactResults = allContacts
    .filter(c => {
      if (recipientSearch.length < 2) return false;
      const q = recipientSearch.toLowerCase();
      const name = `${(c as any).firstName ?? ''} ${(c as any).lastName ?? ''}`.toLowerCase();
      return name.includes(q) || (c.email ?? '').toLowerCase().includes(q) || ((c as any).phone ?? '').includes(q);
    })
    .slice(0, 8);

  const createConv = useMutation({
    mutationFn: () =>
      conversationsApi.create({
        contactId: selectedContact?.id ?? null,
        channel,
        subject: channel === 'email' ? subject : undefined,
        body,
        to: rawRecipient || undefined,
        fromChannelId: fromConnectionId || undefined,
      }),
    onSuccess: (conv) => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
      setSelectedId(conv.id);
      onClose();
    },
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const selectContact = (contact: any) => {
    setSelectedContact(contact);
    const name = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email || 'Contact';
    setRecipientSearch(name);
    setShowContactDropdown(false);
  };

  const canSend = (selectedContact || rawRecipient.trim()) && (channel === 'sms' || subject.trim()) && body.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl shadow-luxury ring-1 ring-white/5 w-full max-w-lg mx-4 overflow-hidden font-inter">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-hover/50">
          <h2 className="text-[15px] font-bold text-text-main">New Conversation</h2>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Channel picker */}
        {step === 'channel' && (
          <div className="p-6">
            <p className="text-[13px] text-text-muted mb-4">Choose a channel to start the conversation.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'email' as const, label: 'Email', icon: Mail, desc: 'Send via Gmail or Outlook' },
                { value: 'sms' as const, label: 'SMS', icon: MessageSquare, desc: 'Send via Twilio number' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setChannel(opt.value); setStep('compose'); }}
                  className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all group shadow-xs"
                >
                  <div className="w-12 h-12 rounded-xl bg-surface-hover group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <opt.icon className="w-6 h-6 text-text-muted group-hover:text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-bold text-text-main">{opt.label}</p>
                    <p className="text-[12px] text-text-muted mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Compose */}
        {step === 'compose' && (
          <div className="p-6 space-y-4">
            {/* Back + channel indicator */}
            <div className="flex items-center gap-2 -mt-1 mb-2">
              <button onClick={() => setStep('channel')} className="text-[12px] text-text-muted hover:text-text-main transition-colors flex items-center gap-1">
                ← Back
              </button>
              <span className="text-[12px] text-text-muted">|</span>
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-main">
                {channel === 'email' ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                {channel === 'email' ? 'Email' : 'SMS'}
              </div>
            </div>

            {/* From (if multiple connections) */}
            {channel === 'email' && emailConnections.length > 1 && (
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">From</label>
                <select
                  value={fromConnectionId}
                  onChange={e => setFromConnectionId(e.target.value)}
                  className="w-full bg-surface-hover border border-border text-text-main text-[13px] px-3 py-2 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select mailbox…</option>
                  {emailConnections.map(c => (
                    <option key={c.id} value={c.id}>{c.email ?? c.label ?? c.id}</option>
                  ))}
                </select>
              </div>
            )}
            {channel === 'sms' && smsConnections.length > 1 && (
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">From</label>
                <select
                  value={fromConnectionId}
                  onChange={e => setFromConnectionId(e.target.value)}
                  className="w-full bg-surface-hover border border-border text-text-main text-[13px] px-3 py-2 rounded-lg focus:outline-none focus:border-primary"
                >
                  <option value="">Select number…</option>
                  {smsConnections.map(c => (
                    <option key={c.id} value={c.id}>{c.twilioPhoneNumber ?? c.id}</option>
                  ))}
                </select>
              </div>
            )}

            {/* To / Recipient */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">To</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    value={recipientSearch}
                    onChange={e => {
                      setRecipientSearch(e.target.value);
                      setSelectedContact(null);
                      setShowContactDropdown(true);
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    placeholder={channel === 'email' ? 'Search contact or enter email…' : 'Search contact or enter phone…'}
                    className="w-full pl-9 pr-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                  {showContactDropdown && recipientSearch.length >= 2 && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface border border-border shadow-luxury ring-1 ring-white/5 rounded-xl overflow-hidden">
                      {contactResults.length === 0 && (
                        <div className="p-3">
                          <p className="text-[12px] text-text-muted text-center mb-2">No contact found</p>
                          <button
                            onClick={() => { setRawRecipient(recipientSearch); setShowContactDropdown(false); }}
                            className="w-full py-2 text-[12px] font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Use "{recipientSearch}" directly
                          </button>
                        </div>
                      )}
                      {contactResults.map((c: any) => {
                        const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.email || c.phone || '';
                        return (
                          <button
                            key={c.id}
                            onClick={() => selectContact(c)}
                            className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-border/30 last:border-0"
                          >
                            <p className="text-[13px] font-semibold text-text-main">{name}</p>
                            <p className="text-[11px] text-text-muted">{c.email ?? c.phone ?? ''}</p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              {selectedContact && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded-full text-[12px] text-primary font-medium">
                  {`${selectedContact.firstName ?? ''} ${selectedContact.lastName ?? ''}`.trim() || selectedContact.email}
                  <button onClick={() => { setSelectedContact(null); setRecipientSearch(''); }} className="ml-0.5">×</button>
                </div>
              )}
            </div>

            {/* Subject (email only) */}
            {channel === 'email' && (
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Subject</label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject…"
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
              </div>
            )}

            {/* Message body */}
            <div>
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Message</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={4}
                placeholder={channel === 'email' ? 'Write your email…' : 'Write your SMS message…'}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors">
                Cancel
              </button>
              <button
                onClick={() => createConv.mutate()}
                disabled={!canSend || createConv.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {createConv.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
