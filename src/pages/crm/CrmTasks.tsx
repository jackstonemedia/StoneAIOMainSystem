import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Filter, ChevronDown, Search, Settings, Edit2, Trash2,
  Check, Clock, X, Phone, Mail, Video, Users, CheckSquare, FileText,
  Zap, Calendar, User, Building, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/apiClient';
import { HeaderPortal } from '../../components/layout/HeaderPortal';
import { SlideOverPanel } from '../../components/ui/SlideOverPanel';
import { ConfirmDelete } from '../../components/ui/ConfirmDelete';
import { useToast } from '../../components/ui/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_COLUMNS = ['Status', 'Task Title', 'Contact', 'Company', 'Due Date', 'Priority', 'Type'] as const;
type ColumnName = (typeof ALL_COLUMNS)[number];

const TASK_TYPES = [
  { value: 'follow_up', label: 'Follow Up', icon: FileText },
  { value: 'call',      label: 'Call',       icon: Phone },
  { value: 'email',     label: 'Email',      icon: Mail },
  { value: 'meeting',   label: 'Meeting',    icon: Video },
  { value: 'demo',      label: 'Demo',       icon: Users },
  { value: 'task',      label: 'Task',       icon: Zap },
] as const;

const EMPTY_FORM = {
  title: '',
  description: '',
  dueDate: '',
  dueTime: '',
  priority: 'medium',
  type: 'follow_up',
  contactId: '',
  companyId: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contactDisplayName(c: any) {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email || c.id;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CrmTasks() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Tabs & filters ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'upcoming' | 'completed'>('all');
  const [panelOpen, setPanelOpen] = useState<'new_task' | 'edit_task' | 'filter' | 'manage' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ field: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<{ field: string; operator: string; value: string }[]>([]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pageSizeDropdownOpen, setPageSizeDropdownOpen] = useState(false);

  // ── Column visibility ─────────────────────────────────────────────────────
  const [visibleCols, setVisibleCols] = useState<Set<ColumnName>>(
    new Set(['Status', 'Task Title', 'Contact', 'Due Date', 'Priority'])
  );

  // ── Row selection ─────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Delete confirmation ───────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // ── Edit task ─────────────────────────────────────────────────────────────
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // ── Create / Edit form state ──────────────────────────────────────────────
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Searchable contact combobox
  const [contactSearch, setContactSearch] = useState('');
  const [contactDropOpen, setContactDropOpen] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  // Close contact dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: rawTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => apiFetch('/api/crm/tasks').then(r => (r.ok ? r.json() : [])),
  });

  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ['contacts'],
    queryFn: () =>
      apiFetch('/api/crm/contacts').then(r =>
        r.ok ? r.json().then((d: any) => d.contacts || d || []) : []
      ),
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ['companies'],
    queryFn: () => apiFetch('/api/crm/companies').then(r => (r.ok ? r.json() : [])),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const r = await apiFetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
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
      setForm({ ...EMPTY_FORM });
      setContactSearch('');
      setPanelOpen(null);
      toast('success', 'Task created successfully');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to create task'),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const r = await apiFetch(`/api/crm/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error('Failed to update task');
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
      setForm({ ...EMPTY_FORM });
      setContactSearch('');
      setPanelOpen(null);
      toast('success', 'Task updated');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to update task'),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiFetch(`/api/crm/tasks/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed to delete task');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setDeleteTarget(null);
      setSelected(new Set());
      toast('success', 'Task deleted');
    },
    onError: (err: any) => toast('error', err.message || 'Failed to delete task'),
  });

  const bulkDeleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map(id =>
          apiFetch(`/api/crm/tasks/${id}`, { method: 'DELETE' }).then(r => {
            if (!r.ok) throw new Error(`Delete ${id} failed`);
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSelected(new Set());
      toast('success', 'Tasks deleted');
    },
    onError: (err: any) => toast('error', err.message || 'Bulk delete failed'),
  });

  const bulkComplete = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map(id =>
          apiFetch(`/api/crm/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' }),
          })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSelected(new Set());
      toast('success', 'Tasks marked complete');
    },
  });

  const toggleStatus = (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTask.mutate({ id: task.id, data: { status: nextStatus } });
  };

  // ── Open edit panel ───────────────────────────────────────────────────────
  const openEdit = (task: Task) => {
    setEditingTask(task);
    const contactObj = contacts.find((c: any) => c.id === task.contactId);
    setContactSearch(contactObj ? contactDisplayName(contactObj) : '');
    setForm({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      dueTime: task.dueTime || '',
      priority: task.priority || 'medium',
      type: task.type || 'follow_up',
      contactId: task.contactId || '',
      companyId: task.companyId || '',
    });
    setPanelOpen('edit_task');
  };

  // ── Open create panel ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingTask(null);
    setForm({ ...EMPTY_FORM });
    setContactSearch('');
    setPanelOpen('new_task');
  };

  // ── Submit form ───────────────────────────────────────────────────────────
  const submitForm = () => {
    const payload = {
      title: form.title.trim(),
      description: form.description || undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      dueTime: form.dueTime || undefined,
      priority: form.priority,
      type: form.type,
      contactId: form.contactId || undefined,
      companyId: form.companyId || undefined,
    };
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, data: payload });
    } else {
      createTask.mutate(payload);
    }
  };

  // ── Filtered & processed tasks ────────────────────────────────────────────
  const processedTasks = useMemo(() => {
    let result = [...rawTasks];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (activeTab === 'today') {
      result = result.filter(t => t.dueDate && t.dueDate.slice(0, 10) === todayStr && t.status !== 'completed');
    } else if (activeTab === 'upcoming') {
      result = result.filter(t => t.dueDate && t.dueDate.slice(0, 10) > todayStr && t.status !== 'completed');
    } else if (activeTab === 'completed') {
      result = result.filter(t => t.status === 'completed');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const contact = `${t.contact?.firstName || ''} ${t.contact?.lastName || ''} ${t.contact?.name || ''}`.toLowerCase();
        return title.includes(q) || desc.includes(q) || contact.includes(q);
      });
    }

    for (const f of filters) {
      if (!f.value && f.operator !== 'not_empty') continue;
      result = result.filter(t => {
        const val = String((t as any)[f.field] || '').toLowerCase();
        const target = f.value.toLowerCase().trim();
        if (f.operator === 'contains') return val.includes(target);
        if (f.operator === 'equals') return val === target;
        if (f.operator === 'not_empty') return val.trim().length > 0;
        return true;
      });
    }

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

  // Tab counts
  const tabCounts = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    return {
      all: rawTasks.length,
      today: rawTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === todayStr && t.status !== 'completed').length,
      upcoming: rawTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) > todayStr && t.status !== 'completed').length,
      completed: rawTasks.filter(t => t.status === 'completed').length,
    };
  }, [rawTasks]);

  const totalPages = Math.max(1, Math.ceil(processedTasks.length / pageSize));
  const paginatedTasks = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedTasks.slice(start, start + pageSize);
  }, [processedTasks, page, pageSize]);

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allPageSelected = paginatedTasks.length > 0 && paginatedTasks.every(t => selected.has(t.id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        paginatedTasks.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        paginatedTasks.forEach(t => next.add(t.id));
        return next;
      });
    }
  };
  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered contact list for searchable combobox
  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    return contacts.filter((c: any) => contactDisplayName(c).toLowerCase().includes(q));
  }, [contacts, contactSearch]);

  // ── Shared form panel body ────────────────────────────────────────────────
  const renderFormBody = () => (
    <div className="space-y-4 pb-6">
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold text-text-main">
          Task Title <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Follow up on proposal pricing"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
        />
      </div>

      {/* Due Date + Priority */}
      <div className="grid grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold text-text-main">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[12px] font-bold text-text-main">Priority</label>
          <select
            value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value })}
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      {/* Type */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold text-text-main">Task Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TASK_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm({ ...form, type: value })}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px] font-semibold transition-colors ${
                form.type === value
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-surface-hover border-border text-text-muted hover:text-text-main hover:border-border/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Associated Contact — searchable combobox */}
      <div className="space-y-1.5" ref={contactRef}>
        <label className="text-[12px] font-bold text-text-main">Associated Contact</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search contacts..."
            value={contactSearch}
            onFocus={() => setContactDropOpen(true)}
            onChange={e => {
              setContactSearch(e.target.value);
              setForm({ ...form, contactId: '' });
              setContactDropOpen(true);
            }}
            className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
          />
          {form.contactId && (
            <button
              type="button"
              onClick={() => { setForm({ ...form, contactId: '' }); setContactSearch(''); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <AnimatePresence>
            {contactDropOpen && filteredContacts.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-luxury max-h-48 overflow-y-auto"
              >
                <li>
                  <button
                    type="button"
                    onClick={() => { setForm({ ...form, contactId: '' }); setContactSearch(''); setContactDropOpen(false); }}
                    className="w-full text-left px-3 py-2 text-[12px] text-text-muted hover:bg-surface-hover"
                  >
                    — No Contact —
                  </button>
                </li>
                {filteredContacts.map((c: any) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, contactId: c.id });
                        setContactSearch(contactDisplayName(c));
                        setContactDropOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-[12px] text-text-main hover:bg-surface-hover font-medium"
                    >
                      {contactDisplayName(c)}
                      {c.email && <span className="text-text-muted ml-1">({c.email})</span>}
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Associated Company */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold text-text-main">Associated Company</label>
        <select
          value={form.companyId}
          onChange={e => setForm({ ...form, companyId: e.target.value })}
          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary font-medium"
        >
          <option value="">— No Company —</option>
          {companies.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Task Details */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-bold text-text-main">Task Details</label>
        <textarea
          placeholder="Additional context or notes..."
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 bg-surface-hover border border-border rounded-lg text-[13px] text-text-main focus:outline-none focus:border-primary min-h-[90px] resize-y"
        />
      </div>
    </div>
  );

  const isPending = createTask.isPending || updateTask.isPending;
  const isEdit = panelOpen === 'edit_task';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full w-full relative bg-bg overflow-hidden">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      {/* ── Header Bar ── */}
      <HeaderPortal>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input
              type="text"
              placeholder="Search Tasks..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-1.5 w-[220px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] hover:border-primary/50 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>

          <button onClick={openCreate} className="btn-secondary">
            <Plus className="w-4 h-4" /> New Task
          </button>

          <div className="w-[1px] h-5 bg-border mx-1" />

          <button
            onClick={() => setPanelOpen('manage')}
            className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-main transition-colors ml-1"
          >
            <Settings className="w-4 h-4" /> Manage Columns
          </button>
        </div>
      </HeaderPortal>

      {/* ── Bulk Actions Bar ── */}
      <AnimatePresence mode="wait" initial={false}>
        {selected.size > 0 && (
          <motion.div
            key="bulk-toolbar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 73 }}
            exit={{ opacity: 0, height: 0 }}
            className="px-8 flex items-center justify-between border-b border-border bg-surface-hover/50 relative shadow-sm w-full overflow-hidden"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-[6px]">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span className="text-[13px] font-bold text-primary">{selected.size} Selected</span>
                </div>
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-[12px] font-medium text-text-muted hover:text-text-main transition-colors"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkComplete.mutate(Array.from(selected))}
                  className="flex items-center gap-2 px-4 py-2 border border-border bg-surface-hover rounded-[8px] text-[13px] font-semibold text-text-main hover:bg-surface transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" /> Mark Complete
                </button>
                <div className="w-[1px] h-6 bg-border mx-1" />
                <button
                  onClick={() => bulkDeleteTasks.mutate(Array.from(selected))}
                  className="flex items-center gap-2 px-4 py-2 border border-red-500/30 bg-red-500/10 rounded-[8px] text-[13px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs Row ── */}
      <div className="px-8 pt-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1">
          {(['all', 'today', 'upcoming', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
              }`}
            >
              {tab === 'all' && 'All Tasks'}
              {tab === 'today' && 'Due Today'}
              {tab === 'upcoming' && 'Upcoming'}
              {tab === 'completed' && 'Completed'}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-surface text-text-muted'
              }`}>
                {tabCounts[tab]}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setPanelOpen('filter')}
          className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted hover:text-text-main border border-border hover:border-border/80 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Filter className="w-3.5 h-3.5" /> Custom Filter Rule
          {filters.length > 0 && (
            <span className="ml-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {filters.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main Table ── */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-auto mx-8 mt-4 mb-6 rounded-[8px] bg-transparent border border-border/50 shadow-luxury ring-1 ring-white/5 relative z-10 flex flex-col">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
              <tr>
                {/* Select-all checkbox */}
                <th className="w-10 p-3 text-center">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded text-primary accent-primary"
                  />
                </th>
                {visibleCols.has('Status') && (
                  <th className="w-12 p-3 text-center text-text-muted font-bold text-[12px]">Status</th>
                )}
                {visibleCols.has('Task Title') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Task Title</th>
                )}
                {visibleCols.has('Contact') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Contact</th>
                )}
                {visibleCols.has('Company') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Company</th>
                )}
                {visibleCols.has('Due Date') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Due Date</th>
                )}
                {visibleCols.has('Priority') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Priority</th>
                )}
                {visibleCols.has('Type') && (
                  <th className="p-3 text-[13px] font-bold text-text-muted">Type</th>
                )}
                <th className="w-20 p-3 text-center text-text-muted font-bold text-[12px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-text-muted">
                    <CheckSquare className="w-10 h-10 mx-auto mb-2 text-text-muted/40" />
                    <p className="text-[14px] font-bold text-text-main">No tasks found</p>
                    <p className="text-[12px] text-text-muted mt-1">
                      Create actionable follow-ups, calls, or milestones for your CRM.
                    </p>
                    <button
                      onClick={openCreate}
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
                  const isSelected = selected.has(t.id);

                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-border/50 transition-colors hover:bg-surface-hover/50 ${
                        isDone ? 'opacity-60' : ''
                      } ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      {/* Row checkbox */}
                      <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(t.id)}
                          className="w-3.5 h-3.5 rounded text-primary accent-primary"
                        />
                      </td>

                      {/* Status toggle */}
                      {visibleCols.has('Status') && (
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
                      )}

                      {/* Task Title */}
                      {visibleCols.has('Task Title') && (
                        <td className="p-3">
                          <div onClick={() => openEdit(t)} className="cursor-pointer group/title">
                            <span
                              className={`text-[13px] font-bold transition-colors group-hover/title:text-primary ${
                                isDone ? 'line-through text-text-muted' : 'text-text-main'
                              }`}
                            >
                              {t.title}
                            </span>
                            {t.description && (
                              <p className="text-[11px] text-text-muted truncate max-w-sm mt-0.5">
                                {t.description}
                              </p>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Contact */}
                      {visibleCols.has('Contact') && (
                        <td className="p-3">
                          {contactName !== '—' ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                                {contactName[0]?.toUpperCase()}
                              </div>
                              <span className="text-[12px] font-semibold text-text-main truncate max-w-[140px]">
                                {contactName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-muted opacity-40">—</span>
                          )}
                        </td>
                      )}

                      {/* Company */}
                      {visibleCols.has('Company') && (
                        <td className="p-3">
                          {t.company ? (
                            <div className="flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-text-muted shrink-0" />
                              <span className="text-[12px] font-medium text-text-main truncate max-w-[120px]">
                                {t.company.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[12px] text-text-muted opacity-40">—</span>
                          )}
                        </td>
                      )}

                      {/* Due Date */}
                      {visibleCols.has('Due Date') && (
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
                      )}

                      {/* Priority */}
                      {visibleCols.has('Priority') && (
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
                      )}

                      {/* Type */}
                      {visibleCols.has('Type') && (
                        <td className="p-3">
                          {(() => {
                            const typeDef = TASK_TYPES.find(x => x.value === t.type);
                            const Icon = typeDef?.icon ?? FileText;
                            return (
                              <div className="flex items-center gap-1.5 text-[12px] text-text-muted font-medium">
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span>{typeDef?.label ?? (t.type || 'Follow Up')}</span>
                              </div>
                            );
                          })()}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEdit(t)}
                            className="p-1 text-text-muted hover:text-primary rounded transition-colors"
                            title="Edit task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: t.id, title: t.title })}
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

      {/* ── Footer ── */}
      <div
        className="pr-8 pl-8 py-4 border-t flex items-center justify-between text-[13px] shrink-0 z-20 sticky bottom-0 shadow-[0_-4px_16px_rgba(0,0,0,0.1)]"
        style={{
          background: 'var(--sidebar-bg)',
          borderColor: 'var(--sidebar-border)',
          color: 'var(--sidebar-text-main)',
          '--text-main': '#ffffff',
          '--text-muted': '#94a3b8',
          '--border': 'rgba(255,255,255,0.15)',
          '--surface': 'rgba(255,255,255,0.1)',
          '--surface-hover': 'rgba(255,255,255,0.16)',
          '--bg': 'var(--sidebar-bg)',
          '--btn-bg': 'var(--primary)',
          '--btn-hover': 'var(--primary-hover)',
          '--btn-text': '#ffffff',
          '--btn-border': 'transparent',
        } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <button onClick={() => setPanelOpen('filter')} className="btn-secondary">
            <Filter className="w-4 h-4 text-white" /> Advanced filters
          </button>

          {/* Sort dropdown */}
          <div className="relative">
            <button onClick={() => setSortDropdownOpen(!sortDropdownOpen)} className="btn-secondary">
              <ChevronDown className="w-4 h-4" /> Sort
              {sortConfig && <span className="ml-1 w-2 h-2 rounded-full bg-primary inline-block" />}
            </button>
            <AnimatePresence>
              {sortDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSortDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute left-0 bottom-full mb-2 w-[210px] bg-surface border border-border shadow-luxury rounded-xl overflow-hidden py-1 z-50 ring-1 ring-white/5"
                  >
                    {[
                      { label: 'Due Date: Earliest First', field: 'dueDate', dir: 'asc' },
                      { label: 'Due Date: Latest First',  field: 'dueDate', dir: 'desc' },
                      { label: 'Title (A–Z)',             field: 'title',   dir: 'asc' },
                      { label: 'Title (Z–A)',             field: 'title',   dir: 'desc' },
                      { label: 'Priority (High → Low)',   field: 'priority', dir: 'desc' },
                    ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => { setSortConfig({ field: opt.field, dir: opt.dir as 'asc' | 'desc' }); setSortDropdownOpen(false); }}
                        className={`w-full flex items-center px-4 py-2 text-[13px] font-medium hover:bg-surface-hover transition-colors ${
                          sortConfig?.field === opt.field && sortConfig?.dir === opt.dir
                            ? 'text-primary'
                            : 'text-text-muted hover:text-text-main'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    {sortConfig && (
                      <div className="border-t border-border mt-1 pt-1">
                        <button
                          onClick={() => { setSortConfig(null); setSortDropdownOpen(false); }}
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
          {/* Page size selector */}
          <div className="relative">
            <button
              onClick={() => setPageSizeDropdownOpen(!pageSizeDropdownOpen)}
              className="flex items-center gap-1.5 border border-border rounded-lg px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main text-[12px]"
            >
              <span>{pageSize} / page</span>
              <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <AnimatePresence>
              {pageSizeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPageSizeDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute right-0 bottom-full mb-1 w-32 bg-surface border border-border rounded-lg shadow-xl py-1 z-50"
                  >
                    {[10, 20, 30, 50].map(size => (
                      <button
                        key={size}
                        onClick={() => { setPageSize(size); setPage(1); setPageSizeDropdownOpen(false); }}
                        className={`w-full px-3 py-1.5 text-[12px] font-semibold text-left flex items-center justify-between hover:bg-surface-hover transition-colors ${
                          pageSize === size ? 'bg-primary/10 text-primary font-bold' : 'text-text-main'
                        }`}
                      >
                        <span>{size} tasks</span>
                        {pageSize === size && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

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
        {/* Create / Edit Task Panel */}
        {(panelOpen === 'new_task' || panelOpen === 'edit_task') && (
          <SlideOverPanel
            isOpen={true}
            onClose={() => { setPanelOpen(null); setEditingTask(null); setForm({ ...EMPTY_FORM }); setContactSearch(''); }}
            title={isEdit ? 'Edit Task' : 'Create New Task'}
            width="w-[480px]"
            footer={
              <>
                <button
                  onClick={() => { setPanelOpen(null); setEditingTask(null); setForm({ ...EMPTY_FORM }); setContactSearch(''); }}
                  className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  disabled={!form.title.trim() || isPending}
                  onClick={submitForm}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Task' : 'Create Task')}
                </button>
              </>
            }
          >
            {renderFormBody()}
          </SlideOverPanel>
        )}

        {/* Filter Panel */}
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
                Done
              </button>
            }
          >
            <div className="space-y-4">
              <p className="text-[12px] text-text-muted">Filters apply live as you edit them.</p>
              {filters.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={f.field}
                    onChange={e => setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))}
                    className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                  >
                    <option value="title">Title</option>
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                    <option value="type">Type</option>
                  </select>
                  <select
                    value={f.operator}
                    onChange={e => setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, operator: e.target.value } : x)))}
                    className="bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary"
                  >
                    <option value="contains">Contains</option>
                    <option value="equals">Equals</option>
                    <option value="not_empty">Not Empty</option>
                  </select>
                  {f.operator !== 'not_empty' && (
                    <input
                      type="text"
                      placeholder="Value..."
                      value={f.value}
                      onChange={e => setFilters(prev => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                      className="flex-1 bg-surface-hover border border-border text-text-main text-[12px] rounded-[6px] px-2 py-1.5 outline-none focus:border-primary min-w-0"
                    />
                  )}
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
              {filters.length > 0 && (
                <button
                  onClick={() => setFilters([])}
                  className="w-full py-1.5 text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </SlideOverPanel>
        )}

        {/* Manage Columns Panel */}
        {panelOpen === 'manage' && (
          <SlideOverPanel
            isOpen={true}
            onClose={() => setPanelOpen(null)}
            title="Manage Columns"
            width="w-[340px]"
            footer={
              <button
                onClick={() => setPanelOpen(null)}
                className="px-4 py-2 bg-primary text-white font-bold text-[13px] rounded-lg shadow-sm"
              >
                Done
              </button>
            }
          >
            <div className="space-y-2">
              <p className="text-[12px] text-text-muted mb-4">
                Toggle which columns are visible in the task table.
              </p>
              {ALL_COLUMNS.map(col => (
                <div
                  key={col}
                  onClick={() => {
                    const next = new Set(visibleCols);
                    if (next.has(col)) next.delete(col);
                    else next.add(col);
                    setVisibleCols(next);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[6px] transition-colors border cursor-pointer ${
                    visibleCols.has(col)
                      ? 'bg-surface-hover border-border'
                      : 'border-transparent hover:bg-surface-hover/50 hover:border-border/50'
                  }`}
                >
                  <CheckSquare className={`w-4 h-4 ${visibleCols.has(col) ? 'text-primary' : 'text-text-muted/30'}`} />
                  <span className={`text-[13px] font-medium ${visibleCols.has(col) ? 'text-text-main' : 'text-text-muted'}`}>
                    {col}
                  </span>
                </div>
              ))}
            </div>
          </SlideOverPanel>
        )}
      </AnimatePresence>

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDelete
        isOpen={!!deleteTarget}
        title={`Delete "${deleteTarget?.title ?? 'task'}"`}
        message="This task will be permanently deleted. This action cannot be undone."
        isLoading={deleteTask.isPending}
        onConfirm={() => deleteTarget && deleteTask.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
