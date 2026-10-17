import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExternalLink, ChevronUp, Plus, User, Mail, Phone,
  MapPin, Building2, Globe, MessageSquare, Flame,
  FileText, CheckSquare, Sparkles, X, Edit3, Check, Loader2,
  Copy, Bot, Calendar, Tag, CheckCircle2, Clock, Send
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { crmApi } from '../../../lib/api/crm';
import { queryKeys } from '../../../lib/queryKeys';
import { useToast } from '../../../components/ui/Toast';
import { apiFetch } from '../../../lib/apiClient';
import type { Conversation } from '../../../types/conversation';
import type { UpdateContactInput } from '../../../types/crm';

function Accordion({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ElementType;
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
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-text-muted" />}
          <span>{title}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <Plus className="w-3.5 h-3.5 text-text-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function ThreadInfoPanel({ conv }: { conv: Conversation }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'contact' | 'notes' | 'copilot'>('contact');
  const [hideEmptyFields, setHideEmptyFields] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [copilotOutput, setCopilotOutput] = useState<{ type: string; content: string } | null>(null);
  const [isCopilotLoading, setIsCopilotLoading] = useState(false);

  const contactId = conv.contactId || conv.contact?.id;

  // Fetch full CRM Contact details
  const { data: crmContact, isLoading: contactLoading } = useQuery({
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
          title: 'Added Internal Note',
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
  const location = crmContact?.location ?? '';
  const title = crmContact?.title ?? '';
  const companyName = crmContact?.company?.name ?? '';
  const leadScore = crmContact?.leadScore ?? 0;
  const contactStatus = crmContact?.status ?? 'Lead';
  const source = crmContact?.source ?? '';
  const preferredChannel = crmContact?.preferredChannel ?? conv.channel;
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

  const handleCopilotAction = (actionType: 'reply' | 'summary' | 'action_items') => {
    setIsCopilotLoading(true);
    setCopilotOutput(null);

    setTimeout(() => {
      setIsCopilotLoading(false);
      if (actionType === 'reply') {
        setCopilotOutput({
          type: 'Smart Reply Draft',
          content: `Hi ${firstName || 'there'},\n\nThank you for reaching out! We've reviewed your inquiry and our team is ready to assist you right away. Let us know what time works best for a quick follow-up.\n\nBest regards,\nStone AIO Team`
        });
      } else if (actionType === 'summary') {
        setCopilotOutput({
          type: 'Thread Summary',
          content: `Customer (${displayName}) has contacted us regarding system workflows and integration timelines. Key priority is reviewing account settings. Last interaction received ${new Date().toLocaleDateString()}.`
        });
      } else {
        setCopilotOutput({
          type: 'Extracted Action Items',
          content: `1. Verify CRM contact details for ${displayName}\n2. Schedule follow-up meeting\n3. Assign account manager and update pipeline`
        });
      }
    }, 600);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast('info', `${label} copied to clipboard`);
  };

  const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

  return (
    <div className="w-[340px] shrink-0 border-l border-border/60 bg-surface/85 flex flex-col h-full font-inter overflow-hidden backdrop-blur-md">
      {/* Tabs matching CRM sub-panels */}
      <div className="flex p-2 gap-1 bg-surface/60 border-b border-border/50 shrink-0">
        <button
          onClick={() => setTab('contact')}
          className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'contact' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          Contact
        </button>
        <button
          onClick={() => setTab('notes')}
          className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'notes' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Notes {events.length > 0 && `(${events.length})`}
        </button>
        <button
          onClick={() => setTab('copilot')}
          className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'copilot' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary-300" />
          Copilot
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* ─── CONTACT TAB ────────────────────────────────────────── */}
        {tab === 'contact' && (
          <>
            {/* Contact profile header card */}
            <div className="p-4 border-b border-border/40 bg-surface/40">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-surface-hover border border-border flex items-center justify-center text-text-main font-bold text-sm overflow-hidden shrink-0 shadow-xs">
                  {(rawContact as any)?.avatarUrl
                    ? <img src={(rawContact as any).avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    : displayName[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-[14px] font-bold text-text-main leading-tight truncate">{displayName}</h3>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">
                    {title || 'Unknown Title'} {companyName ? `at ${companyName}` : '· No Company'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                      {contactStatus || 'Lead'}
                    </span>
                    {leadScore > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Flame className="w-2.5 h-2.5" /> {leadScore}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/30">
                {contactId ? (
                  <button
                    onClick={() => navigate(`/crm/contacts/${contactId}`)}
                    className="col-span-2 py-1.5 px-3 text-[12px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View in CRM Contacts
                  </button>
                ) : (
                  <div className="col-span-2 text-[11px] text-text-muted italic text-center py-1">
                    No CRM record linked
                  </div>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="py-1 px-2 text-[11px] font-medium text-text-muted hover:text-text-main bg-surface-hover hover:bg-surface border border-border rounded-md flex items-center justify-center gap-1 transition-colors"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </a>
                )}
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="py-1 px-2 text-[11px] font-medium text-text-muted hover:text-text-main bg-surface-hover hover:bg-surface border border-border rounded-md flex items-center justify-center gap-1 transition-colors"
                  >
                    <Phone className="w-3 h-3" /> Call
                  </a>
                )}
              </div>
            </div>

            {/* Hide empty fields toggle matching CRM */}
            <div
              className="px-4 py-2.5 flex items-center gap-2 border-b border-border/40 cursor-pointer hover:bg-surface-hover/50 transition-colors bg-surface/20"
              onClick={() => setHideEmptyFields(!hideEmptyFields)}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${hideEmptyFields ? 'bg-primary border-primary text-white' : 'border-border bg-surface'}`}>
                {hideEmptyFields && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <span className="text-[12px] font-medium text-text-muted">Hide empty fields</span>
            </div>

            {/* CRM Contact Form */}
            <form onSubmit={handleSaveContactForm} className="p-4 space-y-5">
              {/* Contact Details Fields */}
              <div className="space-y-3">
                <span className="text-[13px] font-bold text-text-main flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" /> Contact Details
                </span>

                {[
                  { label: 'First Name', key: 'firstName', value: formData.firstName, type: 'text', placeholder: 'Unknown' },
                  { label: 'Last Name', key: 'lastName', value: formData.lastName, type: 'text', placeholder: 'Unknown' },
                  { label: 'Email', key: 'email', value: formData.email, type: 'email', placeholder: 'Unknown' },
                  { label: 'Phone', key: 'phone', value: formData.phone, type: 'text', placeholder: 'Unknown' },
                  { label: 'Date of Birth', key: 'dateOfBirth', value: formData.dateOfBirth, type: 'date', placeholder: 'Unknown' },
                  { label: 'Contact Source', key: 'source', value: formData.source, type: 'text', placeholder: 'Unknown' },
                  { label: 'Contact Type', key: 'status', value: formData.status, type: 'text', placeholder: 'Lead' },
                ]
                  .filter(f => !hideEmptyFields || f.value)
                  .map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted">{field.label}</label>
                      <input
                        type={field.type}
                        value={field.value}
                        placeholder={field.placeholder}
                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full bg-surface-hover/80 border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/50"
                      />
                    </div>
                  ))}
              </div>

              {/* Advanced Details Fields */}
              <div className="space-y-3 pt-3 border-t border-border/40">
                <span className="text-[13px] font-bold text-text-main flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Advanced Details
                </span>

                {[
                  { label: 'Business Name', key: 'businessName', value: formData.businessName, placeholder: 'Unknown' },
                  { label: 'Job Title', key: 'title', value: formData.title, placeholder: 'Unknown' },
                  { label: 'Website', key: 'website', value: formData.website, placeholder: 'Unknown' },
                  { label: 'Location', key: 'location', value: formData.location, placeholder: 'Unknown' },
                ]
                  .filter(f => !hideEmptyFields || f.value)
                  .map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted">{field.label}</label>
                      <input
                        type="text"
                        value={field.value}
                        placeholder={field.placeholder}
                        onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full bg-surface-hover/80 border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary transition-colors placeholder:text-text-muted/50"
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
            <Accordion title="Tags & Labels" icon={Tag} defaultOpen>
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
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Tag
                </button>
              )}
            </Accordion>

            {/* Conversation Settings Accordion */}
            <Accordion title="Conversation Actions" icon={MessageSquare} defaultOpen>
              <div className="space-y-3">
                {/* Assignee */}
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Assignee</p>
                  <select
                    value={conv.assignedUserId ?? ''}
                    onChange={e => patchConv.mutate({ assignedUserId: e.target.value || null })}
                    className="w-full bg-surface-hover border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary shadow-xs"
                  >
                    <option value="">Unassigned</option>
                    {conv.assignedUser && (
                      <option value={conv.assignedUser.id}>{conv.assignedUser.name}</option>
                    )}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <p className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Priority</p>
                  <select
                    value={conv.priority ?? ''}
                    onChange={e => patchConv.mutate({ priority: (e.target.value || undefined) as any })}
                    className="w-full bg-surface-hover border border-border text-text-main text-[12px] px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-primary shadow-xs"
                  >
                    <option value="">None</option>
                    {PRIORITY_OPTIONS.map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Accordion>
          </>
        )}

        {/* ─── NOTES & ACTIVITY TAB ─────────────────────────────────── */}
        {tab === 'notes' && (
          <div className="p-4 space-y-4">
            {/* Create Internal Note Form */}
            <div className="p-3.5 bg-surface/80 border border-border rounded-xl space-y-2.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-main">
                <Edit3 className="w-3.5 h-3.5 text-primary" /> Leave Internal Note
              </div>
              <textarea
                value={newInternalNote}
                onChange={e => setNewInternalNote(e.target.value)}
                placeholder="Write an internal note or comment on this contact's account…"
                rows={3}
                className="w-full bg-surface-hover border border-border rounded-lg p-2.5 text-[12px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-text-muted italic">Visible only to team members</span>
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

            {/* Events / Notes List */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Activity &amp; Notes History
              </span>

              {eventsLoading && (
                <div className="p-6 text-center text-text-muted text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading notes…
                </div>
              )}

              {!eventsLoading && events.length === 0 && (
                <div className="p-6 text-center text-text-muted text-[12px] italic bg-surface/30 rounded-xl border border-border/40">
                  No internal notes or activities logged for this contact yet.
                </div>
              )}

              {events.map((ev: any) => (
                <div key={ev.id} className="p-3 bg-surface border border-border/60 rounded-xl space-y-1 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-sky-400 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> {ev.title || 'Internal Note'}
                    </span>
                    <span className="text-[10px] text-text-muted">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div
                    className="text-[12px] text-text-main whitespace-pre-wrap leading-relaxed pt-1"
                    dangerouslySetInnerHTML={{ __html: ev.content }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── COPILOT TAB ─────────────────────────────────────────── */}
        {tab === 'copilot' && (
          <div className="p-5 flex flex-col h-full space-y-4">
            <div className="text-center pb-2">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2.5 border border-primary/20 shadow-xs">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-[14px] font-bold text-text-main mb-1">Stone AI Copilot</h3>
              <p className="text-[12px] text-text-muted leading-relaxed">
                Smart assistance, real-time draft generation & context summaries.
              </p>
            </div>

            {/* Copilot Action Chips */}
            <div className="space-y-2">
              <button
                onClick={() => handleCopilotAction('reply')}
                disabled={isCopilotLoading}
                className="w-full py-2 px-3 bg-surface hover:bg-surface-hover border border-border rounded-xl text-[12px] font-semibold text-text-main flex items-center gap-2.5 transition-colors shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-left flex-1">Generate Suggested Reply</span>
              </button>

              <button
                onClick={() => handleCopilotAction('summary')}
                disabled={isCopilotLoading}
                className="w-full py-2 px-3 bg-surface hover:bg-surface-hover border border-border rounded-xl text-[12px] font-semibold text-text-main flex items-center gap-2.5 transition-colors shadow-xs"
              >
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-left flex-1">Summarize Conversation</span>
              </button>

              <button
                onClick={() => handleCopilotAction('action_items')}
                disabled={isCopilotLoading}
                className="w-full py-2 px-3 bg-surface hover:bg-surface-hover border border-border rounded-xl text-[12px] font-semibold text-text-main flex items-center gap-2.5 transition-colors shadow-xs"
              >
                <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-left flex-1">Extract Action Items</span>
              </button>
            </div>

            {/* Loading Indicator */}
            {isCopilotLoading && (
              <div className="p-4 bg-surface/50 border border-border rounded-xl flex items-center justify-center gap-2 text-[12px] text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Thinking & generating...
              </div>
            )}

            {/* Output Display */}
            {copilotOutput && !isCopilotLoading && (
              <div className="p-3.5 bg-surface border border-primary/30 rounded-xl space-y-2 shadow-xs animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> {copilotOutput.type}
                  </span>
                  <button
                    onClick={() => copyToClipboard(copilotOutput.content, 'Copilot suggestion')}
                    className="p-1 text-text-muted hover:text-text-main rounded transition-colors"
                    title="Copy text"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[12px] text-text-main leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar p-2 bg-surface-hover/60 rounded-lg border border-border/40 font-mono">
                  {copilotOutput.content}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

