import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import { Plus, Trash2, Loader2, Tag } from 'lucide-react';

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#64748b'];

export default function InboxLabels() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [desc, setDesc] = useState('');

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['inbox', 'labels'],
    queryFn: inboxApi.listLabels,
  });

  const create = useMutation({
    mutationFn: () => inboxApi.createLabel({ title, color, description: desc || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbox', 'labels'] }); setShowCreate(false); setTitle(''); setDesc(''); setColor('#6366f1'); },
  });

  const del = useMutation({
    mutationFn: (id: string) => inboxApi.deleteLabel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'labels'] }),
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Labels</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Categorize conversations with colored labels.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Label
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mb-4">New Label</h3>
          <div className="space-y-3">
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Label name (e.g. Bug, Feature Request)" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div>
              <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 block mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50">
              {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Label
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-[13px] font-medium">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (labels as any[]).length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-slate-500">No labels yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(labels as any[]).map(l => (
            <div key={l.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
              <span className="w-5 h-5 rounded-full shrink-0" style={{ background: l.color || '#94a3b8' }} />
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{l.title}</p>
                {l.description && <p className="text-[12px] text-slate-500">{l.description}</p>}
              </div>
              <button onClick={() => { if (confirm(`Delete label "${l.title}"?`)) del.mutate(l.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
