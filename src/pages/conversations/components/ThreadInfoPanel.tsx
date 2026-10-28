import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronUp, Plus, X, Check, Loader2, Send, Bot, Sparkles, FileText, CheckSquare
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { crmApi } from '../../../lib/api/crm';
import { queryKeys } from '../../../lib/queryKeys';
import { useToast } from '../../../components/ui/Toast';
import { apiFetch } from '../../../lib/apiClient';
import { useConversationsCtx } from '../context/ConversationsContext';
import type { Conversation } from '../../../types/conversation';
import type { UpdateContactInput } from '../../../types/crm';

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/40">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-[12px] font-bold text-text-main hover:bg-surface-hover transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <Plus className="w-3.5 h-3.5 text-text-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function ThreadInfoPanel({ conv, onClose, initialTab }: { conv: Conversation; onClose?: () => void; initialTab?: 'contact' | 'notes' | 'ai' }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const {
    composerDraft, setComposerDraft,
    composerSubject, setComposerSubject,
    setIsComposerOpen,
  } = useConversationsCtx();

  const [tab, setTab] = useState<'contact' | 'notes' | 'ai'>(initialTab || 'contact');
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newInternalNote, setNewInternalNote] = useState('');

  // AI Assistant Chat State
  const [aiChatMessages, setAiChatMessages] = useState<ChatMessage[]>([
    {
      id: 'initial-draft',
      role: 'assistant',
      text: "I'm your AI Copilot. I read the full conversation thread to craft accurate, contextual replies. Click 'Draft Reply' or type an instruction below.",
      timestamp: new Date(),
    }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [copilotOutput, setCopilotOutput] = useState<{ type: string; content: string } | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const contactId = conv.contactId || conv.contact?.id;

  // Fetch full CRM Contact details
  const { data: crmContact } = useQuery({
    queryKey: ['crm-contact', contactId],
    queryFn: () => (contactId ? crmApi.getContact(contactId) : null),
    enabled: !!contactId,
    staleTime: 30_000,
  });

  // Fetch workspace tags for autocomplete/presets
  const { data: workspaceTags = [] } = useQuery<string[]>({
    queryKey: ['workspace-tags'],
    queryFn: () => apiFetch('/api/crm/tags').then(r => r.ok ? r.json() : []),
  });

  // Fetch contact events / notes
  const { data: events = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ['contact-events', contactId],
    queryFn: () => (contactId ? apiFetch(`/api/crm/contacts/${contactId}/events`).then(r => r.ok ? r.json() : []) : []),
    enabled: !!contactId,
  });

  // Conversation mutation
  const patchConv = useMutation({
    mutationFn: (data: Parameters<typeof conversationsApi.patch>[1]) => conversationsApi.patch(conv.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conv.id) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.list() });
    },
  });

  // CRM Contact mutation
  const updateCrmContact = useMutation({
    mutationFn: (data: UpdateContactInput) => crmApi.updateContact(contactId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-contact', contactId] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: queryKeys.conversations.detail(conv.id) });
      toast('success', 'Contact updated', 'CRM record has been synchronized.');
    },
    onError: () => {
      toast('error', 'Update failed', 'Could not save changes to CRM contact.');
    }
  });

  // Add internal note mutation
  const addInternalNote = useMutation({
    mutationFn: async (content: string) => {
      if (!contactId) throw new Error('No contact linked');
      const res = await apiFetch(`/api/crm/contacts/${contactId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'internal_comment',
          title: 'Internal Note',
          content,
        })
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact-events', contactId] });
      setNewInternalNote('');
      toast('success', 'Note saved', 'Internal note logged on contact record.');
    },
    onError: () => {
      toast('error', 'Error', 'Failed to log note.');
    }
  });

  // Contact display calculations
  const rawContact = crmContact || conv.contact;
  const firstName = crmContact?.firstName ?? conv.contact?.firstName ?? '';
  const lastName = crmContact?.lastName ?? conv.contact?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const displayName = fullName || rawContact?.email || conv.subject || 'Unknown Contact';
  const email = crmContact?.email ?? conv.contact?.email ?? '';
  const phone = crmContact?.phone ?? conv.contact?.phone ?? '';
  const companyName = crmContact?.company?.name ?? '';
  const leadScore = crmContact?.leadScore ?? 0;
  const contactStatus = crmContact?.status ?? 'Lead';
  const contactTags: string[] = crmContact?.tags ?? (Array.isArray(conv.tags) ? conv.tags : (conv.tagsJson ? JSON.parse(conv.tagsJson as any) : []));

  // Form state for editing contact details
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    source: '',
    status: '',
    businessName: '',
    website: '',
    location: '',
    title: '',
  });

  useEffect(() => {
    if (crmContact || conv.contact) {
      setFormData({
        firstName: crmContact?.firstName ?? conv.contact?.firstName ?? '',
        lastName: crmContact?.lastName ?? conv.contact?.lastName ?? '',
        email: crmContact?.email ?? conv.contact?.email ?? '',
        phone: crmContact?.phone ?? conv.contact?.phone ?? '',
        dateOfBirth: (crmContact as any)?.dateOfBirth ? new Date((crmContact as any).dateOfBirth).toISOString().split('T')[0] : '',
        source: crmContact?.source ?? '',
        status: crmContact?.status ?? 'Lead',
        businessName: (crmContact as any)?.businessName ?? crmContact?.company?.name ?? '',
        website: (crmContact as any)?.socialProfilesJson ? (JSON.parse((crmContact as any).socialProfilesJson).website || '') : '',
        location: crmContact?.location ?? '',
        title: crmContact?.title ?? '',
      });
    }
  }, [crmContact, conv.contact]);

  // Set reply subject if empty on thread load
  useEffect(() => {
    if (!composerSubject && conv.subject) {
      setComposerSubject(conv.subject.startsWith('Re:') ? conv.subject : `Re: ${conv.subject}`);
    }
  }, [conv.id, conv.subject]);

  useEffect(() => {
    if (tab === 'ai') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages.length, isAiGenerating, tab]);

  const handleSaveContactForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId) return;

    const patchPayload: any = {
      firstName: formData.firstName || '',
      lastName: formData.lastName || '',
      email: formData.email || null,
      phone: formData.phone || null,
      title: formData.title || null,
      location: formData.location || null,
      source: formData.source || null,
      status: formData.status || 'Lead',
      businessName: formData.businessName || null,
    };

    if (formData.dateOfBirth) {
      patchPayload.dateOfBirth = new Date(formData.dateOfBirth).toISOString();
    }
    if (formData.website) {
      patchPayload.socialProfilesJson = JSON.stringify({ website: formData.website });
    }

    updateCrmContact.mutate(patchPayload);
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || contactTags.includes(trimmed)) return;
    const newTags = [...contactTags, trimmed];

    if (contactId) {
      updateCrmContact.mutate({ tags: newTags });
    }
    patchConv.mutate({ tags: newTags });
    setTagInput('');
    setIsAddingTag(false);
  };

  const removeTag = (tag: string) => {
    const newTags = contactTags.filter(t => t !== tag);
    if (contactId) {
      updateCrmContact.mutate({ tags: newTags });
    }
    patchConv.mutate({ tags: newTags });
  };

  // ── AI Assistant Real-Time Chat Handler ──────────────────────────────────────
  const handleSendAiPrompt = async (promptText: string) => {
    const prompt = promptText.trim();
    if (!prompt || isAiGenerating) return;

    const userMessage: ChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: prompt,
      timestamp: new Date(),
    };

    setAiChatMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setIsAiGenerating(true);

    try {
      const data = await conversationsApi.generateAiReply(conv.id, prompt);

      if (data?.draft) {
        setComposerDraft(data.draft);
        setIsComposerOpen(true);
        if (!composerSubject && conv.subject) {
          setComposerSubject(conv.subject.startsWith('Re:') ? conv.subject : `Re: ${conv.subject}`);
        }
      }


      setAiChatMessages(prev => [
        ...prev,
        {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          text: data?.explanation || "I've drafted a reply based on the conversation thread and updated your email composer.",
          timestamp: new Date(),
        }
      ]);
    } catch (e: any) {
      console.error('AI reply generation failed:', e);
      setAiChatMessages(prev => [
        ...prev,
        {
          id: 'ai-' + Date.now(),
          role: 'assistant',
          text: "I was unable to generate an AI reply right now. Please verify your connection or AI key and try again.",
          timestamp: new Date(),
        }
      ]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast('info', `${label} copied to clipboard`);
  };

  // Phase 0: real Gemini-backed copilot — the old setTimeout canned text is gone.
  const handleCopilotAction = async (actionType: 'reply' | 'summary' | 'action_items') => {
    setIsCopilotLoading(true);
    setCopilotOutput(null);
    try {
      const endpoint = actionType === 'reply' ? 'draft' : actionType === 'summary' ? 'summarize' : 'action-items';
      const res = await apiFetch(`/api/conversations/copilot/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Copilot request failed');
      const title = actionType === 'reply' ? 'Smart Reply Draft' : actionType === 'summary' ? 'Thread Summary' : 'Extracted Action Items';
      const content = body.draft ?? body.summary ?? body.actionItems ?? '';
      setCopilotOutput({ type: title, content });
    } catch (err: any) {
      setCopilotOutput({ type: 'Copilot error', content: err.message || 'Copilot request failed' });
    } finally {
      setIsCopilotLoading(false);
    }
  };

  return (
    <div className="w-[340px] shrink-0 border-l border-border/60 bg-surface/85 flex flex-col h-full font-inter overflow-hidden backdrop-blur-md">
      {/* Panel Top Header: Tabs & Fold Button */}
      <div className="flex items-center justify-between p-2 bg-surface/60 border-b border-border/50 shrink-0 gap-1">
        <div className="flex flex-1 gap-1">
          <button
            onClick={() => setTab('contact')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all text-center ${
              tab === 'contact' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
            }`}
          >
            Contact
          </button>
          <button
            onClick={() => setTab('notes')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all text-center ${
              tab === 'notes' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all text-center ${
              tab === 'ai' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
            }`}
          >
            AI Assistant
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors shrink-0"
            title="Fold panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* ─── CONTACT TAB ────────────────────────────────────────── */}
        {tab === 'contact' && (
          <div className="flex flex-col flex-1">
            {/* Contact profile header card (no photo avatar, no lead badge, moved over) */}
            <div className="p-4 border-b border-border/40 bg-surface/40">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-white leading-tight truncate">{displayName}</h3>
                <p className="text-[12px] text-text-muted mt-0.5 truncate">
                  {formData.title || 'No Title'} {companyName ? `at ${companyName}` : ''}
                </p>
              </div>

              {/* Quick Action Buttons (No icons) */}
              {contactId && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/30">
                  <button
                    onClick={() => navigate(`/crm/contacts/${contactId}`)}
                    className="col-span-2 py-1.5 px-3 text-[12px] font-semibold text-white bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-lg flex items-center justify-center transition-colors shadow-xs"
                  >
                    View in CRM Contacts
                  </button>
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      className="py-1 px-2 text-[11px] font-medium text-slate-300 hover:text-white bg-[#242833] border border-white/10 rounded-md flex items-center justify-center transition-colors"
                    >
                      Email
                    </a>
                  )}
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="py-1 px-2 text-[11px] font-medium text-slate-300 hover:text-white bg-[#242833] border border-white/10 rounded-md flex items-center justify-center transition-colors"
                    >
                      Call
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* CRM Contact Form (No icons, no hide empty fields toggle) */}
            <form onSubmit={handleSaveContactForm} className="p-4 space-y-5">
              {/* Contact Details Fields */}
              <div className="space-y-3">
                <span className="text-[13px] font-bold text-text-main">
                  Contact Details
                </span>

                {[
                  { label: 'First Name', key: 'firstName', value: formData.firstName, type: 'text', placeholder: 'First name' },
                  { label: 'Last Name', key: 'lastName', value: formData.lastName, type: 'text', placeholder: 'Last name' },
                  { label: 'Email', key: 'email', value: formData.email, type: 'email', placeholder: 'name@example.com' },
                  { label: 'Phone', key: 'phone', value: formData.phone, type: 'text', placeholder: '+1 (555) 000-0000' },
                  { label: 'Date of Birth', key: 'dateOfBirth', value: formData.dateOfBirth, type: 'date', placeholder: '' },
                  { label: 'Contact Source', key: 'source', value: formData.source, type: 'text', placeholder: 'Website, referral...' },
                  { label: 'Contact Type', key: 'status', value: formData.status, type: 'text', placeholder: 'Lead' },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-[11px] font-semibold text-text-muted">{field.label}</label>
                    <input
                      type={field.type}
                      value={field.value}
                      placeholder={field.placeholder}
                      onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 text-white text-[12px] px-3 py-2 rounded-lg focus:outline-none focus:border-white focus:bg-white/15 transition-colors placeholder:text-white/40"
                    />
                  </div>
                ))}
              </div>

              {/* Advanced Details Fields */}
              <div className="space-y-3 pt-3 border-t border-border/40">
                <span className="text-[13px] font-bold text-text-main">
                  Advanced Details
                </span>

                {[
                  { label: 'Business Name', key: 'businessName', value: formData.businessName, placeholder: 'Company name' },
                  { label: 'Job Title', key: 'title', value: formData.title, placeholder: 'Executive, Owner...' },
                  { label: 'Website', key: 'website', value: formData.website, placeholder: 'https://example.com' },
                  { label: 'Location', key: 'location', value: formData.location, placeholder: 'City, State' },
                ].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <label className="text-[11px] font-semibold text-text-muted">{field.label}</label>
                    <input
                      type="text"
                      value={field.value}
                      placeholder={field.placeholder}
                      onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                      className="w-full bg-white/10 border border-white/20 text-white text-[12px] px-3 py-2 rounded-lg focus:outline-none focus:border-white focus:bg-white/15 transition-colors placeholder:text-white/40"
                    />
                  </div>
                ))}
              </div>

              {contactId && (
                <button
                  type="submit"
                  disabled={updateCrmContact.isPending}
                  className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-[12px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {updateCrmContact.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Contact Information
                </button>
              )}
            </form>

            {/* Tags & Labels Accordion */}
            <Accordion title="Tags & Labels" defaultOpen>
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {contactTags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-surface text-text-main rounded-md border border-border font-semibold shadow-xs"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-text-muted hover:text-red-400 transition-colors ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {contactTags.length === 0 && !isAddingTag && (
                  <p className="text-[11px] text-text-muted italic">No tags assigned</p>
                )}
              </div>

              {isAddingTag ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addTag(tagInput); }}
                      placeholder="Type tag & press enter…"
                      autoFocus
                      className="flex-1 bg-surface-hover border border-primary text-text-main text-[12px] px-2.5 py-1 rounded-lg focus:outline-none"
                    />
                    <button
                      onClick={() => addTag(tagInput)}
                      className="px-2.5 py-1 bg-primary text-white rounded-lg text-[11px] font-semibold"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setTagInput(''); setIsAddingTag(false); }}
                      className="p-1 text-text-muted hover:text-text-main"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Preset quick workspace tags */}
                  {workspaceTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {workspaceTags.filter(t => !contactTags.includes(t)).slice(0, 6).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addTag(t)}
                          className="text-[10px] bg-surface-hover hover:bg-surface border border-border text-text-muted hover:text-text-main px-1.5 py-0.5 rounded transition-colors"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="text-[12px] font-semibold text-white hover:text-white/80 transition-colors flex items-center gap-1"
                >
                  + Add Tag
                </button>
              )}
            </Accordion>

            {/* Small subtle text at the bottom if no CRM record linked */}
            {!contactId && (
              <div className="px-4 py-4 mt-auto text-[11px] text-text-muted/60 text-center italic">
                No CRM record linked
              </div>
            )}
          </div>
        )}

        {/* ─── NOTES TAB ─────────────────────────────────────────── */}
        {tab === 'notes' && (
          <div className="p-4 flex flex-col flex-1">
            {/* Create Internal Note Form */}
            <div className="p-3.5 bg-surface/80 border border-border/70 rounded-xl space-y-3 shadow-xs">
              <span className="text-[12px] font-bold text-white block">
                Write an internal note or account comment
              </span>
              <textarea
                value={newInternalNote}
                onChange={e => setNewInternalNote(e.target.value)}
                placeholder="Write an internal note or account comment…"
                rows={3}
                className="w-full bg-surface-hover/80 border border-border/80 rounded-lg p-3 text-[12px] text-white placeholder:text-text-muted focus:outline-none focus:border-white/40 resize-none transition-colors"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-text-muted italic">Visible to team</span>
                <button
                  onClick={() => {
                    if (newInternalNote.trim()) {
                      addInternalNote.mutate(newInternalNote.trim());
                    }
                  }}
                  disabled={!newInternalNote.trim() || addInternalNote.isPending || !contactId}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg text-[12px] font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  {addInternalNote.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Save Note
                </button>
              </div>
            </div>

            {/* Events / Notes List with generous spacing */}
            <div className="mt-6 space-y-3.5 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block px-0.5">
                Activity &amp; Notes History
              </span>

              {eventsLoading && (
                <div className="p-6 text-center text-text-muted text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading notes…
                </div>
              )}

              {!eventsLoading && events.length === 0 && (
                <div className="p-6 text-center text-text-muted text-[12px] italic bg-surface/30 rounded-xl border border-border/40">
                  No internal notes logged for this contact yet.
                </div>
              )}

              {events.map((ev: any) => (
                <div key={ev.id} className="p-3.5 bg-surface border border-border/70 rounded-xl space-y-1.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-white">
                      {ev.title || 'Internal Note'}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div
                    className="text-[12px] text-white/90 whitespace-pre-wrap leading-relaxed pt-0.5"
                    dangerouslySetInnerHTML={{ __html: ev.content }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── AI ASSISTANT CHAT TAB (Straight Chat Box) ──────────────── */}
        {tab === 'ai' && (
          <div className="flex flex-col flex-1 h-full min-h-0">

            {/* Chat Timeline */}
            <div className="flex-1 p-3 space-y-2.5 overflow-y-auto custom-scrollbar">
              {aiChatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] px-3.5 py-2 rounded-2xl text-[12px] leading-relaxed shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-white text-slate-900 font-medium rounded-tr-none'
                        : 'bg-white/10 border border-white/20 text-white rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-text-muted mt-0.5 px-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {isAiGenerating && (
                <div className="flex items-center gap-2 p-2.5 bg-[#1e2029] border border-white/10 rounded-xl text-[11px] text-slate-300 w-fit">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Updating email composer...
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Copilot Actions (from the agent branch: draft / summary / action items via /api/conversations/copilot) */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-border/40 bg-surface/40 shrink-0">
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('reply')}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-primary/20 hover:bg-primary/30 text-white border border-primary/40 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-white" /> Generate Suggested Reply
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('summary')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-3 h-3" /> Summarize Conversation
              </button>
              <button
                type="button"
                disabled={isCopilotLoading}
                onClick={() => handleCopilotAction('action_items')}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <CheckSquare className="w-3 h-3" /> Extract Action Items
              </button>
            </div>
            {isCopilotLoading && (
              <div className="px-3 py-2 text-[11px] text-slate-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Thinking &amp; generating...
              </div>
            )}
            {copilotOutput && !isCopilotLoading && (
              <div className="mx-3 my-2 p-3 bg-surface border border-primary/30 rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {copilotOutput.type}
                  </span>
                  <button
                    onClick={() => copyToClipboard(copilotOutput.content, 'Copilot suggestion')}
                    className="p-1 text-text-muted hover:text-text-main rounded transition-colors"
                    title="Copy text"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[12px] text-text-main whitespace-pre-wrap leading-relaxed">{copilotOutput.content}</p>
              </div>
            )}

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-border/40 bg-surface/40 shrink-0">
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={() => handleSendAiPrompt("Draft a reply addressing the customer's latest message")}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-primary/20 hover:bg-primary/30 text-white border border-primary/40 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Bot className="w-3 h-3 text-white" /> Draft Reply
              </button>
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={() => handleSendAiPrompt("Keep the email response short, concise, and direct")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Make Concise
              </button>
              <button
                type="button"
                disabled={isAiGenerating}
                onClick={() => handleSendAiPrompt("Draft an invitation for a quick 15-minute onboarding walkthrough")}
                className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Propose Call
              </button>
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 border-t border-border/40 bg-surface/80 shrink-0">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSendAiPrompt(aiInput);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  placeholder="Ask AI Assistant to adjust email…"
                  disabled={isAiGenerating}
                  className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-[12px] px-3.5 py-2 rounded-lg focus:outline-none focus:border-white focus:bg-white/15 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!aiInput.trim() || isAiGenerating}
                  className="p-2 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-lg transition-colors shadow-xs"
                  title="Send to AI Assistant"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
