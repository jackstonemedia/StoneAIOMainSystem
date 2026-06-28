import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiFetch } from '../../lib/apiClient';

type Pipeline = any;

interface PipelineSettingsModalProps {
  pipeline?: Pipeline | null;
  onClose: () => void;
  onSave: () => void;
  isOpen: boolean;
}

export function PipelineSettingsModal({ pipeline, onClose, onSave, isOpen }: PipelineSettingsModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState(pipeline?.name || '');
  const [stages, setStages] = useState<{ id: string; name: string; color: string; order: number; probability: number; isNew?: boolean }[]>(
    pipeline?.stages?.length
      ? [...pipeline.stages].sort((a:any, b:any) => a.order - b.order)
      : [
          { id: 'ns1', name: 'New Lead', color: '#64748b', order: 0, probability: 10, isNew: true },
          { id: 'ns2', name: 'Contacted', color: '#818cf8', order: 1, probability: 30, isNew: true },
          { id: 'ns3', name: 'Proposal Sent', color: '#fbbf24', order: 2, probability: 60, isNew: true },
          { id: 'ns4', name: 'Closed', color: '#34d399', order: 3, probability: 100, isNew: true },
        ]
  );
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const STAGE_COLORS = ['#64748b','#818cf8','#fbbf24','#a78bfa','#34d399','#ef4444','#f97316','#06b6d4','#8b5cf6','#ec4899'];

  const save = async () => {
    if (!name.trim()) { setNameError('Pipeline name is required'); return; }
    setNameError(''); setSaving(true);
    try {
      if (pipeline) {
        await apiFetch(`/api/crm/pipelines/${pipeline.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        for (const s of stages.filter(s => !s.isNew)) {
          await apiFetch(`/api/crm/pipelines/${pipeline.id}/stages/${s.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: s.name, order: s.order }) });
        }
      } else {
        const r = await apiFetch('/api/crm/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i, probability: s.probability })) }) });
        if (!r.ok) throw new Error('Failed');
      }
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      onSave();
    } catch { setNameError('Failed to save. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-5 border-b border-border bg-muted/30">
          <DialogTitle>{pipeline ? 'Edit Pipeline' : 'Create Pipeline'}</DialogTitle>
          <DialogDescription>Configure your pipeline stages and display settings.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-2">
              <Label>Pipeline name <span className="text-destructive">*</span></Label>
              <Input 
                placeholder="e.g. Standard Sales" 
                value={name} 
                onChange={e => { setName(e.target.value); setNameError(''); }}
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pipeline stages ({stages.length})</h3>
                  <p className="text-xs text-muted-foreground mt-1">Drag to reorder · Click color to change</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-primary hover:text-primary/80"
                  onClick={() => setStages(s => [...s, { id: `ns_${Date.now()}`, name: '', color: STAGE_COLORS[s.length % STAGE_COLORS.length], order: s.length, probability: 50, isNew: true }])}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add stage
                </Button>
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2 bg-muted/50 border-b border-border gap-3">
                  <div className="w-4" />
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-5">Color</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stage Name</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-16 text-center">Win %</div>
                  <div className="w-6" />
                </div>
                {stages.map((stage, i) => (
                  <div key={stage.id} className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center px-4 py-2 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors gap-3">
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                    <div className="relative w-5 h-5 rounded-full cursor-pointer shrink-0" style={{ backgroundColor: stage.color }}>
                      <input type="color" value={stage.color} onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, color: e.target.value } : st))}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                      />
                    </div>
                    <Input 
                      value={stage.name} 
                      onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, name: e.target.value } : st))}
                      placeholder="Stage name"
                      className="h-7 px-2 border-none bg-transparent hover:bg-muted/50 focus-visible:ring-1"
                    />
                    <div className="flex items-center gap-1 w-16">
                      <Input 
                        type="number" min="0" max="100" 
                        value={stage.probability}
                        onChange={e => setStages(s => s.map((st, idx) => idx === i ? { ...st, probability: parseInt(e.target.value) || 0 } : st))}
                        className="h-7 px-2 text-center"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-6 h-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setStages(s => s.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {stages.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">No stages yet. Add one above.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : pipeline ? 'Save Changes' : 'Create Pipeline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
