import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import { Plus, Trash2, Loader2, MessageSquareText, Pencil, X, Check } from 'lucide-react';
import type { CannedResponse } from '../types/inbox';

export default function InboxCannedResponses() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['inbox', 'canned-responses'],
    queryFn: () => inboxApi.listCannedResponses(),
  });

  const create = useMutation({
    mutationFn: () => inboxApi.createCannedResponse({ name, content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbox', 'canned-responses'] }); setShowCreate(false); setName(''); setContent(''); },
  });

  const update = useMutation({
    mutationFn: () => inboxApi.updateCannedResponse(editId!, { name, content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbox', 'canned-responses'] }); setEditId(null); setName(''); setContent(''); },
  });

  const del = useMutation({
    mutationFn: (id: string) => inboxApi.deleteCannedResponse(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'canned-responses'] }),
  });

  const startEdit = (r: CannedResponse) => {
    setEditId(r.id);
    setName(r.name);
    setContent(r.content);
    setShowCreate(false);
  };

  const cancelEdit = () => { setEditId(null); setName(''); setContent(''); };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Canned Responses</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Save frequently-used replies. Use "/" in the composer to search and insert them.</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditId(null); setName(''); setContent(''); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Response
        </button>
      </div>

      {(showCreate || editId) && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mb-4">
            {editId ? 'Edit Response' : 'New Canned Response'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Shortcut Name</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. greeting, refund-policy" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">Message Content</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Type the message content..." rows={4} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => editId ? update.mutate() : create.mutate()}
              disabled={!name.trim() || !content.trim() || create.isPending || update.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              {(create.isPending || update.isPending) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editId ? 'Save Changes' : 'Create Response'}
            </button>
            <button onClick={() => { setShowCreate(false); cancelEdit(); }} className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-[13px] font-medium">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (responses as CannedResponse[]).length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <MessageSquareText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-slate-500">No canned responses yet</p>
          <p className="text-[12px] text-slate-400 mt-1">Save frequently-used replies to speed up your team's workflow.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(responses as CannedResponse[]).map(r => (
            <div key={r.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded font-mono">/{r.name}</span>
                  </div>
                  <p className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-2">{r.content}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => startEdit(r)} className="p-1.5 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) del.mutate(r.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
