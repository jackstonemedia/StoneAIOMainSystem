/**
 * Lists & Segments — Audience Management UI
 *
 * Full layout matching Campaigns section 1-to-1:
 * HeaderPortal search, frosted glass backdrop, permanent bordered table headers,
 * theme filter pills, and member detail modals.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../lib/apiClient';
import { useToast } from '../../components/ui/Toast';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import {
  Users, Plus, Upload, Download, Trash2, X, Check,
  ChevronRight, Shield, Filter, Loader2, AlertCircle,
  List, Search, Sparkles, RefreshCw, Send, Eye,
} from 'lucide-react';

const api = {
  getLists: () => apiClient.get('/email-marketing/lists').then(r => r.data),
  createList: (data: any) => apiClient.post('/email-marketing/lists', data).then(r => r.data),
  deleteList: (id: string) => apiClient.delete(`/email-marketing/lists/${id}`),
  getMembers: (listId: string, page: number) =>
    apiClient.get(`/email-marketing/lists/${listId}/members?page=${page}&pageSize=50`).then(r => r.data),
  importCsv: (listId: string, rows: any[]) =>
    apiClient.post(`/email-marketing/lists/${listId}/import`, { rows }).then(r => r.data),
  exportCsv: (listId: string) =>
    apiClient.get(`/email-marketing/lists/${listId}/export`).then(r => r.data as string),
  getSegments: () => apiClient.get('/email-marketing/segments').then(r => r.data),
  createSegment: (data: any) => apiClient.post('/email-marketing/segments', data).then(r => r.data),
  deleteSegment: (id: string) => apiClient.delete(`/email-marketing/segments/${id}`),
  getSuppression: (page: number) =>
    apiClient.get(`/email-marketing/suppression?page=${page}&pageSize=50`).then(r => r.data),
  addSuppression: (email: string, reason: string) =>
    apiClient.post('/email-marketing/suppression', { email, reason }).then(r => r.data),
  removeSuppression: (email: string) =>
    apiClient.delete(`/email-marketing/suppression/${encodeURIComponent(email)}`),
  getSmartLists: () => apiClient.get('/crm/smart-lists').then(r => r.data),
  syncSmartList: (id: string) => apiClient.post(`/email-marketing/smart-lists/${id}/sync`).then(r => r.data),
};

type Tab = 'lists' | 'smart-lists' | 'segments' | 'suppression';

export default function ListsAndSegments() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('smart-lists');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [membersPage, setMembersPage] = useState(1);
  const [showNewListModal, setShowNewListModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [importListId, setImportListId] = useState<string | null>(null);
  const [suppressEmail, setSuppressEmail] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [viewingSmartList, setViewingSmartList] = useState<{ id: string; name: string } | null>(null);

  // Queries
  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: ['email-marketing', 'lists'],
    queryFn: api.getLists,
  });

  const { data: smartLists = [], isLoading: smartListsLoading } = useQuery({
    queryKey: ['crm', 'smart-lists'],
    queryFn: api.getSmartLists,
  });

  const { data: segments = [], isLoading: segLoading } = useQuery({
    queryKey: ['email-marketing', 'segments'],
    queryFn: api.getSegments,
  });

  const { data: suppression } = useQuery({
    queryKey: ['email-marketing', 'suppression', 1],
    queryFn: () => api.getSuppression(1),
  });

  // Mutations
  const createListMutation = useMutation({
    mutationFn: () => api.createList({ name: newListName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'lists'] });
      setNewListName('');
      setShowNewListModal(false);
      toast('success', 'List Created');
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: api.deleteList,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'lists'] });
      if (selectedListId) setSelectedListId(null);
      toast('success', 'List Deleted');
    },
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: api.deleteSegment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'segments'] });
      toast('success', 'Segment Deleted');
    },
  });

  const addSuppressionMutation = useMutation({
    mutationFn: () => api.addSuppression(suppressEmail, 'Manual addition'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'suppression'] });
      setSuppressEmail('');
      toast('success', 'Email Suppressed');
    },
  });

  const removeSuppressionMutation = useMutation({
    mutationFn: api.removeSuppression,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-marketing', 'suppression'] });
      toast('success', 'Suppression Removed');
    },
  });

  const handleSyncSmartList = async (smartList: any) => {
    try {
      setSyncingId(smartList.id);
      await api.syncSmartList(smartList.id);
      qc.invalidateQueries({ queryKey: ['email-marketing', 'lists'] });
      toast('success', 'Smart List Synced', `"${smartList.name}" is up to date.`);
    } catch (err: any) {
      toast('error', 'Sync Failed', err?.message || 'Could not sync smart list.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden z-0 bg-bg text-text-main min-h-screen">
      {/* Full-tab frosted glass backdrop */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Portal for Top Controls */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search Audience..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          
          <button 
            onClick={() => setShowNewListModal(true)} 
            className="btn-secondary"
          >
            <Plus className="w-4 h-4" /> New List
          </button>
        </div>
      </HeaderPortal>

      {/* Content Container — matches Campaigns section 1:1 */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="w-12 p-3 text-center">
                <span className="w-4 h-4 border border-border bg-bg rounded flex items-center justify-center text-text-muted text-[10px] font-bold">
                  #
                </span>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                Audience Name
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                Type / Details
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                Member Count
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                Last Updated
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* ── CRM Smart Lists Tab ── */}
            {tab === 'smart-lists' && smartLists.map((sl: any, idx: number) => (
              <tr 
                key={sl.id}
                className="border-b border-border/50 transition-colors cursor-pointer bg-black/5 hover:bg-black/10"
                onClick={() => setViewingSmartList({ id: sl.id, name: sl.name })}
              >
                <td className="p-3 text-center text-[12px] font-medium text-text-muted opacity-60">
                  {idx + 1}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-primary shadow-sm shrink-0 bg-primary/20 border border-primary/30">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[13px] font-medium text-text-main hover:underline">
                      {sl.name}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-[13px] text-text-muted">
                  CRM Smart List Sync
                </td>
                <td className="p-3 text-[13px] font-semibold text-primary">
                  {sl._count?.contacts ?? '—'} contacts
                </td>
                <td className="p-3 text-[11px] text-text-muted opacity-60">
                  {sl.updatedAt ? new Date(sl.updatedAt).toLocaleDateString() : 'Auto-synced'}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleSyncSmartList(sl)}
                      disabled={syncingId === sl.id}
                      className="px-2.5 py-1 bg-primary text-white hover:bg-primary-hover rounded-[6px] text-[11px] font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingId === sl.id ? 'animate-spin' : ''}`} /> Sync
                    </button>
                    <button
                      onClick={() => navigate(`/email-marketing/campaigns/new?smartListId=${sl.id}`)}
                      className="px-2.5 py-1 border border-border bg-surface-hover hover:bg-surface text-text-main rounded-[6px] text-[11px] font-semibold flex items-center gap-1 shadow-sm"
                    >
                      <Send className="w-3 h-3 text-primary" /> Send Campaign
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* ── Workspace Lists Tab ── */}
            {tab === 'lists' && lists.map((l: any, idx: number) => (
              <tr 
                key={l.id}
                className="border-b border-border/50 transition-colors cursor-pointer bg-black/5 hover:bg-black/10"
              >
                <td className="p-3 text-center text-[12px] font-medium text-text-muted opacity-60">
                  {idx + 1}
                </td>
                <td className="p-3 font-semibold text-text-main">{l.name}</td>
                <td className="p-3 text-[13px] text-text-muted">Static List</td>
                <td className="p-3 text-[13px] font-semibold text-primary">{l._count?.subscribers ?? 0} members</td>
                <td className="p-3 text-[11px] text-text-muted opacity-60">{new Date(l.updatedAt).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setImportListId(l.id)}
                      className="px-2.5 py-1 border border-border bg-surface-hover text-text-main rounded-[6px] text-[11px] font-semibold"
                    >
                      Import CSV
                    </button>
                    <button
                      onClick={() => deleteListMutation.mutate(l.id)}
                      className="p-1 text-text-muted hover:text-red-400 rounded-[6px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* ── Dynamic Segments Tab ── */}
            {tab === 'segments' && segments.map((seg: any, idx: number) => (
              <tr key={seg.id} className="border-b border-border/50 text-[13px]">
                <td className="p-3 text-center text-text-muted opacity-60">{idx + 1}</td>
                <td className="p-3 font-semibold text-text-main">{seg.name}</td>
                <td className="p-3 text-text-muted">Dynamic Filter Rules</td>
                <td className="p-3 font-semibold text-accent-purple">Dynamic</td>
                <td className="p-3 text-[11px] text-text-muted opacity-60">{new Date(seg.updatedAt).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => deleteSegmentMutation.mutate(seg.id)}
                    className="p-1 text-text-muted hover:text-red-400 rounded-[6px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {/* ── Suppression Tab ── */}
            {tab === 'suppression' && (suppression?.entries || []).map((entry: any, idx: number) => (
              <tr key={entry.id} className="border-b border-border/50 text-[13px]">
                <td className="p-3 text-center text-text-muted opacity-60">{idx + 1}</td>
                <td className="p-3 font-semibold text-text-main flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-red-400" /> {entry.email}
                </td>
                <td className="p-3 text-text-muted">{entry.reason}</td>
                <td className="p-3 font-semibold text-red-400">Suppressed</td>
                <td className="p-3 text-[11px] text-text-muted opacity-60">{new Date(entry.createdAt).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => removeSuppressionMutation.mutate(entry.email)}
                    className="px-2 py-1 bg-surface-hover text-text-muted hover:text-text-main rounded text-xs"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Controls & Paginator */}
      <div 
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{ 
          background: 'var(--sidebar-bg)', 
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          {/* Audience Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-hover/50 p-1 rounded-lg border border-border/50">
            {[
              { id: 'smart-lists', label: `CRM Smart Lists (${smartLists.length})` },
              { id: 'lists', label: `Workspace Lists (${lists.length})` },
              { id: 'segments', label: `Segments (${segments.length})` },
              { id: 'suppression', label: 'Suppression List' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`px-3 py-1 rounded-[6px] text-[11px] font-bold transition-all ${
                  tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text-main'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pagination Counter */}
        <div className="flex items-center gap-5">
          <span className="text-[13px] font-medium text-text-muted">
            Audience Synced
          </span>
          <div className="flex items-center gap-3 font-semibold">
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Prev</button>
            <button className="px-3 py-0.5 rounded-[6px] shadow-sm bg-primary text-white font-bold text-[12px]">1</button>
            <button className="text-[13px] font-medium text-text-muted hover:text-white transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* Create List Modal */}
      {showNewListModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border/60 rounded-2xl w-full max-w-md p-6 shadow-luxury space-y-4">
            <h3 className="font-bold text-text-main text-base">Create New Contact List</h3>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="e.g. Q3 VIP Prospects"
              className="w-full bg-surface border border-border/60 rounded-xl px-4 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNewListModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={() => createListMutation.mutate()}
                disabled={!newListName || createListMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-interactive"
              >
                Create List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
