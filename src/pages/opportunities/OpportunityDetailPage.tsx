import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, Trophy, XCircle, Copy, Trash2, User, Phone, Mail,
  Plus, X, Check, Edit2, Calendar, DollarSign, Tag as TagIcon, Clock,
  Upload, Download, FileText, Folder, CheckSquare, Building2,
  Lock, RefreshCw, Send, CheckCircle2, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../lib/api/opportunities';
import { apiFetch } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { NotionEditor } from '../../components/editor/NotionEditor';
import { WonLostReasonModal } from './components/WonLostReasonModal';
import { RequiredFieldsModal } from './components/RequiredFieldsModal';
import type { Opportunity, Pipeline, Stage, CustomField, Tag } from '../../types/opportunities';

function parseJsonSafe<T>(jsonStr: any, fallback: T): T {
  if (!jsonStr) return fallback;
  if (typeof jsonStr !== 'string') return jsonStr as T;
  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    return fallback;
  }
}

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [hideEmptyFields, setHideEmptyFields] = useState(false);
  const [commsTab, setCommsTab] = useState<'internal' | 'email' | 'sms'>('internal');
  const [commsText, setCommsText] = useState('');

  // Right panel tabs
  const [rightTab, setRightTab] = useState<'activity' | 'notes' | 'files'>('activity');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Notes state
  const [newNote, setNewNote] = useState('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#fef3c7');

  // Tag state
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // Modals & prompts
  const [showWonLostModal, setShowWonLostModal] = useState<'won' | 'lost' | null>(null);
  const [linkContactOpen, setLinkContactOpen] = useState(false);
  const [selectedContactToLink, setSelectedContactToLink] = useState('');
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);
  const [pendingTargetStage, setPendingTargetStage] = useState<Stage | null>(null);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: opp, isLoading, error } = useQuery<Opportunity>({
    queryKey: ['opportunity', id],
    queryFn: () => opportunitiesApi.get(id!),
    enabled: Boolean(id),
  });

  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ['opportunities-pipelines'],
    queryFn: () => opportunitiesApi.listPipelines(),
  });

  const { data: workspaceTags = [] } = useQuery<Tag[]>({
    queryKey: ['opportunities-tags'],
    queryFn: () => opportunitiesApi.listTags(),
  });

  const { data: allContacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () => apiFetch('/api/crm/contacts').then(r => r.ok ? r.json().then(d => d.contacts || d || []) : []),
  });

  // Fetch opportunity events/logs
  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['opportunity-events', id],
    queryFn: async () => {
      try {
        const res = await apiFetch(`/api/opportunities/${id}/logs`);
        if (res.ok) return res.json();
      } catch {}
      return opp?.opportunityLogs || [];
    },
    enabled: Boolean(id),
  });

  const pipeline = opp?.pipelineStage?.pipeline || pipelines.find(p => p.stages?.some(s => s.id === opp?.pipelineStageId));
  const stages = pipeline?.stages || [];
  const lineItems = opp?.lineItems || [];
  const files = opp?.attachments || [];

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: (data: Partial<Opportunity>) => opportunitiesApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', id] });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('success', 'Opportunity updated');
    },
    onError: (err: any) => toast('error', 'Failed to update', err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => opportunitiesApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('success', 'Opportunity deleted');
      navigate('/crm/opportunities');
    },
    onError: (err: any) => toast('error', 'Failed to delete', err.message),
  });

  const duplicateMut = useMutation({
    mutationFn: () => opportunitiesApi.duplicate(id!),
    onSuccess: (newOpp) => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('success', 'Opportunity duplicated');
      navigate(`/crm/opportunities/${newOpp.id}`);
    },
  });



  const addEventMut = useMutation({
    mutationFn: async ({ type, content, title }: { type: string; content: string; title?: string }) => {
      const res = await apiFetch(`/api/opportunities/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title || (type === 'internal_comment' ? 'Internal Note' : type === 'email' ? 'Email Sent' : 'SMS Sent'),
          content,
        }),
      });
      if (!res.ok) {
        return { id: Date.now().toString(), type, content, title: title || 'Note', createdAt: new Date().toISOString() };
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity-events', id] });
      qc.invalidateQueries({ queryKey: ['opportunity', id] });
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

  // Stage change handler
  const handleStageSelect = (newStage: Stage) => {
    if (newStage.isWon) {
      setShowWonLostModal('won');
      return;
    }
    if (newStage.isLost) {
      setShowWonLostModal('lost');
      return;
    }

    const reqFields = parseJsonSafe<string[]>(newStage.requiredFieldsJson, []);
    if (reqFields.length > 0) {
      const missing: string[] = [];
      const customObj = opp?.customFields || {};
      for (const rf of reqFields) {
        if (rf === 'contactId' && !opp?.contactId) missing.push('Contact');
        else if (rf === 'amount' && !opp?.amount) missing.push('Value');
        else if (rf === 'closeDate' && !opp?.closeDate) missing.push('Close Date');
        else if (rf === 'source' && !opp?.source) missing.push('Source');
        else if (rf.startsWith('cf_')) {
          const k = rf.replace('cf_', '');
          if (!customObj[k]) missing.push(k);
        }
      }
      if (missing.length > 0) {
        setPendingTargetStage(newStage);
        setShowRequiredFieldsModal(true);
        return;
      }
    }

    updateMut.mutate({ pipelineStageId: newStage.id });
  };

  const handleAddTag = (tagName: string) => {
    if (!opp) return;
    const currentTags = opp.tags || [];
    if (!currentTags.includes(tagName)) {
      updateMut.mutate({ tags: [...currentTags, tagName] });
    }
    setNewTagText('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagName: string) => {
    if (!opp) return;
    const updated = (opp.tags || []).filter(t => t !== tagName);
    updateMut.mutate({ tags: updated });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await apiFetch('/api/crm/attachments', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'deal',
          entityId: id,
          fileName: file.name,
          fileUrl: URL.createObjectURL(file),
          fileSize: file.size,
          fileType: file.type,
        }),
      });
      qc.invalidateQueries({ queryKey: ['opportunity', id] });
      toast('success', 'File uploaded');
    } catch (err: any) {
      toast('error', 'Upload failed', err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mr-3" />
        Loading opportunity details...
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-[18px] font-bold text-text-main">Opportunity Not Found</h2>
        <p className="text-xs text-text-muted">The requested opportunity does not exist or was deleted.</p>
        <Link to="/crm/opportunities" className="inline-block px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl mt-2">
          Back to Opportunities
        </Link>
      </div>
    );
  }

  const currentStage = opp.pipelineStage || stages.find(s => s.id === opp.pipelineStageId) || stages[0];

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Fixed Action Buttons - Overlaying Global Banner */}
      <div className="fixed top-2.5 right-6 z-[60] flex items-center gap-2">
        <button
          title="Mark Won"
          onClick={() => setShowWonLostModal('won')}
          className="px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm transition-all"
        >
          <Trophy className="w-3.5 h-3.5" /> Won
        </button>
        <button
          title="Mark Lost"
          onClick={() => setShowWonLostModal('lost')}
          className="px-3 py-1.5 rounded-[6px] flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-sm transition-all"
        >
          <XCircle className="w-3.5 h-3.5" /> Lost
        </button>
        <button
          title="Duplicate Opportunity"
          onClick={() => duplicateMut.mutate()}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center text-text-muted bg-surface hover:text-white hover:border-white border border-border transition-all shadow-sm"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          title="Delete Opportunity"
          onClick={() => {
            if (window.confirm('Delete this opportunity permanently?')) {
              deleteMut.mutate();
            }
          }}
          className="w-9 h-9 rounded-[6px] flex items-center justify-center text-text-muted bg-surface hover:text-red-400 hover:border-red-400 border border-border transition-all shadow-sm"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Layout - Floating Frosted Glass Panel */}
      <div className="flex-1 overflow-hidden flex w-full p-6">
        <div
          className="flex-1 flex w-full rounded-[16px] shadow-luxury ring-1 ring-white/5 backdrop-blur-xl border border-border/50 overflow-hidden"
          style={{ background: 'var(--glass-bg)' }}
        >
          {/* Column 1: Opportunity Form (~340px) */}
          <div className="w-[340px] flex flex-col shrink-0 bg-transparent border-r border-border overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border gap-2 shrink-0">
              <Link
                to="/crm/opportunities"
                className="flex items-center text-[12px] font-semibold text-text-muted hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Back
              </Link>

              <div className="flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: currentStage?.color || '#3b82f6' }}
                  />
                  <span className="text-[12px] font-bold text-text-main">
                    {currentStage?.name || 'In Pipeline'}
                  </span>
                </div>
                <span className="text-[14px] font-extrabold font-mono text-emerald-400 mt-0.5">
                  ${(opp.amount || 0).toLocaleString()}
                </span>
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
              <span className="text-[12px] font-medium text-text-main">Hide empty fields</span>
            </div>

            {/* Properties Form */}
            <div className="flex-1 flex flex-col p-5 pb-20 space-y-6">
              {/* Opportunity Details Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-white mb-2">
                  <span className="text-[14px] font-bold">Opportunity Details</span>
                </div>

                {/* Title */}
                <div className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-text-muted mb-1.5">Deal Name</label>
                  <input
                    type="text"
                    defaultValue={opp.title}
                    onBlur={e => {
                      if (e.target.value !== opp.title && e.target.value.trim()) {
                        updateMut.mutate({ title: e.target.value.trim() });
                      }
                    }}
                    className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all"
                  />
                </div>

                {/* Amount */}
                <div className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-text-muted mb-1.5">Deal Value ($)</label>
                  <input
                    type="number"
                    defaultValue={opp.amount}
                    onBlur={e => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val !== opp.amount) {
                        updateMut.mutate({ amount: val });
                      }
                    }}
                    className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all font-mono"
                  />
                </div>

                {/* Pipeline Stage */}
                <div className="flex flex-col relative group">
                  <label className="text-[12px] font-semibold text-text-muted mb-1.5">Stage</label>
                  <select
                    value={currentStage?.id || ''}
                    onChange={e => {
                      const target = stages.find(s => s.id === e.target.value);
                      if (target) handleStageSelect(target);
                    }}
                    className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all"
                  >
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Close Date */}
                {(!hideEmptyFields || opp.closeDate) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-text-muted mb-1.5">Expected Close Date</label>
                    <input
                      type="date"
                      defaultValue={opp.closeDate ? new Date(opp.closeDate).toISOString().split('T')[0] : ''}
                      onChange={e => updateMut.mutate({ closeDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all"
                    />
                  </div>
                )}

                {/* Probability */}
                {(!hideEmptyFields || opp.probability !== undefined) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-text-muted mb-1.5">Win Probability (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={opp.probability ?? 50}
                      onBlur={e => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) updateMut.mutate({ probability: val });
                      }}
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all font-mono"
                    />
                  </div>
                )}

                {/* Source */}
                {(!hideEmptyFields || opp.source) && (
                  <div className="flex flex-col relative group">
                    <label className="text-[12px] font-semibold text-text-muted mb-1.5">Lead Source</label>
                    <input
                      type="text"
                      defaultValue={opp.source || ''}
                      onBlur={e => updateMut.mutate({ source: e.target.value })}
                      placeholder="e.g. Website, Referral"
                      className="w-full bg-surface border border-border/70 rounded-[6px] text-[13px] font-medium text-text-main py-2 px-3 focus:outline-none focus:border-white transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Associated Contacts & Accounts */}
              <div className="space-y-4 pt-5 border-t border-border/50 mt-6">
                <div className="flex items-center justify-between text-white mb-2">
                  <span className="text-[14px] font-bold">Associated Details</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContactToLink(opp.contact?.id || '');
                      setContactSearchTerm('');
                      setLinkContactOpen(true);
                    }}
                    className="text-[12px] font-semibold text-white hover:text-white/80 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" /> {opp.contact ? 'Change Contact' : 'Link Contact'}
                  </button>
                </div>

                {/* Contact Card */}
                {opp.contact ? (
                  <div className="p-3 rounded-lg bg-surface border border-border/70 flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {opp.contact.firstName[0]}
                      </div>
                      <div>
                        <Link
                          to={`/crm/contacts/${opp.contact.id}`}
                          className="text-[13px] font-bold text-text-main hover:text-primary transition-colors block"
                        >
                          {opp.contact.firstName} {opp.contact.lastName || ''}
                        </Link>
                        <span className="text-[11px] text-text-muted">{opp.contact.email || opp.contact.phone || 'Contact'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateMut.mutate({ contactId: null as any })}
                      className="text-text-muted hover:text-red-400 p-1 transition-colors opacity-0 group-hover:opacity-100"
                      title="Unlink Contact"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-surface/40 border border-border/50 flex items-center justify-between">
                    <span className="text-[12px] text-text-muted italic">No contact associated</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedContactToLink('');
                        setContactSearchTerm('');
                        setLinkContactOpen(true);
                      }}
                      className="text-[12px] font-semibold text-white hover:text-white/80 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" /> Link Contact
                    </button>
                  </div>
                )}

                {/* Company / Account Card */}
                {opp.company ? (
                  <div className="p-3 rounded-lg bg-surface border border-border/70 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-hover text-text-muted flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <Link
                          to={`/crm/companies/${opp.company.id}`}
                          className="text-[13px] font-bold text-text-main hover:text-primary transition-colors block"
                        >
                          {opp.company.name}
                        </Link>
                        <span className="text-[11px] text-text-muted">{(opp.company as any)?.industry || 'Account'}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Tags & Labels */}
              <div className="space-y-3 pt-5 border-t border-border/50 mt-6">
                <div className="flex items-center justify-between text-white">
                  <span className="text-[13px] font-bold flex items-center gap-2">
                    <TagIcon className="w-3.5 h-3.5 text-white" /> Tags &amp; Labels
                  </span>
                  {!isAddingTag && (
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(true)}
                      className="text-[11px] font-semibold text-white hover:text-white/80 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-white" /> Add
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(opp.tags || []).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-surface border border-border text-text-main group"
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
                  {(opp.tags || []).length === 0 && !isAddingTag && (
                    <span className="text-[11px] text-text-muted italic">No tags added</span>
                  )}
                </div>

                {isAddingTag && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      autoFocus
                      value={newTagText}
                      onChange={e => setNewTagText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTagText.trim()) {
                          handleAddTag(newTagText.trim());
                        } else if (e.key === 'Escape') {
                          setIsAddingTag(false);
                          setNewTagText('');
                        }
                      }}
                      placeholder="Type tag & press Enter..."
                      className="flex-1 bg-surface border border-violet-500 rounded-[6px] text-[12px] font-medium text-text-main py-1 px-2.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newTagText.trim()) handleAddTag(newTagText.trim());
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

          {/* Column 2: Activity Canvas & Messaging Area (flex-1) */}
          <div className="flex-1 flex flex-col bg-[#1B1D22] border-r border-border relative min-w-[400px]">
            {/* Conversation / Activity Canvas */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6">
              <div className="flex flex-col gap-4">
                {/* Stage Banner Event */}
                <div className="p-4 rounded-xl bg-surface/50 border border-border/50 text-[13px] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: currentStage?.color || '#3b82f6' }}
                    />
                    <span className="text-text-main font-semibold">
                      Currently in <strong className="text-white">{currentStage?.name}</strong>
                    </span>
                  </div>
                  <span className="text-xs text-text-muted">{opp.daysInStage} days in stage</span>
                </div>

                {/* Logged Activities & Messages */}
                {events.map((evt: any) => (
                  <div
                    key={evt.id}
                    className="flex flex-col max-w-[85%] mb-2 ml-auto items-end"
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-row-reverse">
                      <span className="text-[12px] font-bold text-sky-400">
                        {evt.title || 'Internal Note'}
                      </span>
                      <span className="text-[11px] text-text-muted/60">
                        {evt.createdAt ? new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="p-4 rounded-[8px] bg-surface/40 border border-border/40 text-[13px] text-text-main shadow-sm rounded-tr-sm">
                      <div className="prose prose-sm prose-invert" dangerouslySetInnerHTML={{ __html: evt.content }} />
                    </div>
                  </div>
                ))}

                {events.length === 0 && (
                  <div className="py-12 text-center text-text-muted space-y-2">
                    <Clock className="w-8 h-8 mx-auto opacity-30" />
                    <p className="text-[13px] font-medium text-text-main">No activities recorded yet</p>
                    <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                      Log internal notes, emails, and calls with the composer below to track deal progress.
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
                  { id: 'sms', label: 'SMS' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setCommsTab(t.id as any)}
                    className={`flex items-center gap-1.5 pb-3 text-[13px] font-bold transition-colors border-b-[2px] -mb-[1px] ${
                      commsTab === t.id
                        ? 'text-white border-primary'
                        : 'text-text-muted hover:text-text-main border-transparent'
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
                      ? 'Type internal deal note...'
                      : commsTab === 'email'
                      ? 'Compose email to contact...'
                      : 'Type SMS message...'
                  }
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-text-muted">Press Ctrl+Enter or click Log</span>
                  <button
                    type="button"
                    disabled={!commsText.trim() || addEventMut.isPending}
                    onClick={handleSendComms}
                    className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[12px] font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{commsTab === 'internal' ? 'Log Note' : 'Send'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Right Collapsible Panel + 52px Icon Rail */}
          <div className="flex h-full shrink-0 border-l border-border bg-surface">
            {isRightPanelOpen && (
              <div className="w-[360px] flex flex-col shrink-0 bg-transparent overflow-hidden border-r border-border/50">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-surface shrink-0">
                  <span className="text-[14px] font-bold text-text-main capitalize">
                    {rightTab}
                  </span>
                  <div className="flex items-center gap-3">
                    {rightTab === 'files' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[12px] font-semibold text-white hover:text-white/80 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-white" /> Upload
                      </button>
                    )}
                    <button
                      onClick={() => setIsRightPanelOpen(false)}
                      className="text-text-muted hover:text-text-main transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6">
                  {/* Activity Tab */}
                  {rightTab === 'activity' && (
                    <div className="space-y-4">
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                        Deal Timeline
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-surface-hover/50 border border-border text-xs space-y-1">
                          <span className="text-text-main font-semibold block">Opportunity Created</span>
                          <span className="text-[11px] text-text-muted">
                            {new Date(opp.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {events.map((e: any) => (
                          <div key={e.id} className="p-3 rounded-lg bg-surface-hover/50 border border-border text-xs space-y-1">
                            <span className="text-text-main font-semibold block">{e.title || 'Activity'}</span>
                            <div className="text-text-muted text-[11px]" dangerouslySetInnerHTML={{ __html: e.content }} />
                            <span className="text-[10px] text-text-muted/60 block">
                              {new Date(e.createdAt).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes Tab */}
                  {rightTab === 'notes' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                          Notes
                        </span>
                        {!isCreatingNote && (
                          <button
                            onClick={() => setIsCreatingNote(true)}
                            className="text-xs text-white font-bold hover:text-white/80 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5 text-white" /> New Note
                          </button>
                        )}
                      </div>

                      {isCreatingNote && (
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                          <input
                            type="text"
                            placeholder="Note title..."
                            value={newNoteTitle}
                            onChange={e => setNewNoteTitle(e.target.value)}
                            className="w-full bg-surface-hover border border-border rounded-lg px-3 py-1.5 text-xs text-text-main outline-none"
                          />
                          <NotionEditor
                            content={newNote}
                            onChange={html => setNewNote(html)}
                            minHeight="min-h-[120px]"
                            placeholder="Add note content..."
                          />
                          <div className="flex items-center justify-between pt-2">
                            <button
                              onClick={() => {
                                setIsCreatingNote(false);
                                setNewNote('');
                                setNewNoteTitle('');
                              }}
                              className="text-xs text-text-muted hover:text-text-main"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (newNote.trim()) {
                                  addEventMut.mutate({
                                    type: 'note',
                                    title: newNoteTitle || 'Deal Note',
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

                  {/* Files Tab */}
                  {rightTab === 'files' && (
                    <div className="space-y-3">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {files.map(file => (
                        <div
                          key={file.id}
                          className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-text-muted shrink-0" />
                            <span className="truncate text-text-main">{file.fileName}</span>
                          </div>
                          {file.fileUrl && (
                            <a
                              href={file.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-text-muted hover:text-primary shrink-0"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                      {files.length === 0 && (
                        <div className="py-8 text-center text-text-muted text-xs">No files attached</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Vertical Icon Rail */}
            <div className="w-[52px] flex flex-col items-center py-4 gap-2 bg-surface shrink-0">
              {[
                { id: 'activity', icon: Clock, label: 'Activity' },
                { id: 'notes', icon: FileText, label: 'Notes' },
                { id: 'files', icon: Folder, label: 'Files' },
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
                      : 'text-text-muted hover:text-text-main hover:bg-bg border border-transparent'
                  }`}
                >
                  <tab.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Won / Lost Reason Modal */}
      <WonLostReasonModal
        isOpen={Boolean(showWonLostModal)}
        type={showWonLostModal || 'won'}
        reasons={pipeline?.wonLostReasons || []}
        opportunityTitle={opp.title}
        onClose={() => setShowWonLostModal(null)}
        onConfirm={async ({ reason, notes }) => {
          if (!showWonLostModal) return;
          try {
            await opportunitiesApi.update(id!, {
              status: showWonLostModal,
              wonLostReason: reason,
              wonLostNotes: notes,
            });
            qc.invalidateQueries({ queryKey: ['opportunity', id] });
            setShowWonLostModal(null);
            toast('success', `Marked as ${showWonLostModal}`);
          } catch (err: any) {
            toast('error', 'Update failed', err.message);
          }
        }}
      />

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
                <h3 className="text-base font-bold text-white">Link Contact to Opportunity</h3>
                <button onClick={() => setLinkContactOpen(false)} className="text-text-muted hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-text-muted">
                  Select a contact from your CRM to associate with <strong className="text-white">{opp.title}</strong>.
                </p>

                <div className="relative">
                  <input
                    type="text"
                    value={contactSearchTerm}
                    onChange={e => setContactSearchTerm(e.target.value)}
                    placeholder="Search contacts by name or email..."
                    className="w-full bg-surface-hover border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary placeholder:text-text-muted/60"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-border/20 border border-border/50 rounded-xl p-1 bg-surface-hover/30">
                  {allContacts
                    .filter(c => {
                      const name = `${c.firstName || ''} ${c.lastName || ''} ${c.email || ''}`.toLowerCase();
                      return name.includes(contactSearchTerm.toLowerCase());
                    })
                    .map(c => {
                      const isSelected = selectedContactToLink === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedContactToLink(c.id)}
                          className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary text-white font-semibold'
                              : 'text-text-main hover:bg-surface-hover'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-white/10 text-xs font-bold flex items-center justify-center shrink-0">
                              {(c.firstName || c.email || '?')[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">
                                {c.firstName} {c.lastName || ''}
                              </p>
                              <p className={`text-[11px] truncate ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>
                                {c.email || c.phone || 'No email'}
                              </p>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 text-white" />}
                        </div>
                      );
                    })}

                  {allContacts.length === 0 && (
                    <div className="p-4 text-center text-xs text-text-muted">No contacts found in workspace</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setLinkContactOpen(false)}
                  className="px-3.5 py-2 text-xs text-text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedContactToLink || updateMut.isPending}
                  onClick={() => {
                    updateMut.mutate({ contactId: selectedContactToLink });
                    setLinkContactOpen(false);
                  }}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {updateMut.isPending ? 'Linking...' : 'Link Contact'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
