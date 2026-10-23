import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Building2, Globe, MapPin, Users, DollarSign,
  Edit2, Trash2, Plus, Mail, Phone, Calendar, Clock,
  CheckCircle2, Sparkles, CheckSquare, Folder, X, ExternalLink,
  Tag, Send, Check, Briefcase, FileText, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { NotionEditor } from '../../components/editor/NotionEditor';

interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  employees?: string;
  revenue?: string;
  description?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt?: string;
  tagsJson?: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  companyId?: string;
}

interface Deal {
  id: string;
  title: string;
  amount: number;
  priority?: string;
  pipelineStage?: { id: string; name: string; color: string };
  closeDate?: string;
  companyId?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: string;
  priority: string;
  companyId?: string;
}

export default function CompanyDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [hideEmptyFields, setHideEmptyFields] = useState(false);
  const [commsTab, setCommsTab] = useState<'internal' | 'email' | 'call'>('internal');
  const [commsText, setCommsText] = useState('');

  // Right panel tab
  const [rightTab, setRightTab] = useState<'contacts' | 'deals' | 'tasks' | 'notes' | 'activity'>('contacts');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Notes state
  const [newNote, setNewNote] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#fef3c7');

  // Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Modals state
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [selectedContactToLink, setSelectedContactToLink] = useState('');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealForm, setNewDealForm] = useState({ title: '', amount: '', stageId: '' });

  // ── Fetch Company ──────────────────────────────────────────────────────────
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['company', id],
    queryFn: () => apiFetch(`/api/crm/companies/${id}`).then(r => (r.ok ? r.json() : null)),
  });

  // Fetch all contacts
  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => apiFetch('/api/crm/contacts').then(r => (r.ok ? r.json().then(d => d.contacts || d || []) : [])),
  });
  const companyContacts = allContacts.filter(c => c.companyId === id);

  // Fetch all deals
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: () => apiFetch('/api/crm/deals').then(r => (r.ok ? r.json() : [])),
  });
  const companyDeals = allDeals.filter(d => d.companyId === id);

  // Fetch pipelines for stages
  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['pipelines'],
    queryFn: () => apiFetch('/api/crm/pipelines').then(r => (r.ok ? r.json() : [])),
  });
  const allStages = pipelines.flatMap(p => p.stages || []);

  // Fetch tasks
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/api/crm/tasks').then(r => (r.ok ? r.json() : [])),
  });
  const companyTasks = allTasks.filter(t => t.companyId === id);

  // Fetch workspace tags
  const { data: workspaceTags = [] } = useQuery<string[]>({
    queryKey: ['workspace-tags'],
    queryFn: () => apiFetch('/api/crm/tags').then(r => (r.ok ? r.json() : [])),
  });

  // Fetch events / activity
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['company-events', id],
    queryFn: async () => {
      try {
        const res = await apiFetch(`/api/crm/companies/${id}/events`);
        if (res.ok) return res.json();
      } catch {}
      return [];
    },
    enabled: Boolean(id),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateCompany = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const res = await apiFetch(`/api/crm/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update company');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', id] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast('success', 'Account updated');
    },
    onError: () => toast('error', 'Failed to update'),
  });

  const linkContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiFetch(`/api/crm/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: id }),
      });
      if (!res.ok) throw new Error('Failed to link contact');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setLinkContactOpen(false);
      setSelectedContactToLink('');
      toast('success', 'Contact linked to account');
    },
  });

  const unlinkContact = async (contactId: string) => {
    try {
      await apiFetch(`/api/crm/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: null }),
      });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast('success', 'Contact unlinked');
    } catch {}
  };

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/crm/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          companyId: id,
          amount: parseFloat(data.amount) || 0,
        }),
      });
      if (!res.ok) throw new Error('Failed to create deal');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      setNewDealOpen(false);
      setNewDealForm({ title: '', amount: '', stageId: '' });
      toast('success', 'Opportunity created for account');
    },
  });

  const addEventMut = useMutation({
    mutationFn: async ({ type, content, title }: { type: string; content: string; title?: string }) => {
      const res = await apiFetch(`/api/crm/companies/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title || (type === 'internal_comment' ? 'Internal Note' : type === 'email' ? 'Email' : 'Call Log'),
          content,
        }),
      });
      if (!res.ok) {
        return { id: Date.now().toString(), type, content, title: title || 'Note', createdAt: new Date().toISOString() };
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-events', id] });
      setCommsText('');
      toast('success', 'Activity logged');
    },
    onError: () => toast('error', 'Failed to log activity'),
  });

  const handleSendComms = () => {
    if (!commsText.trim()) return;
    addEventMut.mutate({
      type: commsTab === 'internal' ? 'internal_comment' : commsTab,
      content: commsText,
    });
  };

  const handleSaveField = (key: keyof Company, val: string) => {
    updateCompany.mutate({ [key]: val });
  };

  const parsedTags: string[] = company?.tagsJson
    ? typeof company.tagsJson === 'string'
      ? JSON.parse(company.tagsJson || '[]')
      : company.tagsJson
    : [];

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      if (!parsedTags.includes(newTagInput.trim())) {
        updateCompany.mutate({ tagsJson: JSON.stringify([...parsedTags, newTagInput.trim()]) });
      }
      setNewTagInput('');
      setIsAddingTag(false);
    } else if (e.key === 'Escape') {
      setIsAddingTag(false);
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    const updated = parsedTags.filter(x => x !== t);
    updateCompany.mutate({ tagsJson: JSON.stringify(updated) });
  };

  if (isLoading || !company) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-bg relative overflow-hidden">
      {/* Fixed Action Buttons - Overlaying Global Banner */}
      <div className="fixed top-2.5 right-6 z-[60] flex items-center gap-2">
        {/* New Opportunity moved up onto top-right bar */}
        <button
          onClick={() => setNewDealOpen(true)}
          className="px-3.5 py-1.5 rounded-[6px] flex items-center gap-1.5 text-xs font-bold text-white bg-primary hover:bg-primary-hover shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5 text-white" /> New Opportunity
        </button>

        {company.website && (
          <a
            href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-[6px] border border-border bg-surface text-text-main text-xs font-semibold hover:border-white flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Globe className="w-3.5 h-3.5 text-primary" /> Visit Website
          </a>
        )}

        <button
          onClick={() => { setRightTab('contacts'); setIsRightPanelOpen(true); setLinkContactOpen(true); }}
          title="Link Contact"
          className="w-9 h-9 rounded-[6px] flex items-center justify-center text-text-muted bg-surface hover:text-white hover:border-white border border-border transition-all shadow-sm"
        >
          <Users className="w-4 h-4" />
        </button>

        <button
          onClick={() => { setRightTab('activity'); setCommsTab('call'); }}
          title="Log Call"
          className="w-9 h-9 rounded-[6px] flex items-center justify-center text-text-muted bg-surface hover:text-emerald-400 hover:border-emerald-400 border border-border transition-all shadow-sm"
        >
          <Phone className="w-4 h-4" />
        </button>
      </div>

      {/* Main Layout - Floating Frosted Glass Panel */}
      <div className="flex-1 overflow-hidden flex w-full p-6">
        <div
          className="flex-1 flex w-full rounded-[16px] shadow-luxury ring-1 ring-white/5 backdrop-blur-xl border border-border/50 overflow-hidden"
          style={{ background: 'var(--glass-bg)' }}
        >
          {/* Column 1: Account Properties Panel (~340px) */}
          <div className="w-[340px] flex flex-col shrink-0 bg-transparent border-r border-border overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Header: Chevron Back + Company Name (Logo/letter icon removed completely) */}
            <div className="flex items-center justify-between p-4 border-b border-border gap-2 shrink-0">
              <Link
                to="/crm/companies"
                className="flex items-center text-[12px] font-semibold text-text-muted hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Back
              </Link>

              <div className="flex flex-col items-end text-right">
                <h1 className="text-[14px] font-bold text-white tracking-tight leading-tight">
                  {company.name}
                </h1>
                {company.industry && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-slate-300 mt-1">
                    {company.industry}
                  </span>
                )}
              </div>
            </div>

            {/* Hide Empty Fields Toggle */}
            <div
              className="p-4 flex items-center gap-2 border-b border-border/50 cursor-pointer hover:bg-surface-hover/30 transition-colors"
              onClick={() => setHideEmptyFields(!hideEmptyFields)}
            >
              <div
                className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  hideEmptyFields ? 'bg-white border-white' : 'bg-transparent border-border'
                }`}
              >
                {hideEmptyFields && <CheckSquare className="w-3.5 h-3.5 text-black" />}
              </div>
              <span className="text-[12px] font-medium text-white">Hide empty fields</span>
            </div>

            {/* Account Details Form */}
            <div className="flex-1 flex flex-col p-5 pb-20 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white mb-2">
                  <span className="text-[14px] font-bold">Account Overview</span>
                </div>

                {/* Company Name */}
                <div className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Company Name</label>
                  <input
                    type="text"
                    defaultValue={company.name}
                    onBlur={e => {
                      if (e.target.value.trim() && e.target.value !== company.name) {
                        handleSaveField('name', e.target.value.trim());
                      }
                    }}
                    className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all"
                  />
                </div>

                {/* Industry */}
                {(!hideEmptyFields || company.industry) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Industry</label>
                    <input
                      type="text"
                      defaultValue={company.industry || ''}
                      onBlur={e => handleSaveField('industry', e.target.value)}
                      placeholder="e.g. Technology, Retail"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50"
                    />
                  </div>
                )}

                {/* Website */}
                {(!hideEmptyFields || company.website) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Website</label>
                    <input
                      type="text"
                      defaultValue={company.website || ''}
                      onBlur={e => handleSaveField('website', e.target.value)}
                      placeholder="e.g. acme.com"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50"
                    />
                  </div>
                )}

                {/* Location */}
                {(!hideEmptyFields || company.location) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Location</label>
                    <input
                      type="text"
                      defaultValue={company.location || ''}
                      onBlur={e => handleSaveField('location', e.target.value)}
                      placeholder="e.g. New York, NY"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50"
                    />
                  </div>
                )}

                {/* Employees */}
                {(!hideEmptyFields || company.employees) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Employees</label>
                    <input
                      type="text"
                      defaultValue={company.employees || ''}
                      onBlur={e => handleSaveField('employees', e.target.value)}
                      placeholder="e.g. 50-100"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50"
                    />
                  </div>
                )}

                {/* Revenue */}
                {(!hideEmptyFields || company.revenue) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">Annual Revenue</label>
                    <input
                      type="text"
                      defaultValue={company.revenue || ''}
                      onBlur={e => handleSaveField('revenue', e.target.value)}
                      placeholder="e.g. $2.5M"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-emerald-400 font-mono py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50"
                    />
                  </div>
                )}

                {/* Description */}
                {(!hideEmptyFields || company.description) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-slate-300 mb-1.5">About Account</label>
                    <textarea
                      rows={3}
                      defaultValue={company.description || ''}
                      onBlur={e => handleSaveField('description', e.target.value)}
                      placeholder="Account notes and summary..."
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-white py-2 px-3 focus:outline-none focus:border-white transition-all placeholder:text-text-muted/50 resize-none"
                    />
                  </div>
                )}
              </div>

              {/* Tags & Labels */}
              <div className="space-y-3 pt-5 border-t border-border/50 mt-6">
                <div className="flex items-center justify-between text-white">
                  <span className="text-[13px] font-bold flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-violet-400" /> Tags &amp; Labels
                  </span>
                  {!isAddingTag && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(true)}
                      className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {parsedTags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border text-white group"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-text-muted hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {parsedTags.length === 0 && !isAddingTag && (
                    <span className="text-[11px] text-slate-400 italic">No tags added</span>
                  )}
                </div>

                {isAddingTag && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      autoFocus
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="Type tag & press Enter..."
                      className="flex-1 bg-surface border border-violet-500 rounded-[6px] text-[12px] font-medium text-white py-1 px-2.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagInput.trim()) {
                          if (!parsedTags.includes(newTagInput.trim())) {
                            updateCompany.mutate({ tagsJson: JSON.stringify([...parsedTags, newTagInput.trim()]) });
                          }
                          setNewTagInput('');
                          setIsAddingTag(false);
                        }
                      }}
                      className="px-2.5 py-1 bg-violet-600 text-white rounded text-[11px] font-bold"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Messaging / Activity Canvas (flex-1) */}
          <div className="flex-1 flex flex-col bg-[#1B1D22] border-r border-border relative min-w-[400px]">
            {/* Conversation Canvas */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6">
              <div className="flex flex-col gap-4">
                {events.map((evt: any) => (
                  <div key={evt.id} className="flex flex-col max-w-[85%] mb-2 ml-auto items-end">
                    <div className="flex items-center gap-2 mb-1.5 flex-row-reverse">
                      <span className="text-[12px] font-bold text-sky-400">
                        {evt.title || 'Internal Note'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="p-4 rounded-[8px] bg-surface/40 border border-border/40 text-[13px] text-white shadow-sm rounded-tr-sm">
                      <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: evt.content }} />
                    </div>
                  </div>
                ))}

                {events.length === 0 && (
                  <div className="py-12 text-center text-slate-300 space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-30 text-white" />
                    <p className="text-[14px] font-bold text-white">No communications logged yet</p>
                    <p className="text-[12px] text-slate-300 max-w-xs mx-auto leading-relaxed">
                      Use the composer below to record internal account notes, emails, and call logs.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Composer Anchored at Bottom */}
            <div className="border-t border-border bg-transparent flex flex-col shrink-0">
              <div className="flex items-center border-b border-border px-5 pt-3 gap-6">
                {[
                  { id: 'internal', label: 'Internal Note' },
                  { id: 'email', label: 'Email' },
                  { id: 'call', label: 'Call Log' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCommsTab(t.id as any)}
                    className={`flex items-center gap-1.5 pb-3 text-[13px] font-bold transition-colors border-b-[2px] -mb-[1px] ${
                      commsTab === t.id
                        ? 'text-white border-primary'
                        : 'text-slate-300 hover:text-white border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-4 flex flex-col gap-3">
                <NotionEditor
                  content={commsText}
                  onChange={html => setCommsText(html)}
                  minHeight="min-h-[100px]"
                  placeholder={
                    commsTab === 'internal'
                      ? 'Type internal note for this account...'
                      : commsTab === 'email'
                      ? 'Log or draft email...'
                      : 'Log call notes...'
                  }
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">Press Ctrl+Enter or click Log</span>
                  <button
                    type="button"
                    disabled={!commsText.trim() || addEventMut.isPending}
                    onClick={handleSendComms}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{commsTab === 'internal' ? 'Log Note' : commsTab === 'call' ? 'Save Call' : 'Send'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Right Collapsible Panel + 52px Vertical Rail */}
          <div className="flex h-full shrink-0 border-l border-border bg-surface">
            {isRightPanelOpen && (
              <div className="w-[360px] flex flex-col shrink-0 bg-transparent overflow-hidden border-r border-border/50">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface shrink-0">
                  <span className="text-[14px] font-bold text-white capitalize">
                    {rightTab === 'contacts'
                      ? `Contacts (${companyContacts.length})`
                      : rightTab === 'deals'
                      ? `Opportunities (${companyDeals.length})`
                      : rightTab === 'tasks'
                      ? `Tasks (${companyTasks.length})`
                      : rightTab}
                  </span>
                  <div className="flex items-center gap-3">
                    {rightTab === 'contacts' && (
                      <button
                        onClick={() => setLinkContactOpen(true)}
                        className="flex items-center gap-1 text-[12px] font-semibold text-white hover:text-white/80 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" /> Link Contact
                      </button>
                    )}
                    {rightTab === 'deals' && (
                      <button
                        onClick={() => setNewDealOpen(true)}
                        className="flex items-center gap-1 text-[12px] font-semibold text-white hover:text-white/80 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" /> New Deal
                      </button>
                    )}
                    <button
                      onClick={() => setIsRightPanelOpen(false)}
                      className="text-text-muted hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6 space-y-4">
                  {/* Contacts Tab */}
                  {rightTab === 'contacts' && (
                    <div className="space-y-3">
                      {companyContacts.map(c => (
                        <div
                          key={c.id}
                          className="p-3 rounded-xl bg-surface-hover/40 border border-border flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                              {c.firstName[0]}
                            </div>
                            <div>
                              <Link
                                to={`/crm/contacts/${c.id}`}
                                className="text-[13px] font-bold text-white hover:text-primary transition-colors block"
                              >
                                {c.firstName} {c.lastName}
                              </Link>
                              <span className="text-[11px] text-slate-300 block">{c.title || c.email || 'Contact'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => unlinkContact(c.id)}
                            className="p-1 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Unlink Contact"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {companyContacts.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">No contacts linked</div>
                      )}
                    </div>
                  )}

                  {/* Deals / Opportunities Tab */}
                  {rightTab === 'deals' && (
                    <div className="space-y-3">
                      {companyDeals.map(d => (
                        <div
                          key={d.id}
                          className="p-3 rounded-xl bg-surface-hover/40 border border-border flex items-center justify-between"
                        >
                          <div>
                            <Link
                              to={`/crm/opportunities/${d.id}`}
                              className="text-[13px] font-bold text-white hover:text-primary transition-colors block"
                            >
                              {d.title}
                            </Link>
                            <span className="text-[11px] text-slate-300">
                              {d.pipelineStage?.name || 'In Pipeline'}
                            </span>
                          </div>
                          <span className="text-xs font-bold font-mono text-emerald-400">
                            ${(d.amount || 0).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {companyDeals.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">No opportunities yet</div>
                      )}
                    </div>
                  )}

                  {/* Tasks Tab */}
                  {rightTab === 'tasks' && (
                    <div className="space-y-3">
                      {companyTasks.map(t => (
                        <div
                          key={t.id}
                          className="p-3 rounded-xl bg-surface-hover/40 border border-border flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-xs font-bold text-white">{t.title}</span>
                          </div>
                          {t.dueDate && (
                            <span className="text-[10px] text-slate-300">
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                      {companyTasks.length === 0 && (
                        <div className="py-8 text-center text-slate-400 text-xs">No tasks scheduled</div>
                      )}
                    </div>
                  )}

                  {/* Notes Tab */}
                  {rightTab === 'notes' && (
                    <div className="space-y-4">
                      {!isCreatingNote ? (
                        <button
                          onClick={() => setIsCreatingNote(true)}
                          className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Note
                        </button>
                      ) : (
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                          <input
                            type="text"
                            placeholder="Note title..."
                            value={newNoteTitle}
                            onChange={e => setNewNoteTitle(e.target.value)}
                            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                          />
                          <NotionEditor
                            content={newNote}
                            onChange={html => setNewNote(html)}
                            minHeight="min-h-[120px]"
                            placeholder="Add account note content..."
                          />
                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => {
                                setIsCreatingNote(false);
                                setNewNote('');
                                setNewNoteTitle('');
                              }}
                              className="text-xs text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (newNote.trim()) {
                                  addEventMut.mutate({
                                    type: 'note',
                                    title: newNoteTitle || 'Account Note',
                                    content: newNote,
                                  });
                                  setIsCreatingNote(false);
                                  setNewNote('');
                                  setNewNoteTitle('');
                                }
                              }}
                              className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-lg"
                            >
                              Save Note
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Activity Tab */}
                  {rightTab === 'activity' && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-surface-hover/50 border border-border text-xs space-y-1">
                        <span className="text-white font-semibold block">Account Created</span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(company.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {events.map((e: any) => (
                        <div key={e.id} className="p-3 rounded-lg bg-surface-hover/50 border border-border text-xs space-y-1">
                          <span className="text-white font-semibold block">{e.title || 'Activity'}</span>
                          <div className="text-slate-300 text-[11px]" dangerouslySetInnerHTML={{ __html: e.content }} />
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(e.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vertical Icon Rail */}
            <div className="w-[52px] flex flex-col items-center py-4 gap-2 bg-surface shrink-0">
              {[
                { id: 'contacts', icon: Users, label: 'Contacts' },
                { id: 'deals', icon: Briefcase, label: 'Opportunities' },
                { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
                { id: 'notes', icon: FileText, label: 'Notes' },
                { id: 'activity', icon: Clock, label: 'Activity' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setRightTab(tab.id as any);
                    setIsRightPanelOpen(true);
                  }}
                  title={tab.label}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    rightTab === tab.id && isRightPanelOpen
                      ? 'bg-white/10 text-white shadow-sm border border-white/20'
                      : 'text-text-muted hover:text-white hover:bg-bg border border-transparent'
                  }`}
                >
                  <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* New Opportunity Modal */}
      <AnimatePresence>
        {newDealOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">New Opportunity for {company.name}</h3>
                <button onClick={() => setNewDealOpen(false)} className="text-text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Deal Title *</label>
                  <input
                    type="text"
                    value={newDealForm.title}
                    onChange={e => setNewDealForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Q4 Platform License"
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Deal Value ($)</label>
                  <input
                    type="number"
                    value={newDealForm.amount}
                    onChange={e => setNewDealForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="5000"
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Pipeline Stage</label>
                  <select
                    value={newDealForm.stageId}
                    onChange={e => setNewDealForm(f => ({ ...f, stageId: e.target.value }))}
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary"
                  >
                    <option value="">Select a stage...</option>
                    {allStages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setNewDealOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newDealForm.title.trim() || createDealMutation.isPending}
                  onClick={() => createDealMutation.mutate(newDealForm)}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  Create Opportunity
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Link Contact Modal */}
      <AnimatePresence>
        {linkContactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Link Existing Contact</h3>
                <button onClick={() => setLinkContactOpen(false)} className="text-text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Search & Select Contact</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={e => setContactSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full bg-surface-hover border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-text-muted outline-none focus:border-primary transition-colors"
                  />
                  {contactSearchQuery && (
                    <button
                      onClick={() => setContactSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="max-h-52 overflow-y-auto custom-scrollbar border border-border rounded-xl bg-surface-hover/40 divide-y divide-border/40">
                  {allContacts
                    .filter(c => c.companyId !== id)
                    .filter(c => {
                      if (!contactSearchQuery.trim()) return true;
                      const q = contactSearchQuery.toLowerCase();
                      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
                      const email = (c.email || '').toLowerCase();
                      return fullName.includes(q) || email.includes(q);
                    })
                    .map(c => {
                      const isChosen = selectedContactToLink === c.id;
                      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || 'Unnamed';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedContactToLink(c.id)}
                          className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between text-xs transition-colors ${
                            isChosen ? 'bg-primary/20 text-white font-semibold' : 'text-slate-300 hover:bg-surface-hover hover:text-white'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="truncate font-medium">{name}</p>
                            {c.email && <p className="text-[11px] text-text-muted truncate">{c.email}</p>}
                          </div>
                          {isChosen && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  {allContacts.filter(c => c.companyId !== id).filter(c => {
                    if (!contactSearchQuery.trim()) return true;
                    const q = contactSearchQuery.toLowerCase();
                    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
                    const email = (c.email || '').toLowerCase();
                    return fullName.includes(q) || email.includes(q);
                  }).length === 0 && (
                    <div className="p-4 text-center text-text-muted text-xs">
                      No matching contacts found.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setLinkContactOpen(false)}
                  className="px-3.5 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedContactToLink || linkContactMutation.isPending}
                  onClick={() => linkContactMutation.mutate(selectedContactToLink)}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
                >
                  Link to {company.name}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
