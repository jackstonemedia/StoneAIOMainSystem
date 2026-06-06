import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, GripVertical, Trash2, Edit2, MoreVertical, Target, ChevronLeft, Check, GitBranch, TrendingUp, Search, MoreHorizontal } from 'lucide-react';
import { apiClient } from '../../lib/apiClient';

interface Stage { id: string; name: string; color: string; order: number; probability: number; }
interface Pipeline { id: string; name: string; isDefault: boolean; stages: Stage[]; updatedAt?: string; }

export function PipelineModal({ pipeline, onClose, onSave }: { pipeline?: Pipeline | null; onClose: () => void; onSave: () => void }) {
  const PASTEL_COLORS = [
    '#FFF59D', '#FFCC80', '#FFCDD2', '#F48FB1', '#F8BBD0', '#E1BEE7',
    '#E6EE9C', '#C5E1A5', '#A5D6A7', '#80CBC4', '#80DEEA', '#B2DFDB',
    '#C5CAE9', '#D1C4E9', '#E1BEE7', '#CE93D8', '#9FA8DA', '#90CAF9',
    '#81D4FA', '#B3E5FC', '#4DD0E1', '#90CAF9', '#CFD8DC', '#B0BEC5'
  ];

  const [activeColorPicker, setActiveColorPicker] = useState<number | null>(null);

  const qc = useQueryClient();
  const [name, setName] = useState(pipeline?.name || '');
  const [stages, setStages] = useState<{ id: string; name: string; color: string; order: number; probability: number; isNew?: boolean }[]>(
    pipeline?.stages?.length
      ? [...pipeline.stages].sort((a, b) => a.order - b.order)
      : [
          { id: 'ns1', name: 'Active Deals', color: PASTEL_COLORS[0], order: 0, probability: 50, isNew: true },
          { id: 'ns2', name: 'Closed Won', color: PASTEL_COLORS[1], order: 1, probability: 100, isNew: true },
        ]
  );
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { setNameError('Pipeline name is required'); return; }
    setNameError(''); setSaving(true);
    try {
      if (pipeline) {
        await apiClient.put(`/crm/pipelines/${pipeline.id}`, { name });
        for (const s of stages.filter(s => !s.isNew)) {
          await apiClient.put(`/crm/pipelines/${pipeline.id}/stages/${s.id}`, { name: s.name, color: s.color, order: s.order });
        }
        for (const s of stages.filter(s => s.isNew)) {
          await apiClient.post(`/crm/pipelines/${pipeline.id}/stages`, { name: s.name, color: s.color, order: s.order, probability: s.probability });
        }
      } else {
        await apiClient.post('/crm/pipelines', { 
          name, 
          stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i, probability: s.probability })) 
        });
      }
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      onSave();
    } catch (err) { 
      console.error(err);
      setNameError('Failed to save. Please try again.'); 
    }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.18 }}
        className="relative w-[600px] max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="text-[16px] font-bold text-text-main">{pipeline ? 'Edit Pipeline' : 'Create Pipeline'}</h2>
            <p className="text-[12px] text-text-muted mt-0.5">Configure your pipeline stages and display settings.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-text-muted">Pipeline name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="e.g. Standard Sales" value={name} onChange={e => { setName(e.target.value); setNameError(''); }}
              className="w-full px-3 py-2.5 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
            />
            {nameError && <p className="text-[11px] text-red-400">{nameError}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[13px] font-bold text-text-main">Pipeline stages ({stages.length})</h3>
                <p className="text-[11px] text-text-muted mt-0.5">Drag to reorder · Click color to change</p>
              </div>
              <button onClick={() => setStages(s => [...s, { id: `ns_${Date.now()}`, name: '', color: PASTEL_COLORS[s.length % PASTEL_COLORS.length], order: s.length, probability: 50, isNew: true }])}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Add stage
              </button>
            </div>

            <div className="rounded-[8px] border border-border overflow-hidden">
              <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2.5 bg-surface-hover/60 border-b border-border gap-3">
                <div className="w-4" />
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider w-5">Color</div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Stage Name</div>
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider w-16 text-center">Win %</div>
                <div className="w-6" />
              </div>
              {stages.map((stage, i) => (
                <div key={stage.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-surface-hover/20 transition-colors gap-3">
                  <GripVertical className="w-4 h-4 text-text-muted cursor-grab" />
                  <div className="relative">
                    <div 
                      className="w-5 h-5 rounded-full cursor-pointer shrink-0 border border-border shadow-sm hover:scale-110 transition-transform" 
                      style={{ backgroundColor: stage.color }}
                      onClick={() => setActiveColorPicker(activeColorPicker === i ? null : i)}
                    />
                    {activeColorPicker === i && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setActiveColorPicker(null)} />
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute left-0 top-full mt-2 w-[180px] bg-surface border border-border shadow-luxury rounded-xl p-3 z-20 grid grid-cols-4 gap-2"
                        >
                          {PASTEL_COLORS.map(color => (
                            <div 
                              key={color} 
                              className="w-6 h-6 rounded-full cursor-pointer hover:scale-110 transition-transform border border-border/50 shadow-sm flex items-center justify-center"
                              style={{ backgroundColor: color }}
                              onClick={() => {
                                setStages(s => s.map((st, idx) => idx === i ? { ...st, color } : st));
                                setActiveColorPicker(null);
                              }}
                            >
                              {stage.color === color && <Check className="w-3 h-3 text-bg mix-blend-difference" />}
                            </div>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </div>
                  <input type="text" value={stage.name} onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))}
                    placeholder="Stage name"
                    className="bg-transparent border-none text-[13px] font-medium text-text-main focus:outline-none focus:bg-surface-hover rounded px-1 py-0.5 placeholder:text-text-muted/50"
                  />
                  <div className="flex items-center gap-1 w-16">
                    <input type="number" min="0" max="100" value={stage.probability}
                      onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, probability: parseInt(e.target.value) || 0 } : st))}
                      className="w-10 bg-surface-hover border border-border rounded-[4px] text-[12px] text-text-main text-center focus:outline-none focus:border-primary px-1 py-0.5"
                    />
                    <span className="text-[11px] text-text-muted">%</span>
                  </div>
                  <button onClick={() => setStages(s => s.filter((_, idx) => idx !== i))}
                    className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {stages.length === 0 && (
                <div className="px-4 py-8 text-center text-[12px] text-text-muted">No stages yet. Add one above.</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface-hover/30 shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-muted border border-border hover:bg-surface-hover transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} className="px-5 py-2 rounded-[6px] text-[13px] font-semibold text-white bg-primary hover:opacity-90 disabled:opacity-40 transition-opacity">
            {saving ? 'Saving...' : pipeline ? 'Save Changes' : 'Create Pipeline'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function PipelinesTab({ pipelines, onRefresh, onBack }: { pipelines: Pipeline[]; onRefresh: () => void; onBack: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = pipelines.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const del = async (id: string) => {
    if (!confirm('Delete this pipeline? Deals will lose their stage assignment.')) return;
    await apiClient.delete(`/crm/pipelines/${id}`);
    qc.invalidateQueries({ queryKey: ['pipelines'] });
  };

  return (
    <div className="flex-1 overflow-auto p-8 bg-surface h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-[22px] font-bold text-text-main">Pipelines</h2>
            <p className="text-[13px] text-text-muted mt-1 max-w-xl">Manage your sales pipelines and configure stages. Each pipeline can have its own stages, colors, and win probabilities.</p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Create Pipeline
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Pipelines', value: pipelines.length, icon: GitBranch, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Total Stages', value: pipelines.reduce((s, p) => s + (p.stages?.length || 0), 0), icon: GitBranch, color: 'text-violet-400', bg: 'bg-violet-400/10' },
          { label: 'Default Pipeline', value: pipelines.find(p => p.isDefault)?.name || '—', icon: Check, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface border border-border rounded-[10px] px-5 py-4 flex items-center gap-4 shadow-sm">
            <div className={`w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0 ${stat.bg}`}>
              <TrendingUp className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{stat.label}</div>
              <div className="text-[18px] font-bold text-text-main">{stat.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-[10px] overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-surface-hover/30">
          <h3 className="text-[13px] font-bold text-text-main">All Pipelines</h3>
          <div className="relative w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input type="text" placeholder="Search pipelines..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-[6px] text-[12px] text-text-main focus:outline-none focus:border-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_120px_200px_80px] items-center px-5 py-3 bg-surface-hover/20 border-b border-border">
          {['Pipeline Name', 'No. of Stages', 'Updated On', 'Actions'].map(h => (
            <div key={h} className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{h}</div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-hover border border-border flex items-center justify-center mx-auto mb-3"><Target className="w-6 h-6 text-text-muted" /></div>
            <p className="text-[14px] font-semibold text-text-main mb-1">No pipelines found</p>
            <p className="text-[12px] text-text-muted">Create your first pipeline to start tracking deals.</p>
          </div>
        ) : filtered.map(pipeline => (
          <div key={pipeline.id}
            className="grid grid-cols-[1fr_120px_200px_80px] items-center px-5 py-4 border-b border-border/40 last:border-b-0 hover:bg-surface-hover/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(pipeline.stages || []).slice(0, 5).map(s => (
                  <div key={s.id} className="w-1.5 h-6 rounded-full" style={{ backgroundColor: s.color }} />
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-main">{pipeline.name}</span>
                  {pipeline.isDefault && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-[3px]">Default</span>}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">{(pipeline.stages || []).map(s => s.name).join(' → ')}</div>
              </div>
            </div>
            <div className="text-[13px] font-medium text-text-muted">{(pipeline.stages || []).length} stages</div>
            <div className="text-[12px] text-text-muted">
              {pipeline.updatedAt ? new Date(pipeline.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            </div>
            <div className="relative flex justify-start">
              <button onClick={() => setMenuOpen(menuOpen === pipeline.id ? null : pipeline.id)}
                className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {menuOpen === pipeline.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute left-0 top-[calc(100%+4px)] w-[160px] bg-surface border border-border rounded-[8px] shadow-xl z-20 py-1"
                    >
                      <button onClick={() => { setEditingPipeline(pipeline); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors">
                        <Edit2 className="w-3.5 h-3.5" /> Edit Pipeline
                      </button>
                      <button onClick={() => { del(pipeline.id); setMenuOpen(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {createOpen && <PipelineModal onClose={() => setCreateOpen(false)} onSave={() => { setCreateOpen(false); onRefresh(); }} />}
        {editingPipeline && <PipelineModal pipeline={editingPipeline} onClose={() => setEditingPipeline(null)} onSave={() => { setEditingPipeline(null); onRefresh(); }} />}
      </AnimatePresence>
    </div>
  );
}
