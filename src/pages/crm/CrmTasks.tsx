import { useState, useMemo } from 'react';
import { 
  Plus, Filter, ChevronDown, Search, Settings, Edit2, Trash2, 
  Check, Clock, X, Phone, Mail, Video, Users, CheckSquare, FileText, 
  Zap, AlertTriangle, Calendar, User, Building, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { SlideOverPanel } from '../../components/ui/SlideOverPanel';
import { useToast } from '../../components/ui/Toast';
import { NotionEditor } from '../../components/editor/NotionEditor';

interface Task {
  id: string;
  title: string;
  description?: string;
  assignee?: { id?: string; name: string; color?: string };
  contactId?: string;
  contact?: { id: string; firstName?: string; lastName?: string; name?: string };
  companyId?: string;
  company?: { id: string; name: string };
  dueDate?: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high' | string;
  status: 'pending' | 'completed' | string;
  type?: string;
  createdAt?: string;
}

export default function CrmTasks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [panelOpen, setPanelOpen] = useState<'new_task' | 'filter' | 'manage' | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  // Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    priority: 'medium',
    type: 'follow_up',
    contactId: '',
    companyId: ''
  });

  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);

  // Queries
  const { data: rawTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/api/crm/tasks').then(r => (r.ok ? r.json() : []))
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () => apiFetch('/api/crm/contacts').then(r => (r.ok ? r.json().then(d => d.contacts || d || []) : []))
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['companies'],
    queryFn: () => apiFetch('/api/crm/companies').then(r => (r.ok ? r.json() : []))
  });

  // Mutations
  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) {
        const text = await r.text();
        let msg = 'Failed to create task';
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setNewTask({ title: '', description: '', dueDate: '', dueTime: '', priority: 'medium', type: 'follow_up', contactId: '', companyId: '' });
      setPanelOpen(null);
      toast('success', 'Task created successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create task')
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await apiFetch(`/api/crm/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('Failed to update task');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
      toast('success', 'Task updated');
    }
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/crm/tasks/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete task');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteTaskId(null);
      toast('success', 'Task removed');
    }
  });

  const toggleStatus = (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask.mutate({ id: task.id, data: { status: nextStatus } });
  };

  // Filtered Tasks
  const processedTasks = useMemo(() => {
    let result = [...rawTasks];

    // Tab filter
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (activeTab === 'today') {
      result = result.filter(t => t.dueDate && t.dueDate.slice(0, 10) === todayStr && t.status !== 'completed');
    } else if (activeTab === 'upcoming') {
      result = result.filter(t => t.dueDate && t.dueDate.slice(0, 10) > todayStr && t.status !== 'completed');
    } else if (activeTab === 'completed') {
      result = result.filter(t => t.status === 'completed');
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const contact = `${t.contact?.firstName || ''} ${t.contact?.lastName || ''} ${t.contact?.name || ''}`.toLowerCase();
        return title.includes(q) || desc.includes(q) || contact.includes(q);
      });
    }

    // Custom Filters
    for (const f of filters) {
      if (!f.value && f.operator !== 'not_empty') continue;
      result = result.filter(t => {
        const val = String((t as any)[f.field] || '').toLowerCase();
        const target = f.value.toLowerCase().trim();
        if (f.operator === 'contains') return val.includes(target);
        if (f.operator === 'equals') return val === target;
        if (f.operator === 'starts_with') return val.startsWith(target);
        if (f.operator === 'not_empty') return val.trim().length > 0;
        return true;
      });
    }

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.field === 'dueDate') {
          const tA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const tB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return sortConfig.dir === 'asc' ? tA - tB : tB - tA;
        }
        const strA = String((a as any)[sortConfig.field] || '').toLowerCase();
        const strB = String((b as any)[sortConfig.field] || '').toLowerCase();
        return sortConfig.dir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rawTasks, activeTab, searchQuery, filters, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(processedTasks.length / pageSize));
  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedTasks.slice(start, start + pageSize);
  }, [processedTasks, page, pageSize]);

  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* Header Bar Portal matching Contacts design */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search Tasks..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-4 py-1.5 w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>

          <button onClick={() => setPanelOpen('new_task')} className="btn-primary">
            <Plus className="w-4 h-4" /> New Task
          </button>

          <div className="w-[1px] h-5 bg-border mx-1" />

          <button
            onClick={() => setPanelOpen('manage')}
            className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors ml-1"
          >
            <Settings className="w-4 h-4" /> Manage fields
          </button>
        </div>
      </HeaderPortal>

      {/* Tabs Row */}
      <div className="mx-8 mt-4 mb-2 flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/40 scrollbar-none shrink-0">
        {[
          { id: 'all', label: 'All Tasks', count: rawTasks.length },
          { id: 'today', label: 'Due Today', count: rawTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === new Date().toISOString().slice(0, 10) && t.status !== 'completed').length },
          { id: 'upcoming', label: 'Upcoming', count: rawTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) > new Date().toISOString().slice(0, 10) && t.status !== 'completed').length },
          { id: 'completed', label: 'Completed', count: rawTasks.filter(t => t.status === 'completed').length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-main hover:bg-surface-hover border border-border/40'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-surface-hover text-text-muted'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}

        <button
          onClick={() => setPanelOpen('filter')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-primary hover:bg-primary/10 transition-colors ml-auto shrink-0 border border-primary/30"
        >
          <Filter className="w-3.5 h-3.5" /> Custom Filter Rule
        </button>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-8 mt-2 mb-6 rounded-[10px] bg-surface/40 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/90 backdrop-blur-md shadow-sm">
              <tr>
                <th className="w-12 p-3 text-center text-text-muted font-bold text-[12px]">Status</th>
                <th className="p-3 text-[13px] font-bold text-text-muted">Task Title</th>
                <th className="p-3 text-[13px] font-bold text-text-muted">Associated Contact</th>
                <th className="p-3 text-[13px] font-bold text-text-muted">Due Date</th>
                <th className="p-3 text-[13px] font-bold text-text-muted">Priority</th>
                <th className="w-20 p-3 text-center text-text-muted font-bold text-[12px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-text-muted">
                    <CheckSquare className="w-10 h-10 mx-auto mb-2 text-text-muted/40" />
                    <p className="text-[14px] font-bold text-text-main">No tasks found</p>
                    <p className="text-[12px] text-text-muted mt-1">Create actionable follow-ups, calls, or milestones for your CRM.</p>
                    <button
                      onClick={() => setPanelOpen('new_task')}
                      className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm"
                    >
                      + New Task
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedTasks.map(t => {
                  const contactName = t.contact
                    ? `${t.contact.firstName || ''} ${t.contact.lastName || ''} ${t.contact.name || ''}`.trim()
                    : '—';
                  const isDone = t.status === 'completed';

                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-border/50 transition-colors hover:bg-surface-hover/50 ${
                        isDone ? 'bg-black/5 opacity-70' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleStatus(t)}
                          className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center cursor-pointer transition-colors ${
                            isDone
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'hover:border-primary text-transparent border-border bg-bg'
                          }`}
                        >
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </button>
                      </td>

                      <td className="p-3">
                        <div
                          onClick={() => setEditingTask(t)}
                          className="cursor-pointer group/title"
                        >
                          <span
                            className={`text-[13px] font-bold transition-colors group-hover/title:text-primary ${
                              isDone ? 'line-through text-text-muted' : 'text-text-main'
                            }`}
                          >
                            {t.title}
                          </span>
                          {t.description && (
                            <p className="text-[11px] text-text-muted truncate max-w-sm mt-0.5">{t.description}</p>
                          )}
                        </div>
                      </td>

                      <td className="p-3">
                        {contactName !== '—' ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                              {contactName[0]?.toUpperCase()}
                            </div>
                            <span className="text-[12px] font-semibold text-text-main truncate max-w-[140px]">{contactName}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-text-muted opacity-40">—</span>
                        )}
                      </td>

                      <td className="p-3">
                        {t.dueDate ? (
                          <div className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
                            <Clock className="w-3.5 h-3.5 text-primary" />
                            <span>{new Date(t.dueDate).toLocaleDateString()}</span>
                            {t.dueTime && <span className="text-[11px] text-text-muted/70">({t.dueTime})</span>}
                          </div>
                        ) : (
                          <span className="text-[12px] text-text-muted opacity-40">—</span>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            t.priority === 'high'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : t.priority === 'low'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {t.priority || 'medium'}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setEditingTask(t)}
                            className="p-1 text-text-muted hover:text-primary rounded transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTask.mutate(t.id)}
                            className="p-1 text-text-muted hover:text-red-400 rounded transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer matching Contacts design */}
      <div
        className="px-8 py-3.5 border-t flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0 shadow-lg"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setPanelOpen('filter')} className="btn-secondary">
            <Filter className="w-4 h-4 text-primary" /> Advanced filters
          </button>

          <div className="relative">
            <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="btn-secondary">
              <ChevronDown className="w-4 h-4" /> Sort
            </button>

            <AnimatePresence>
              {sortDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[200px] bg-surface border border-border shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {[
                      { label: 'Due Date: Earliest First', field: 'dueDate', dir: 'asc' },
                      { label: 'Due Date: Latest First', field: 'dueDate', dir: 'desc' },
                      { label: 'Title (A-Z)', field: 'title', dir: 'asc' },
                      { label: 'Title (Z-A)', field: 'title', dir: 'desc' },
                      { label: 'Priority (High to Low)', field: 'priority', dir: 'desc' },
                    ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setSortConfig({ field: opt.field, dir: opt.dir as 'asc' | 'desc' });
                          setSortDropdownOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                    {sortConfig && (
                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          onClick={() => {
                            setSortConfig(null);
                            setSortDropdownOpen(false);
                          }}
                          className="w-full flex items-center px-4 py-2 text-[13px] font-medium text-red-400 hover:bg-surface-hover transition-colors"
                        >
                          Clear Sort
                        </button>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[13px] font-medium text-text-muted">
            {processedTasks.length === 0
              ? '0 Tasks'
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, processedTasks.length)} of ${processedTasks.length} Tasks`}
          </span>

          <div className="flex items-center gap-1.5 font-semibold">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 text-[12px] font-bold text-text-main">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-[6px] border border-border text-[12px] font-medium text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ── SlideOver Panels ── */}
      <AnimatePresence>
        {panelOpen === 'new_task' && (
          <SlideOverPanel
            isOpen={true}
            onClose={() => setPanelOpen(null)}
            title="Create New Task"
            width="w-[460px]"
            footer={
              <>
                <button
                  onClick={() => setPanelOpen(null)}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  disabled={!newTask.title.trim() || createTask.isPending}
                  onClick={() => {
                    createTask.mutate({
                      title: newTask.title.trim(),
                      description: newTask.description || undefined,
                      dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : undefined,
                      dueTime: newTask.dueTime || undefined,
                      priority: newTask.priority,
                      type: newTask.type,
                      contactId: newTask.contactId || undefined,
                      companyId: newTask.companyId || undefined
                    });
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm disabled:opacity-50"
                >
                  {createTask.isPending ? 'Creating...' : 'Create Task'}
                </button>
              </>
            }
          >
            <div className="space-y-4 pb-6">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">
                  Task Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Follow up on proposal pricing"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Due Date</label>
                  <input
                    type="date"
                    value={newTask.dueDate}
                    onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-bold text-text-main">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">Associated Contact</label>
                <select
                  value={newTask.contactId}
                  onChange={e => setNewTask({ ...newTask, contactId: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
                >
                  <option value="">— No Contact —</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-text-main">Task Details</label>
                <textarea
                  placeholder="Additional context or notes..."
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary min-h-[90px] resize-y"
                />
              </div>
            </div>
          </SlideOverPanel>
        )}

        {panelOpen === 'filter' && (
          <SlideOverPanel
            isOpen={true}
            onClose={() => setPanelOpen(null)}
            title="Advanced Task Filters"
            width="w-[420px]"
            footer={
              <button
                onClick={() => setPanelOpen(null)}
                className="px-4 py-2 bg-primary text-white font-bold text-[13px] rounded-lg shadow-sm"
              >
                Apply Filters
              </button>
            }
          >
            <div className="space-y-4">
              <p className="text-[12px] text-text-muted">Filter tasks by priority, status, or title.</p>
              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={f.field}
                    onChange={e =>
                      setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))
                    }
                    className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                  >
                    <option value="title">Title</option>
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={f.operator}
                    onChange={e =>
                      setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, operator: e.target.value } : x)))
                    }
                    className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                  >
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value..."
                    value={f.value}
                    onChange={e =>
                      setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))
                    }
                    className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary min-w-0"
                  />
                  <button onClick={() => setFilters(prev => prev.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setFilters(prev => [...prev, { field: 'title', operator: 'contains', value: '' }])}
                className="w-full py-2 border-2 border-dashed border-border rounded-lg text-[12px] font-bold text-primary hover:bg-primary/5 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add filter rule
              </button>
            </div>
          </SlideOverPanel>
        )}
      </AnimatePresence>
    </div>
  );
}
