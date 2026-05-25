import { useState } from 'react';
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';

interface Props { contactId: string; }

const PRIORITY_STYLES: Record<string, string> = {
  high: 'text-red-400 bg-red-400/10 border-red-400/20',
  medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  low: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
};

export default function ContactTasksTab({ contactId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium', type: 'follow_up' });

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ['tasks', contactId],
    queryFn: () => fetch(`/api/crm/tasks?contactId=${contactId}`).then(r => r.ok ? r.json() : []),
  });

  const createTask = useMutation({
    mutationFn: (data: any) => fetch('/api/crm/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, contactId }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', contactId] }); setShowForm(false); setForm({ title: '', description: '', dueDate: '', priority: 'medium', type: 'follow_up' }); toast('success', 'Task created'); },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => fetch(`/api/crm/tasks/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', contactId] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => fetch(`/api/crm/tasks/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', contactId] }); toast('success', 'Task deleted'); },
  });

  const filtered = tasks.filter(t => filter === 'all' ? true : t.status === filter);
  const overdue = (t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(['all', 'pending', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-[12px] font-bold capitalize transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-bg border border-border text-text-muted hover:text-text-main'}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 transition-opacity">
          <Plus className="w-3.5 h-3.5" /> New Task
        </button>
      </div>

      {showForm && (
        <div className="bg-bg border border-border rounded-[10px] p-4 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title *"
            className="w-full bg-surface border border-border rounded-[6px] px-3 py-2 text-[13px] text-text-main focus:outline-none focus:border-primary" />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Due Date</label>
              <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="w-full bg-surface border border-border rounded-[6px] px-3 py-1.5 text-[12px] text-text-main focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                className="w-full bg-surface border border-border rounded-[6px] px-3 py-1.5 text-[12px] text-text-main focus:outline-none focus:border-primary">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1 block">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full bg-surface border border-border rounded-[6px] px-3 py-1.5 text-[12px] text-text-main focus:outline-none focus:border-primary">
                <option value="follow_up">Follow Up</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="demo">Demo</option>
              </select>
            </div>
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)"
            className="w-full bg-surface border border-border rounded-[6px] px-3 py-2 text-[12px] text-text-main focus:outline-none focus:border-primary resize-none min-h-[60px]" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-[12px] font-semibold text-text-muted hover:text-text-main transition-colors">Cancel</button>
            <button onClick={() => createTask.mutate(form)} disabled={!form.title || createTask.isPending}
              className="px-4 py-1.5 bg-primary text-white rounded-[6px] text-[12px] font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {createTask.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null} Create Task
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border/50">
              <div className="skeleton w-5 h-5 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="skeleton h-3 rounded" style={{ width: `${45 + i * 12}%` }} />
              </div>
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-[10px]">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-text-muted/30" />
          <p className="text-[13px] font-semibold text-text-muted">No {filter !== 'all' ? filter : ''} tasks yet</p>
          <p className="text-[12px] text-text-muted/60 mt-1">Create tasks to keep track of follow-ups</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task: any) => (
            <div key={task.id} className={`flex items-start gap-3 p-3.5 rounded-[8px] border transition-all group ${task.status === 'completed' ? 'bg-bg/50 border-border/50 opacity-60' : overdue(task) ? 'bg-red-500/5 border-red-500/20' : 'bg-bg border-border hover:border-primary/30'}`}>
              <button onClick={() => updateTask.mutate({ id: task.id, data: { status: task.status === 'completed' ? 'pending' : 'completed' } })}
                className="mt-0.5 shrink-0 transition-colors">
                {task.status === 'completed'
                  ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400" />
                  : <Circle className="w-4.5 h-4.5 text-text-muted hover:text-primary" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[13px] font-semibold ${task.status === 'completed' ? 'line-through text-text-muted' : 'text-text-main'}`}>{task.title}</span>
                  <span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold border capitalize ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>{task.priority}</span>
                  {overdue(task) && <span className="flex items-center gap-1 text-[10px] font-bold text-red-400"><AlertTriangle className="w-3 h-3" /> Overdue</span>}
                </div>
                {task.description && <p className="text-[12px] text-text-muted mt-0.5 truncate">{task.description}</p>}
                {task.dueDate && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-text-muted" />
                    <span className="text-[11px] text-text-muted">{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                )}
              </div>
              <button onClick={() => deleteTask.mutate(task.id)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-text-muted hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
