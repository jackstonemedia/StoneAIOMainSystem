import React, { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft, MoreVertical, Trophy, XCircle, Copy, ArrowRight,
  Trash2, User, Phone, Mail, ExternalLink, Plus, X, Check,
  Edit2, Calendar, DollarSign, Tag as TagIcon, Clock, Upload,
  Download, FileText, Zap, Sparkles, Building2, ChevronDown, CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../lib/api/opportunities';
import { apiFetch } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { WonLostReasonModal } from './components/WonLostReasonModal';
import { RequiredFieldsModal } from './components/RequiredFieldsModal';
import type { Opportunity, Pipeline, Stage, CustomField, Tag } from '../../types/opportunities';

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'line_items' | 'files' | 'automations'>('overview');

  // Inline edit state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // Modals & prompts
  const [showWonLostModal, setShowWonLostModal] = useState<'won' | 'lost' | null>(null);
  const [showMovePipelineModal, setShowMovePipelineModal] = useState(false);
  const [targetPipelineId, setTargetPipelineId] = useState('');
  const [targetStageId, setTargetStageId] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddLineItemModal, setShowAddLineItemModal] = useState(false);
  const [showRequiredFieldsModal, setShowRequiredFieldsModal] = useState(false);
  const [pendingTargetStage, setPendingTargetStage] = useState<Stage | null>(null);

  // Line item form
  const [lineItemName, setLineItemName] = useState('');
  const [lineItemQty, setLineItemQty] = useState('1');
  const [lineItemUnitPrice, setLineItemUnitPrice] = useState('0');
  const [lineItemDesc, setLineItemDesc] = useState('');

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

  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['opportunities-custom-fields', opp?.pipelineStage?.pipeline?.id],
    queryFn: () => opportunitiesApi.listCustomFields(opp?.pipelineStage?.pipeline?.id),
    enabled: Boolean(opp?.pipelineStage?.pipeline?.id),
  });

  const { data: workspaceTags = [] } = useQuery<Tag[]>({
    queryKey: ['opportunities-tags'],
    queryFn: () => opportunitiesApi.listTags(),
  });

  const pipeline = opp?.pipelineStage?.pipeline;
  const stages = pipeline?.stages || [];
  const lineItems = opp?.lineItems || [];
  const logs = opp?.opportunityLogs || [];
  const files = opp?.attachments || [];
  const automations = opp?.automations || [];

  // Determine which tabs are visible
  const visibleTabs = parseJsonSafe<string[]>(pipeline?.visibleTabsJson, ['overview', 'activity', 'line_items', 'files', 'automations']);
  const showLineItemsTab = pipeline?.enableLineItems && visibleTabs.includes('line_items');

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: (data: Partial<Opportunity>) => opportunitiesApi.update(id!, data),
    onSuccess: (updated) => {
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
      navigate('/opportunities');
    },
    onError: (err: any) => toast('error', 'Failed to delete', err.message),
  });

  const duplicateMut = useMutation({
    mutationFn: () => opportunitiesApi.duplicate(id!),
    onSuccess: (newOpp) => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      toast('success', 'Opportunity duplicated');
      navigate(`/opportunities/${newOpp.id}`);
    },
  });

  const addLineItemMut = useMutation({
    mutationFn: () => opportunitiesApi.createLineItem(id!, {
      name: lineItemName.trim(),
      description: lineItemDesc.trim() || undefined,
      quantity: parseFloat(lineItemQty) || 1,
      unitPrice: parseFloat(lineItemUnitPrice) || 0,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', id] });
      setShowAddLineItemModal(false);
      setLineItemName('');
      setLineItemQty('1');
      setLineItemUnitPrice('0');
      setLineItemDesc('');
      toast('success', 'Line item added');
    },
    onError: (err: any) => toast('error', 'Failed to add line item', err.message),
  });

  const deleteLineItemMut = useMutation({
    mutationFn: (itemId: string) => opportunitiesApi.deleteLineItem(id!, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunity', id] });
      toast('success', 'Line item removed');
    },
  });

  // Stage change handler with required fields check
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

  // Tag addition
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

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Mock / direct upload attachment creation
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
    } catch (e: any) {
      toast('error', 'Upload failed', e.message);
    }
  };

  if (isLoading) {
    return <div className="p-12 text-center text-text-muted text-sm">Loading opportunity details...</div>;
  }

  if (error || !opp) {
    return (
      <div className="p-12 text-center space-y-3">
        <h2 className="text-[18px] font-bold text-text-main">Opportunity Not Found</h2>
        <p className="text-xs text-text-muted">The requested opportunity does not exist or was deleted.</p>
        <Link to="/opportunities" className="inline-block px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl mt-2">
          Back to Opportunities
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* ── 4.1 Header ───────────────────────────────────────────────────────── */}
      <div className="px-8 py-4 border-b border-border bg-surface shrink-0 space-y-3">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Link to="/opportunities" className="hover:text-text-main transition-colors">Opportunities</Link>
          <span>/</span>
          <span className="text-text-muted">{pipeline?.name || 'Pipeline'}</span>
          <span>/</span>
          <span className="text-text-main font-semibold truncate max-w-xs">{opp.title}</span>
        </div>

        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {/* Title (Inline Editable) */}
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  className="text-[22px] font-bold text-text-main bg-surface-hover/80 border border-primary px-3 py-1 rounded-xl focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (titleInput.trim()) updateMut.mutate({ title: titleInput.trim() });
                    setEditingTitle(false);
                  }}
                  className="p-1.5 rounded-lg bg-primary text-white"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg text-text-muted hover:text-text-main">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setTitleInput(opp.title);
                  setEditingTitle(true);
                }}
                className="text-[22px] font-extrabold text-text-main hover:text-primary cursor-pointer transition-colors truncate max-w-xl group flex items-center gap-2"
                title="Click to rename"
              >
                <span>{opp.title}</span>
                <Edit2 className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </h1>
            )}

            {/* Stage Pill Dropdown */}
            <div className="relative group">
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors shadow-xs"
                style={{
                  backgroundColor: `${opp.pipelineStage?.color || '#52677D'}25`,
                  borderColor: `${opp.pipelineStage?.color || '#52677D'}50`,
                  color: opp.pipelineStage?.color || '#52677D',
                }}
              >
                <span>{opp.pipelineStage?.name || 'Stage'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <div className="absolute left-0 top-full mt-1 z-30 bg-surface border border-border rounded-xl shadow-xl p-1.5 min-w-[170px] hidden group-hover:block">
                {stages.map(s => (
                  <div
                    key={s.id}
                    onClick={() => handleStageSelect(s)}
                    className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      opp.pipelineStageId === s.id ? 'bg-primary text-white font-bold' : 'text-text-main hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span>{s.name}</span>
                    </div>
                    {opp.pipelineStageId === s.id && <Check className="w-3.5 h-3.5" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Value Inline Editable */}
            {editingAmount ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={amountInput}
                  onChange={e => setAmountInput(e.target.value)}
                  className="w-32 text-[18px] font-bold font-mono text-emerald-400 bg-surface-hover/80 border border-primary px-2.5 py-0.5 rounded-xl focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    updateMut.mutate({ amount: parseFloat(amountInput) || 0 });
                    setEditingAmount(false);
                  }}
                  className="p-1 rounded bg-primary text-white"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingAmount(false)} className="p-1 text-text-muted hover:text-text-main">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setAmountInput(String(opp.amount));
                  setEditingAmount(true);
                }}
                className="text-[20px] font-extrabold font-mono text-emerald-400 hover:text-emerald-300 cursor-pointer flex items-center gap-1 group"
                title="Click to edit value"
              >
                <span>${opp.amount.toLocaleString()}</span>
                <Edit2 className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {opp.status !== 'won' && (
              <button
                onClick={() => setShowWonLostModal('won')}
                className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <Trophy className="w-3.5 h-3.5" /> Mark Won
              </button>
            )}

            {opp.status !== 'lost' && (
              <button
                onClick={() => setShowWonLostModal('lost')}
                className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Mark Lost
              </button>
            )}

            <button
              onClick={() => duplicateMut.mutate()}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl border border-border transition-colors"
              title="Duplicate Opportunity"
            >
              <Copy className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setTargetPipelineId(pipeline?.id || '');
                setShowMovePipelineModal(true);
              }}
              className="p-1.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl border border-border transition-colors"
              title="Move to different pipeline"
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-border transition-colors"
              title="Delete Opportunity"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags and Metadata Row */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {opp.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-surface-hover border border-border text-[11px] text-text-muted font-medium"
              >
                {tag}
                <button onClick={() => handleRemoveTag(tag)} className="hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {isAddingTag ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="Tag name..."
                  value={newTagText}
                  onChange={e => setNewTagText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTagText.trim()) handleAddTag(newTagText.trim());
                  }}
                  className="px-2 py-0.5 bg-surface border border-primary rounded-md text-[11px] text-text-main focus:outline-none w-24"
                  autoFocus
                />
                <button onClick={() => handleAddTag(newTagText.trim())} className="p-1 text-primary">
                  <Check className="w-3 h-3" />
                </button>
                <button onClick={() => setIsAddingTag(false)} className="p-1 text-text-muted">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingTag(true)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Tag
              </button>
            )}
          </div>

          <div className="h-3 w-[1px] bg-border" />

          {/* Owner Avatar & Reassign */}
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="font-semibold">Owner:</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-hover border border-border">
              <div className="w-4 h-4 rounded-full bg-primary/30 text-primary font-bold text-[9px] flex items-center justify-center">
                {opp.ownerId ? opp.ownerId[0]?.toUpperCase() : 'U'}
              </div>
              <span>{opp.ownerId || 'Unassigned'}</span>
            </div>
          </div>

          <div className="h-3 w-[1px] bg-border" />

          {/* Days in stage */}
          <div className="flex items-center gap-1 text-xs text-text-muted font-medium">
            <Clock className="w-3 h-3" />
            <span>{opp.daysInStage} days in current stage</span>
          </div>
        </div>
      </div>

      {/* ── Main Layout Body ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex gap-6 p-8 max-w-7xl mx-auto w-full">
        {/* Left Column: 4.2 Linked Contact Card */}
        <div className="w-80 shrink-0 space-y-6">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-[13px] font-bold text-text-muted uppercase tracking-wider">Linked Contact</h3>
              {opp.contact && (
                <Link
                  to={`/crm/contacts/${opp.contact.id}`}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>View Full Contact</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {opp.contact ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 text-primary font-extrabold text-base flex items-center justify-center">
                    {opp.contact.firstName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold text-text-main">
                      {opp.contact.firstName} {opp.contact.lastName || ''}
                    </div>
                    <div className="text-xs text-text-muted truncate">{opp.contact.email || 'No email'}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/40 text-xs">
                  {opp.contact.phone && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span className="text-text-main font-medium">{opp.contact.phone}</span>
                    </div>
                  )}
                  {opp.contact.email && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      <span className="text-text-main font-medium">{opp.contact.email}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-surface-hover text-text-muted mx-auto flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <p className="text-xs text-text-muted">No contact linked to this deal</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 4.3 Tabs Container */}
        <div className="flex-1 bg-surface border border-border rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {/* Tab Navigation */}
          <div className="px-6 border-b border-border bg-surface-hover/20 flex items-center gap-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'activity', label: 'Activity Log' },
              ...(showLineItemsTab ? [{ id: 'line_items', label: `Line Items (${lineItems.length})` }] : []),
              { id: 'files', label: `Files (${files.length})` },
              { id: 'automations', label: `Automations (${automations.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:text-text-main'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-[14px] font-bold text-text-main mb-4">Core Opportunity Fields</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-surface-hover/30 border border-border rounded-xl space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted uppercase">Win Probability</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={opp.probability}
                          onChange={e => updateMut.mutate({ probability: parseInt(e.target.value) || 0 })}
                          className="w-16 px-2 py-1 bg-surface border border-border rounded text-xs text-text-main"
                        />
                        <span className="text-xs text-text-muted">%</span>
                      </div>
                    </div>

                    <div className="p-3 bg-surface-hover/30 border border-border rounded-xl space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted uppercase">Expected Close Date</label>
                      <input
                        type="date"
                        value={opp.closeDate ? opp.closeDate.split('T')[0] : ''}
                        onChange={e => updateMut.mutate({ closeDate: e.target.value || null })}
                        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-main"
                      />
                    </div>

                    <div className="p-3 bg-surface-hover/30 border border-border rounded-xl space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted uppercase">Lead Source</label>
                      <input
                        type="text"
                        value={opp.source || ''}
                        placeholder="Enter source..."
                        onChange={e => updateMut.mutate({ source: e.target.value })}
                        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-main"
                      />
                    </div>

                    <div className="p-3 bg-surface-hover/30 border border-border rounded-xl space-y-1">
                      <label className="text-[11px] font-semibold text-text-muted uppercase">Priority</label>
                      <select
                        value={opp.priority || 'medium'}
                        onChange={e => updateMut.mutate({ priority: e.target.value })}
                        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-main"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Custom Fields Section */}
                {customFields.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <h3 className="text-[14px] font-bold text-text-main mb-4">Custom Fields</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {customFields.map(cf => {
                        const currentVal = opp.customFields?.[cf.id] ?? opp.customFields?.[cf.label] ?? '';
                        return (
                          <div key={cf.id} className="p-3 bg-surface-hover/30 border border-border rounded-xl space-y-1">
                            <label className="text-[11px] font-semibold text-text-muted uppercase">{cf.label}</label>
                            <input
                              type="text"
                              value={String(currentVal)}
                              placeholder={`Enter ${cf.label.toLowerCase()}...`}
                              onChange={e => {
                                const updated = { ...(opp.customFields || {}), [cf.id]: e.target.value };
                                updateMut.mutate({ customFields: updated });
                              }}
                              className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-main"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-[14px] font-bold text-text-main mb-2">Description / Notes</h3>
                  <textarea
                    rows={3}
                    value={opp.description || ''}
                    placeholder="Enter deal notes or details..."
                    onChange={e => updateMut.mutate({ description: e.target.value })}
                    className="w-full p-3 bg-surface-hover/30 border border-border rounded-xl text-xs text-text-main focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Activity Log (Read-Only System Events) */}
            {activeTab === 'activity' && (
              <div className="space-y-4">
                <div className="text-xs text-text-muted">
                  System-generated event audit log for this opportunity.
                </div>
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs">No activity logged yet.</div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log: any) => (
                      <div key={log.id} className="p-3.5 bg-surface-hover/30 border border-border rounded-xl flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                          ●
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-text-main">{log.title}</span>
                            <span className="text-text-muted">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          {log.description && (
                            <p className="text-xs text-text-muted mt-0.5">{log.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Line Items */}
            {activeTab === 'line_items' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-text-muted">
                    Products & services attached to this opportunity. Subtotals roll up to total deal value.
                  </div>
                  <button
                    onClick={() => setShowAddLineItemModal(true)}
                    className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line Item
                  </button>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-hover/40 font-bold text-text-muted uppercase">
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3">Quantity</th>
                        <th className="py-2.5 px-3">Unit Price</th>
                        <th className="py-2.5 px-3">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-text-main">
                      {lineItems.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-text-muted">No line items added yet</td>
                        </tr>
                      ) : (
                        lineItems.map(item => (
                          <tr key={item.id}>
                            <td className="py-2.5 px-3 font-semibold">{item.name}</td>
                            <td className="py-2.5 px-3">{item.quantity}</td>
                            <td className="py-2.5 px-3 font-mono">${item.unitPrice.toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-400">
                              ${item.subtotal.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => deleteLineItemMut.mutate(item.id)}
                                className="text-text-muted hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 4: Files */}
            {activeTab === 'files' && (
              <div className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer bg-surface-hover/20 hover:bg-surface-hover/40 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="w-6 h-6 text-primary" />
                  <span className="text-xs font-semibold text-text-main">Click or drop files to attach to this opportunity</span>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                </div>

                <div className="space-y-2">
                  {files.map((file: any) => (
                    <div key={file.id} className="p-3 bg-surface-hover/30 border border-border rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-medium text-text-main">{file.fileName}</span>
                      </div>
                      <a href={file.fileUrl} download className="text-primary hover:underline font-semibold">
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: Automations */}
            {activeTab === 'automations' && (
              <div className="space-y-3">
                <div className="text-xs text-text-muted">
                  Workflows watching or executing on this opportunity.
                </div>
                {automations.length === 0 ? (
                  <div className="p-8 text-center text-text-muted text-xs">No active automations watching deals.</div>
                ) : (
                  automations.map((w: any) => (
                    <div key={w.id} className="p-3.5 bg-surface-hover/30 border border-border rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <div>
                          <div className="font-bold text-text-main">{w.name}</div>
                          <div className="text-[11px] text-text-muted">Trigger: {w.triggerType}</div>
                        </div>
                      </div>
                      <Link to={`/automations/${w.id}`} className="text-primary hover:underline font-semibold">
                        Open Builder
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Won / Lost Modal */}
      {showWonLostModal && (
        <WonLostReasonModal
          isOpen={Boolean(showWonLostModal)}
          type={showWonLostModal}
          reasons={pipeline?.wonLostReasons || []}
          opportunityTitle={opp.title}
          onClose={() => setShowWonLostModal(null)}
          onConfirm={({ reason, notes }) => {
            updateMut.mutate({
              status: showWonLostModal,
              wonLostReason: reason,
              wonLostNotes: notes,
            });
            setShowWonLostModal(null);
          }}
        />
      )}

      {/* Required Fields Modal */}
      {showRequiredFieldsModal && pendingTargetStage && (
        <RequiredFieldsModal
          isOpen={showRequiredFieldsModal}
          opportunity={opp}
          targetStage={pendingTargetStage}
          customFields={customFields}
          onClose={() => {
            setShowRequiredFieldsModal(false);
            setPendingTargetStage(null);
          }}
          onConfirm={(collectedValues) => {
            updateMut.mutate({
              pipelineStageId: pendingTargetStage.id,
              ...collectedValues,
            });
            setShowRequiredFieldsModal(false);
            setPendingTargetStage(null);
          }}
        />
      )}

      {/* Move Pipeline Modal */}
      <AnimatePresence>
        {showMovePipelineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-[16px] font-bold text-text-main">Move to Different Pipeline</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-text-muted">Select Target Pipeline</label>
                  <select
                    value={targetPipelineId}
                    onChange={e => setTargetPipelineId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main"
                  >
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button onClick={() => setShowMovePipelineModal(false)} className="px-4 py-1.5 text-xs text-text-muted hover:text-text-main">
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await opportunitiesApi.movePipeline(id!, targetPipelineId);
                    qc.invalidateQueries({ queryKey: ['opportunity', id] });
                    setShowMovePipelineModal(false);
                    toast('success', 'Pipeline moved');
                  }}
                  className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl"
                >
                  Confirm Move
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Line Item Modal */}
      <AnimatePresence>
        {showAddLineItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-[16px] font-bold text-text-main">Add Line Item</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-text-muted">Item / Product Name *</label>
                  <input
                    type="text"
                    value={lineItemName}
                    onChange={e => setLineItemName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-text-muted">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={lineItemQty}
                      onChange={e => setLineItemQty(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-text-muted">Unit Price ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={lineItemUnitPrice}
                      onChange={e => setLineItemUnitPrice(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-surface border border-border rounded-xl text-xs text-text-main"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button onClick={() => setShowAddLineItemModal(false)} className="px-4 py-1.5 text-xs text-text-muted">
                  Cancel
                </button>
                <button
                  onClick={() => addLineItemMut.mutate()}
                  disabled={!lineItemName.trim()}
                  className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Add Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Opportunity Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm bg-surface border border-red-500/30 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <h3 className="text-[16px] font-bold text-text-main">Delete Opportunity?</h3>
              <p className="text-xs text-text-muted">Are you sure you want to delete "{opp.title}"? This cannot be undone.</p>
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-1.5 text-xs text-text-muted">Cancel</button>
                <button onClick={() => deleteMut.mutate()} className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function parseJsonSafe<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}
