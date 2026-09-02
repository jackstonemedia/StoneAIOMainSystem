import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../../lib/api/conversations';
import { Plus, Trash2, Loader2, Pencil, Tag, Check, X } from 'lucide-react';
import type { ConversationTag } from '../../../types/conversation';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#0f172a',
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? 'border-white scale-110' : 'border-transparent'}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-6 h-6 rounded-full overflow-hidden cursor-pointer border-0" title="Custom color" />
    </div>
  );
}

function TagRow({ tag, onEdit, onDelete, onMerge }: {
  tag: ConversationTag;
  onEdit: () => void;
  onDelete: () => void;
  onMerge: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-4 h-4 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: tag.color }} />
        <div>
          <span className="text-[13px] font-semibold text-slate-900 dark:text-white">{tag.name}</span>
          <span className="ml-2 text-[11px] text-slate-500">{tag.usageCount} conversation{tag.usageCount !== 1 ? 's' : ''}</span>
        </div>
        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
          tag.scope === 'shared'
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : 'text-slate-500 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
        }`}>
          {tag.scope === 'shared' ? 'Shared' : 'Conversations'}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onMerge} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors" title="Merge into another tag">
          <Tag className="w-4 h-4" />
        </button>
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function MergeModal({ source, allTags, onConfirm, onCancel }: {
  source: ConversationTag;
  allTags: ConversationTag[];
  onConfirm: (targetId: string) => void;
  onCancel: () => void;
}) {
  const [targetId, setTargetId] = useState('');
  const others = allTags.filter(t => t.id !== source.id);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white mb-2">Merge tag</h3>
        <p className="text-[13px] text-slate-500 mb-4">
          Merge <strong className="text-slate-900 dark:text-white">"{source.name}"</strong> into another tag. All conversations will be re-tagged and "{source.name}" will be deleted.
        </p>
        <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-[13px] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none mb-4">
          <option value="">Select target tag…</option>
          {others.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 text-[13px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(targetId)}
            disabled={!targetId}
            className="flex-1 py-2 text-[13px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConversationsTagsSettings() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[5]);
  const [scope, setScope] = useState<'shared' | 'conversations_only'>('conversations_only');

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['conversations', 'tags'],
    queryFn: conversationsApi.listTags,
  });

  const create = useMutation({
    mutationFn: () => conversationsApi.createTag({ name, color, scope }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations', 'tags'] }); setShowCreate(false); resetForm(); },
  });

  const update = useMutation({
    mutationFn: () => conversationsApi.updateTag(editId!, { name, color, scope }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations', 'tags'] }); setEditId(null); resetForm(); },
  });

  const del = useMutation({
    mutationFn: (id: string) => conversationsApi.deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', 'tags'] }),
  });

  const merge = useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      conversationsApi.mergeTags(sourceId, targetId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conversations', 'tags'] }); setMergeSourceId(null); },
  });

  const resetForm = () => { setName(''); setColor(PRESET_COLORS[5]); setScope('conversations_only'); };

  const startEdit = (tag: ConversationTag) => {
    setEditId(tag.id); setName(tag.name); setColor(tag.color); setScope(tag.scope);
    setShowCreate(false);
  };

  const mergeSource = tags.find(t => t.id === mergeSourceId);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Tags</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Organize conversations with tags. Shared tags also appear in Contacts.</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setEditId(null); resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Tag
        </button>
      </div>

      {/* Create / Edit form */}
      {(showCreate || editId) && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white">{editId ? 'Edit Tag' : 'New Tag'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Name</label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Tag name…"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Scope</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="conversations_only">Conversations only</option>
                <option value="shared">Shared (Contacts + Conversations)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Color</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: color }} />
            <span className="text-[13px] text-slate-600 dark:text-slate-400">Preview:</span>
            <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
              {name || 'Tag name'}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => editId ? update.mutate() : create.mutate()}
              disabled={!name.trim() || create.isPending || update.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              {(create.isPending || update.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? 'Save Changes' : 'Create Tag'}
            </button>
            <button onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }} className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-[13px] font-medium hover:text-slate-900 dark:hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Tag className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-slate-500">No tags yet</p>
          <p className="text-[12px] text-slate-400 mt-1">Create tags to organize and filter conversations.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map(tag => (
            <TagRow
              key={tag.id}
              tag={tag}
              onEdit={() => startEdit(tag)}
              onDelete={() => { if (confirm(`Delete tag "${tag.name}"?`)) del.mutate(tag.id); }}
              onMerge={() => setMergeSourceId(tag.id)}
            />
          ))}
        </div>
      )}

      {mergeSource && (
        <MergeModal
          source={mergeSource}
          allTags={tags}
          onConfirm={targetId => merge.mutate({ sourceId: mergeSource.id, targetId })}
          onCancel={() => setMergeSourceId(null)}
        />
      )}
    </div>
  );
}
