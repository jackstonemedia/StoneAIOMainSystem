import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../../types/crm';
import { WidgetShell } from '../WidgetShell';

interface TasksWidgetProps {
  isEditing?: boolean;
  onRemove?: () => void;
}

type Tab = 'all' | 'today' | 'overdue';

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d < now && !isToday(dateStr);
}

function formatDueBadge(t: Task): { label: string; cls: string } {
  if (!t.dueDate) return { label: 'No due date', cls: 'bg-surface text-text-muted border-border' };
  if (isToday(t.dueDate)) return { label: 'Today', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  if (isOverdue(t.dueDate)) return { label: 'Overdue', cls: 'bg-red-500/10 text-red-400 border-red-500/30' };
  return { label: 'Upcoming', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
}

export function TasksWidget({ isEditing, onRemove }: TasksWidgetProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('today');
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['dashboard_tasks'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tasks');
      if (!res.ok) return [];
      const body = await res.json();
      return Array.isArray(body) ? body : body.tasks ?? [];
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const res = await fetch(`/api/crm/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard_tasks'] }),
  });

  const createTask = useMutation({
    mutationFn: async (title: string) => {
      const now = new Date();
      const body = {
        title,
        description: '',
        type: 'task',
        priority: 'medium',
        dueDate: now.toISOString(),
      };
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => {
      setNewTitle('');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['dashboard_tasks'] });
    },
  });

  const filtered = tasks.filter((t) => {
    if (tab === 'all') return true;
    if (tab === 'today') return isToday(t.dueDate) || t.status === 'pending';
    if (tab === 'overdue') return isOverdue(t.dueDate ?? null);
    return true;
  });

  const handleToggle = (t: Task) => {
    updateTask.mutate({ id: t.id, data: { status: t.status === 'completed' ? 'pending' : 'completed' } });
  };

  const actions = (
    <button
      type="button"
      className="text-[12px] text-primary hover:text-primary/80 font-medium"
      onClick={() => navigate('/crm/tasks')}
    >
      View all tasks →
    </button>
  );

  return (
    <WidgetShell
      title="Tasks"
      subtitle="Today's focus"
      isEditing={isEditing}
      onRemove={onRemove}
      actions={actions}
      noPadding
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 text-[12px]">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: 'overdue', label: 'Overdue' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded-full border text-[12px] font-medium transition-colors ${
                tab === t.id
                  ? 'bg-primary/10 border-primary text-text-main'
                  : 'bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-main"
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      <div className="p-4 space-y-2 max-h-full overflow-y-auto">
        {adding && (
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  createTask.mutate(newTitle.trim());
                }
              }}
              placeholder="New task title..."
              className="flex-1 rounded-lg border border-border bg-surface-hover px-3 py-1.5 text-[13px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => newTitle.trim() && createTask.mutate(newTitle.trim())}
              className="px-3 py-1.5 rounded-lg bg-primary text-[12px] font-medium text-bg hover:bg-primary/90"
            >
              Save
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 rounded-lg bg-surface-hover animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-[13px] text-text-muted">
            <div className="w-8 h-8 rounded-full border border-border flex items-center justify-center mb-2">
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
            <div>All clear for today</div>
          </div>
        ) : (
          filtered.slice(0, 8).map((t) => {
            const { label, cls } = formatDueBadge(t);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/60 bg-surface/60 hover:bg-surface-hover transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    t.status === 'completed'
                      ? 'bg-emerald-500 border-emerald-500 text-bg'
                      : 'border-border bg-bg hover:border-primary'
                  }`}
                >
                  {t.status === 'completed' && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[13px] font-medium truncate ${
                      t.status === 'completed' ? 'text-text-muted/70 line-through' : 'text-text-main'
                    }`}
                  >
                    {t.title}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full border text-[11px] font-medium whitespace-nowrap ${cls}`}
                >
                  {label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </WidgetShell>
  );
}
