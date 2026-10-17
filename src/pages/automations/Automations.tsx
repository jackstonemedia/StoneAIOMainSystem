import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Zap, Trash2, Copy, Search, Clock, CheckCircle2, PauseCircle,
  ChevronRight, Loader2, MoreHorizontal, FolderOpen, Folder, Star,
  FolderPlus, Edit2, X, Check, Webhook, Calendar, Plug,
} from 'lucide-react';
import { useWorkflows, useCreateWorkflow, useDeleteWorkflow, useDuplicateWorkflow } from '../../hooks/useWorkflows';
import { useFolders, useCreateFolder, useRenameFolder, useDeleteFolder, useMoveWorkflowToFolder, useToggleFavorite } from '../../hooks/useTables';
import { useToast } from '../../components/ui/Toast';
import type { Workflow, WorkflowStatus } from '../../types/automation';
import type { AutomationFolder } from '../../hooks/useTables';

const STATUS_CFG: Record<WorkflowStatus, { label: string; icon: typeof Zap; cls: string }> = {
  published: { label: 'Live',   icon: CheckCircle2, cls: 'text-green-400 bg-green-500/10 border border-green-500/25' },
  draft:     { label: 'Draft',  icon: Clock,        cls: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/25' },
  paused:    { label: 'Paused', icon: PauseCircle,  cls: 'text-text-muted bg-surface border border-border' },
};

const TRIGGER_TYPES = [
  { id: 'blank', label: 'Start from Scratch', desc: 'Build your automation step by step', icon: Zap, color: 'text-accent' },
  { id: 'webhook', label: 'Webhook Trigger', desc: 'Trigger via HTTP webhook URL', icon: Webhook, color: 'text-purple-400' },
  { id: 'schedule', label: 'Schedule', desc: 'Run on a cron / time-based schedule', icon: Calendar, color: 'text-blue-400' },
  { id: 'app', label: 'App Event', desc: 'Connect to 700+ app integrations', icon: Plug, color: 'text-orange-400' },
];

export default function Automations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | ''>('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderVal, setRenameFolderVal] = useState('');

  // New Automation Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [newWfName, setNewWfName] = useState('Untitled Automation');
  const [newWfTrigger, setNewWfTrigger] = useState('blank');

  const { data: workflows = [], isLoading } = useWorkflows({ search: search || undefined, status: statusFilter || undefined });
  const { data: folders = [] } = useFolders();
  const createWorkflow  = useCreateWorkflow();
  const deleteWorkflow  = useDeleteWorkflow();
  const duplicateWorkflow = useDuplicateWorkflow();
  const createFolder    = useCreateFolder();
  const renameFolder    = useRenameFolder();
  const deleteFolder    = useDeleteFolder();
  const moveToFolder    = useMoveWorkflowToFolder();
  const toggleFavorite  = useToggleFavorite();

  const filtered = useMemo(() => workflows.filter((w: any) => {
    if (selectedFolder === '__fav__') return w.isFavorite;
    if (selectedFolder) return w.folderId === selectedFolder;
    return true;
  }), [workflows, selectedFolder]);

  const handleCreate = async () => {
    try {
      const wf = await createWorkflow.mutateAsync({ name: newWfName || 'Untitled Automation' });
      setShowNewModal(false);
      setNewWfName('Untitled Automation');
      navigate(`/automations/${wf.id}`);
    } catch {
      toast('error', 'Engine Unavailable', 'Could not connect to the automation engine.');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync(newFolderName.trim());
    setNewFolderMode(false); setNewFolderName('');
  };

  const handleRenameFolder = async (id: string) => {
    if (!renameFolderVal.trim()) return;
    await renameFolder.mutateAsync({ id, name: renameFolderVal.trim() });
    setRenamingFolder(null);
  };

  return (
    <div className="flex h-full bg-bg">
      {/* Folder sidebar */}
      <aside className="w-52 shrink-0 border-r border-border bg-surface flex flex-col py-3">
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">Folders</span>
          <button onClick={() => setNewFolderMode(true)} className="p-1 rounded hover:bg-bg" title="New folder">
            <FolderPlus className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </div>
        {(['__all__', '__fav__'] as const).map((id) => {
          const label = id === '__all__' ? 'All Workflows' : 'Favorites';
          const Icon  = id === '__all__' ? Zap : Star;
          const count = id === '__all__' ? workflows.length : workflows.filter((w: any) => w.isFavorite).length;
          const active = (id === '__all__' && selectedFolder === null) || selectedFolder === id;
          return (
            <button key={id} onClick={() => setSelectedFolder(id === '__all__' ? null : id)}
              className={`mx-2 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${active ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-bg hover:text-text-main'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
              <span className="ml-auto text-[10px]">{count}</span>
            </button>
          );
        })}

        {newFolderMode && (
          <div className="mx-2 mt-1 flex items-center gap-1">
            <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
              placeholder="Folder name"
              className="flex-1 px-2 py-1 bg-bg border border-accent rounded text-xs text-text-main focus:outline-none" />
            <button onClick={handleCreateFolder}><Check className="w-3 h-3 text-green-400" /></button>
            <button onClick={() => setNewFolderMode(false)}><X className="w-3 h-3 text-text-muted" /></button>
          </div>
        )}

        <div className="mt-1 space-y-0.5">
          {folders.map((f) => (
            <div key={f.id} className="group mx-2">
              {renamingFolder === f.id ? (
                <div className="flex items-center gap-1">
                  <input autoFocus value={renameFolderVal} onChange={(e) => setRenameFolderVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(f.id); if (e.key === 'Escape') setRenamingFolder(null); }}
                    className="flex-1 px-2 py-1 bg-bg border border-accent rounded text-xs text-text-main focus:outline-none" />
                  <button onClick={() => handleRenameFolder(f.id)}><Check className="w-3 h-3 text-green-400" /></button>
                  <button onClick={() => setRenamingFolder(null)}><X className="w-3 h-3 text-text-muted" /></button>
                </div>
              ) : (
                <button onClick={() => setSelectedFolder(f.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${selectedFolder === f.id ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-bg hover:text-text-main'}`}>
                  {selectedFolder === f.id ? <FolderOpen className="w-3.5 h-3.5 shrink-0" /> : <Folder className="w-3.5 h-3.5 shrink-0" />}
                  <span className="flex-1 truncate text-left">{f.name}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setRenamingFolder(f.id); setRenameFolderVal(f.name); }} className="p-0.5 hover:text-accent"><Edit2 className="w-2.5 h-2.5" /></button>
                    <button onClick={() => deleteFolder.mutate(f.id)} className="p-0.5 hover:text-red-400"><Trash2 className="w-2.5 h-2.5" /></button>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-surface shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-text-main">
                {selectedFolder === '__fav__' ? 'Favorites' : selectedFolder ? (folders.find((f) => f.id === selectedFolder)?.name ?? 'Folder') : 'All Workflows'}
              </h1>
              <p className="text-xs text-text-muted mt-0.5">{isLoading ? 'Loading...' : `${filtered.length} workflow${filtered.length !== 1 ? 's' : ''}`}</p>
            </div>
            <button onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors">
              <Plus className="w-4 h-4" />
              New Automation
            </button>
          </div>
          <div className="flex gap-3 mt-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input type="text" placeholder="Search workflows..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:border-accent" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent">
              <option value="">All Status</option>
              <option value="published">Live</option>
              <option value="draft">Draft</option>
              <option value="paused">Paused</option>
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
          ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center"><Zap className="w-7 h-7 text-accent" /></div>
              <div className="text-center">
                <p className="text-text-main font-semibold">No workflows here</p>
                <p className="text-text-muted text-sm mt-1">Create your first automation to get started</p>
              </div>
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent/90">
                <Plus className="w-4 h-4" /> New Automation
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface border-b border-border">
                <tr>
                  <th className="w-8 px-4 py-2.5" />
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Trigger</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Folder</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted uppercase tracking-wider">Updated</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((wf: any) => {
                  const cfg = STATUS_CFG[wf.status as WorkflowStatus];
                  const StatusIcon = cfg.icon;
                  const folderName = folders.find((f) => f.id === wf.folderId)?.name;
                  if (deleteConfirm === wf.id) {
                    return (
                      <tr key={wf.id} className="bg-red-500/5">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-4">
                            <p className="text-sm text-text-main">Delete <strong>"{wf.name}"</strong>?</p>
                            <button onClick={() => { deleteWorkflow.mutate(wf.id); setDeleteConfirm(null); }} className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 border border-border text-xs text-text-muted rounded-lg hover:bg-bg">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={wf.id} className="hover:bg-surface/60 cursor-pointer group" onClick={() => navigate(`/automations/${wf.id}`)}>
                      <td className="px-4 py-3" onClick={(e) => { e.stopPropagation(); toggleFavorite.mutate(wf.id); }}>
                        <Star className={`w-3.5 h-3.5 transition-colors ${wf.isFavorite ? 'text-yellow-400 fill-yellow-400' : 'text-border group-hover:text-text-muted'}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0"><Zap className="w-3.5 h-3.5 text-accent" /></div>
                          <span className="font-medium text-text-main">{wf.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
                          <StatusIcon className="w-3 h-3" />{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">{wf.triggerType ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {folderName ? <span className="flex items-center gap-1"><Folder className="w-3 h-3" />{folderName}</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{new Date(wf.updatedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button onClick={() => setMenuOpen(menuOpen === wf.id ? null : wf.id)}
                            className="p-1 rounded hover:bg-bg opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4 text-text-muted" />
                          </button>
                          {menuOpen === wf.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-lg shadow-xl z-20 overflow-hidden">
                              <button onClick={() => navigate(`/automations/${wf.id}`)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-bg"><ChevronRight className="w-3.5 h-3.5" /> Open</button>
                              <button onClick={() => { duplicateWorkflow.mutate(wf.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-bg"><Copy className="w-3.5 h-3.5" /> Duplicate</button>
                              {folders.length > 0 && (
                                <>
                                  <div className="border-t border-border/50 my-1" />
                                  <p className="px-3 py-1 text-[10px] text-text-muted uppercase tracking-wider">Move to folder</p>
                                  {folders.map((f) => (
                                    <button key={f.id} onClick={() => { moveToFolder.mutate({ workflowId: wf.id, folderId: f.id }); setMenuOpen(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-main hover:bg-bg">
                                      <Folder className="w-3 h-3 text-text-muted" />{f.name}
                                    </button>
                                  ))}
                                  {wf.folderId && (
                                    <button onClick={() => { moveToFolder.mutate({ workflowId: wf.id, folderId: null }); setMenuOpen(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-muted hover:bg-bg">
                                      <X className="w-3 h-3" /> Remove from folder
                                    </button>
                                  )}
                                </>
                              )}
                              <div className="border-t border-border/50 my-1" />
                              <button onClick={() => { setDeleteConfirm(wf.id); setMenuOpen(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-bg"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}

      {/* ── New Automation Modal ─────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-text-main">New Automation</h2>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 rounded-lg hover:bg-bg text-text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Name</label>
              <input
                autoFocus
                type="text"
                value={newWfName}
                onChange={(e) => setNewWfName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Untitled Automation"
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-main focus:outline-none focus:border-accent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Start with</label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setNewWfTrigger(t.id)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all ${
                        newWfTrigger === t.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-accent/50 hover:bg-bg'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${t.color}`} />
                      <span className="text-xs font-semibold text-text-main">{t.label}</span>
                      <span className="text-[11px] text-text-muted leading-tight">{t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-sm text-text-muted hover:bg-bg rounded-lg border border-border"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createWorkflow.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50"
              >
                {createWorkflow.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
