import { useState } from 'react';
import { Plus, Filter, ChevronDown, Search, Settings, Edit2, Trash2, Check, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: { name: string; color: string };
  contact: { name: string; color: string };
  dueDate: string;
  status: 'pending' | 'completed';
}

export default function CrmTasks() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [panelOpen, setPanelOpen] = useState<'new_task' | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '' });

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => fetch('/api/crm/tasks').then(r => r.ok ? r.json() : []),
  });



  const createTask = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch('/api/crm/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const r = await fetch(`/api/crm/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const toggleStatus = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    updateTask.mutate({ id, data: { status: task.status === 'pending' ? 'completed' : 'pending' } });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
          <div className="text-text-muted font-medium text-sm animate-pulse">Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-bg">
      {/* Header section removed */}

      {/* Unified Toolbar */}
      <div className="px-8 flex items-center justify-between border-b border-border bg-surface relative shadow-[0_4px_16px_rgba(0,0,0,0.03)] h-[73px]">
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'today', label: 'Due Today' },
            { id: 'upcoming', label: 'Upcoming' },
          ].map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full cursor-pointer transition-colors border ${
                activeTab === tab.id ? 'bg-bg border-border text-text-main shadow-sm font-bold' : 'border-transparent text-text-muted hover:text-text-main hover:bg-surface-hover font-medium'
              }`}
            >
              <span className="text-[13px]">{tab.label}</span>
            </div>
          ))}
          <div className="w-[1px] h-5 bg-border mx-2"></div>
          <div className="px-4 py-1.5 bg-surface-hover border border-border rounded-full flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors min-w-[130px] ml-1">
            <span className="text-[13px] font-medium text-text-muted">Assignee: <span className="text-text-main">Any</span></span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="px-4 py-1.5 bg-surface-hover border border-border rounded-full flex items-center justify-between cursor-pointer hover:border-primary/40 transition-colors min-w-[130px]">
            <span className="text-[13px] font-medium text-text-muted">Status: <span className="text-text-main">Any</span></span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <button className="flex items-center gap-2 px-4 py-1.5 bg-bg border border-border rounded-full text-[13px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm">
            <Filter className="w-3.5 h-3.5" /> More
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative shadow-sm rounded-full flex items-center mr-2">
            <Search className="w-4 h-4 absolute left-3 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              className="pl-9 pr-4 py-1.5 w-[200px] border border-border bg-surface-hover text-text-main rounded-full text-[13px] focus:outline-none focus:border-primary transition-all placeholder:text-text-muted"
            />
          </div>
          <button onClick={() => setPanelOpen('new_task')} className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-[4px] text-[13px] font-medium text-text-muted hover:text-text-main transition-colors shadow-sm bg-surface active:scale-95">
            <Plus className="w-4 h-4" /> New Task
          </button>
          <div className="w-[1px] h-5 bg-border mx-1"></div>
          <button className="flex items-center gap-2 text-[13px] px-3 py-1.5 font-medium text-text-muted hover:text-text-main transition-colors border border-border rounded-[4px] bg-surface shadow-sm">
            <Settings className="w-4 h-4" /> Manage
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto mx-8 mt-6 mb-6 rounded-[8px] bg-surface/30 backdrop-blur-xl border border-border/50 shadow-luxury ring-1 ring-white/5">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-border/50 bg-surface/80 backdrop-blur-md shadow-sm">
            <tr>
              <th className="w-12 p-3 text-[13px] font-semibold whitespace-nowrap text-center text-text-muted">Status</th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Title <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Description <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Associated Contacts</th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">Assignee</th>
              <th className="p-3 text-[13px] font-semibold whitespace-nowrap text-text-muted">
                <div className="flex items-center justify-between">Due Date (EDT) <ChevronDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100 cursor-pointer transition-opacity" /></div>
              </th>
              <th className="w-24 p-3 text-[13px] font-semibold whitespace-nowrap text-center text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-border/50 transition-colors hover:bg-surface-hover/50">
                <td className="p-3 text-center">
                  <div 
                    onClick={() => toggleStatus(t.id)}
                    className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center cursor-pointer transition-colors ${
                      t.status === 'completed' ? 'bg-accent-green border-accent-green text-bg' : 'hover:border-primary text-transparent border-border bg-bg'
                    }`}
                  >
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </div>
                </td>
                <td className="p-3">
                  <span className={`text-[13px] font-semibold transition-colors cursor-pointer hover:text-primary ${
                    t.status === 'completed' ? 'text-text-muted/60 line-through' : 'text-text-main'
                  }`}>
                    {t.title}
                  </span>
                </td>
                <td className="p-3 text-[13px] font-medium text-text-muted truncate max-w-[200px]">{t.description}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-bg uppercase shadow-sm" style={{ backgroundColor: t.contact?.color || '#52677D' }}>
                      {(t.contact?.name || 'TB').substring(0, 2)}
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-bg uppercase shadow-sm" style={{ backgroundColor: t.assignee?.color || '#52677D' }}>
                      {(t.assignee?.name || 'Un').substring(0, 2)}
                    </div>
                    <span className="text-[13px] font-medium text-text-main">{t.assignee?.name || 'Unassigned'}</span>
                  </div>
                </td>
                <td className="p-3 text-[13px] font-medium whitespace-nowrap text-text-main">
                  <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-text-muted" />{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</div>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-3">
                    <button className="transition-all text-text-muted hover:text-primary"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => deleteTask.mutate(t.id)} className="transition-all text-text-muted hover:text-accent-red"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer Paginator */}
      <div className="px-8 py-4 border-t border-border bg-surface flex items-center justify-between text-[13px] shrink-0 z-10 sticky bottom-0">
        <div className="font-semibold text-text-muted flex items-center gap-3">
          Page 1 of 1
          <div className="w-[1px] h-4 bg-border"></div>
          <span className="px-2.5 py-0.5 rounded-[4px] text-[13px] font-medium bg-bg text-text-main shadow-sm border border-border flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60"></span>
            {tasks.length} Tasks
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 border border-border rounded-[4px] px-2.5 py-1.5 cursor-pointer font-semibold hover:border-primary/50 transition-colors bg-bg text-text-main">
            20 <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="flex items-center gap-1.5 font-semibold">
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Prev</button>
            <button className="px-3.5 py-1.5 rounded-[4px] shadow-sm text-bg font-bold" style={{ backgroundColor: 'var(--primary)' }}>1</button>
            <button className="px-3 py-1.5 transition-colors text-text-muted hover:text-text-main">Next</button>
          </div>
        </div>
      </div>

      {/* Slide-over Panels */}
      <AnimatePresence>
        {panelOpen === 'new_task' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[2px]"
              onClick={() => setPanelOpen(null)} 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[400px] bg-surface shadow-2xl z-50 flex flex-col border-l border-border"
            >
              <div className="px-6 py-5 flex items-center justify-between border-b border-border bg-surface-hover/50">
                <h2 className="text-[16px] font-bold text-text-main">
                  Create New Task
                </h2>
                <button onClick={() => setPanelOpen(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text-main transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex-1 overflow-auto bg-surface">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Title</label>
                    <input type="text" placeholder="Task Title" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Description</label>
                    <textarea placeholder="Describe the task..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary min-h-[100px] resize-y" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Assignee</label>
                    <div className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main flex items-center justify-between cursor-pointer">
                      <span>Select Assignee...</span>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Due Date</label>
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="w-full px-3 py-2 bg-surface-hover border border-border rounded-[6px] text-[13px] text-text-main focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-border flex justify-end gap-3 bg-surface-hover/50 shrink-0">
                <button onClick={() => setPanelOpen(null)} className="px-4 py-2 rounded-[6px] text-[13px] font-semibold text-text-main border border-border hover:bg-surface-hover transition-colors">Cancel</button>
                <button 
                  onClick={async () => {
                    if (newTask.title) {
                      await createTask.mutateAsync({
                        title: newTask.title,
                        description: newTask.description,
                        dueDate: newTask.dueDate || null,
                      });
                      setNewTask({ title: '', description: '', dueDate: '' });
                      setPanelOpen(null);
                    }
                  }}
                  style={{ backgroundColor: 'var(--primary)' }} className="px-5 py-2 text-white rounded-[6px] text-[13px] font-semibold font-medium">
                  Create Task
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
