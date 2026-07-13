import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxApi } from '../lib/api/inbox';
import { Plus, Trash2, Loader2, Users } from 'lucide-react';

export default function InboxTeams() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['inbox', 'teams'],
    queryFn: inboxApi.listTeams,
  });

  const create = useMutation({
    mutationFn: () => inboxApi.createTeam({ name, description: desc || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbox', 'teams'] }); setShowCreate(false); setName(''); setDesc(''); },
  });

  const del = useMutation({
    mutationFn: (id: string) => inboxApi.deleteTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'teams'] }),
  });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[16px] font-bold text-slate-900 dark:text-white">Teams</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Group agents into teams to assign conversations.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Team
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h3 className="text-[14px] font-bold text-slate-900 dark:text-white mb-4">New Team</h3>
          <div className="space-y-3">
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Team name" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-[13px] bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50">
              {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Team
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 rounded-lg text-[13px] font-medium">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (teams as any[]).length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-[14px] font-medium text-slate-500">No teams yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(teams as any[]).map(t => (
            <div key={t.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-white">{t.name}</p>
                {t.description && <p className="text-[12px] text-slate-500">{t.description}</p>}
              </div>
              <button onClick={() => { if (confirm(`Delete "${t.name}"?`)) del.mutate(t.id); }} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
