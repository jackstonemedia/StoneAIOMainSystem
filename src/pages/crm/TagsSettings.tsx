import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Edit2, Trash2, Check, X, Plus } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

export function TagsSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tags = [], isLoading } = useQuery<any[]>({
    queryKey: ['crm_tags'],
    queryFn: () => fetch('/api/crm/tags').then(r => r.json()),
  });

  const createTag = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/crm/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm_tags'] })
  });

  const renameTag = useMutation({
    mutationFn: async ({ id, name }: { id: string, name: string }) => {
      const res = await fetch(`/api/crm/tags/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_tags'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast('success', 'Tag renamed');
    }
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/crm/tags/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_tags'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast('success', 'Tag deleted');
    }
  });

  const mergeTags = useMutation({
    mutationFn: async ({ sourceTagId, targetTagId }: { sourceTagId: string, targetTagId: string }) => {
      const res = await fetch('/api/crm/tags/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceTagId, targetTagId }) });
      if (!res.ok) throw new Error();
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm_tags'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast('success', 'Tags merged successfully');
      setMergeState(null);
    }
  });

  const [newTagName, setNewTagName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [mergeState, setMergeState] = useState<{ sourceId: string } | null>(null);

  if (isLoading) return <div className="text-[13px] text-text-muted p-4">Loading tags...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <input 
          type="text" 
          placeholder="New tag name" 
          value={newTagName} 
          onChange={e => setNewTagName(e.target.value)}
          className="flex-1 px-3 py-2 bg-surface-hover border border-border rounded-[8px] text-[13px] text-text-main focus:outline-none focus:border-primary"
        />
        <button 
          disabled={!newTagName || createTag.isPending}
          onClick={() => {
            createTag.mutate({ name: newTagName });
            setNewTagName('');
          }}
          className="px-4 py-2 bg-primary text-white text-[13px] font-semibold rounded-[8px] disabled:opacity-50 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-surface-hover/30">
        {tags.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-text-muted">No tags found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-hover">
                <th className="p-3 text-[12px] font-bold text-text-muted uppercase tracking-wider">Tag Name</th>
                <th className="p-3 text-[12px] font-bold text-text-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map(tag => (
                <tr key={tag.id} className="border-b border-border/50 last:border-0 hover:bg-surface-hover/50">
                  <td className="p-3">
                    {editingId === tag.id ? (
                      <input 
                        type="text" 
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="px-2 py-1 bg-surface border border-primary rounded text-[13px] text-text-main outline-none w-full max-w-[200px]"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            renameTag.mutate({ id: tag.id, name: editName });
                            setEditingId(null);
                          } else if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-[13px] font-medium text-text-main">{tag.name}</span>
                        {mergeState?.sourceId === tag.id && (
                          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-primary/20 text-primary rounded">MERGING</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {editingId === tag.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { renameTag.mutate({ id: tag.id, name: editName }); setEditingId(null); }} className="p-1.5 text-primary hover:bg-primary/10 rounded"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-text-muted hover:bg-surface rounded"><X className="w-4 h-4" /></button>
                      </div>
                    ) : mergeState ? (
                       mergeState.sourceId === tag.id ? (
                         <button onClick={() => setMergeState(null)} className="text-[12px] font-medium text-text-muted hover:text-text-main">Cancel Merge</button>
                       ) : (
                         <button onClick={() => mergeTags.mutate({ sourceTagId: mergeState.sourceId, targetTagId: tag.id })} className="text-[12px] font-semibold text-primary px-3 py-1 bg-primary/10 rounded hover:bg-primary/20 transition-colors">Merge Into {tag.name}</button>
                       )
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setMergeState({ sourceId: tag.id })}
                          className="text-[12px] font-medium text-text-muted hover:text-primary transition-colors px-2"
                        >
                          Merge
                        </button>
                        <button 
                          onClick={() => { setEditingId(tag.id); setEditName(tag.name); }}
                          className="p-1.5 text-text-muted hover:text-primary transition-colors rounded hover:bg-surface-hover"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => { if (confirm('Delete this tag from all contacts?')) deleteTag.mutate(tag.id); }}
                          className="p-1.5 text-text-muted hover:text-accent-red transition-colors rounded hover:bg-surface-hover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
