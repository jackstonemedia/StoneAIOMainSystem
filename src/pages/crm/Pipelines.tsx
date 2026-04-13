import React, { useState, useEffect } from 'react';
import { Plus, Settings2, GripVertical, MoreHorizontal, Pencil, Trash2, Check, X, Clock, Zap, ChevronRight, Mail, UserPlus, ClipboardList, Bell } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'motion/react';

interface Automation {
  id: string;
  trigger: 'enter' | 'time';
  triggerDays?: number;
  action: 'email' | 'task' | 'assign' | 'notify';
  actionValue: string;
  enabled: boolean;
}

interface Stage {
  id: string; name: string; probability: number; color: string; order: number;
  rottingDays?: number; autoTask?: boolean; automations?: Automation[];
}

interface Pipeline { id: string; name: string; stages: Stage[]; }

const STAGE_COLORS = [
  { label: 'Slate', value: 'bg-surface-hover', hex: '#52677D' },
  { label: 'Blue', value: 'bg-primary/100', hex: '#52677D' },
  { label: 'Cyan', value: 'bg-primary/100', hex: '#52677D' },
  { label: 'Amber', value: 'bg-primary/100', hex: '#52677D' },
  { label: 'Orange', value: 'bg-primary/100', hex: '#52677D' },
  { label: 'Purple', value: 'bg-primary/100', hex: '#52677D' },
  { label: 'Rose', value: 'bg-rose-500', hex: '#52677D' },
  { label: 'Green', value: 'bg-green-500', hex: '#52677D' },
  { label: 'Emerald', value: 'bg-emerald-500', hex: '#10b981' },
];

const ACTION_ICONS: Record<string, any> = { email: Mail, task: ClipboardList, assign: UserPlus, notify: Bell };

const DEFAULT_PIPELINES: Pipeline[] = [
  {
    id: 'p1', name: 'Main Sales Pipeline',
    stages: [
      { id: 's1', name: 'Lead', probability: 10, color: 'bg-surface-hover', order: 0, rottingDays: 21, autoTask: false, automations: [] },
      { id: 's2', name: 'Discovery', probability: 25, color: 'bg-primary/100', order: 1, rottingDays: 14, autoTask: false, automations: [] },
      { id: 's3', name: 'Proposal', probability: 50, color: 'bg-primary/100', order: 2, rottingDays: 10, autoTask: true, automations: [{ id: 'a1', trigger: 'enter', action: 'email', actionValue: 'Send proposal follow-up', enabled: true }] },
      { id: 's4', name: 'Negotiation', probability: 75, color: 'bg-primary/100', order: 3, rottingDays: 7, autoTask: false, automations: [] },
      { id: 's5', name: 'Closed Won', probability: 100, color: 'bg-green-500', order: 4, rottingDays: 0, autoTask: false, automations: [{ id: 'a2', trigger: 'enter', action: 'task', actionValue: 'Send onboarding kit', enabled: true }] },
    ]
  },
];

const STORAGE_KEY = 'crm_pipelines';

