import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Building2, Globe, MapPin, Users, DollarSign,
  Edit2, Trash2, Plus, Mail, Phone, Calendar, Clock,
  CheckCircle2, Sparkles, CheckSquare, Folder, X, ExternalLink,
  Tag, Send, Check, Briefcase, FileText
} from 'lucide-react';
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
  priority: string;
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

  const [activeTab, setActiveTab] = useState<'activity' | 'contacts' | 'deals' | 'tasks' | 'notes'>('activity');
  const [commsTab, setCommsTab] = useState<'note' | 'internal' | 'call'>('note');
  const [commsText, setCommsText] = useState('');

  // Inline editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // Modals state
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [selectedContactToLink, setSelectedContactToLink] = useState('');
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealForm, setNewDealForm] = useState({ title: '', amount: '', stageId: '' });

  // Fetch Company
  const { data: company, isLoading } = useQuery<Company>({
    queryKey: ['company', id],
    queryFn: () => apiFetch(`/api/crm/companies/${id}`).then(r => (r.ok ? r.json() : null))
  });

  // Fetch all contacts
  const { data: allContacts = [] } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: () => apiFetch('/api/crm/contacts').then(r => (r.ok ? r.json().then(d => d.contacts || d || []) : []))
  });
  const companyContacts = allContacts.filter(c => c.companyId === id);

  // Fetch all deals
  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ['deals'],
    queryFn: () => apiFetch('/api/crm/deals').then(r => (r.ok ? r.json() : []))
  });
  const companyDeals = allDeals.filter(d => d.companyId === id);

  // Fetch pipelines for stages
  const { data: pipelines = [] } = useQuery<any[]>({
    queryKey: ['pipelines'],
    queryFn: () => apiFetch('/api/crm/pipelines').then(r => (r.ok ? r.json() : []))
  });
  const allStages = pipelines.flatMap(p => p.stages || []);

  // Fetch tasks
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/api/crm/tasks').then(r => (r.ok ? r.json() : []))
  });
  const companyTasks = allTasks.filter(t => t.companyId === id);

  // Mutations
  const updateCompany = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const res = await apiFetch(`/api/crm/companies/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update company');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company', id] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      setEditingField(null);
      toast('success', 'Account updated');
    },
    onError: () => toast('error', 'Failed to update')
  });

  const linkContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const res = await apiFetch(`/api/crm/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: id })
      });
      if (!res.ok) throw new Error('Failed to link contact');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setLinkContactOpen(false);
      setSelectedContactToLink('');
      toast('success', 'Contact linked to account');
    }
  });

  const unlinkContact = async (contactId: string) => {
    try {
      await apiFetch(`/api/crm/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: null })
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
          amount: parseFloat(data.amount) || 0
        })
      });
      if (!res.ok) throw new Error('Failed to create deal');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      setNewDealOpen(false);
      setNewDealForm({ title: '', amount: '', stageId: '' });
      toast('success', 'Opportunity created for account');
    }
  });

  const parsedTags: string[] = company?.tagsJson ? (typeof company.tagsJson === 'string' ? JSON.parse(company.tagsJson || '[]') : company.tagsJson) : [];

  if (isLoading || !company) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const handleSaveField = (key: keyof Company, val: string) => {
    updateCompany.mutate({ [key]: val });
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg relative overflow-hidden">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Top Navigation Bar matching ContactDetail design */}
      <header className="h-[64px] border-b border-border bg-surface/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3.5">
          <Link
            to="/crm/companies"
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-border bg-surface hover:bg-surface-hover transition-colors text-text-muted hover:text-text-main"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-[14px] flex items-center justify-center shrink-0 shadow-sm">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="w-full h-full object-contain rounded-xl" />
            ) : (
              (company.name[0] || 'C').toUpperCase()
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[16px] font-bold text-text-main leading-tight">{company.name}</h1>
              {company.industry && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-hover border border-border text-text-muted">
                  {company.industry}
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">
              Account • Created {new Date(company.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              <Globe className="w-3.5 h-3.5 text-primary" /> Visit Website
            </a>
          )}

          <button onClick={() => setNewDealOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Opportunity
          </button>
        </div>
      </header>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Account Properties Panel (~340px) */}
        <aside className="w-[340px] border-r border-border bg-surface/50 overflow-y-auto p-6 space-y-6 shrink-0">
          {/* Quick Summary Card */}
          <div className="p-4 rounded-xl bg-surface border border-border shadow-sm space-y-3">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Account Overview</div>

            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</span>
                <span className="font-semibold text-text-main truncate max-w-[150px]">{company.website || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</span>
                <span className="font-semibold text-text-main truncate max-w-[150px]">{company.location || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Employees</span>
                <span className="font-semibold text-text-main">{company.employees || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Revenue</span>
                <span className="font-bold text-emerald-400">{company.revenue || '—'}</span>
              </div>
            </div>
          </div>

          {/* Editable Properties */}
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Properties</div>

            <div className="space-y-3">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted">Account Name</label>
                {editingField === 'name' ? (
                  <input
                    autoFocus
                    defaultValue={company.name}
                    onBlur={e => handleSaveField('name', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveField('name', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-primary rounded-md text-[13px] text-text-main font-medium focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField('name')}
                    className="px-2.5 py-1.5 rounded-md hover:bg-surface-hover border border-transparent hover:border-border cursor-pointer transition-colors text-[13px] font-semibold text-text-main"
                  >
                    {company.name}
                  </div>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted">Website</label>
                {editingField === 'website' ? (
                  <input
                    autoFocus
                    defaultValue={company.website || ''}
                    onBlur={e => handleSaveField('website', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveField('website', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-primary rounded-md text-[13px] text-text-main font-medium focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField('website')}
                    className="px-2.5 py-1.5 rounded-md hover:bg-surface-hover border border-transparent hover:border-border cursor-pointer transition-colors text-[13px] text-text-main"
                  >
                    {company.website || <span className="text-text-muted opacity-50">Add website...</span>}
                  </div>
                )}
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted">Headquarters / Location</label>
                {editingField === 'location' ? (
                  <input
                    autoFocus
                    defaultValue={company.location || ''}
                    onBlur={e => handleSaveField('location', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveField('location', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-primary rounded-md text-[13px] text-text-main font-medium focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField('location')}
                    className="px-2.5 py-1.5 rounded-md hover:bg-surface-hover border border-transparent hover:border-border cursor-pointer transition-colors text-[13px] text-text-main"
                  >
                    {company.location || <span className="text-text-muted opacity-50">Add location...</span>}
                  </div>
                )}
              </div>

              {/* Industry */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-text-muted">Industry</label>
                {editingField === 'industry' ? (
                  <input
                    autoFocus
                    defaultValue={company.industry || ''}
                    onBlur={e => handleSaveField('industry', e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveField('industry', e.currentTarget.value);
                      if (e.key === 'Escape') setEditingField(null);
                    }}
                    className="w-full px-2.5 py-1.5 bg-surface-hover border border-primary rounded-md text-[13px] text-text-main font-medium focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => setEditingField('industry')}
                    className="px-2.5 py-1.5 rounded-md hover:bg-surface-hover border border-transparent hover:border-border cursor-pointer transition-colors text-[13px] text-text-main"
                  >
                    {company.industry || <span className="text-text-muted opacity-50">Add industry...</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2.5 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Account Tags</label>
              {!isAddingTag && (
                <button
                  onClick={() => setIsAddingTag(true)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tag
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {parsedTags.map((tag, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-primary/10 text-primary border border-primary/20"
                >
                  <Tag className="w-3 h-3" />
                  {tag}
                  <button
                    onClick={() => {
                      const updated = parsedTags.filter((_, idx) => idx !== i);
                      updateCompany.mutate({ tagsJson: JSON.stringify(updated) });
                    }}
                    className="hover:text-red-400 ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {isAddingTag && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  placeholder="New tag..."
                  value={newTagInput}
                  onChange={e => setNewTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTagInput.trim()) {
                      const updated = [...parsedTags, newTagInput.trim()];
                      updateCompany.mutate({ tagsJson: JSON.stringify(updated) });
                      setNewTagInput('');
                      setIsAddingTag(false);
                    } else if (e.key === 'Escape') {
                      setIsAddingTag(false);
                    }
                  }}
                  className="flex-1 px-2.5 py-1 bg-surface-hover border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    if (newTagInput.trim()) {
                      const updated = [...parsedTags, newTagInput.trim()];
                      updateCompany.mutate({ tagsJson: JSON.stringify(updated) });
                      setNewTagInput('');
                    }
                    setIsAddingTag(false);
                  }}
                  className="px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-md"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Center/Right Main Tabs Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-bg">
          {/* Main Navigation Tabs */}
          <div className="border-b border-border bg-surface px-8 flex items-center gap-6 h-[48px] shrink-0">
            {[
              { id: 'activity', label: 'Activity & Notes' },
              { id: 'contacts', label: `Associated Contacts (${companyContacts.length})` },
              { id: 'deals', label: `Opportunities (${companyDeals.length})` },
              { id: 'tasks', label: `Tasks (${companyTasks.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-full text-[13px] font-bold transition-all relative flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Panes */}
          <div className="flex-1 overflow-y-auto p-8">
            {/* ── Activity & Notes Tab ── */}
            {activeTab === 'activity' && (
              <div className="max-w-3xl space-y-6">
                {/* Interactive Composer */}
                <div className="p-4 rounded-xl bg-surface border border-border shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-border text-[12px] font-bold text-text-muted">
                    <button
                      onClick={() => setCommsTab('note')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        commsTab === 'note' ? 'bg-primary text-white' : 'hover:text-text-main'
                      }`}
                    >
                      Add Note
                    </button>
                    <button
                      onClick={() => setCommsTab('internal')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        commsTab === 'internal' ? 'bg-primary text-white' : 'hover:text-text-main'
                      }`}
                    >
                      Internal Log
                    </button>
                    <button
                      onClick={() => setCommsTab('call')}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        commsTab === 'call' ? 'bg-primary text-white' : 'hover:text-text-main'
                      }`}
                    >
                      Log Call / Meeting
                    </button>
                  </div>

                  <NotionEditor
                    content={commsText}
                    onChange={setCommsText}
                    placeholder="Type '/' for commands or start writing notes about this company..."
                    minHeight="min-h-[100px]"
                  />

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-text-muted">Markdown supported</span>
                    <button
                      onClick={() => {
                        if (!commsText.trim()) return;
                        toast('success', 'Note saved to account');
                        setCommsText('');
                      }}
                      className="px-4 py-1.5 bg-primary text-white text-[12px] font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                    >
                      Save Activity
                    </button>
                  </div>
                </div>

                {/* About & Description Section */}
                <div className="p-5 rounded-xl bg-surface border border-border shadow-sm space-y-2.5">
                  <h3 className="text-[14px] font-bold text-text-main">About {company.name}</h3>
                  {company.description ? (
                    <p className="text-[13px] text-text-muted leading-relaxed whitespace-pre-wrap">{company.description}</p>
                  ) : (
                    <p className="text-[13px] text-text-muted italic">No description provided for this account.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Associated Contacts Tab ── */}
            {activeTab === 'contacts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-text-main">Contacts ({companyContacts.length})</h3>
                  <button onClick={() => setLinkContactOpen(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> Link Existing Contact
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {companyContacts.map(c => (
                    <div
                      key={c.id}
                      className="p-4 rounded-xl bg-surface border border-border hover:border-primary/50 shadow-sm transition-all flex items-start justify-between group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-[13px] flex items-center justify-center shrink-0 border border-primary/20">
                          {(c.firstName[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <Link
                            to={`/crm/contacts/${c.id}`}
                            className="text-[14px] font-bold text-text-main hover:text-primary transition-colors"
                          >
                            {c.firstName} {c.lastName}
                          </Link>
                          {c.title && <p className="text-[12px] text-text-muted">{c.title}</p>}
                          {c.email && (
                            <p className="text-[11px] text-text-muted flex items-center gap-1 mt-1">
                              <Mail className="w-3 h-3" /> {c.email}
                            </p>
                          )}
                          {c.phone && (
                            <p className="text-[11px] text-text-muted flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => unlinkContact(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-muted hover:text-red-400 transition-all text-[11px]"
                        title="Unlink contact from account"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {companyContacts.length === 0 && (
                    <div className="col-span-2 py-12 text-center text-text-muted border border-dashed border-border rounded-xl">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-[13px] font-bold text-text-main">No contacts linked</p>
                      <p className="text-[12px] text-text-muted mt-0.5">Link employees or representatives from this company.</p>
                      <button
                        onClick={() => setLinkContactOpen(true)}
                        className="mt-3 px-3 py-1.5 bg-primary/10 text-primary font-bold text-[12px] rounded-lg border border-primary/20"
                      >
                        + Link Contact
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Deals Tab ── */}
            {activeTab === 'deals' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-text-main">Opportunities ({companyDeals.length})</h3>
                  <button onClick={() => setNewDealOpen(true)} className="btn-primary">
                    <Plus className="w-4 h-4" /> New Opportunity
                  </button>
                </div>

                <div className="space-y-2.5">
                  {companyDeals.map(d => (
                    <div
                      key={d.id}
                      className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between shadow-sm hover:border-primary/40 transition-colors"
                    >
                      <div>
                        <h4 className="text-[14px] font-bold text-text-main">{d.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] font-bold text-emerald-400">
                            ${(d.amount || 0).toLocaleString()}
                          </span>
                          {d.pipelineStage && (
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold"
                              style={{
                                backgroundColor: `${d.pipelineStage.color}25`,
                                color: d.pipelineStage.color
                              }}
                            >
                              {d.pipelineStage.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                        {d.priority} Priority
                      </span>
                    </div>
                  ))}

                  {companyDeals.length === 0 && (
                    <div className="py-12 text-center text-text-muted border border-dashed border-border rounded-xl">
                      <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-[13px] font-bold text-text-main">No opportunities linked</p>
                      <p className="text-[12px] text-text-muted mt-0.5">Track sales deals and contract expansions for this account.</p>
                      <button
                        onClick={() => setNewDealOpen(true)}
                        className="mt-3 px-3 py-1.5 bg-primary/10 text-primary font-bold text-[12px] rounded-lg border border-primary/20"
                      >
                        + Create Opportunity
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tasks Tab ── */}
            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-text-main">Tasks ({companyTasks.length})</h3>
                </div>

                <div className="space-y-2">
                  {companyTasks.map(t => (
                    <div
                      key={t.id}
                      className="p-3 rounded-lg bg-surface border border-border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className="w-4 h-4 text-primary" />
                        <span className="text-[13px] font-semibold text-text-main">{t.title}</span>
                      </div>
                      <span className="text-[11px] text-text-muted">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</span>
                    </div>
                  ))}

                  {companyTasks.length === 0 && (
                    <div className="py-12 text-center text-text-muted border border-dashed border-border rounded-xl">
                      <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-[13px] font-bold text-text-main">No tasks for this account</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modal: Link Existing Contact ── */}
      {linkContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLinkContactOpen(false)} />
          <div className="relative w-[400px] bg-surface border border-border rounded-xl p-5 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-text-main">Link Contact to {company.name}</h3>
              <button onClick={() => setLinkContactOpen(false)} className="p-1 rounded-full text-text-muted hover:text-text-main">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-bold text-text-muted">Select Contact</label>
              <select
                value={selectedContactToLink}
                onChange={e => setSelectedContactToLink(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
              >
                <option value="">— Select a contact —</option>
                {allContacts.filter(c => c.companyId !== id).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.email || 'No email'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setLinkContactOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-text-main"
              >
                Cancel
              </button>
              <button
                disabled={!selectedContactToLink || linkContactMutation.isPending}
                onClick={() => linkContactMutation.mutate(selectedContactToLink)}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold disabled:opacity-50"
              >
                Link Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Opportunity ── */}
      {newDealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setNewDealOpen(false)} />
          <div className="relative w-[440px] bg-surface border border-border rounded-xl p-5 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-text-main">New Opportunity for {company.name}</h3>
              <button onClick={() => setNewDealOpen(false)} className="p-1 rounded-full text-text-muted hover:text-text-main">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[12px] font-bold text-text-main">Deal Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise License Expansion"
                  value={newDealForm.title}
                  onChange={e => setNewDealForm({ ...newDealForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-text-main">Deal Value ($)</label>
                <input
                  type="number"
                  placeholder="5000"
                  value={newDealForm.amount}
                  onChange={e => setNewDealForm({ ...newDealForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-bold text-text-main">Pipeline Stage *</label>
                <select
                  value={newDealForm.stageId}
                  onChange={e => setNewDealForm({ ...newDealForm, stageId: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary"
                >
                  <option value="">— Select Stage —</option>
                  {allStages.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewDealOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-text-main"
              >
                Cancel
              </button>
              <button
                disabled={!newDealForm.title.trim() || !newDealForm.stageId || createDealMutation.isPending}
                onClick={() =>
                  createDealMutation.mutate({
                    title: newDealForm.title,
                    amount: newDealForm.amount,
                    pipelineStageId: newDealForm.stageId
                  })
                }
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold disabled:opacity-50"
              >
                Create Deal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
