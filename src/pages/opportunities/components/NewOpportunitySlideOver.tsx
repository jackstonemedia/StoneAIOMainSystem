import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Plus, UserPlus, DollarSign, Calendar, Tag as TagIcon,
  ChevronDown, Search, Check, AlertCircle, Sparkles, Building2,
  User, Layers, Flag, UserCheck, FileText, Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { apiFetch } from '../../../lib/apiClient';
import { useToast } from '../../../components/ui/Toast';
import { SlideOverPanel } from '../../../components/ui/SlideOverPanel';
import type { Pipeline, Stage, CustomField, Tag } from '../../../types/opportunities';

export interface NewOpportunitySlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newDeal: any) => void;
  initialPipelineId?: string;
  initialStageId?: string;
  initialContactId?: string;
}

// Render a standard form row with an icon and label
const FormRow = ({ label, icon: Icon, required, optional, children }: {
  label: string;
  icon?: any;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="text-[12px] font-semibold text-text-main flex items-center justify-between">
      <span className="flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-text-muted" />}
        {label}
        {required && <span className="text-red-400">*</span>}
      </span>
      {optional && <span className="text-[11px] text-text-muted font-normal">Optional</span>}
    </label>
    {children}
  </div>
);

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  { id: 'medium', label: 'Medium', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  { id: 'high', label: 'High', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  { id: 'urgent', label: 'Urgent', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
];

export function NewOpportunitySlideOver({
  isOpen,
  onClose,
  onSuccess,
  initialPipelineId,
  initialStageId,
  initialContactId,
}: NewOpportunitySlideOverProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [pipelineId, setPipelineId] = useState<string>('');
  const [stageId, setStageId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [description, setDescription] = useState('');
  const [contactId, setContactId] = useState<string>(initialContactId || '');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // Contact search and quick creation
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const [showQuickContact, setShowQuickContact] = useState(false);
  const [quickFirstName, setQuickFirstName] = useState('');
  const [quickLastName, setQuickLastName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');

  // Tag creation
  const [tagInput, setTagInput] = useState('');
  const [isTagDropOpen, setIsTagDropOpen] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['opportunities-pipelines'],
    queryFn: () => opportunitiesApi.listPipelines(),
    enabled: isOpen,
  });

  const { data: contactsData } = useQuery<{ contacts: any[] }>({
    queryKey: ['contacts-list-mini'],
    queryFn: () => apiFetch('/api/crm/contacts?limit=100').then(r => r.json()),
    enabled: isOpen,
  });
  const contacts = contactsData?.contacts || [];

  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['opportunities-custom-fields', pipelineId],
    queryFn: () => opportunitiesApi.listCustomFields(pipelineId || undefined),
    enabled: isOpen,
  });

  const { data: workspaceTags = [] } = useQuery<Tag[]>({
    queryKey: ['opportunities-tags'],
    queryFn: () => opportunitiesApi.listTags(),
    enabled: isOpen,
  });

  const { data: teamMembers = [] } = useQuery<any[]>({
    queryKey: ['workspace-team-members'],
    queryFn: () => apiFetch('/api/settings/team').then(r => r.json()).catch(() => []),
    enabled: isOpen,
  });

  // Set default pipeline and stage
  useEffect(() => {
    if (pipelines.length > 0) {
      const activeP = (initialPipelineId && pipelines.find(p => p.id === initialPipelineId))
        || pipelines.find(p => p.isDefault)
        || pipelines[0];
      setPipelineId(activeP.id);
      if (activeP.stages.length > 0) {
        const activeS = (initialStageId && activeP.stages.find(s => s.id === initialStageId)) || activeP.stages[0];
        setStageId(activeS.id);
      }
    }
  }, [pipelines, initialPipelineId, initialStageId, isOpen]);

  useEffect(() => {
    if (initialContactId) {
      setContactId(initialContactId);
    }
  }, [initialContactId]);

  const selectedPipeline = pipelines.find(p => p.id === pipelineId);
  const stages = selectedPipeline?.stages || [];
  const selectedStage = stages.find(s => s.id === stageId) || stages[0];
  const selectedContact = contacts.find(c => c.id === contactId);

  // Auto-name placeholder template
  const contactNameDisplay = selectedContact
    ? `${selectedContact.firstName} ${selectedContact.lastName || ''}`.trim()
    : 'New Contact';
  const autoNameTemplate = `${contactNameDisplay} - ${selectedPipeline?.name || 'Sales'} Deal`;

  const handlePipelineChange = (newPid: string) => {
    setPipelineId(newPid);
    const p = pipelines.find(x => x.id === newPid);
    if (p && p.stages.length > 0) {
      setStageId(p.stages[0].id);
    }
  };

  // Quick contact creation
  const handleCreateQuickContact = async () => {
    if (!quickFirstName.trim()) return;
    try {
      const res = await apiFetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: quickFirstName.trim(),
          lastName: quickLastName.trim() || undefined,
          email: quickEmail.trim() || undefined,
          phone: quickPhone.trim() || undefined,
        }),
      });
      const newContact = await res.json();
      qc.invalidateQueries({ queryKey: ['contacts-list-mini'] });
      setContactId(newContact.id);
      setShowQuickContact(false);
      setQuickFirstName('');
      setQuickLastName('');
      setQuickEmail('');
      setQuickPhone('');
      toast('success', 'Contact created');
    } catch (e: any) {
      toast('error', 'Failed to create contact', e.message);
    }
  };

  // Create Opportunity Mutation
  const createMut = useMutation({
    mutationFn: async () => {
      const finalTitle = title.trim() || autoNameTemplate;
      return opportunitiesApi.create({
        title: finalTitle,
        amount: parseFloat(amount) || 0,
        pipelineStageId: stageId,
        contactId: contactId || null,
        source: source || null,
        ownerId: ownerId || null,
        closeDate: closeDate || null,
        priority,
        description: description || null,
        tags: selectedTags,
        customFields: customFieldValues,
      });
    },
    onSuccess: (newDeal) => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      toast('success', 'Opportunity created successfully');
      onSuccess?.(newDeal);
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create opportunity');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    if (!stageId) {
      setError('Please select a pipeline stage');
      return;
    }
    createMut.mutate();
  };

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch.trim()) return true;
    const term = contactSearch.toLowerCase();
    const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  return (
    <SlideOverPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Add Opportunity"
      width="w-[520px]"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={createMut.isPending || !stageId}
            onClick={() => handleSubmit()}
            className="px-4 py-2 bg-primary text-white rounded-[6px] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {createMut.isPending ? 'Saving...' : 'Save Opportunity'}
          </button>
        </>
      }
    >
      <div className="space-y-6 pb-8 relative">
        {error && (
          <div className="p-3.5 rounded-[6px] bg-red-500/10 border border-red-500/30 text-red-400 text-[13px] flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Primary Identity ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <FormRow label="Opportunity Name" icon={Sparkles} optional>
            <input
              type="text"
              placeholder={autoNameTemplate}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main placeholder:text-text-muted/50 focus:outline-none focus:border-primary transition-all"
            />
            <p className="text-[11px] text-text-muted mt-1">Leave blank to use the smart auto-generated title.</p>
          </FormRow>

          {/* Linked Contact */}
          <FormRow label="Linked Contact" icon={User} optional>
            {initialContactId && selectedContact ? (
              <div className="flex items-center gap-3 p-2.5 bg-surface-hover/60 border border-border rounded-[6px]">
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs">
                  {selectedContact.firstName?.[0] || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-text-main">
                    {selectedContact.firstName} {selectedContact.lastName || ''}
                  </div>
                  <div className="text-[11px] text-text-muted truncate">{selectedContact.email || selectedContact.phone || 'No contact info'}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Selected</span>
              </div>
            ) : (
              <div className="relative">
                <div
                  onClick={() => setContactDropOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-surface-hover border border-border rounded-[6px] cursor-pointer hover:border-primary/50 text-[13px] text-text-main transition-colors"
                >
                  {selectedContact ? (
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">
                        {selectedContact.firstName?.[0] || 'C'}
                      </div>
                      <span className="truncate">{selectedContact.firstName} {selectedContact.lastName || ''}</span>
                      {selectedContact.email && <span className="text-text-muted text-[11px] truncate">({selectedContact.email})</span>}
                    </div>
                  ) : (
                    <span className="text-text-muted">Search or link a contact...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                </div>

                <AnimatePresence>
                  {contactDropOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setContactDropOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-2xl p-2 max-h-60 overflow-y-auto"
                      >
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-text-muted" />
                          <input
                            type="text"
                            placeholder="Search by name, email, phone..."
                            value={contactSearch}
                            onChange={e => setContactSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-surface-hover rounded-md border border-border text-[12px] text-text-main placeholder-text-muted focus:outline-none focus:border-primary"
                            autoFocus
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickContact(true);
                            setContactDropOpen(false);
                          }}
                          className="w-full mb-1 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[12px] font-semibold flex items-center gap-2 transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          + Create new contact
                        </button>

                        {contactId && (
                          <div
                            onClick={() => {
                              setContactId('');
                              setContactDropOpen(false);
                            }}
                            className="px-3 py-1.5 rounded-lg text-[12px] text-red-400 hover:bg-surface-hover cursor-pointer mb-1"
                          >
                            Clear linked contact
                          </div>
                        )}

                        {filteredContacts.length === 0 ? (
                          <div className="p-3 text-center text-[12px] text-text-muted">No contacts found</div>
                        ) : (
                          filteredContacts.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setContactId(c.id);
                                setContactDropOpen(false);
                              }}
                              className={`px-3 py-2 rounded-lg text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                                contactId === c.id ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-hover text-text-main'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-medium">{c.firstName} {c.lastName || ''}</div>
                                {c.email && <div className="text-[11px] text-text-muted truncate">{c.email}</div>}
                              </div>
                              {contactId === c.id && <Check className="w-4 h-4 text-primary shrink-0" />}
                            </div>
                          ))
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </FormRow>

          {/* Quick Contact Form Inline Drawer */}
          <AnimatePresence>
            {showQuickContact && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3.5 bg-surface-hover/70 border border-primary/30 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-text-main flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-primary" /> Quick Add Contact
                  </span>
                  <button type="button" onClick={() => setShowQuickContact(false)} className="text-text-muted hover:text-text-main text-xs">Cancel</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="First Name *"
                    value={quickFirstName}
                    onChange={e => setQuickFirstName(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={quickLastName}
                    onChange={e => setQuickLastName(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary"
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={quickEmail}
                    onChange={e => setQuickEmail(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={quickPhone}
                    onChange={e => setQuickPhone(e.target.value)}
                    className="px-2.5 py-1.5 bg-surface border border-border rounded-md text-[12px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateQuickContact}
                  disabled={!quickFirstName.trim()}
                  className="w-full py-1.5 bg-primary text-white text-[12px] font-semibold rounded-md disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  Save & Select Contact
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-px bg-border" />

        {/* ── Pipeline & Stage Context ──────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-text-main">Pipeline & Stage</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Pipeline" icon={Layers} required>
              <select
                value={pipelineId}
                onChange={e => handlePipelineChange(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.isDefault ? '(Default)' : ''}</option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Stage" icon={Flag} required>
              <select
                value={stageId}
                onChange={e => setStageId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.probability}%)</option>
                ))}
              </select>
            </FormRow>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* ── Financials & Timeline ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-[14px] font-bold text-text-main">Deal Details</h3>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Estimated Value ($)" icon={DollarSign}>
              <div className="relative">
                <span className="absolute left-3 top-2 text-text-muted text-[13px]">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                />
              </div>
            </FormRow>

            <FormRow label="Expected Close Date" icon={Calendar}>
              <input
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
              />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Lead Source" icon={Globe}>
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Select source...</option>
                <option value="Website Inbound">Website Inbound</option>
                <option value="Cold Outreach">Cold Outreach</option>
                <option value="Referral">Referral</option>
                <option value="Organic Search">Organic Search</option>
                <option value="Paid Ads">Paid Ads</option>
                <option value="Event / Conference">Event / Conference</option>
                <option value="Partner">Partner</option>
              </select>
            </FormRow>

            <FormRow label="Owner" icon={UserCheck}>
              <select
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">Current User (Default)</option>
                {teamMembers.map((m: any) => (
                  <option key={m.userId} value={m.userId}>{m.userId} ({m.role})</option>
                ))}
              </select>
            </FormRow>
          </div>

          {/* Priority Pill Selector */}
          <FormRow label="Priority" icon={Flag}>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPriority(opt.id)}
                  className={`py-1.5 px-2 rounded-[6px] text-[12px] font-semibold border transition-all text-center ${
                    priority === opt.id
                      ? `${opt.color} ring-1 ring-primary/40 font-bold`
                      : 'border-border bg-surface-hover text-text-muted hover:text-text-main'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FormRow>
        </div>

        <div className="h-px bg-border" />

        {/* ── Tags ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <FormRow label="Tags" icon={TagIcon}>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5 p-2 bg-surface-hover border border-border rounded-[6px] min-h-[42px] items-center">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-primary/20 border border-primary/30 text-text-main text-[11px] font-semibold"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setSelectedTags(t => t.filter(x => x !== tag))}
                      className="hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

                <div className="relative flex-1 min-w-[120px]">
                  <input
                    type="text"
                    placeholder="+ Add tag..."
                    value={tagInput}
                    onChange={e => {
                      setTagInput(e.target.value);
                      setIsTagDropOpen(true);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && tagInput.trim()) {
                        e.preventDefault();
                        const t = tagInput.trim();
                        if (!selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
                        setTagInput('');
                      }
                    }}
                    className="w-full bg-transparent px-2 py-0.5 text-[12px] text-text-main focus:outline-none placeholder:text-text-muted"
                  />

                  <AnimatePresence>
                    {isTagDropOpen && tagInput && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsTagDropOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          className="absolute top-full left-0 mt-1 z-50 bg-surface border border-border rounded-xl shadow-xl p-1.5 max-h-40 overflow-y-auto min-w-[160px]"
                        >
                          {workspaceTags.filter(t => t.name.toLowerCase().includes(tagInput.toLowerCase())).map(t => (
                            <div
                              key={t.id}
                              onClick={() => {
                                if (!selectedTags.includes(t.name)) setSelectedTags(prev => [...prev, t.name]);
                                setTagInput('');
                                setIsTagDropOpen(false);
                              }}
                              className="px-2.5 py-1.5 text-[12px] text-text-main hover:bg-surface-hover rounded-md cursor-pointer flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                              {t.name}
                            </div>
                          ))}
                          <div
                            onClick={() => {
                              const t = tagInput.trim();
                              if (!selectedTags.includes(t)) setSelectedTags(prev => [...prev, t]);
                              setTagInput('');
                              setIsTagDropOpen(false);
                            }}
                            className="px-2.5 py-1.5 text-[12px] text-primary hover:bg-primary/10 rounded-md cursor-pointer font-medium"
                          >
                            + Create "{tagInput.trim()}"
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </FormRow>
        </div>

        {/* ── Dynamic Custom Fields ────────────────────────────────────────── */}
        {customFields.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <div className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main">Custom Fields</h3>
              <div className="grid grid-cols-2 gap-3">
                {customFields.map(cf => {
                  const options = cf.optionsJson ? parseJsonSafe<string[]>(cf.optionsJson, []) : [];
                  return (
                    <div key={cf.id} className="space-y-1.5">
                      <label className="text-[12px] font-semibold text-text-main flex items-center justify-between">
                        <span>{cf.label} {cf.required && <span className="text-red-400">*</span>}</span>
                      </label>

                      {cf.type === 'select' || cf.type === 'dropdown' ? (
                        <select
                          value={customFieldValues[cf.id] || customFieldValues[cf.label] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="">Select option...</option>
                          {options.map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : cf.type === 'checkbox' || cf.type === 'boolean' ? (
                        <label className="flex items-center gap-2.5 pt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(customFieldValues[cf.id])}
                            onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.checked }))}
                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                          />
                          <span className="text-[13px] text-text-main">{cf.label}</span>
                        </label>
                      ) : cf.type === 'date' ? (
                        <input
                          type="date"
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <input
                          type={cf.type === 'number' || cf.type === 'currency' ? 'number' : 'text'}
                          placeholder={`Enter ${cf.label.toLowerCase()}...`}
                          value={customFieldValues[cf.id] || ''}
                          onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="h-px bg-border" />

        {/* ── Notes / Description ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <FormRow label="Notes / Description" icon={FileText}>
            <textarea
              rows={3}
              placeholder="Add key deal details, context, or next steps..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary resize-none placeholder:text-text-muted/50"
            />
          </FormRow>
        </div>
      </div>
    </SlideOverPanel>
  );
}

function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