function NewPipelineModal({ isOpen, onClose, onSave }: { isOpen: boolean; onClose: () => void; onSave: (name: string) => void; }) {
  const [name, setName] = useState('');
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 flex items-center justify-center z-50 p-6">
            <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-[400px] p-6">
              <h2 className="text-[16px] font-bold text-text-main mb-1">Create Pipeline</h2>
              <p className="text-[12px] text-text-muted mb-4">Give your pipeline a name and we'll set up default stages for you.</p>
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName(''); onClose(); } if (e.key === 'Escape') onClose(); }}
                placeholder="e.g. Enterprise Pipeline, Partner Deals..."
                className="w-full px-3.5 py-2.5 bg-surface-hover border border-border rounded-xl text-[13px] text-text-main focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4" />
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
                <button disabled={!name.trim()} onClick={() => { onSave(name.trim()); setName(''); onClose(); }}
                  className="px-6 py-2 rounded-xl text-[13px] font-semibold bg-primary text-white hover:bg-[#52677D] disabled:opacity-40">
                  Create Pipeline
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function AutomationRow({ auto, onToggle, onDelete }: { auto: Automation; onToggle: () => void; onDelete: () => void }) {
  const ActionIcon = ACTION_ICONS[auto.action] || Zap;
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-surface rounded-xl border border-border group">
      <div className="w-7 h-7 rounded-lg bg-[#52677D] flex items-center justify-center shrink-0">
        <ActionIcon className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-text-main">
          {auto.trigger === 'enter' ? 'When deal enters stage' : `After ${auto.triggerDays} days in stage`}
          <ChevronRight className="w-3 h-3 inline mx-1 text-text-muted" />
          <span className="text-primary">{auto.actionValue}</span>
        </p>
      </div>
      <button onClick={onToggle} className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${auto.enabled ? 'bg-primary' : 'bg-surface-hover'}`}>
        <span className={`absolute top-0.5 w-3 h-3 bg-surface rounded-full shadow transition-all ${auto.enabled ? 'left-4' : 'left-0.5'}`} />
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 transition-all">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Pipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    return DEFAULT_PIPELINES;
  });
  const [newPipelineOpen, setNewPipelineOpen] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingProb, setEditingProb] = useState(0);
  const [editingRotting, setEditingRotting] = useState(0);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [expandedAutomations, setExpandedAutomations] = useState<string | null>(null);
  const [addingAutomationFor, setAddingAutomationFor] = useState<string | null>(null);
  const [newAutoAction, setNewAutoAction] = useState<'email' | 'task' | 'assign' | 'notify'>('email');
  const [newAutoTrigger, setNewAutoTrigger] = useState<'enter' | 'time'>('enter');
  const [newAutoValue, setNewAutoValue] = useState('');
  const [deletingPipeline, setDeletingPipeline] = useState<string | null>(null);

  const persist = (updated: Pipeline[]) => {
    setPipelines(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const createPipeline = (name: string) => {
    const newPipeline: Pipeline = {
      id: `p-${Date.now()}`, name,
      stages: [
        { id: `s-${Date.now()}-1`, name: 'Lead', probability: 10, color: 'bg-surface-hover', order: 0, rottingDays: 21, autoTask: false, automations: [] },
        { id: `s-${Date.now()}-2`, name: 'Discovery', probability: 25, color: 'bg-primary/100', order: 1, rottingDays: 14, autoTask: false, automations: [] },
        { id: `s-${Date.now()}-3`, name: 'Proposal', probability: 50, color: 'bg-primary/100', order: 2, rottingDays: 10, autoTask: false, automations: [] },
        { id: `s-${Date.now()}-4`, name: 'Won', probability: 100, color: 'bg-green-500', order: 3, rottingDays: 0, autoTask: false, automations: [] },
      ]
    };
    persist([...pipelines, newPipeline]);
  };

  const deletePipeline = (pipelineId: string) => { persist(pipelines.filter(p => p.id !== pipelineId)); setDeletingPipeline(null); };

  const onDragEnd = (result: DropResult, pipelineId: string) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;
    persist(pipelines.map(p => {
      if (p.id !== pipelineId) return p;
      const stages = [...p.stages];
      const [moved] = stages.splice(source.index, 1);
      stages.splice(destination.index, 0, moved);
      stages.forEach((s, i) => { s.order = i; });
      return { ...p, stages };
    }));
  };

  const startEdit = (stage: Stage) => {
    setEditingStageId(stage.id); setEditingName(stage.name);
    setEditingProb(stage.probability); setEditingRotting(stage.rottingDays || 0);
  };

  const commitEdit = (pipelineId: string, stageId: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : {
      ...p, stages: p.stages.map(s => s.id === stageId
        ? { ...s, name: editingName.trim() || s.name, probability: Math.min(100, Math.max(0, editingProb)), rottingDays: Math.max(0, editingRotting) }
        : s)
    }));
    setEditingStageId(null);
  };

  const changeColor = (pipelineId: string, stageId: string, color: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, color } : s) }));
    setColorPickerFor(null);
  };

  const addStage = (pipelineId: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : {
      ...p, stages: [...p.stages, { id: `stage-${Date.now()}`, name: 'New Stage', probability: 50, color: 'bg-surface-hover', order: p.stages.length, rottingDays: 14, autoTask: false, automations: [] }]
    }));
  };

  const removeStage = (pipelineId: string, stageId: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : { ...p, stages: p.stages.filter(s => s.id !== stageId).map((s, i) => ({ ...s, order: i })) }));
  };

  const addAutomation = (pipelineId: string, stageId: string) => {
    if (!newAutoValue.trim()) return;
    const automation: Automation = { id: `auto-${Date.now()}`, trigger: newAutoTrigger, action: newAutoAction, actionValue: newAutoValue.trim(), enabled: true, triggerDays: newAutoTrigger === 'time' ? 3 : undefined };
    persist(pipelines.map(p => p.id !== pipelineId ? p : { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, automations: [...(s.automations || []), automation] } : s) }));
    setNewAutoValue(''); setAddingAutomationFor(null);
  };

  const toggleAutomation = (pipelineId: string, stageId: string, autoId: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, automations: (s.automations || []).map(a => a.id === autoId ? { ...a, enabled: !a.enabled } : a) } : s) }));
  };

  const deleteAutomation = (pipelineId: string, stageId: string, autoId: string) => {
    persist(pipelines.map(p => p.id !== pipelineId ? p : { ...p, stages: p.stages.map(s => s.id === stageId ? { ...s, automations: (s.automations || []).filter(a => a.id !== autoId) } : s) }));
  };

  return (
    <div className="h-full flex flex-col bg-bg relative styled-scrollbar">
      <header className="flex items-center justify-between px-8 py-6 border-b border-border bg-bg/80 backdrop-blur-xl shrink-0 sticky top-0 z-10 transition-all duration-300 shadow-sm">
        <div>
          <h1 className="text-[24px] font-bold text-text-main tracking-tight">Pipelines</h1>
          <p className="text-[13px] text-text-muted mt-1 font-medium">Configure stages, probabilities, automations, and rotting thresholds.</p>
        </div>
        <button onClick={() => setNewPipelineOpen(true)} className="flex items-center gap-2 px-5 py-2 block btn-primary shadow-luxury text-[13px]">
          <Plus className="w-4 h-4" /> New Pipeline
        </button>
      </header>

      <div className="flex-1 overflow-auto p-8 relative z-0">
        <div className="max-w-[960px] mx-auto space-y-8">
          {pipelines.map(pipeline => (
            <div key={pipeline.id} className="glass-panel border-border shadow-[0_4px_24px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Pipeline header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-surface-hover/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-[16px] font-bold text-text-main">{pipeline.name}</h2>
                  {pipeline.id === 'p1' && <span className="text-[11px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase tracking-widest shadow-sm">Default</span>}
                  <span className="text-[12px] font-bold text-text-muted px-2 py-0.5 bg-bg rounded-md shadow-inner">{pipeline.stages.length} stages</span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-text-muted hover:text-primary rounded-lg hover:bg-surface-hover transition-colors"><Settings2 className="w-4 h-4" /></button>
                  {pipelines.length > 1 && (
                    <button onClick={() => setDeletingPipeline(pipeline.id)} className="p-2 text-text-muted hover:text-accent-red rounded-lg hover:bg-red/10 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>

              {/* Stage flow */}
              <div className="px-6 py-4 border-b border-border overflow-x-auto bg-surface/30">
                <div className="flex items-center gap-0 w-max">
                  {pipeline.stages.map((stage, i) => {
                    const hex = STAGE_COLORS.find(c => c.value === stage.color)?.hex || 'var(--text-muted)';
                    return (
                      <div key={stage.id} className="flex items-center shrink-0">
                        <div className="flex items-center gap-2.5 bg-surface border border-border shadow-sm hover:shadow-md transition-shadow rounded-lg px-3 py-1.5 text-[12px]">
                          <div className="w-3 h-3 rounded-md shadow-sm" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
                          <span className="font-bold text-text-main">{stage.name}</span>
                          <span className="text-text-muted font-bold opacity-80">{stage.probability}%</span>
                        </div>
                        {i < pipeline.stages.length - 1 && <div className="w-6 h-[2px] bg-border mx-1.5" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stage editor list */}
              <div className="p-6 bg-surface/30">
                <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>Manage Stages</span>
                  <span className="text-[10px] text-text-muted/60 font-bold normal-case">Drag to reorder</span>
                </h3>
                <DragDropContext onDragEnd={result => onDragEnd(result, pipeline.id)}>
                  <Droppable droppableId={`pipeline-${pipeline.id}`}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {pipeline.stages.map((stage, index) => {
                          const isEditing = editingStageId === stage.id;
                          const hex = STAGE_COLORS.find(c => c.value === stage.color)?.hex || 'var(--text-muted)';
                          const automations = stage.automations || [];
                          const isExpandedAuto = expandedAutomations === stage.id;

                          return (
                            <Draggable key={stage.id} draggableId={stage.id} index={index}>
                              {(provided, snapshot) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} style={provided.draggableProps.style}>
                                  <div className={`bg-surface border rounded-xl transition-all ${snapshot.isDragging ? 'shadow-interactive border-primary scale-[1.01] bg-surface-hover z-50' : 'border-border shadow-sm hover:border-text-muted/30'}`}>
                                    <div className="flex items-center gap-4 p-3 group">
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing text-text-muted/50 hover:text-text-muted shrink-0">
                                        <GripVertical className="w-4 h-4" />
                                      </div>

                                      {/* Color */}
                                      <div className="relative shrink-0">
                                        <button onClick={() => setColorPickerFor(colorPickerFor === stage.id ? null : stage.id)}
                                          className={`w-7 h-7 rounded-md shadow-[0_2px_4px_rgba(0,0,0,0.1)] border border-black/20 ${stage.color} hover:scale-110 transition-transform`} />
                                        {colorPickerFor === stage.id && (
                                          <div className="absolute top-9 left-0 z-50 bg-surface border border-border rounded-xl p-3 shadow-luxury flex flex-wrap gap-2 w-48">
                                            {STAGE_COLORS.map(c => (
                                              <button key={c.value} onClick={() => changeColor(pipeline.id, stage.id, c.value)}
                                                className={`w-6 h-6 rounded-md ${c.value} ${stage.color === c.value ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface' : ''} hover:scale-110 transition-transform`} />
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Name */}
                                      {isEditing ? (
                                        <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(pipeline.id, stage.id); if (e.key === 'Escape') setEditingStageId(null); }}
                                          className="flex-1 min-w-[120px] bg-transparent border-b-2 border-primary text-[14px] font-bold focus:outline-none text-text-main pb-1" />
                                      ) : (
                                        <div className="flex-1 font-bold text-[14px] text-text-main group-hover:text-primary transition-colors">{stage.name}</div>
                                      )}

                                      {/* Stats */}
                                      <div className="flex items-center gap-5 bg-bg/50 px-4 py-2 rounded-xl border border-border shrink-0 shadow-inner">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-0.5">Win Prob</span>
                                          {isEditing ? (
                                            <div className="flex items-center gap-1">
                                              <input type="number" min="0" max="100" value={editingProb} onChange={e => setEditingProb(Number(e.target.value))}
                                                className="w-12 text-center input-luxury text-[12px] font-bold py-1 px-1" />
                                              <span className="text-[12px] font-bold text-text-muted">%</span>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden shadow-inner flex shrink-0">
                                                <div className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_currentColor]" style={{ width: `${stage.probability}%`, background: hex, color: hex }} />
                                              </div>
                                              <span className="text-[12px] font-bold text-text-main w-8 text-right">{stage.probability}%</span>
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col border-l border-border pl-4">
                                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-0.5"><Clock className="w-3 h-3 text-primary" /> Rotting</span>
                                          {isEditing ? (
                                            <div className="flex items-center gap-1.5">
                                              <input type="number" min="0" value={editingRotting} onChange={e => setEditingRotting(Number(e.target.value))}
                                                className="w-14 text-center input-luxury text-[12px] font-bold py-1 px-1" />
                                              <span className="text-[11px] font-bold text-text-muted">days</span>
                                            </div>
                                          ) : <div className="text-[12px] font-bold text-text-main mt-0.5">{stage.rottingDays || 0} <span className="text-[11px] font-bold text-text-muted">days</span></div>}
                                        </div>
                                      </div>

                                      {/* Automation toggle */}
                                      <button onClick={() => setExpandedAutomations(isExpandedAuto ? null : stage.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all border ${isExpandedAuto ? 'bg-primary/10 border-primary/30 text-primary shadow-sm' : 'border-border text-text-muted hover:bg-surface-hover hover:text-text-main'}`}>
                                        <Zap className="w-3.5 h-3.5" />
                                        {automations.length > 0 ? `${automations.length} rule${automations.length > 1 ? 's' : ''}` : 'Automate'}
                                      </button>

                                      {/* Actions */}
                                      <div className={`flex items-center gap-1 shrink-0 ${isEditing ? 'visible' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                                        {isEditing ? (
                                          <>
                                            <button onClick={() => setEditingStageId(null)} className="p-2 rounded-lg bg-surface hover:bg-surface-hover text-text-muted border border-border shadow-sm"><X className="w-4 h-4" /></button>
                                            <button onClick={() => commitEdit(pipeline.id, stage.id)} className="p-2 rounded-lg bg-green/20 text-accent-green hover:bg-green/30 border border-green/30 shadow-sm"><Check className="w-4 h-4" /></button>
                                          </>
                                        ) : (
                                          <>
                                            <button onClick={() => startEdit(stage)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover hover:border hover:border-border text-text-muted hover:text-text-main transition-all"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => removeStage(pipeline.id, stage.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red/10 text-text-muted hover:text-accent-red transition-all"><Trash2 className="w-4 h-4" /></button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Automation panel */}
                                    <AnimatePresence>
                                      {isExpandedAuto && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                          className="border-t border-border px-4 pb-4 pt-4 space-y-3 overflow-hidden bg-bg/50">
                                          <p className="text-[11px] font-bold text-text-muted/70 uppercase tracking-widest pl-1">Automation Rules</p>
                                          {automations.map(auto => (
                                            <div key={auto.id} className="flex items-center gap-3 py-2 px-3 bg-surface rounded-xl border border-border group shadow-sm hover:shadow-md transition-shadow">
                                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                                                <Zap className="w-4 h-4 text-primary" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-bold text-text-main tracking-tight">
                                                  {auto.trigger === 'enter' ? 'When deal enters stage' : `After ${auto.triggerDays} days in stage`}
                                                  <ChevronRight className="w-3.5 h-3.5 inline mx-1 text-text-muted/60" />
                                                  <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{auto.actionValue}</span>
                                                </p>
                                              </div>
                                              <button onClick={() => toggleAutomation(pipeline.id, stage.id, auto.id)} className={`w-9 h-5 rounded-full relative transition-colors shrink-0 shadow-inner ${auto.enabled ? 'bg-primary' : 'bg-surface-hover border border-border'}`}>
                                                <span className={`absolute top-[2px] w-4 h-4 bg-surface rounded-full shadow-sm transition-all ${auto.enabled ? 'left-[18px]' : 'left-[3px]'}`} />
                                              </button>
                                              <button onClick={() => deleteAutomation(pipeline.id, stage.id, auto.id)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-red hover:bg-red/10 w-7 h-7 rounded-lg flex items-center justify-center transition-all ml-1">
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          ))}
                                          {automations.length === 0 && <p className="text-[13px] text-text-muted font-bold italic py-2 pl-1 bg-surface-hover rounded-lg border border-border/50 text-center">No automation rules yet.</p>}

                                          {addingAutomationFor === stage.id ? (
                                            <div className="p-4 bg-surface border border-border rounded-xl shadow-sm space-y-3 mt-3 shadow-luxury">
                                              <div className="flex gap-3">
                                                <select value={newAutoTrigger} onChange={e => setNewAutoTrigger(e.target.value as any)}
                                                  className="flex-1 input-luxury">
                                                  <option value="enter">When deal enters stage</option>
                                                  <option value="time">After X days in stage</option>
                                                </select>
                                                <select value={newAutoAction} onChange={e => setNewAutoAction(e.target.value as any)}
                                                  className="flex-1 input-luxury">
                                                  <option value="email">Send email</option>
                                                  <option value="task">Create task</option>
                                                  <option value="assign">Assign owner</option>
                                                  <option value="notify">Notify team</option>
                                                </select>
                                              </div>
                                              <input value={newAutoValue} onChange={e => setNewAutoValue(e.target.value)}
                                                placeholder={newAutoAction === 'email' ? 'Email subject or template name...' : newAutoAction === 'task' ? 'Task title...' : 'Value...'}
                                                className="w-full input-luxury" />
                                              <div className="flex justify-end gap-2 pt-1 border-t border-border/50 mt-2">
                                                <button onClick={() => setAddingAutomationFor(null)} className="px-4 py-2 text-[12px] font-bold text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-all">Cancel</button>
                                                <button onClick={() => addAutomation(pipeline.id, stage.id)} className="px-5 py-2 text-[12px] font-bold bg-primary text-white rounded-lg hover:bg-primary-hover shadow-luxury transition-all">Add Rule</button>
                                              </div>
                                            </div>
                                          ) : (
                                            <button onClick={() => setAddingAutomationFor(stage.id)}
                                              className="w-full py-2.5 mt-2 flex items-center justify-center gap-2 text-[13px] font-bold text-primary hover:text-primary-hover hover:bg-primary/5 rounded-xl transition-all border-2 border-dashed border-primary/30">
                                              <Plus className="w-4 h-4" /> Add automation rule
                                            </button>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>

                <button onClick={() => addStage(pipeline.id)}
                  className="mt-5 flex items-center justify-center w-full py-4 border-2 border-dashed border-border bg-surface/30 rounded-2xl text-[14px] font-bold text-text-muted hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all shadow-[0_0_15px_var(--glow-color)_inset]">
                  <Plus className="w-5 h-5 mr-2" /> Add a new stage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NewPipelineModal isOpen={newPipelineOpen} onClose={() => setNewPipelineOpen(false)} onSave={createPipeline} />

      {/* Delete pipeline confirm */}
      <AnimatePresence>
        {deletingPipeline && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-40" onClick={() => setDeletingPipeline(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 flex items-center justify-center z-50 p-6">
              <div className="bg-surface rounded-2xl shadow-2xl border border-border p-6 max-w-[360px] w-full">
                <h2 className="text-[16px] font-bold text-text-main mb-1">Delete Pipeline?</h2>
                <p className="text-[13px] text-text-muted mb-5">This cannot be undone. All stages in this pipeline will be removed.</p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setDeletingPipeline(null)} className="px-5 py-2 rounded-xl text-[13px] font-semibold text-text-muted hover:bg-surface-hover">Cancel</button>
                  <button onClick={() => deletePipeline(deletingPipeline!)} className="px-5 py-2 rounded-xl text-[13px] font-semibold bg-red-500 text-white hover:bg-red-600">Delete Pipeline</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
