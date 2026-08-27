import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, Plus, Settings, Trash2, Edit2, GripVertical, Check,
  AlertCircle, Trophy, XCircle, ArrowRight, Sparkles, Layers,
  CheckCircle2, Copy, ShieldAlert, Sliders, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { opportunitiesApi } from '../../../lib/api/opportunities';
import { useToast } from '../../../components/ui/Toast';
import type { Pipeline, Stage, WonLostReason, CustomField } from '../../../types/opportunities';

const COLOR_PALETTE = [
  '#818CF8', '#60A5FA', '#38BDF8', '#34D399', '#10B981',
  '#FBBF24', '#F59E0B', '#F472B6', '#EC4899', '#A78BFA',
  '#8B5CF6', '#94A3B8', '#64748B', '#F87171', '#EF4444',
];

export default function PipelineSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activePipelineId, setActivePipelineId] = useState<string | null>(null);
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [showDeletePipelineModal, setShowDeletePipelineModal] = useState(false);
  const [reassignmentStageId, setReassignmentStageId] = useState('');

  // New Pipeline form
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelineMode, setNewPipelineMode] = useState<'preset' | 'blank' | 'copy'>('preset');
  const [selectedPreset, setSelectedPreset] = useState('sales');
  const [selectedSourcePipelineId, setSelectedSourcePipelineId] = useState('');

  // Reason form state
  const [newReasonText, setNewReasonText] = useState('');
  const [newReasonType, setNewReasonType] = useState<'won' | 'lost' | 'both'>('both');

  // Stage editing state
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageData, setEditingStageData] = useState<Partial<Stage>>({});

  // ── Data Fetching ────────────────────────────────────────────────────────────
  const { data: pipelines = [], isLoading } = useQuery<Pipeline[]>({
    queryKey: ['opportunities-pipelines'],
    queryFn: () => opportunitiesApi.listPipelines(),
  });

  const { data: customFields = [] } = useQuery<CustomField[]>({
    queryKey: ['opportunities-custom-fields'],
    queryFn: () => opportunitiesApi.listCustomFields(),
  });

  const activePipeline = pipelines.find(p => p.id === activePipelineId) || pipelines[0];
  const stages = activePipeline?.stages || [];
  const reasons = activePipeline?.wonLostReasons || [];

  // Set active pipeline default
  React.useEffect(() => {
    if (pipelines.length > 0 && !activePipelineId) {
      const def = pipelines.find(p => p.isDefault) || pipelines[0];
      setActivePipelineId(def.id);
    }
  }, [pipelines, activePipelineId]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createPipelineMut = useMutation({
    mutationFn: async () => {
      if (newPipelineMode === 'preset') {
        return opportunitiesApi.createPipeline({ name: newPipelineName, templatePreset: selectedPreset });
      } else if (newPipelineMode === 'copy') {
        return opportunitiesApi.createPipeline({ name: newPipelineName, sourcePipelineId: selectedSourcePipelineId });
      } else {
        return opportunitiesApi.createPipeline({ name: newPipelineName, stages: [] });
      }
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setActivePipelineId(p.id);
      setShowNewPipelineModal(false);
      setNewPipelineName('');
      toast('success', 'Pipeline created successfully');
    },
    onError: (err: any) => toast('error', 'Failed to create pipeline', err.message),
  });

  const updatePipelineMut = useMutation({
    mutationFn: (data: Partial<Pipeline>) => opportunitiesApi.updatePipeline(activePipeline.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      toast('success', 'Pipeline settings updated');
    },
    onError: (err: any) => toast('error', 'Failed to update pipeline', err.message),
  });

  const deletePipelineMut = useMutation({
    mutationFn: () => opportunitiesApi.deletePipeline(activePipeline.id, reassignmentStageId || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setShowDeletePipelineModal(false);
      setActivePipelineId(null);
      toast('success', 'Pipeline deleted');
    },
    onError: (err: any) => toast('error', 'Failed to delete pipeline', err.message),
  });

  const createStageMut = useMutation({
    mutationFn: () => opportunitiesApi.createStage(activePipeline.id, {
      name: `Stage ${stages.length + 1}`,
      probability: Math.min(100, (stages.length + 1) * 15),
      color: COLOR_PALETTE[stages.length % COLOR_PALETTE.length],
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      toast('success', 'Stage added');
    },
  });

  const updateStageMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Stage> }) => opportunitiesApi.updateStage(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setEditingStageId(null);
      toast('success', 'Stage updated');
    },
    onError: (err: any) => toast('error', 'Failed to update stage', err.message),
  });

  const deleteStageMut = useMutation({
    mutationFn: ({ id, reassign }: { id: string; reassign?: string }) => opportunitiesApi.deleteStage(id, reassign),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      toast('success', 'Stage removed');
    },
    onError: (err: any) => toast('error', 'Failed to remove stage', err.message),
  });

  const createReasonMut = useMutation({
    mutationFn: () => opportunitiesApi.createReason({
      pipelineId: activePipeline.id,
      reason: newReasonText.trim(),
      type: newReasonType,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      setNewReasonText('');
      toast('success', 'Reason added');
    },
  });

  const deleteReasonMut = useMutation({
    mutationFn: (id: string) => opportunitiesApi.deleteReason(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
      toast('success', 'Reason deleted');
    },
  });

  // Reorder stages helpers (move up / down)
  const moveStage = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;
    const newStages = [...stages];
    const temp = newStages[index];
    newStages[index] = newStages[targetIndex];
    newStages[targetIndex] = temp;
    await opportunitiesApi.reorderStages(activePipeline.id, newStages.map(s => s.id));
    qc.invalidateQueries({ queryKey: ['opportunities-pipelines'] });
  };

  const otherStagesForReassignment = pipelines
    .flatMap(p => p.stages)
    .filter(s => !stages.some(st => st.id === s.id));

  if (isLoading) {
    return <div className="p-8 text-text-muted text-sm">Loading pipeline settings...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Top Header Bar */}
      <header className="px-8 py-4 border-b border-border bg-surface shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/opportunities"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-[20px] font-bold text-text-main flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              Pipeline & Stage Management
            </h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              Customize sales processes, stage criteria, and win/loss tracking per pipeline
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowNewPipelineModal(true)}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-[13px] font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" /> New Pipeline
        </button>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-auto p-8 flex gap-8">
        {/* Left Sidebar: Pipelines List */}
        <div className="w-72 shrink-0 space-y-3">
          <h2 className="text-[12px] font-bold text-text-muted uppercase tracking-wider px-1">Your Pipelines</h2>
          <div className="space-y-1.5">
            {pipelines.map(p => {
              const isActive = activePipeline?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setActivePipelineId(p.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isActive
                      ? 'bg-surface border-primary ring-1 ring-primary/20 shadow-sm'
                      : 'bg-surface/50 border-border hover:bg-surface hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-text-main">{p.name}</span>
                    {p.isDefault && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/20 text-primary font-bold border border-primary/30">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1.5 flex items-center gap-3">
                    <span>{p.stages.length} stages</span>
                    <span>•</span>
                    <span>{p.opportunityCount || 0} opportunities</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Content: Active Pipeline Configuration */}
        {activePipeline && (
          <div className="flex-1 space-y-8 max-w-4xl pb-12">
            {/* General Pipeline Settings Card */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-text-main">Pipeline Configuration</h3>
                  <p className="text-[12px] text-text-muted mt-0.5">Control pipeline behavior, thresholds, and default status</p>
                </div>
                <div className="flex items-center gap-3">
                  {!activePipeline.isDefault && (
                    <button
                      onClick={() => updatePipelineMut.mutate({ isDefault: true })}
                      className="px-3 py-1.5 bg-surface-hover hover:bg-surface-hover/80 text-text-main text-xs font-semibold rounded-lg border border-border transition-colors"
                    >
                      Set as Default
                    </button>
                  )}
                  {pipelines.length > 1 && (
                    <button
                      onClick={() => setShowDeletePipelineModal(true)}
                      className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete Pipeline"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Pipeline Name</label>
                  <input
                    type="text"
                    value={activePipeline.name}
                    onChange={e => updatePipelineMut.mutate({ name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Stale Deal Threshold (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={activePipeline.staleThresholdDays || 14}
                    onChange={e => updatePipelineMut.mutate({ staleThresholdDays: parseInt(e.target.value) || 14 })}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 p-3.5 bg-surface-hover/30 border border-border rounded-xl cursor-pointer hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={activePipeline.allowStageSkip}
                    onChange={e => updatePipelineMut.mutate({ allowStageSkip: e.target.checked })}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <div>
                    <span className="text-[13px] font-semibold text-text-main block">Allow Stage Skipping</span>
                    <span className="text-[11px] text-text-muted">Users can drag deals freely across non-sequential stages</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 bg-surface-hover/30 border border-border rounded-xl cursor-pointer hover:border-primary/40">
                  <input
                    type="checkbox"
                    checked={activePipeline.enableLineItems}
                    onChange={e => updatePipelineMut.mutate({ enableLineItems: e.target.checked })}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <div>
                    <span className="text-[13px] font-semibold text-text-main block">Enable Line Items / Products</span>
                    <span className="text-[11px] text-text-muted">Display line items tab and rollup subtotals to total deal value</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Stages Editor Card */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-text-main">Pipeline Stages</h3>
                  <p className="text-[12px] text-text-muted mt-0.5">Order stages from top of funnel to close. Configure required fields per stage.</p>
                </div>
                <button
                  onClick={() => createStageMut.mutate()}
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-white" />
                  <span className="text-white">Add Stage</span>
                </button>
              </div>

              {/* Stage Rows */}
              <div className="space-y-2.5">
                {stages.map((stage, idx) => {
                  const isEditing = editingStageId === stage.id;
                  const reqFields = parseJsonSafe<string[]>(stage.requiredFieldsJson, []);

                  return (
                    <div
                      key={stage.id}
                      className="p-4 bg-surface-hover/40 border border-border rounded-xl flex flex-col gap-3 transition-all"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              disabled={idx === 0}
                              onClick={() => moveStage(idx, 'up')}
                              className="text-text-muted hover:text-text-main disabled:opacity-20 text-[10px]"
                            >
                              ▲
                            </button>
                            <button
                              disabled={idx === stages.length - 1}
                              onClick={() => moveStage(idx, 'down')}
                              className="text-text-muted hover:text-text-main disabled:opacity-20 text-[10px]"
                            >
                              ▼
                            </button>
                          </div>

                          {/* Color Swatch */}
                          <div className="relative group">
                            <span
                              className="w-4 h-4 rounded-full inline-block cursor-pointer ring-2 ring-transparent group-hover:ring-primary"
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>

                          {/* Stage Name Inline Edit */}
                          <input
                            type="text"
                            value={stage.name}
                            onChange={e => updateStageMut.mutate({ id: stage.id, data: { name: e.target.value } })}
                            className="bg-transparent border-b border-transparent hover:border-border focus:border-primary text-[14px] font-bold text-text-main px-1 py-0.5 focus:outline-none flex-1 max-w-xs"
                          />

                          {/* Probability % */}
                          <div className="flex items-center gap-1 text-xs text-text-muted">
                            <span>Win Probability:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={stage.probability}
                              onChange={e => updateStageMut.mutate({ id: stage.id, data: { probability: parseInt(e.target.value) || 0 } })}
                              className="w-12 px-1.5 py-0.5 bg-surface border border-border rounded text-center text-text-main focus:outline-none focus:border-primary"
                            />
                            <span>%</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Won / Lost Flags */}
                          <label className="flex items-center gap-1.5 text-xs text-emerald-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(stage.isWon)}
                              onChange={e => updateStageMut.mutate({ id: stage.id, data: { isWon: e.target.checked, isLost: false } })}
                              className="w-3.5 h-3.5 rounded text-emerald-500"
                            />
                            Won Stage
                          </label>

                          <label className="flex items-center gap-1.5 text-xs text-red-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(stage.isLost)}
                              onChange={e => updateStageMut.mutate({ id: stage.id, data: { isLost: e.target.checked, isWon: false } })}
                              className="w-3.5 h-3.5 rounded text-red-500"
                            />
                            Lost Stage
                          </label>

                          {/* Delete Stage */}
                          {stages.length > 1 && (
                            <button
                              onClick={() => {
                                const nextS = stages.find(s => s.id !== stage.id);
                                deleteStageMut.mutate({ id: stage.id, reassign: nextS?.id });
                              }}
                              className="p-1 text-text-muted hover:text-red-400 transition-colors"
                              title="Delete stage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Required Fields Criteria Selector */}
                      <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-text-muted">Required when moving to this stage:</span>
                        {[
                          { id: 'amount', label: 'Value ($)' },
                          { id: 'closeDate', label: 'Close Date' },
                          { id: 'source', label: 'Lead Source' },
                          { id: 'contactId', label: 'Contact' },
                          ...customFields.map(f => ({ id: `cf_${f.id}`, label: f.label })),
                        ].map(rf => {
                          const isRequired = reqFields.includes(rf.id);
                          return (
                            <button
                              key={rf.id}
                              type="button"
                              onClick={() => {
                                const updatedReq = isRequired
                                  ? reqFields.filter(x => x !== rf.id)
                                  : [...reqFields, rf.id];
                                updateStageMut.mutate({
                                  id: stage.id,
                                  data: { requiredFieldsJson: JSON.stringify(updatedReq) }
                                });
                              }}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all ${
                                isRequired
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                                  : 'bg-surface text-text-muted border-border hover:border-primary/40'
                              }`}
                            >
                              {isRequired && '✓ '} {rf.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Won / Lost Reasons Card */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-5">
              <div className="border-b border-border pb-4">
                <h3 className="text-[16px] font-bold text-text-main">Won & Lost Reasons</h3>
                <p className="text-[12px] text-text-muted mt-0.5">Predefined reasons for reps to select when marking deals as Won or Lost</p>
              </div>

              {/* Add Reason Form */}
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="New reason (e.g. Superior Product Demo, Budget Constraint)..."
                  value={newReasonText}
                  onChange={e => setNewReasonText(e.target.value)}
                  className="flex-1 px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                />
                <select
                  value={newReasonType}
                  onChange={e => setNewReasonType(e.target.value as any)}
                  className="px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="both">Won & Lost</option>
                  <option value="won">Won Only</option>
                  <option value="lost">Lost Only</option>
                </select>
                <button
                  type="button"
                  onClick={() => createReasonMut.mutate()}
                  disabled={!newReasonText.trim()}
                  className="px-4 py-2 bg-primary text-white text-[13px] font-semibold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {/* Reasons List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {reasons.map(r => (
                  <div
                    key={r.id}
                    className="p-3 bg-surface-hover/30 border border-border rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                        r.type === 'won' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        r.type === 'lost' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}>
                        {r.type}
                      </span>
                      <span className="text-[13px] text-text-main">{r.reason}</span>
                    </div>
                    <button
                      onClick={() => deleteReasonMut.mutate(r.id)}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Pipeline Modal */}
      <AnimatePresence>
        {showNewPipelineModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-[16px] font-bold text-text-main">Create New Pipeline</h3>
                <button onClick={() => setShowNewPipelineModal(false)} className="text-text-muted hover:text-text-main">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Pipeline Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Enterprise Outbound"
                    value={newPipelineName}
                    onChange={e => setNewPipelineName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted">Template / Origin</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'preset', label: 'From Preset' },
                      { id: 'copy', label: 'Copy Existing' },
                      { id: 'blank', label: 'Start Blank' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setNewPipelineMode(opt.id as any)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          newPipelineMode === opt.id
                            ? 'bg-primary text-white border-primary shadow-xs'
                            : 'bg-surface-hover/40 text-text-muted border-border'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {newPipelineMode === 'preset' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted">Choose Industry Preset</label>
                    <select
                      value={selectedPreset}
                      onChange={e => setSelectedPreset(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main"
                    >
                      <option value="sales">Standard B2B Sales (6 Stages)</option>
                      <option value="saas">SaaS Inbound & Expansion (6 Stages)</option>
                      <option value="consulting">Consulting & Agency (6 Stages)</option>
                      <option value="realestate">Real Estate Deals (6 Stages)</option>
                    </select>
                  </div>
                )}

                {newPipelineMode === 'copy' && (
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted">Copy Stages From</label>
                    <select
                      value={selectedSourcePipelineId}
                      onChange={e => setSelectedSourcePipelineId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover/50 border border-border rounded-xl text-[13px] text-text-main"
                    >
                      <option value="">Select pipeline...</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewPipelineModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => createPipelineMut.mutate()}
                  disabled={!newPipelineName.trim() || createPipelineMut.isPending}
                  className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Create Pipeline
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Pipeline Confirmation Modal */}
      <AnimatePresence>
        {showDeletePipelineModal && activePipeline && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-surface border border-red-500/30 rounded-2xl shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-text-main">Delete "{activePipeline.name}"?</h3>
                  <p className="text-[12px] text-text-muted">This action cannot be undone</p>
                </div>
              </div>

              {activePipeline.opportunityCount && activePipeline.opportunityCount > 0 ? (
                <div className="space-y-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                  <p>
                    This pipeline currently holds <strong>{activePipeline.opportunityCount} active opportunities</strong>.
                    You must choose a destination stage in another pipeline to reassign them:
                  </p>
                  <select
                    value={reassignmentStageId}
                    onChange={e => setReassignmentStageId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-surface border border-border rounded-lg text-text-main"
                  >
                    <option value="">Choose reassignment stage...</option>
                    {otherStagesForReassignment.map(s => (
                      <option key={s.id} value={s.id}>{s.pipeline?.name || 'Pipeline'} → {s.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeletePipelineModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-text-muted hover:text-text-main"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => deletePipelineMut.mutate()}
                  disabled={Boolean(activePipeline.opportunityCount && activePipeline.opportunityCount > 0 && !reassignmentStageId)}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                >
                  Delete Pipeline
                </button>
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
